from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import psycopg
import bcrypt
import jwt as pyjwt
import os
from datetime import datetime, timedelta, timezone

app = FastAPI(title="Chatbot Auth API")

# ─── Configuración ────────────────────────────────────────────────────────────
DATABASE_URL   = os.getenv("DATABASE_URL",   "postgresql://stats:stats@stats_db:5432/stats")
SECRET_KEY     = os.getenv("JWT_SECRET",     "cambia-esto-en-produccion")
ALGORITHM      = "HS256"
TOKEN_EXPIRE_H = int(os.getenv("TOKEN_EXPIRE_HOURS", "8"))
ALLOWED_DOMAIN = os.getenv("ALLOWED_DOMAIN", "capgemini.com")
ALLOW_ORIGINS  = os.getenv("ALLOW_ORIGINS",  "*").split(",")
ADMIN_KEY      = os.getenv("ADMIN_KEY",      "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ─── Modelos ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email:    str
    password: str

class CreateUserRequest(BaseModel):
    email:     str
    password:  str
    admin_key: str

# ─── Helpers ──────────────────────────────────────────────────────────────────
def db_connect():
    return psycopg.connect(DATABASE_URL)

def make_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "iat": now,
        "exp": now + timedelta(hours=TOKEN_EXPIRE_H),
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login(req: LoginRequest):
    email = req.email.lower().strip()

    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se permiten correos @{ALLOWED_DOMAIN}",
        )

    with db_connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM chatbot_users "
                "WHERE email = %s AND active = TRUE",
                (email,),
            )
            row = cur.fetchone()

    # Mismo error genérico para email inexistente y contraseña incorrecta (anti-enumeración)
    if not row or not bcrypt.checkpw(
        req.password.encode("utf-8"), row[0].encode("utf-8")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    token = make_token(email)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "expires_in":   TOKEN_EXPIRE_H * 3600,
    }


@app.get("/validate")
def validate(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = pyjwt.decode(
            credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM]
        )
        return {"email": payload["sub"], "valid": True}
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(req: CreateUserRequest):
    """Crea un usuario. Requiere ADMIN_KEY en el body."""
    if not ADMIN_KEY or req.admin_key != ADMIN_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado")

    email = req.email.lower().strip()
    if not email.endswith(f"@{ALLOWED_DOMAIN}"):
        raise HTTPException(status_code=400, detail=f"Solo se permiten correos @{ALLOWED_DOMAIN}")

    pwd_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        with db_connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO chatbot_users (email, password_hash) VALUES (%s, %s)",
                    (email, pwd_hash),
                )
            conn.commit()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="El usuario ya existe")

    return {"message": f"Usuario {email} creado correctamente"}
