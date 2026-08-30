-- Q3 Tuned Result
-- Reuses recent-period partial index and pre-aggregates sales by product.
CREATE INDEX IF NOT EXISTS idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

ANALYZE ecom.orders;

WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id,
         SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
)
SELECT c.category_id,
       c.category_name,
       ROUND(SUM(ps.revenue), 2) AS revenue
FROM product_sales AS ps
JOIN ecom.products AS p
  ON p.product_id = ps.product_id
JOIN ecom.categories AS c
  ON c.category_id = p.category_id
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC, c.category_id
LIMIT 10;

