#!/bin/bash

echo "🚀 Iniciando comando "$1" de Rasa..."
docker compose run --rm rasa_cli $1

if [ $? -eq 0 ]; then
    echo "✨ Comando rasa completado con éxito"
else
    echo "❌ Error durante la ejecucion del comando rasa. Revisa los logs arriba."
fi
