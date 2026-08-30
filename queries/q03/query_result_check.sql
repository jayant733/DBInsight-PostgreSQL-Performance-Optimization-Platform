-- Q3 Parity verification across all categories between baseline and tuned: mismatch_rows must be 0.
WITH baseline AS (
  SELECT c.category_id,
         c.category_name,
         SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  JOIN ecom.products AS p ON p.product_id = oi.product_id
  JOIN ecom.categories AS c ON c.category_id = p.category_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY c.category_id, c.category_name
),
product_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
),
tuned AS (
  SELECT c.category_id,
         c.category_name,
         SUM(ps.revenue) AS revenue
  FROM product_sales AS ps
  JOIN ecom.products AS p ON p.product_id = ps.product_id
  JOIN ecom.categories AS c ON c.category_id = p.category_id
  GROUP BY c.category_id, c.category_name
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows
FROM diff;
