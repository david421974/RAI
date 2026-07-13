"""
Script para listar usuarios del chatbot.

Uso dentro del contenedor:
    docker exec -it auth_api python sel_user.py

Uso local (con la DB expuesta en localhost:5432):
    DATABASE_URL=postgresql://stats:stats@localhost:5432/stats \\
        python del_user.py usuario@capgemini.com
"""
import sys
import os
import bcrypt
import psycopg

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://stats:stats@localhost:5432/stats",
)


def select_user() -> None:
    with psycopg.connect(DATABASE_URL) as conn:
      with conn.cursor() as cur:
        cur.execute("SELECT id, email, active FROM chatbot_users")
        rows = cur.fetchall()
        for row in rows:
            print(row)


if __name__ == "__main__":
    if len(sys.argv) != 1:
        print("Uso: python sel_user.py")
        sys.exit(1)

    select_user()
