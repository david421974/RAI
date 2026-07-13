"""
Script para borrar usuarios del chatbot.

Uso dentro del contenedor:
    docker exec -it auth_api python del_user.py usuario@capgemini.com

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


def delete_user(email: str) -> None:
    email = email.lower().strip()

    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(
            """
            DELETE FROM chatbot_users
            WHERE email=%s
            """,
            (email,),
        )
        conn.commit()

    print(f"✅  Usuario '{email}' borrado correctamente.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Uso: python del_user.py email@capgemini.com")
        sys.exit(1)

    delete_user(sys.argv[1])
