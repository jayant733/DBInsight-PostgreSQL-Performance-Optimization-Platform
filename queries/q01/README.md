# Q1 — Realized Revenue for the Past Month

Calculates the sum of `order_items.line_total` for orders in `paid`, `shipped`, or `delivered` status over the past month.

## Experiment Flow

1. `baseline.sql` / `baseline_plan.sql` — Pre-tuning query result and `EXPLAIN (ANALYZE, BUFFERS)`
2. `tuned.sql` / `tuned_plan.sql` — Query result and plan after applying a composite partial index
3. `hash_join.sql`, `nested_loop.sql`, `merge_join.sql` — Join algorithm comparisons
4. `bitmap_heap_scan.sql` followed by `bitmap_cleanup.sql` — Reverting temporary Bitmap experiment setup
5. `materialized_view_refresh.sql` → `materialized_view_result_compare.sql` → MV plan files — MV refresh, result comparison, and plan inspection

`full_workflow.sql` serves as a reference script containing the integrated workflow for Q1, and `benchmarks/q01_benchmark.sql` is a helper script executing 500 repeated iterations for both baseline and tuned plans.

## Accuracy & Correctness Notes

A naive daily MV can overcount revenue when the start timestamp falls in the middle of a day because it aggregates starting from midnight of that boundary day. `materialized_view_boundary_safe_plan.sql` demonstrates a safe hybrid approach: reading fully enclosed calendar dates from the MV and querying the fractional boundary day from the raw tables.
