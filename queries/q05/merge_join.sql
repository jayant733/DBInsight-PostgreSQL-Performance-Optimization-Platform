-- Q5 Tuned Query: Merge Join Comparison
BEGIN;
DROP INDEX IF EXISTS ecom.idx_orders_q4_valid_order_id;
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_mergejoin = on;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
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
       SUM(order_total) AS monetary
FROM order_totals
GROUP BY customer_id
ORDER BY monetary DESC, customer_id;

ROLLBACK;
