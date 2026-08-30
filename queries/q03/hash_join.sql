-- Q3 Tuned Query: Hash Join Comparison
BEGIN;
DROP INDEX IF EXISTS ecom.idx_orders_q4_valid_order_id;
SET LOCAL enable_hashjoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_mergejoin = off;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
)
SELECT c.category_id, c.category_name, SUM(ps.revenue) AS revenue
FROM product_sales AS ps
JOIN ecom.products AS p ON p.product_id = ps.product_id
JOIN ecom.categories AS c ON c.category_id = p.category_id
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC, c.category_id
LIMIT 10;

ROLLBACK;
