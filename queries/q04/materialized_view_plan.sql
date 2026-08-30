-- Q4 Top 20 RANK Execution Plan using Product Cumulative Revenue MV
EXPLAIN (ANALYZE, BUFFERS)
WITH ranked AS (
  SELECT m.product_id,
         p.product_name,
         m.revenue,
         RANK() OVER (ORDER BY m.revenue DESC) AS revenue_rank
  FROM ecom.mv_product_revenue AS m
  JOIN ecom.products AS p USING (product_id)
)
SELECT * FROM ranked
WHERE revenue_rank <= 20
ORDER BY revenue_rank, product_id;
