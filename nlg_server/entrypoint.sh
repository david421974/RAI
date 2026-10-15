#!/bin/bash
echo "🚀 Iniciando NLG Server..."
echo "📂 Comprobando acceso a datos en /data..."

# Cuenta cuántos archivos CSV existen en la ruta correcta del contenedor
NUM_CSVS=$(ls -1 /data/utters/*.csv 2>/dev/null | wc -l)

if [ "$NUM_CSVS" -gt 0 ]; then
    echo "✅ Se encontraron $NUM_CSVS archivos CSV de respuestas en /data/utters/."
else
    echo "⚠️ ADVERTENCIA: No se detectan archivos .csv en /data/utters/"
fi

# Arranca FastAPI
exec uvicorn nlg_server:app --host 0.0.0.0 --port 5006
