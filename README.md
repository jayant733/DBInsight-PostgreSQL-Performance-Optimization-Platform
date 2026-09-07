# PostgreSQL E-commerce Query Performance Lab

An e-commerce analytical query performance lab analyzing bottlenecks based on PostgreSQL execution plans and experimental measurements. It explores optimization techniques including Indexes, Materialized Views, and Join/Scan strategies while rigorously verifying result correctness alongside performance.

> The metrics in the representative results table reflect **values recorded in previous baseline experiments**. On 2026-08-28, scenarios Q1, Q4, Q6, and Q10 were reproduced on a dedicated standalone database; the new measurement values and raw execution plans are documented separately in [docs/reproduction-results.md](docs/reproduction-results.md).

## Overview

For each scenario (Q1 to Q10), the lab follows a structured workflow:
`Baseline → EXPLAIN (ANALYZE, BUFFERS) → Bottleneck Analysis → Tuning → Execution Plan Comparison → Correctness Verification`.

Rather than arbitrarily choosing a specific index or Join method, this lab evaluates `Buffers`, actual row counts, scan methods, and business boundary conditions together.

## Environment

- PostgreSQL 17 — Baseline experimental environment
- DBeaver — Used for SQL execution and plan inspection
- Default schema: `ecom`
- Built-in SQL scripts generate the schema and synthetic seed data

## Dataset / Schema

Instead of external CSV files, the e-commerce domain data is generated using [`sql/schema.sql`](sql/schema.sql) and [`sql/seed.sql`](sql/seed.sql). The seed script creates customers, addresses, and order data with realistic synthetic values such as `userN@example.com` and `Customer N`.

Key domains include:

| Domain | Key Tables |
| --- | --- |
| Customer | `customers`, `addresses`, `country` |
| Product | `categories`, `products`, `product_prices`, `suppliers`, `inventory` |
| Order | `orders`, `order_items`, `payments`, `shipments` |
| Quality Metrics | `reviews` |

The baseline dataset scale comprises 6,830 orders, 18,622 order items, 3,000 customers, 600 products/inventory records, and 2,060 reviews.

## Optimization Workflow

```text
Baseline Query
  → EXPLAIN (ANALYZE, BUFFERS)
  → Bottleneck Analysis
  → Index / Query Shape / Materialized View
  → Execution Plan Comparison
  → Correctness Verification
  → Repeated Measurement where applicable
```

Detailed objectives and records for each query can be found in [docs/query-summary.md](docs/query-summary.md), and the complete experiment log is in [docs/progress-summary.md](docs/progress-summary.md).

## Query Scenarios

| Query | Goal | Main optimization explored |
| --- | --- | --- |
| Q1 | Realized revenue for the past month | Partial Index, Index Only Scan, Daily GMV MV with boundary date adjustment |
| Q2 | Monthly order count, revenue, and AOV | Pre-aggregation at order level, Monthly MV |
| Q3 | Top 10 revenue categories in the past 90 days | Partial Index, Product pre-aggregation, Daily category MV |
| Q4 | Cumulative revenue RANK Top 20 by product | Partial Index, Pre-aggregation, Merge Join, Product revenue MV |
| Q5 | Customer RFM | Pre-aggregation at order level to remove `DISTINCT`, Customer RFM MV |
| Q6 | Repeat purchase rate within 30 days of first purchase | Correlated `EXISTS` removal, Pre-aggregating subsequent orders, First purchase MV |
| Q7 | Low-stock products | Selectivity review of Partial Index and Low-stock MV |
| Q8 | High-rating & high-review products | Review pre-aggregation and Product review MV |
| Q9 | Average order value by coupon usage | Pre-aggregation at order level and Coupon metrics MV |
| Q10 | Past 60-day revenue of top 1% customers by cumulative spend | Join strategy comparison, Combining customer cumulative spend MV with recent raw data |

## Representative Results

| Query | Existing experiment result | Main observation |
| --- | --- | --- |
| Q1 | 500-run average `1.349 ms → 0.769 ms` | Partial Index / Index Only Scan and boundary-adjusted MV |
| Q4 | `7.984 ms → 3.059 ms` | Merge Join leveraging sorted indexes is advantageous for this data/query |
| Q6 | `5,633 → 142` buffers | Replacing correlated `EXISTS` with pre-aggregation reduced repeated table access |
| Q10 | Forced Nested Loop `690.278 ms`, `15,976` buffers → MV + recent raw data `3.159 ms` | Demonstrates the risks of artificially forcing a specific join algorithm |

*Note: Measurement baselines differ per query. Q1 uses a 500-run average, Q6 compares buffer counts, and the 690.278 ms in Q10 represents a performance degradation caused by forcing a Nested Loop.*

## Case Study 1 — Q1: Performance & Date Boundary Accuracy

Calculates realized revenue for valid orders (`paid`, `shipped`, `delivered`) over the past month. In the baseline records, the `orders` Seq Scan was replaced with an Index Only Scan using a composite partial index, achieving 0 Heap Fetches.

A naive daily GMV Materialized View showed very fast baseline measurements (`0.053 ms`), but because it aggregated from midnight of the boundary date, it overcounted revenue by `39,475.01`. The final approach reads fully enclosed full dates from the MV and queries the partial boundary date from raw tables, maintaining exact parity with direct query results. Refer to [queries/q01/README.md](queries/q01/README.md) for the detailed step sequence.

## Case Study 2 — Q4: Merge Join as a Conditional Optimization

In ranking the Top 20 products by cumulative revenue, partial indexes and pre-aggregations were applied. In the baseline records, leveraging the ordered `order_id` index with a Merge Join eliminated sorting overhead, reducing execution time from `7.984 ms → 3.059 ms`.

This does not mean Merge Join is universally superior. In the same experiment, Nested Loop yielded similar runtime but drastically increased buffer consumption, demonstrating the importance of evaluating execution plans and I/O together.

## Case Study 3 — Q6: From Correlated EXISTS to Pre-aggregation

When calculating the 30-day repeat purchase rate following a customer's first purchase, the baseline correlated subplan performed repeated access per customer. Transforming the query to pre-aggregate subsequent orders before joining reduced buffer reads from `5,633 → 142`.

## Case Study 4 — Q10: Measuring Bad Tuning

When aggregating recent revenue for top customers, forcing a Nested Loop caused severe performance degradation to `690.278 ms` and `15,976` buffers. A hybrid approach—pre-computing cumulative revenue via an MV while querying real-time 60-day revenue from raw tables—achieved `3.159 ms`.

This highlights that `Query Optimization ≠ Forcing a specific join algorithm`, and decisions must be made based on cardinality, execution plans, and buffer usage.

## Correctness Verification

Each Query directory contains SQL scripts comparing baseline against tuned/MV results. The validation employs bidirectional `EXCEPT ALL`, row count / amount / rank comparisons, and date boundary checks. Notably in Q1, overcounting in naive MVs was identified and corrected.

Baseline artifacts are preserved. Scenarios Q1, Q4, Q6, and Q10 were re-executed from scratch on a dedicated database on 2026-08-28, with results and execution plans documented in [reproduction-results.md](docs/reproduction-results.md).

## Project Structure

```text
ecom_analysis/
├── sql/
│   ├── schema.sql
│   └── seed.sql
├── queries/
│   ├── q01/ … q10/
│   └── q01/full_workflow.sql
├── benchmarks/
│   └── q01_benchmark.sql
└── docs/
    ├── progress-summary.md
    ├── query-summary.md
    ├── reproduction.md
    ├── reproduction-results.md
    └── plans/
```

## How to Reproduce

Prepare a new PostgreSQL 17 database, then execute the schema and seed scripts in order. Detailed commands and query execution steps are documented in [docs/reproduction.md](docs/reproduction.md).

## Dashboard and Live Query Analyzer

Start the bundled database with `docker compose up -d`, then run `npm install`
and `npm run dev` inside `dashboard-v2`. QueryLab PostgreSQL uses host port
`5434` by default to avoid collisions with other local projects.

The original Q1–Q10 pages remain recorded, reproducible case studies. The
**Add new query** page is live: it accepts one read-only `SELECT`/`WITH`, runs a
timed `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, gives conservative rule-based
advice, verifies safe rewrite candidates with bidirectional `EXCEPT ALL`, and
saves analyses in PostgreSQL. See [dashboard-v2/README.md](dashboard-v2/README.md)
for setup and safety details.

## Limitations

- Metrics in the representative results table reflect baseline experiment logs; newly reproduced metrics are maintained in separate documents.
- Execution time is influenced by OS page cache, PostgreSQL shared buffers, hardware, planner statistics, data volume, and execution sequence.
- Certain Join/Bitmap comparison files use intentional planner overrides or temporary DDL for educational analysis; follow the specified execution order and run cleanup scripts afterwards.
- The current working copy does not include Git history or automated CI.

## Key Takeaways

- Interpreted `EXPLAIN (ANALYZE, BUFFERS)` alongside actual row counts rather than relying on execution time alone.
- Recognized that Seq Scan can be the optimal choice for low-selectivity analytical queries.
- Ensured Materialized View speedups are backed by strict boundary condition and result parity validation.
- Selected Join/Scan strategies based on data distribution and execution plans rather than rigid assumptions.
