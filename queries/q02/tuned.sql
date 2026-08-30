-- Q2 Tuned Result
-- Pre-calculating order totals eliminates COUNT(DISTINCT) in the outer aggregation.
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
)
SELECT order_month,
       COUNT(order_id) AS order_count,
       ROUND(SUM(order_total), 2) AS revenue,
       ROUND(AVG(order_total), 2) AS aov
FROM order_totals
GROUP BY order_month
ORDER BY order_month;
