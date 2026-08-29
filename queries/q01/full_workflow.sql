/*
Q1. Realized Revenue for the Past Month

Conditions:
  - order_status IN ('paid', 'shipped', 'delivered')
  - order_ts >= now() - interval '1 month'
  - Sum of order_items.line_total

DBeaver Usage:
  - Select each block one at a time and execute with Command+Enter (macOS) / Ctrl+Enter (Windows).
  - Complete the 'Pre-Tuning' captures first, then execute the 'Post-Tuning' block.
  - Run from 0 (BEGIN) through 6 (COMMIT) within the same connection.
    This fixes PostgreSQL's now() throughout the transaction for exact pre/post result comparison.
*/

-- 0. Connection and Data Verification
BEGIN;

SELECT current_database() AS database_name,
       current_user AS user_name,
       now() AS benchmark_as_of,
       COUNT(*) AS order_count
FROM ecom.orders;


-- 1. Restore Pre-Tuning Environment
-- Only drops the index introduced in this lab; original schema indexes are untouched.
DROP INDEX IF EXISTS ecom.idx_orders_revenue_ts_order_id;
ANALYZE ecom.orders;
ANALYZE ecom.order_items;

-- Must return NULL to confirm pre-tuning state.
SELECT to_regclass('ecom.idx_orders_revenue_ts_order_id') AS index_before;


-- 2. Pre-Tuning Result
SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';


-- 3. Pre-Tuning Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(oi.line_total) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';


-- 4. Tuning: Composite partial index on valid orders
-- order_ts: range scan for past 1 month
-- order_id: covering column to avoid table access when joining order_items
CREATE INDEX IF NOT EXISTS idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

ANALYZE ecom.orders;

-- Must display index name to confirm post-tuning state.
SELECT to_regclass('ecom.idx_orders_revenue_ts_order_id') AS index_after;


-- 5. Post-Tuning Result: Must match result from step 2 exactly.
SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';


-- 6. Post-Tuning Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(oi.line_total) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';

COMMIT;


-- 7. Result Validation Helper Query
-- Check for future-dated orders (which can exist due to the seed repurchase generation logic).
SELECT now() AS checked_at,
       MAX(order_ts) AS max_order_ts,
       COUNT(*) FILTER (WHERE order_ts > now()) AS future_order_count
FROM ecom.orders;
