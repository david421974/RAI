#!/bin/bash

docker logs rasa_server 2> traza.txt

# Comprobamos que se ha pasado un archivo por argumento. Si no, usa traza.txt por defecto.
ARCHIVO_TRAZA=${1:-traza.txt}

if [ ! -f "$ARCHIVO_TRAZA" ]; then
  echo "❌ Error: No se ha encontrado el archivo '$ARCHIVO_TRAZA'."
  exit 1
fi

echo "🔍 Analizando el archivo de trazas: $ARCHIVO_TRAZA..."
echo "--------------------------------------------------------"

python3 - <<EOF
import re
import sys

# =========================
# Utilidades
# =========================

def decode_text(txt):
    """Decodifica escapes unicode y saltos de línea."""
    if txt is None:
        return None
    try:
        txt = txt.encode("utf-8").decode("unicode_escape", errors="ignore")
    except Exception:
        pass
    txt = txt.replace("\\\\n", "\n").replace("\\n", "\n").strip()
    return txt

def normalizar_bloque(txt):
    """
    Normaliza el bloque para facilitar regex:
    - \"  -> "
    - \/  -> /
    """
    if txt is None:
        return ""
    return txt.replace('\\"', '"').replace('\\/', '/')

def extraer_pregunta(bloque, parse_data_text):
    """
    La PREGUNTA debe salir del campo 'user text'.
    Si no aparece, fallback a parse_data_text.
    """
    # Formato típico:
    # [state 1] user text: ¿Qué es la RLPT? | previous action name: action_listen
    patron = r'user text:\s*(.*?)\s*(?:\|\s*previous action name:|(?:\\n|\n)\s*previous action name:)'

    m = re.search(patron, bloque, re.DOTALL)
    if m:
        return decode_text(m.group(1).strip())

    bloque_norm = normalizar_bloque(bloque)
    m = re.search(patron, bloque_norm, re.DOTALL)
    if m:
        return decode_text(m.group(1).strip())

    return decode_text(parse_data_text)

def extraer_ranking_normal(bloque):
    """
    Extrae intent_ranking normal:
    [{"name": "...", "confidence": ...}, ...]
    """
    bloque_norm = normalizar_bloque(bloque)

    m = re.search(r'"intent_ranking"\s*:\s*\[(.*?)\]', bloque_norm, re.DOTALL)
    if not m:
        return []

    ranking_block = m.group(1)

    items = re.findall(
        r'\{"name"\s*:\s*"([^"]+)"\s*,\s*"confidence"\s*:\s*([0-9eE\.-]+)\}',
        ranking_block,
        re.DOTALL
    )

    ranking = []
    for nombre, conf_str in items:
        try:
            ranking.append((nombre, float(conf_str)))
        except Exception:
            pass

    return ranking

def extraer_ranking_retrieval(bloque, prefijo):
    """
    Extrae el ranking interno de retrieval intents (faq/chitchat):
    "ranking": [
      {"confidence": ..., "intent_response_key": "faq/..."},
      ...
    ]

    SOLO debe usarse cuando el intent base sea faq o chitchat.
    """
    bloque_norm = normalizar_bloque(bloque)

    # Buscamos todos los bloques "ranking": [...]
    bloques_ranking = re.finditer(r'"ranking"\s*:\s*\[(.*?)\]', bloque_norm, re.DOTALL)

    candidatos = []

    for match in bloques_ranking:
        ranking_block = match.group(1)

        items = re.findall(
            r'\{"confidence"\s*:\s*([0-9eE\.-]+)\s*,\s*"intent_response_key"\s*:\s*"([^"]+)"\}',
            ranking_block,
            re.DOTALL
        )

        ranking = []
        vistos = set()

        for conf_str, intent_response_key in items:
            if not intent_response_key.startswith(prefijo + "/"):
                continue

            # Evitar duplicados conservando el orden
            if intent_response_key in vistos:
                continue

            try:
                ranking.append((intent_response_key, float(conf_str)))
                vistos.add(intent_response_key)
            except Exception:
                pass

        if ranking:
            candidatos.append(ranking)

    if not candidatos:
        return []

    # Elegimos el más largo (suele ser el ranking completo interno)
    candidatos.sort(key=len, reverse=True)
    return candidatos[0]

def extraer_retrieval_intent_desde_utter(bloque, prefijo):
    """
    Fallback para obtener el retrieval intent ganador desde:
    - Requesting NLG for utter_faq/rlpt
    - response: "utter_faq/rlpt"
    - utter_action/template si aplica

    Devuelve:
      faq/rlpt
    """
    bloque_norm = normalizar_bloque(bloque)

    patrones = [
        rf'Requesting NLG for utter_({prefijo}/[A-Za-z0-9_./-]+)',
        rf'"response"\s*:\s*"utter_({prefijo}/[A-Za-z0-9_./-]+)"',
        rf'"utter_action"\s*:\s*"utter_({prefijo}/[A-Za-z0-9_./-]+)"',
        rf'"template"\s*:\s*"utter_({prefijo}/[A-Za-z0-9_./-]+)"',
    ]

    for patron in patrones:
        m = re.search(patron, bloque_norm, re.DOTALL)
        if m:
            return m.group(1)

    return None

def extraer_respuesta(bloque):
    """
    Busca la respuesta del bot.
    Prioridad:
    1) Received NLG response
    2) BotUttered(...)
    """
    # 1) Received NLG response
    patrones_nlg = [
        r'Received NLG response:.*?"text"\s*:\s*"((?:\\.|[^"])*)"',
    ]

    for patron in patrones_nlg:
        m = re.search(patron, bloque, re.DOTALL)
        if m:
            return decode_text(m.group(1))

    bloque_norm = normalizar_bloque(bloque)
    for patron in patrones_nlg:
        m = re.search(patron, bloque_norm, re.DOTALL)
        if m:
            return decode_text(m.group(1))

    # 2) BotUttered('...')
    patrones_botuttered = [
        r"BotUttered\(\s*'((?:\\.|[^'])*)'",
        r'BotUttered\(\s*"((?:\\.|[^"])*)"',
    ]

    for patron in patrones_botuttered:
        m = re.search(patron, bloque, re.DOTALL)
        if m:
            return decode_text(m.group(1))

    for patron in patrones_botuttered:
        m = re.search(patron, bloque_norm, re.DOTALL)
        if m:
            return decode_text(m.group(1))

    return None


# =========================
# Lectura de archivo
# =========================

try:
    with open("$ARCHIVO_TRAZA", "r", encoding="utf-8") as f:
        content = f.read()
except Exception as e:
    print(f"❌ Error al leer el archivo: {e}")
    sys.exit(1)

# =========================
# Localización de cada interacción
# =========================

# IMPORTANTE:
# - group(1) = parse_data_text
# - group(2) = intent_base
# - group(3) = confidence
#
# Este patrón admite campos extra dentro de parse_data_intent,
# por ejemplo full_retrieval_intent_name.
patron_parseo = re.compile(
    r'"parse_data_text"\s*:\s*"((?:\\.|[^"])*)"\s*,\s*"parse_data_intent"\s*:\s*\{.*?"name"\s*:\s*"([^"]+)"\s*,\s*"confidence"\s*:\s*([0-9eE\.-]+)',
    re.DOTALL
)

matches = list(patron_parseo.finditer(content))

if not matches:
    print("❌ No se encontraron eventos 'processor.message.parse' en la traza.")
    sys.exit(1)

# =========================
# Procesado por interacción
# =========================

for i, match in enumerate(matches):
    parse_data_text = match.group(1)
    intent_base = match.group(2)
    confianza_base = float(match.group(3)) * 100

    # IMPORTANTE:
    # Cogemos desde match.start(), no match.end(),
    # para incluir también el ranking interno FAQ/chitchat
    inicio_bloque = match.start()
    fin_bloque = matches[i + 1].start() if i + 1 < len(matches) else len(content)
    bloque = content[inicio_bloque:fin_bloque]

    pregunta = extraer_pregunta(bloque, parse_data_text)

    intent_ganador = intent_base
    confianza_ganador = confianza_base
    ranking_final = []

    # ==========================================================
    # Lógica principal:
    # - Si gana faq/chitchat -> usar ranking interno retrieval
    # - Si no -> usar intent_ranking normal
    # ==========================================================
    if intent_base in ("faq", "chitchat"):
        ranking_retrieval = extraer_ranking_retrieval(bloque, intent_base)

        if ranking_retrieval:
            ranking_final = ranking_retrieval
            intent_ganador = ranking_retrieval[0][0]
            confianza_ganador = ranking_retrieval[0][1] * 100
        else:
            # No usamos intent_ranking si gana faq/chitchat
            ranking_final = []

            # Fallback opcional para mostrar mejor el intent ganador si no apareció el ranking interno
            intent_retrieval = extraer_retrieval_intent_desde_utter(bloque, intent_base)
            if intent_retrieval:
                intent_ganador = intent_retrieval
    else:
        ranking_final = extraer_ranking_normal(bloque)

    respuesta = extraer_respuesta(bloque)

    # =========================
    # Salida
    # =========================
    print(f"🗣️ PREGUNTA: {pregunta}")
    print(f"🎯 INTENT GANADOR: {intent_ganador} (Confianza: {confianza_ganador:.2f}%)")

    if ranking_final:
        print("📊 RANKING DE INTENTS (Top 5):")
        for idx, (nombre, conf_val) in enumerate(ranking_final[:5]):
            print(f" {idx+1}. {nombre}: {conf_val*100:.6f}%")
    else:
        print("📊 RANKING DE INTENTS (Top 5): No encontrado")

    if respuesta:
        print(f"🤖 RESPUESTA:\n {respuesta}")
    else:
        print("🤖 RESPUESTA:\n (No se encontró respuesta en la traza para esta interacción)")

    print("\n" + "=" * 60 + "\n")
EOF
