-- Q6 Result comparison: Baseline (EXISTS) vs. Tuned (Subsequent order pre-aggregation)
-- mismatch_rows must be 0.
WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
baseline AS (
  SELECT f.customer_id,
         EXISTS (
           SELECT 1 FROM ecom.orders AS r
           WHERE r.customer_id = f.customer_id
             AND r.order_status IN ('paid', 'shipped', 'delivered')
             AND r.order_ts > f.first_order_ts
             AND r.order_ts <= f.first_order_ts + INTERVAL '30 days'
         ) AS repurchased_30d
  FROM first_orders AS f
),
first_repurchase AS (
  SELECT f.customer_id, f.first_order_ts, MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
),
tuned AS (
  SELECT customer_id,
         COALESCE(
           first_repurchase_ts <= first_order_ts + INTERVAL '30 days',
           false
         ) AS repurchased_30d
  FROM first_repurchase
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows FROM diff;
