-- Q5 Tuned Result
-- Pre-aggregates order totals first to eliminate COUNT(DISTINCT) at customer level.
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         o.customer_id,
         o.order_ts,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
)
SELECT customer_id,
       MAX(order_ts) AS last_order_ts,
       CURRENT_DATE - MAX(order_ts)::date AS recency_days,
       COUNT(order_id) AS frequency,
       ROUND(SUM(order_total), 2) AS monetary
FROM order_totals
GROUP BY customer_id
ORDER BY monetary DESC, customer_id;

