# Reproduction Guide

## Prerequisites

- PostgreSQL 17 recommended (minimum stated support across SQL files is PostgreSQL 14+)
- Permissions to create `citext` and `btree_gist` extensions
- A new local database

## Setup

The example below creates and populates a new database named `ecom_lab`. Since the SQL scripts create and use the `ecom` schema, the database name can be customized.

```bash
createdb ecom_lab
psql -d ecom_lab -f sql/schema.sql
psql -d ecom_lab -f sql/seed.sql
```

> [!CAUTION]
> `seed.sql` performs `TRUNCATE ... RESTART IDENTITY` on existing tables before inserting synthetic seed data. Never run this against a production or shared database.

## Query Execution

Execute scripts within each `queries/qNN/` directory in the following sequence:

1. Check `execution_order.sql` first if present.
2. Run `baseline.sql` and `baseline_plan.sql`.
3. Run `tuned.sql` and `tuned_plan.sql`.
4. Run Join and Bitmap comparison files. Always run `bitmap_cleanup.sql` in the same session immediately after `bitmap_heap_scan.sql`.
5. Run `materialized_view.sql`, `result_compare.sql`, `materialized_view_plan.sql`, and any optional validation files.

For Q1, follow the sequence in [queries/q01/README.md](../queries/q01/README.md). For repeated iteration benchmarks, execute `benchmarks/q01_benchmark.sql` separately.

## Correctness Checks

The query directories contain validation SQL scripts featuring bidirectional `EXCEPT ALL`, monetary sum, ranking, row count, and date boundary comparisons. Verify that `EXCEPT ALL` queries return 0 rows and inspect `Buffers` alongside actual row counts in the execution plans.

## Benchmarking Notes

Execution time is influenced by OS page cache, PostgreSQL shared buffers, underlying hardware, optimizer statistics, data volume, and script execution sequence. The figures in the main README reflect baseline experiment logs; this guide outlines reproduction procedures and does not guarantee identical microsecond-level timings.
