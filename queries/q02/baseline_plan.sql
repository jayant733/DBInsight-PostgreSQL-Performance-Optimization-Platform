-- Q2 Baseline Execution Plan
-- Sorting all joined rows by month/order_id for COUNT(DISTINCT) is the primary bottleneck.
EXPLAIN (ANALYZE, BUFFERS)
SELECT date_trunc('month', o.order_ts) AS order_month,
       COUNT(DISTINCT o.order_id) AS order_count,
       SUM(oi.line_total) AS revenue,
       ROUND(
         SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0),
         2
       ) AS aov
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY date_trunc('month', o.order_ts)
ORDER BY order_month;

