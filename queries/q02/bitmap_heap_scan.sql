-- Q2 Bitmap Heap Scan Comparison
-- Low selectivity makes Seq Scan naturally more suitable for full-period monthly reports.
-- Disables Seq/standard Index scans to observe Bitmap Scan behavior on the status index for study.
BEGIN;
DROP INDEX IF EXISTS ecom.idx_orders_q4_valid_order_id;
SET LOCAL enable_hashjoin = on;
SET LOCAL enable_nestloop = on;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = on;
SET LOCAL jit = off;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
)
SELECT order_month,
       COUNT(order_id) AS order_count,
       SUM(order_total) AS revenue,
       ROUND(AVG(order_total), 2) AS aov
FROM order_totals
GROUP BY order_month
ORDER BY order_month;

-- Execute 08b_cleanup.sql after capturing plan
