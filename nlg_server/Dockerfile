FROM python:3.10-slim

WORKDIR /app

# Instalamos dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamos los scripts
COPY nlg_server.py .
COPY entrypoint.sh .

# Permisos para el script de entrada
RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
