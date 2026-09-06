# QueryLab — Easy Video Script

Use this when you record. Speak in your own voice. Q01–Q10 show **saved experiment results**. The **Add new query** section is live and runs read-only analysis against local PostgreSQL.

**Length:** about 5–6 minutes (or 3 minutes if you skip Q04).

**Open:** use the URL printed by Next.js (`http://localhost:3001` when port 3000 is already occupied).

---

## Why this project exists (say this first)

Most “I optimized a database” projects only show a faster query. That is not enough.

I built this because **slow e-commerce reports are usually a query problem, not a “buy a bigger server” problem**. Shops need answers like:

- How much money did we actually make last month?
- Which products are selling?
- Who are the best customers?
- How many new buyers come back?

If those queries scan the whole table, join the wrong way, or use a shortcut that **gets the wrong total**, the business makes bad decisions.

**Main reason:** prove that I can take a real-shaped Postgres shop, find *why* a query is slow (using `EXPLAIN ANALYZE` and buffer I/O, not guesswork), make it faster **or** show when “optimization” is a trap, and **prove the answer is still correct**.

That last part is the point. A wrong-but-fast number is worse than a slow-but-true one. In Q01 a “fast” daily summary overcounted revenue. I kept the speed idea, but fixed the date edge so the money matches the slow query exactly.

---

## What the project is (one paragraph)

This is a **PostgreSQL 17 e-commerce performance lab**. Synthetic shop data (orders, items, customers, products, reviews) is created with `sql/schema.sql` and `sql/seed.sql`. There are **10 analytical queries**. For each one I:

1. Run the naive query (baseline).
2. Read the real plan and how much data it touched (buffers).
3. Change indexes, query shape, join style, or a materialized view.
4. Compare plans and timings.
5. Check that baseline and tuned results match (`EXCEPT ALL` and similar checks).

The Next.js dashboard is a **walkthrough of those recorded results** — charts, plans, and SQL side by side. Postgres itself is started with Docker (`docker-compose.yml`). Re-run the `.sql` files if you need fresh numbers; they will move a little because of cache and hardware.

Queries that mean “last month / last 90 days / last 60 days” use **`now()`**, not a frozen calendar date. Totals change as time passes. That is on purpose.

---

## What is live vs saved (read this before you record)

| Piece | What it actually is |
| --- | --- |
| `sql/` + `queries/q01`…`q10` | Real SQL. You run it on PostgreSQL. Dates like “past month” are relative to today. |
| Docker Postgres | Real database. Schema + seed load on first start. |
| Built-in Q01–Q10 numbers, charts, plan graphs | **Saved** from the documented experiments, not queried again on every page load. |
| Correctness “PASS” on the UI | Copied from the SQL checks you already ran. Re-run the compare scripts in Postgres to prove it again. |
| **Add new query** | Live. It runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on local Postgres, builds a plan graph, gives rule-based advice, and saves the result. |
| Sidebar connection status | Live check of the analyzer API/database. |

If someone asks “is this dashboard hitting the DB?” say: **The original ten cases are reproducible saved benchmarks. New Query analysis is live against the local Docker database.**

### Optional live analyzer scene — Add new query

**Click:** **Add new query**. Enter a title, load the example, then click **Analyze & save**.

**Say:**

> This section is live. I can paste one read-only SELECT or WITH query. QueryLab runs the real PostgreSQL plan with an eight-second safety limit, measures execution time and buffers, and turns the JSON plan into the same visual graph.
>
> The advisor uses conservative rules, not an AI guess. It can point out a selective sequential scan, repeated correlated work, a small table where Seq Scan is correct, or a pre-aggregation pattern.
>
> It does not create indexes or change data. It only generates a rewritten query for a pattern that the lab already knows how to transform safely. Even then, it runs both versions and uses bidirectional EXCEPT ALL. If the rows differ, the candidate fails. If no safe rewrite exists, it honestly says “Suggestion only.”
>
> Every analysis is saved in PostgreSQL and appears in the sidebar. Verified candidates also join the benchmark charts.

---

## Simple story of all 10 queries

| ID | In plain words | What I learned |
| --- | --- | --- |
| Q01 | Last month’s **real** sales (paid / shipped / delivered only) | Partial index + index-only scan. A naive daily MV **overcounted** because it included a full calendar day at the cutoff. Hybrid MV + raw data for the edge day = fast **and** exact. |
| Q02 | Orders, revenue, average order value **by month** | Joining line items duplicates orders. Pre-aggregate per order instead of `COUNT(DISTINCT)` on a huge join. |
| Q03 | Top 10 categories, last 90 days | Shrink to product totals first, then join categories. Don’t join every line to every dimension first. |
| Q04 | Top 20 products by revenue (ranking) | Same idea: aggregate first. Here an **ordered Merge Join** beat a big Hash Join. |
| Q05 | Customer RFM (recency, frequency, money) | Two-step aggregation; drop expensive `DISTINCT`. |
| Q06 | After first purchase, how many buy again in 30 days? | Correlated `EXISTS` did extra work **per customer**. Rewrite as a join + pre-agg. Time barely changed; **buffers dropped ~98%** (4,756 → 78). That is the win under load. |
| Q07 | Products below reorder point | Inventory is tiny (~600 rows). Forcing an index was **slower**. Seq Scan was the right call. Tuning is not “always add an index.” |
| Q08 | High rating + enough reviews | Aggregate reviews first, then join products. |
| Q09 | Average order value with vs without coupon | Cleaner query (no duplicated lines). Slightly slower on this small data; shape still matters as data grows. |
| Q10 | Top 1% spenders and their last 60 days | Forcing Nested Loop blew up (~690 ms, huge buffers). Don’t force a join type. Mix a lifetime summary with recent raw rows. |

---

## Recording checklist

1. `docker compose up -d` if you want Postgres in the background (optional for the UI).
2. Dashboard: `cd dashboard-v2` then `npm run dev` → `http://localhost:3000`
3. Browser 1920×1080, 100% zoom, no extra tabs.
4. Do **not** say “the dashboard is connected to live telemetry” unless you have wired that.

---

## Video flow (where to click + what to say)

### Scene 1 — Home (`/`) — ~50 seconds

**Click:** KPI cards, then the two charts, then the table.

**Say:**

> I built QueryLab because e-commerce dashboards fail in two ways: they are slow, or they are fast and wrong.
>
> This is a PostgreSQL 17 lab. Ten real reporting questions on shop data. For each one: measure the naive query, read the plan and the I/O, change the query or the indexes, then prove the numbers still match.
>
> The cards are the headline from those runs: ten queries, about 40% average time win where time went down, a peak of about 98% less buffer I/O on the worst pattern, and ten out of ten exact-match checks.
>
> I always look at **time and buffers**. A query can look fast from cache and still hammer the disk when many people run it.
>
> Next, the full scoreboard.

**Click:** Benchmarks.

---

### Scene 2 — Benchmarks (`/benchmarks`) — ~50 seconds

**Point at:** green speedups, Q06 buffer drop, Q07 negative speedup, PASS column.

**Say:**

> This is every query, before vs after.
>
> Q01 is a classic index win. Q06 is the important one: almost the same milliseconds, but almost no repeated page reads. That is what saves the database when traffic is high.
>
> Q07 is slower after a “clever” index. The table is small. Postgres was right to sequential-scan it. I left that in on purpose so this is not a fake “everything got faster” demo.
>
> PASS means the tuned result matched the baseline. Speed without that check is not engineering.

**Click:** Execution Plans.

---

### Scene 3 — Plans (`/plans`) — ~45 seconds

**Do:** scroll Q01 then Q06. Blue = scans, purple = joins, yellow = aggregates.

**Say:**

> `EXPLAIN` is a tree of how Postgres actually ran the query. Here it is drawn as a graph so you can see the change.
>
> Q01 baseline walks a lot of the orders table. Tuned version can use an index that only holds paid, shipped, and delivered orders, and can answer from the index without extra heap fetches.
>
> Q06 baseline is a loop: for many customers, run another lookup. Tuned version does that work once with a hash join.
>
> Now three examples in detail.

**Click:** Q01.

---

### Scene 4 — Q01 (`/queries/q01`) — ~45 seconds

**Point at:** times, SQL, key insight (date boundary).

**Say:**

> Q01 is last month’s realized revenue — only orders that actually count as sold.
>
> The index is partial: it does not store cancelled or unpaid rows, so it stays small. Postgres can index-only scan it.
>
> The trap: a daily pre-computed total that starts at midnight on the cutoff day **adds extra money**. I saw thousands of dollars of overcount. The fix is boring and correct: take full days from the summary, and only the leftover hours from the raw tables, then add them. Fast path, same number as the slow query.

**Click:** Q04 (or skip to Q06 for a 3-minute cut).

---

### Scene 5 — Q04 (`/queries/q04`) — ~35 seconds

**Say:**

> Q04 ranks products by revenue.
>
> If you join every line item to product names first, ranking runs on a huge pile of rows. I total sales per product first, then join names, then rank. Fewer rows, less work.
>
> On this data, a merge join on already-ordered keys beat building a big hash table. That is not “merge join is always best.” It was best **here**, which is why we read the plan.

**Click:** Q06.

---

### Scene 6 — Q06 (`/queries/q06`) — ~45 seconds

**Point at:** 4,756 vs 78 buffers.

**Say:**

> Repeat purchase rate: of people who bought at least once, how many bought again within 30 days.
>
> The naive version uses `EXISTS` per customer. Postgres keeps coming back to the orders table. Time looked fine. Buffers did not — thousands of hits.
>
> After rewriting it as a set join with a pre-aggregated first-repeat date, buffers fell from 4,756 to 78. Same answer. That is the query I would show a hiring manager: **I/O is the real bottleneck.**

**Click:** Q10.

---

### Scene 7 — Q10 (`/queries/q10`) — ~40 seconds

**Point at:** join comparison / Nested Loop warning.

**Say:**

> Q10 is top 1% of customers by lifetime spend, plus how much they spent in the last 60 days.
>
> If you force a nested loop because a blog post said “indexes plus nested loop,” this query went to hundreds of milliseconds and huge I/O. The planner’s hash join was the sane choice.
>
> The good design: one order-total calculation reused for ranking and for the 60-day window, and a lifetime summary for the heavy part. Do not force join types.

**Click:** Dashboard.

---

### Scene 8 — Close (`/`) — ~25 seconds

**Say:**

> So the reason this repo exists is not pretty charts. It is a habit: measure, read the plan, change the query, **check the answer**.
>
> Indexes help when they match the filter. Aggregating early helps when joins explode rows. Materialized views help when you respect date edges. Sometimes Seq Scan is correct. Sometimes the “faster” path is a lie.
>
> The SQL and how to reproduce it are in the repo. Thanks for watching.

---

## 3-minute version

1. Why + KPIs (home).
2. Benchmarks: Q06 buffers, Q07 Seq Scan lesson, PASS.
3. Q01 date bug + Q06 I/O + Q10 nested-loop trap.
4. Close: correctness first.

---

## Numbers to quote (dashboard snapshot)

Do not mix these with older README figures (those are a different run).

| Query | Baseline ms | Tuned ms | Speedup | Buffers before → after |
| --- | ---: | ---: | ---: | --- |
| Q01 | 2.79 | 1.33 | +52.2% | 138 → 106 |
| Q02 | 14.20 | 7.94 | +44.1% | 251 → 251 |
| Q03 | 8.62 | 4.48 | +48.0% | 259 → 226 |
| Q04 | 2.80 | 2.19 | +21.8% | 148 → 123 |
| Q05 | 20.36 | 10.02 | +50.8% | 257 → 251 |
| Q06 | 2.48 | 2.42 | +2.6% | **4756 → 78** |
| Q07 | 0.23 | 0.39 | −70.4% | 18 → 18 |
| Q08 | 2.74 | 1.75 | +36.3% | 35 → 35 |
| Q09 | 12.58 | 14.62 | −16.2% | 259 → 256 |
| Q10 | 6.65 | 6.79 | −2.1% | 300 → 181 |

Peak buffer cut: **Q06, 98.4%**. Nested-loop disaster (not the default tuned query): **~690 ms** on Q10 when forced.

---

## How to reproduce the real (dynamic) lab

```bash
docker compose up -d
# wait until Postgres is healthy, then:
# createdb if you are not using the compose DB name
psql -h localhost -U postgres -d postgres -f sql/schema.sql
psql -h localhost -U postgres -d postgres -f sql/seed.sql
```

Compose already mounts schema + seed on **first** volume create. Then run files in each `queries/qNN/` in the order of `execution_order.sql` (or that folder’s README). Always run `bitmap_cleanup.sql` in the **same session** after bitmap experiments.

Full steps: `docs/reproduction.md`.
