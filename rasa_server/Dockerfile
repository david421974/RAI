FROM rasa/rasa:3.6.20-full
# (Asegúrate de usar la versión que te corresponda, p.ej. 3.1.0 o la que uses)

# 2. Cambiamos a usuario root para poder instalar cosas
USER root

# 3. Instalamos Spacy y descargamos el modelo en español
RUN pip install spacy
RUN python -m spacy download es_core_news_lg

# Copiamos el script de build del domain
COPY scripts/build_domain.py /app/scripts/build_domain.py

# 4. Volvemos al usuario por defecto de Rasa para seguridad
#USER 1001


# Directorio de trabajo
WORKDIR /app
