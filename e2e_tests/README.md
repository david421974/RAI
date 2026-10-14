# 🎭 Pruebas End-to-End (E2E) con Playwright

Este directorio contiene la suite de pruebas automatizadas de extremo a extremo para el Chatbot RAI. Las pruebas están diseñadas para ejecutarse de forma aislada dentro de un contenedor Docker, garantizando un entorno reproducible sin necesidad de instalar dependencias locales (como Node.js o navegadores) en la máquina del desarrollador.

## 🏗️ Arquitectura de Pruebas

El contenedor de pruebas (`e2e_tests`) se integra en la red local de Docker Compose y se comunica internamente con los servicios del chatbot:

```text
[ Contenedor e2e_tests ] ──( HTTP )──> [ Contenedor rasa_angular_ui:80 ]
          │                                           │
          ▼ (Navegador Headless)                      ▼
    Ejecuta los tests                       Llama a auth_api y Rasa
```

---

## 🚀 Cómo Ejecutar las Pruebas
Si ya tienes el entorno levantado y el chat funcionando puedes pasar al punto 3 y lanzar directamente las pruebas.

### 1. Recrear el entorno e iniciar servicios (Recomendado)
Si deseas limpiar residuos de bases de datos o sesiones previas:
```bash
# Apagar todo y limpiar volúmenes de la DB
docker compose --profile test down -v --remove-orphans

# Levantar el stack principal en segundo plano
docker compose up -d --build
```

### 2. Registrar el usuario de prueba
Al limpiar la base de datos PostgreSQL, es obligatorio dar de alta al usuario que utilizará el script de Playwright:
```bash
docker exec -it auth_api python add_user.py trinidad.diezrojo@capgemini.com tuContraseñaSegura123
```

### 3. Lanzar la suite de pruebas
Ejecuta el contenedor de Playwright indicándole que construya la imagen limpia y destruya el contenedor de test al finalizar (`--rm`):
```bash
# Ejecutar todos los tests
docker compose --profile test run --build --rm e2e_tests

# Ejecutar únicamente un archivo específico (ej. chatbot_login.spec.ts)
docker compose --profile test run --build --rm e2e_tests npx playwright test tests/chatbot_login.spec.ts
```

---

## 🛠️ Modo Interactivo (Depuración Manual sin ejecutar tests)

Si deseas encender el contenedor de pruebas para realizar tareas manuales, depurar comandos paso a paso o usar herramientas de Playwright de forma directa sin lanzar toda la suite automáticamente, puedes forzar al contenedor a mantenerse activo ejecutando un intérprete de comandos (`bash`).

Ejecuta este comando desde la raíz del proyecto:
```bash
docker compose --profile test run --build --rm e2e_tests sh -c "npm install && npx playwright install-deps && bash"
```

Entrarás directamente al contenedor, el cual expone un entorno Linux puro y aislado con Node.js y Playwright nativos (lo identificarás por el prompt `root@<ID_CONTENEDOR>:/app#`).

#### 💡 Solución a desincronización de ejecutables (Error de versión de Imagen)
Si al lanzar un test dentro del contenedor recibes un recuadro de advertencia indicando que la versión de Playwright de tu código requiere ejecutables más recientes que los provistos por la imagen de Docker, **ejecuta este comando de rescate directamente dentro del prompt de `root`** para descargar el navegador compatible al vuelo:
```bash
npx playwright install --with-deps chromium 
```

#### Comandos útiles dentro del contexto interactivo (`root`):
* **Ejecutar un solo archivo de test:**
  ```bash
  npx playwright test tests/chatbot_login.spec.ts
  ```
* **Lanzar todos los tests viendo el debug paso a paso por pantalla:**
  ```bash
  DEBUG=pw:api npx playwright test
  ```
* **Salir del contenedor y proceder a su autodestrucción automática:**
  ```bash
  exit
  ```

---

## 📁 Estructura del Directorio

```text
e2e-tests/
 ├── tests/
 │    └── chatbot_login.spec.ts  # Script del flujo de Login e interacción con Rasa
 ├── Dockerfile                 # Imagen aislada con Playwright y Linux Noble
 ├── playwright.config.ts        # Configuración de timeouts, baseURL y reportes
 ├── package.json               # Dependencias del entorno de pruebas
 └── README.md                  # Este archivo informativo
```

---

## 🔍 Depuración y Reportes (Debugging)

Si un test falla, Playwright está configurado para almacenar de forma automática capturas de pantalla y grabaciones de vídeo del navegador virtual en caso de error.

### Ver el Reporte HTML en Windows desde WSL
Los resultados se guardan localmente en la carpeta `e2e-tests/playwright-report/`. Puedes levantar un servidor rápido en WSL para abrir el reporte interactivo desde el navegador de tu Windows:

1. Ejecuta el servidor en tu terminal de WSL:
   ```bash
   python3 -m http.server 9323 --directory e2e-tests/playwright-report
   ```
2. Abre en tu navegador de Windows: **[http://localhost:9323](http://localhost:9323)**

### Logs detallados en consola desde WSL
Para ver de forma detallada qué elementos o selectores HTML está intentando pulsar Playwright segundo a segundo sin entrar al modo interactivo, puedes inyectar la variable de depuración de la API en el comando general de Docker:
```bash
docker compose --profile test run --rm -e DEBUG=pw:api e2e_tests
```

⚠️ **Nota para el desarrollo:** Debido a que el volumen `/app/node_modules` está protegido de forma anónima dentro de Docker para evitar conflictos con el sistema de archivos de Windows/WSL, cualquier cambio en las dependencias del `package.json` requerirá que pases obligatoriamente el flag `--build` al comando de ejecución de Docker Compose.
