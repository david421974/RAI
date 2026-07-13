-- ─── Tabla de usuarios del chatbot ──────────────────────────────────────────
-- Este script se ejecuta automáticamente al inicializar stats_db
-- (solo la primera vez, si el volumen está vacío)

CREATE TABLE IF NOT EXISTS chatbot_users (
    id            SERIAL       PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    active        BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- Índice para acelerar el login
CREATE INDEX IF NOT EXISTS idx_chatbot_users_email
    ON chatbot_users (email)
    WHERE active = TRUE;
