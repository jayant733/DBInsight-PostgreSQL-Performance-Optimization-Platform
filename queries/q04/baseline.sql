-- Q4 Baseline Result: Top 20 products by cumulative revenue RANK
WITH product_revenue AS (
  SELECT p.product_id,
         p.product_name,
         SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  JOIN ecom.products AS p ON p.product_id = oi.product_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY p.product_id, p.product_name
),
ranked AS (
  SELECT product_id,
         product_name,
         ROUND(revenue, 2) AS revenue,
         RANK() OVER (ORDER BY revenue DESC) AS revenue_rank
  FROM product_revenue
)
SELECT product_id, product_name, revenue, revenue_rank
FROM ranked
WHERE revenue_rank <= 20
ORDER BY revenue_rank, product_id;

