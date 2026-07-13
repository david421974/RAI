import os
import re
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Engine, create_engine, text
import yaml


def _env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None or v == "":
        raise RuntimeError(f"Missing env var: {name}")
    return v


DATABASE_URL = _env("DATABASE_URL")
RASA_URL = _env("RASA_URL", "http://rasa_server:5005").rstrip("/")
ALLOW_ORIGINS = os.getenv("ALLOW_ORIGINS", "*")
NLU_DIR = os.getenv("NLU_DIR", "/data/nlu")

engine: Engine = create_engine(DATABASE_URL, pool_pre_ping=True)

app = FastAPI(title="Stats API", version="1.0.0")

origins = ["*"] if ALLOW_ORIGINS.strip() == "*" else [o.strip() for o in ALLOW_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TopIntent(BaseModel):
    label: str
    payload: str
    intent: str
    hits: int
    pregunta_principal: str | None = None
    pregunta_realizada: str | None = None


class LogMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    sender: str | None = Field(default=None, max_length=200)


INTENT_TO_PRIMARY_QUESTION: dict[str, str] = {}


def _load_primary_questions_from_nlu(nlu_dir: str) -> dict[str, str]:
    """
    Devuelve intent -> pregunta principal, donde "pregunta principal" es el primer ejemplo
    del bloque `examples:` del intent en los ficheros NLU.
    """
    mapping: dict[str, str] = {}
    p = Path(nlu_dir)
    if not p.exists() or not p.is_dir():
        return mapping

    for fp in sorted(p.glob("*.yml")) + sorted(p.glob("*.yaml")):
        try:
            doc = yaml.safe_load(fp.read_text(encoding="utf-8")) or {}
        except Exception:
            continue
        nlu_items = doc.get("nlu") or []
        if not isinstance(nlu_items, list):
            continue
        for item in nlu_items:
            if not isinstance(item, dict):
                continue
            intent = item.get("intent")
            examples = item.get("examples")
            if not intent or not isinstance(examples, str):
                continue
            if intent in mapping:
                continue
            first = None
            # Preferimos una pregunta "humana" (no "sí/no", no tokens cortos).
            best = None
            for line in examples.splitlines():
                s = line.strip()
                if not s:
                    continue
                if s.startswith("-"):
                    candidate = s[1:].strip()
                    if candidate:
                        first = candidate
                        # Heurística: que parezca pregunta o frase larga.
                        c_norm = candidate.strip().lower()
                        if len(candidate) >= 12 and (candidate.startswith("¿") or "?" in candidate):
                            best = candidate
                            break
                        if c_norm not in {"si", "sí", "no"} and len(candidate) >= 12 and best is None:
                            best = candidate
            if best or first:
                mapping[str(intent)] = str(best or first)

    return mapping


def _ensure_schema() -> None:
    """
    En entornos con volumen persistente, `init.sql` no se re-ejecuta.
    Aseguramos que existan las columnas que necesitamos.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS intent_hits (
                  intent TEXT PRIMARY KEY,
                  pregunta_principal TEXT,
                  pregunta_realizada TEXT,
                  hits BIGINT NOT NULL DEFAULT 0,
                  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_intent_hits_hits ON intent_hits (hits DESC);"))

        cols = conn.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'intent_hits'
                """
            )
        ).scalars().all()
        colset = set(cols)
        if "pregunta_principal" not in colset:
            conn.execute(text("ALTER TABLE intent_hits ADD COLUMN pregunta_principal TEXT;"))
        if "pregunta_realizada" not in colset:
            conn.execute(text("ALTER TABLE intent_hits ADD COLUMN pregunta_realizada TEXT;"))


@app.on_event("startup")
def _startup() -> None:
    global INTENT_TO_PRIMARY_QUESTION
    _ensure_schema()
    INTENT_TO_PRIMARY_QUESTION = _load_primary_questions_from_nlu(NLU_DIR)


def _pretty_intent(intent: str) -> str:
    s = intent.strip()
    # Normalizamos nombres para que se vean mejor en UI.
    # Ejemplos:
    # - faq/payrolls -> Payrolls
    # - ask_fill_timesheet -> Fill timesheet
    if s.startswith("faq/"):
        s = s[len("faq/") :]
    s = re.sub(r"^ask_", "", s)
    if s == "faq":
        s = "faq"
    s = s.replace("_", " ")
    return s[:1].upper() + s[1:] if s else intent


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/debug/parse")
async def debug_parse(text_in: str) -> dict[str, Any]:
    """
    Diagnóstico: devuelve el payload de Rasa /model/parse para un texto.
    """
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.post(f"{RASA_URL}/model/parse", json={"text": text_in})
        resp.raise_for_status()
        return resp.json()


@app.get("/debug/db")
def debug_db() -> dict[str, Any]:
    """
    Diagnóstico: número de filas y top bruto en BD.
    """
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM intent_hits")).scalar_one()
        top = conn.execute(
            text(
                """
                SELECT intent, hits, pregunta_principal, pregunta_realizada, last_seen_at
                FROM intent_hits
                ORDER BY hits DESC, last_seen_at DESC
                LIMIT 10
                """
            )
        ).mappings().all()
        return {"rows": int(count), "top10": [dict(r) for r in top]}


@app.get("/intents/top", response_model=list[TopIntent])
def top_intents(limit: int = 8) -> list[TopIntent]:
    limit = max(1, min(limit, 1000))
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT intent, hits, pregunta_principal, pregunta_realizada
                FROM intent_hits
                WHERE intent LIKE 'faq/%'
                ORDER BY hits DESC, last_seen_at DESC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings()
        result: list[TopIntent] = []
        for r in rows:
            intent = str(r["intent"])
            hits = int(r["hits"])
            pregunta_principal = r.get("pregunta_principal")
            pregunta_realizada = r.get("pregunta_realizada")
            label = str(pregunta_principal) if pregunta_principal else _pretty_intent(intent)
            result.append(
                TopIntent(
                    intent=intent,
                    hits=hits,
                    label=label,
                    # En la UI queremos enviar la "pregunta principal", no el nombre del intent.
                    payload=label,
                    pregunta_principal=pregunta_principal,
                    pregunta_realizada=pregunta_realizada,
                )
            )
        return result


@app.post("/intents/log-from-message")
async def log_from_message(req: LogMessageRequest) -> dict[str, Any]:
    msg = req.message.strip()
    # Evitamos contaminar el ranking con respuestas cortas tipo "sí/no" o clicks.
    if len(msg) < 5 or msg.lower() in {"si", "sí", "no"}:
        return {"ok": True, "intent": None, "hits": None}
    # Si viene un payload estilo "/algo", normalmente no es una pregunta natural.
    if msg.startswith("/"):
        return {"ok": True, "intent": None, "hits": None}

    # Parse intent with Rasa and increment counters.
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(f"{RASA_URL}/model/parse", json={"text": req.message})
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Rasa parse failed: {e}") from e

    data = resp.json() if isinstance(resp, httpx.Response) else {}
    direct_intent = (data.get("intent") or {}).get("name")
    ranking = data.get("intent_ranking") or []

    # En Rasa, los retrieval intents se devuelven como intent "faq" + response_selector
    # con `intent_response_key` del estilo "faq/fundacion_capgemini".
    response_selector = data.get("response_selector") or {}
    retrieval_key = None
    if isinstance(response_selector, dict):
        # Buscamos en cualquier selector porque el nombre de la clave puede variar
        # (p.ej. "default", "faq", etc.). Nos quedamos con el primer intent_response_key
        # que sea un retrieval FAQ.
        for _, sel in response_selector.items():
            if not isinstance(sel, dict):
                continue
            resp_obj = sel.get("response") or {}
            if not isinstance(resp_obj, dict):
                continue
            key = resp_obj.get("intent_response_key")
            if key and str(key).startswith("faq/"):
                retrieval_key = str(key)
                break

    chosen_intent = str(retrieval_key) if retrieval_key else None
    chosen_conf = 1.0 if chosen_intent else -1.0

    # Fallback: elegimos el intent FAQ con más confianza del ranking.
    if chosen_intent is None:
        best_name = None
        best_conf = -1.0
        if isinstance(ranking, list):
            for r in ranking:
                if not isinstance(r, dict):
                    continue
                name = r.get("name")
                if not name or not str(name).startswith("faq/"):
                    continue
                conf = r.get("confidence")
                try:
                    conf_f = float(conf)
                except Exception:
                    conf_f = 0.0
                if conf_f > best_conf:
                    best_name = str(name)
                    best_conf = conf_f
        if best_name is not None:
            chosen_intent = best_name
            chosen_conf = best_conf

    # Último fallback: intent directo si ya es faq/...
    if chosen_intent is None and direct_intent and str(direct_intent).startswith("faq/"):
        chosen_intent = str(direct_intent)
        chosen_conf = 1.0

    if chosen_intent is None:
        return {"ok": True, "intent": None, "hits": None}

    # Nunca guardamos el intent padre "faq": no es útil para el ranking.
    if str(chosen_intent) == "faq":
        return {"ok": True, "intent": None, "hits": None}

    # Si no es un intent FAQ, no lo contamos para el ranking del Home.
    if not str(chosen_intent).startswith("faq/"):
        return {"ok": True, "intent": None, "hits": None}

    intent = str(chosen_intent) if chosen_intent else None
    if not intent:
        return {"ok": True, "intent": None, "hits": None}

    primary_q = INTENT_TO_PRIMARY_QUESTION.get(intent)
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO intent_hits(intent, pregunta_principal, pregunta_realizada, hits, last_seen_at)
                VALUES (:intent, :pregunta_principal, :pregunta_realizada, 1, NOW())
                ON CONFLICT (intent)
                DO UPDATE SET
                  hits = intent_hits.hits + 1,
                  pregunta_realizada = EXCLUDED.pregunta_realizada,
                  pregunta_principal = COALESCE(intent_hits.pregunta_principal, EXCLUDED.pregunta_principal),
                  last_seen_at = NOW()
                RETURNING hits
                """
            ),
            {
                "intent": intent,
                "pregunta_principal": primary_q,
                "pregunta_realizada": msg,
            },
        ).mappings().first()

    return {"ok": True, "intent": intent, "hits": int(row["hits"]) if row else None}

