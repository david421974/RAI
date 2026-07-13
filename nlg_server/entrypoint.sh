#!/bin/bash
echo "🚀 Iniciando NLG Server..."
echo "📂 Comprobando acceso a datos en /data..."

if [ -f "/data/$EXCEL_NAME" ]; then
    echo "✅ Archivo $EXCEL_NAME encontrado."
else
    echo "⚠️ ADVERTENCIA: No se ve el archivo en /data/$EXCEL_NAME"
fi

# Arranca FastAPI
exec uvicorn nlg_server:app --host 0.0.0.0 --port 5006
