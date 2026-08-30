-- Q4 Tuned Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id,
         SUM(oi.line_total) AS revenue
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
SELECT product_id, product_name, revenue, revenue_rank
FROM ranked
WHERE revenue_rank <= 20
ORDER BY revenue_rank, product_id;

