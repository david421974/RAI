# 🔐 Guía — Autenticación login/password con PostgreSQL

## Arquitectura

```
Navegador (Angular)
    │  POST /login {email, password}
    ▼
auth_api (FastAPI · puerto 7001)
    │  SELECT password_hash FROM chatbot_users WHERE email = ?
    ▼
stats_db (PostgreSQL · puerto 5432)
```

---

## 1. Copia los archivos

```
auth_api/
  ├── main.py
  ├── requirements.txt
  ├── Dockerfile
  ├── init_users.sql
  └── add_user.py

chatbot-ui/src/app/
  ├── services/auth.service.ts        (reemplaza el anterior)
  ├── guards/auth.guard.ts            (igual que antes)
  └── pages/auth/
        ├── auth.component.ts
        ├── auth.component.html
        └── auth.component.css

docker-compose.yml                    (reemplaza el existente)
```

> `app.routes.ts` ya está correcto del paso anterior — no hay que tocarlo.

---

## 2. ⚠ Cambia los secretos en docker-compose.yml

```yaml
auth_api:
  environment:
    - JWT_SECRET=pon-aqui-una-cadena-larga-y-aleatoria   # mínimo 32 caracteres
    - ADMIN_KEY=clave-para-crear-usuarios-desde-la-api
```

Genera un secreto seguro:
```bash
openssl rand -hex 32
```

---

## 3. Arranca el stack

```bash
docker-compose up -d --build
```

> **Importante**: `init_users.sql` solo se ejecuta la primera vez que se crea
> el volumen de la DB. Si el volumen ya existe, ejecuta el paso 4 manualmente.
>
> Si necesitas forzar la recreación: `docker-compose down -v && docker-compose up -d --build`

---

## 4. Crea el primer usuario

### Opción A — Script dentro del contenedor (recomendado)

```bash
docker exec -it auth_api python add_user.py nombre@capgemini.com contraseña123
```

### Opción B — API REST

```bash
curl -X POST http://localhost:7001/users \
  -H "Content-Type: application/json" \
  -d '{
    "email":     "nombre@capgemini.com",
    "password":  "contraseña123",
    "admin_key": "tu-ADMIN_KEY-del-compose"
  }'
```

### Opción C — SQL directo

```bash
# Genera el hash primero (desde el contenedor)
docker exec -it auth_api python -c "
import bcrypt, sys
print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode())
" "contraseña123"

# Inserta con el hash resultante
docker exec -it stats_db psql -U stats -d stats -c "
INSERT INTO chatbot_users (email, password_hash)
VALUES ('nombre@capgemini.com', '<hash-generado-arriba>');
"
```

---

## 5. Comprueba que la API funciona

```bash
# Health check
curl http://localhost:7001/health

# Prueba de login
curl -X POST http://localhost:7001/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nombre@capgemini.com","password":"contraseña123"}'
```

---

## 6. URL de la auth_api en Angular

En `auth.service.ts`, la constante `AUTH_API_URL` apunta a `http://localhost:7001`.

En producción (servidor remoto), cámbiala por la IP o dominio del servidor:
```typescript
const AUTH_API_URL = 'https://tu-servidor.com:7001';
```

O mejor, muévela a `src/environments/environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  authApiUrl: 'https://tu-servidor.com:7001',
};
```

---

## Flujo de autenticación

```
Usuario → /auth  (login form)
  → introduce email @capgemini.com + contraseña
  → Angular llama POST http://localhost:7001/login
  → auth_api consulta chatbot_users en PostgreSQL
  → si OK → devuelve JWT (válido 8 horas)
  → Angular guarda JWT en sessionStorage
  → redirige a /  (HomeComponent)

Ruta protegida sin JWT válido → redirige a /auth
JWT expirado (8 h)             → redirige a /auth
```
