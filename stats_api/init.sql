CREATE TABLE IF NOT EXISTS intent_hits (
  intent TEXT PRIMARY KEY,
  pregunta_principal TEXT,
  pregunta_realizada TEXT,
  hits BIGINT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_hits_hits ON intent_hits (hits DESC);
