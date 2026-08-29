-- Q1 Bitmap Heap Scan Comparison: Run 08b_cleanup.sql after capture
BEGIN;
SET LOCAL enable_hashjoin = on;
SET LOCAL enable_nestloop = on;
SET LOCAL enable_mergejoin = on;
DROP INDEX ecom.idx_orders_revenue_ts_order_id;
CREATE INDEX idx_orders_q1_ts_only ON ecom.orders(order_ts);
ANALYZE ecom.orders;

EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(oi.line_total) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';
