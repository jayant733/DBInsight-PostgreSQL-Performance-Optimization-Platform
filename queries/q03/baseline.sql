-- Q3 Baseline Result: Top 10 revenue categories in past 90 days
SELECT c.category_id,
       c.category_name,
       ROUND(SUM(oi.line_total), 2) AS revenue
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

