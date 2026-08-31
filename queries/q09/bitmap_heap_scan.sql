-- Q9 Forced Bitmap Heap Scan comparison using status index
-- High proportion of valid orders makes default Seq Scan more sensible.
BEGIN;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = on;
SET LOCAL jit = off;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id, o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
)
SELECT coupon_used, COUNT(*) AS order_count, ROUND(AVG(order_total), 2) AS avg_order_amount,
       SUM(order_total) AS revenue
FROM order_totals GROUP BY coupon_used ORDER BY coupon_used DESC;
ROLLBACK;
