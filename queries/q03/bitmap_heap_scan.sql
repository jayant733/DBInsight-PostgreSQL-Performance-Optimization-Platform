-- Q3 Bitmap Heap Scan Comparison
-- Temporarily drops Q1 partial index to collect candidate TIDs using single date index.
BEGIN;
DROP INDEX IF EXISTS ecom.idx_orders_q4_valid_order_id;
DROP INDEX IF EXISTS ecom.idx_orders_revenue_ts_order_id;
CREATE INDEX idx_orders_q3_ts_only ON ecom.orders (order_ts);
ANALYZE ecom.orders;

SET LOCAL enable_hashjoin = on;
SET LOCAL enable_nestloop = on;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = on;
SET LOCAL jit = off;

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

-- Execute 08b_cleanup.sql after capturing plan
