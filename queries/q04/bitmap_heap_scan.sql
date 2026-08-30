-- Q4 Bitmap Heap Scan Comparison
-- Low selectivity across cumulative revenue makes Seq Scan the default optimal choice.
-- Forces Bitmap Heap Scan on the status index for instructional comparison.
BEGIN;
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
  GROUP BY oi.product_id
),
ranked AS (
  SELECT ps.product_id,
         p.product_name,
         ps.revenue,
         RANK() OVER (ORDER BY ps.revenue DESC) AS revenue_rank
  FROM product_sales AS ps
  JOIN ecom.products AS p ON p.product_id = ps.product_id
)
SELECT * FROM ranked
WHERE revenue_rank <= 20
ORDER BY revenue_rank, product_id;

-- Execute 08b_cleanup.sql after capturing plan

