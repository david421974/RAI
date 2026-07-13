"""
Script para crear o actualizar usuarios del chatbot.

Uso dentro del contenedor:
    docker exec -it auth_api python add_user.py usuario@capgemini.com contraseña123

Uso local (con la DB expuesta en localhost:5432):
    DATABASE_URL=postgresql://stats:stats@localhost:5432/stats \\
        python add_user.py usuario@capgemini.com contraseña123
"""
import sys
import os
import bcrypt
import psycopg

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://stats:stats@localhost:5432/stats",
)


def create_or_update_user(email: str, password: str) -> None:
    email = email.lower().strip()
    pwd_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(
            """
            INSERT INTO chatbot_users (email, password_hash)
            VALUES (%s, %s)
            ON CONFLICT (email)
            DO UPDATE SET password_hash = EXCLUDED.password_hash, active = TRUE
            """,
            (email, pwd_hash),
        )
        conn.commit()

    print(f"✅  Usuario '{email}' creado/actualizado correctamente.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python add_user.py email@capgemini.com contraseña")
        sys.exit(1)

    create_or_update_user(sys.argv[1], sys.argv[2])
