# Dockerfile
# Usamos la imagen oficial de Python 3.10
FROM python:3.10-slim

# Establecer el directorio de trabajo
WORKDIR /app

# Instalar dependencias, spacy es_core_news_lg, incluyendo la librería 'rasa' para el comando 'rasa run actions'
RUN pip install --no-cache-dir "pydantic<1.10.10" "rasa==3.6.14" "spacy<3.8.0"
RUN python -m spacy download es_core_news_lg

# Copiar el código del servidor de acciones
COPY actions /app/actions

# El comando por defecto para correr el servidor de acciones
#CMD ["rasa", "run", "actions", "--port", "5055"]
CMD ["rasa", "run", "actions", "--actions", "actions", "--port", "5055"]
