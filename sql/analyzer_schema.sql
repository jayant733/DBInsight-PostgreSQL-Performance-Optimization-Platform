-- Persistence and least-privilege role for the local QueryLab analyzer.
-- This runs after schema.sql and seed.sql on a fresh Docker volume.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'querylab_app') THEN
    CREATE ROLE querylab_app LOGIN PASSWORD 'querylab';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS analyzer;

CREATE TABLE IF NOT EXISTS analyzer.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sql_text TEXT NOT NULL,
  sql_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'ok', 'suggestion_only', 'rejected', 'timeout', 'error')
  ),
  reject_reason TEXT,
  baseline_plan JSONB,
  baseline_metrics JSONB,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidate_sql TEXT,
  candidate_plan JSONB,
  candidate_metrics JSONB,
  parity JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_created_at
  ON analyzer.analyses (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_sql_hash
  ON analyzer.analyses (sql_hash);

GRANT CONNECT ON DATABASE postgres TO querylab_app;
GRANT USAGE ON SCHEMA ecom TO querylab_app;
GRANT SELECT ON ALL TABLES IN SCHEMA ecom TO querylab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA ecom
  GRANT SELECT ON TABLES TO querylab_app;

GRANT USAGE ON SCHEMA analyzer TO querylab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON analyzer.analyses TO querylab_app;

ALTER ROLE querylab_app SET statement_timeout = '8s';
ALTER ROLE querylab_app SET lock_timeout = '1s';
ALTER ROLE querylab_app SET idle_in_transaction_session_timeout = '10s';
