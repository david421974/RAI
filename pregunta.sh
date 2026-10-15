#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 \"<pregunta>\""
  echo "Ejemplo: $0 \"Hola\""
  exit 1
fi

QUESTION="$1"
SENDER="cli-test"

# Construir JSON seguro (escapa comillas, acentos, etc.)
PAYLOAD="$(jq -n --arg sender "$SENDER" --arg message "$QUESTION" \
  '{sender: $sender, message: $message}')"

# Llamar al webhook REST y mostrar solo los textos devueltos
docker exec -i rasa_server curl -s -X POST "http://localhost:5005/webhooks/rest/webhook" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
| jq -r '.[].text // empty'

