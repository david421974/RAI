import requests
import logging

logger = logging.getLogger(__name__)

# URL de tu NLG Server interno
NLG_SERVER_URL = "http://nlg_server:5006/generate"

def obtener_respuesta_nlg(intent_name: str, entities: dict) -> str:
    """Función común para pedirle textos al excel a través de tu nlg_server"""
    try:
        payload = {"intent": intent_name, "entities": entities}
        response = requests.post(NLG_SERVER_URL, json=payload)
        if response.status_code == 200:
            return response.json().get("text", "Error: Sin texto")
    except Exception as e:
        logger.error(f"Error conectando al NLG: {e}")
    return "Lo siento, hubo un problema al generar la respuesta."

# Puedes poner otras funciones compartidas aquí...
