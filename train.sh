#!/bin/bash

echo "🚀 Parar el docker compose totalmente ..."
docker compose down

echo "🚀 Iniciando entrenamiento modular de Rasa..."
docker compose run --rm rasa_cli train

if [ $? -eq 0 ]; then
    echo "✨ Entrenamiento completado con éxito"
    echo "🚀 Arrancar el docker compose ..."
    docker compose up -d
else
    echo "❌ Error durante el entrenamiento. Revisa los logs arriba."
fi
