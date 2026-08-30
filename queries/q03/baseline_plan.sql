-- Q3 Baseline Execution Plan
-- Recreates state without Q1 partial index inside a transaction.
BEGIN;

DROP INDEX IF EXISTS ecom.idx_orders_revenue_ts_order_id;
ANALYZE ecom.orders;

EXPLAIN (ANALYZE, BUFFERS)
SELECT c.category_id,
       c.category_name,
       SUM(oi.line_total) AS revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
JOIN ecom.products AS p
  ON p.product_id = oi.product_id
JOIN ecom.categories AS c
  ON c.category_id = p.category_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '90 days'
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC, c.category_id
LIMIT 10;

ROLLBACK;

