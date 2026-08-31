-- Q6 Tuning: Valid order partial index on (customer_id, order_ts) + subsequent order pre-aggregation
CREATE INDEX IF NOT EXISTS idx_orders_q6_valid_customer_ts
ON ecom.orders (customer_id, order_ts)
INCLUDE (order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
ANALYZE ecom.orders;

WITH first_orders AS MATERIALIZED (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
customer_repurchase AS MATERIALIZED (
  SELECT f.customer_id,
         f.first_order_ts,
         MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (
         WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
       ) AS repurchased_customers,
       ROUND(
         100.0 * COUNT(*) FILTER (
           WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
         ) / NULLIF(COUNT(*), 0),
         2
       ) AS repurchase_rate_pct
FROM customer_repurchase;
