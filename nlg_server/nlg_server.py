import os
import glob
import pandas as pd
from fastapi import FastAPI, Request
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NLG_MULTI_CSV")

app = FastAPI()

# Ahora apuntamos a un DIRECTORIO, no a un archivo
DIR_PATH = "/data/utters/"

def fill_slots(text, tracker):
    """Sustituye variables tipo {slot} por los valores del tracker."""
    slots = tracker.get('slots', {})
    
    def replace_match(match):
        slot_name = match.group(1)
        return str(slots.get(slot_name, match.group(0)))

    return re.sub(r'\{([a-zA-Z0-9_]+)\}', replace_match, text)

@app.post("/nlg")
async def nlg(request: Request):
    try:
        payload = await request.json()

        logger.info(f"--- Payload: {payload} ---")
        response_name = payload.get("response").strip()
        tracker = payload.get("tracker", {})
        
        logger.info(f"--- Solicitud Rasa: {response_name} ---")

        # 1. Buscamos TODOS los archivos .csv en el directorio
        # Esto permite añadir o quitar archivos en caliente sin reiniciar el servidor
        csv_files = glob.glob(os.path.join(DIR_PATH, "*.csv"))
        
        if not csv_files:
            logger.error(f"⚠️ No se encontraron archivos CSV en {DIR_PATH}")
            return {"text": "Error: Base de conocimientos vacía o directorio incorrecto."}

        # 2. Iteramos por cada archivo encontrado
        for file_path in csv_files:
            try:
                # Leemos el archivo actual
                df = pd.read_csv(file_path, sep=';', header=None, engine='python', encoding='utf-8-sig')
                df = df.apply(lambda x: x.astype(str).str.strip())

                # Buscamos el match
                logger.info(f"Buscando: {response_name} ")
                match = df[df.iloc[:, 0] == response_name]

                # Si lo encontramos, procesamos y DEVOLVEMOS la respuesta inmediatamente
                if not match.empty:
                    raw_text = str(match.iloc[0, 1])
                    final_text = fill_slots(raw_text, tracker)
                    
                    # Log útil para saber en qué archivo lo encontró
                    nombre_archivo = os.path.basename(file_path)
                    logger.info(f"✅ Match encontrado en [{nombre_archivo}]: {final_text}")
                    
                    return {"text": final_text, "buttons": []}
                    
            except Exception as e:
                logger.error(f"💥 Error leyendo el archivo {file_path}: {str(e)}")
                continue # Si un archivo falla, pasa al siguiente en lugar de colapsar

        # 3. Si el bucle termina y no ha retornado nada, es que no existe en ningún CSV
        logger.warning(f"⚠️ No hay respuesta para {response_name} en ninguno de los {len(csv_files)} CSVs.")
        return {"text": f"Lo siento, la respuesta para '{response_name}' no está configurada."}

    except Exception as e:
        logger.error(f"💥 Error crítico en NLG: {str(e)}")
        return {"text": "Error técnico procesando la respuesta."}
