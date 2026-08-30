-- Q5 Baseline Execution Plan
-- Large sort to compute COUNT(DISTINCT order_id) over joined rows is the primary bottleneck.
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.customer_id,
       MAX(o.order_ts) AS last_order_ts,
       CURRENT_DATE - MAX(o.order_ts)::date AS recency_days,
       COUNT(DISTINCT o.order_id) AS frequency,
       SUM(oi.line_total) AS monetary
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY o.customer_id
ORDER BY monetary DESC, o.customer_id;

