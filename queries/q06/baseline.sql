-- Q6 Baseline: Verifying repeat purchase within 30 days of first purchase via correlated EXISTS
DROP INDEX IF EXISTS ecom.idx_orders_q6_valid_customer_ts;
ANALYZE ecom.orders;

WITH first_orders AS MATERIALIZED (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
customer_repurchase AS MATERIALIZED (
  SELECT f.customer_id,
         EXISTS (
           SELECT 1
           FROM ecom.orders AS r
           WHERE r.customer_id = f.customer_id
             AND r.order_status IN ('paid', 'shipped', 'delivered')
             AND r.order_ts > f.first_order_ts
             AND r.order_ts <= f.first_order_ts + INTERVAL '30 days'
         ) AS repurchased_30d
  FROM first_orders AS f
)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (WHERE repurchased_30d) AS repurchased_customers,
       ROUND(
         100.0 * COUNT(*) FILTER (WHERE repurchased_30d)
         / NULLIF(COUNT(*), 0),
         2
       ) AS repurchase_rate_pct
FROM customer_repurchase;
