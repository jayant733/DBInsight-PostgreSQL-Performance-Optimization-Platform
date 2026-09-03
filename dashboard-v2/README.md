# QueryLab Dashboard

Next.js dashboard for the PostgreSQL performance lab. It contains ten saved
reference scenarios plus a live, local-only query analyzer.

## Local setup

From the repository root:

```bash
docker compose up -d
cd dashboard-v2
npm install
npm run dev
```

Open the URL printed by Next.js. It is normally `http://localhost:3000`, or
`http://localhost:3001` when port 3000 is occupied.

QueryLab PostgreSQL is exposed on host port `5434` by default so it can coexist
with another local PostgreSQL. Override it with `QUERYLAB_POSTGRES_PORT`.

The app defaults to:

```text
postgresql://querylab_app:querylab@127.0.0.1:5434/postgres
```

Set `DATABASE_URL` to override it. Development mode refuses non-loopback
database URLs because this analyzer is intentionally local-only.

If Docker reports that the database volume already exists, install the analyzer
table once:

```bash
docker compose exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /analyzer_schema.sql
```

## Live analyzer

Click **Add new query**, enter a title, and paste one `SELECT` or `WITH` query.
The server:

1. Rejects writes, DDL, stacked statements, row locks, and unsafe functions.
2. Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` inside a read-only transaction
   with a statement timeout.
3. Converts the real plan to the interactive QueryLab graph.
4. Produces conservative plan-based advice.
5. Runs a rewritten candidate only for an exact, known-safe rule.
6. Uses bidirectional `EXCEPT ALL` before accepting candidate correctness.
7. Saves the analysis in PostgreSQL.

Index and materialized-view SQL is advice only. The analyzer never applies DDL
and never forces a join method. If no safe rewrite exists, it shows
**Suggestion only** instead of fake optimized metrics.

## Checks

```bash
npm test
npm run lint
npm run build
```
