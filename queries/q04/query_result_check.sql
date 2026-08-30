-- Q4 Parity verification across all product rankings between baseline and tuned: mismatch_rows must be 0.
WITH baseline_sales AS (
  SELECT p.product_id, p.product_name, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  JOIN ecom.products AS p ON p.product_id = oi.product_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY p.product_id, p.product_name
),
baseline AS (
  SELECT product_id,
         product_name,
         revenue,
         RANK() OVER (ORDER BY revenue DESC) AS revenue_rank
  FROM baseline_sales
),
tuned_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY oi.product_id
),
tuned AS (
  SELECT ts.product_id,
         p.product_name,
         ts.revenue,
         RANK() OVER (ORDER BY ts.revenue DESC) AS revenue_rank
  FROM tuned_sales AS ts
  JOIN ecom.products AS p ON p.product_id = ts.product_id
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows
FROM diff;
