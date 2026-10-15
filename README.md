# RAI

Para dar de alto un usuario del chatbot, ejecutar:
 add_user.sh <usuario> <password> ejemplo: add_user.sh francisco.gonzalez@capgemini.com frank2

Para dar de baja un usuario:
del_user.sh <usuario>
:
Para ver la tabla de usuarios:
sel_user.sh

Para analizar las trazas:
analisis_trazas.sh

Para borrar los modelos existentes:
cls_models.sh

Borrar un intent de la base de datos:
del_intent_hits.sh

Borrar los intents de la base de datos:
sel_intent_hits.sh

Para arrancar el chatbot:
down.sh

Para entrenar el chatbot:
train.sh

Para dar de alta el chatbot:
up.sh

Los datos de los Utters se ecnuentran en:
/mnt/c/Users/<usuario>/Capgemini/Microproyecto\ Chatbot\ IA\ RASA\ -\ Utters

Tamnien encontrarse los datos de los Utters en local en:
./Utters

# E2E testing
Se añaden en el docker compose un contenedor para diseñar y ejecutar tests e2e con playwright.
