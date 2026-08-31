# STEP 3 Reproduction Verification Results

## Scope and Environment

- Verification Date: 2026-08-28
- PostgreSQL Version: 17.10
- Execution sequence on a dedicated database: `sql/schema.sql`, `sql/seed.sql`, and `ANALYZE`
- Target Scenarios: Q1, Q4, Q6, Q10

This document does not overwrite previous experimental baseline logs. Because synthetic seeds utilize `random()`, and cache, optimizer statistics, and execution timings differ, the metrics below represent standalone reproduction measurements.

## Q1 — Realized Revenue for Past Month

- Baseline / Tuned result: Exactly identical at `846539.85`
- Baseline execution plan: `orders` Seq Scan, execution time `2.786 ms`, shared hit `138`
- Tuned execution plan: Partial index Index Only Scan, Heap Fetches `0`, execution time `1.333 ms`, shared hit `106`
- 500-run average: Baseline `0.746 ms`, Tuned `0.417 ms`
- The naive daily MV overcounted by `16457.10` due to the date boundary. The boundary-adjusted hybrid MV returned `846539.85`, matching the direct aggregation exactly.

## Q4 — Top 20 Products by Cumulative Revenue

- Baseline / Tuned full ranking comparison: `mismatch_rows = 0`
- Baseline: `2.798 ms`, shared hit `148`
- Tuned: `2.188 ms`, shared hit `123`, partial index Index Only Scan with Heap Fetches `0`
- Forced Join comparison: Hash Join `2.501 ms`, Merge Join `2.595 ms`, Nested Loop `4.485 ms`
- Product Revenue MV Top 20: `0.273 ms`, shared hit `17`; Top 20 revenues and ranks fully matched direct aggregation.

## Q6 — 30-Day Repeat Purchase Rate

- Baseline / Tuned results: Target `2247`, Repeat purchases `223`, Repeat purchase rate `9.92%` (identical)
- Baseline: `2.482 ms`, shared hit `4756`; Correlated SubPlan executed `2247` times
- Tuned: `2.418 ms`, shared hit `78`
- Baseline vs. Tuned and Direct Aggregation vs. MV comparisons: All `mismatch_rows = 0`
- First Purchase MV query: `0.354 ms`, shared hit `16`

## Q10 — Past 60-Day Revenue for Top 1% Customers

- Baseline / Tuned Top 30 comparison: `mismatch_rows = 0`
- Full customer cumulative spend direct aggregation vs. MV comparison: `mismatch_rows = 0` (`3000` customers)
- Baseline: `6.652 ms`, shared hit `300`
- Tuned pre-aggregation: `6.789 ms`, shared hit `181`
- Forced Nested Loop: `394.589 ms`, shared hit `10665`; Repeated CTE scanning per customer observed in the plan.
- Cumulative Spend MV + Recent 60-day raw aggregation: `3.036 ms`, shared hit `154`

## Raw Execution Plans

Representative `EXPLAIN (ANALYZE, BUFFERS)` outputs are preserved in [`docs/plans/`](plans/). These files contain unaltered raw execution plan outputs from the reproduction run.
