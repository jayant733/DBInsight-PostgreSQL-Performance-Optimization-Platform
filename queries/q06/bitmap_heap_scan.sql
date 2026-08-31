-- Q6 Forced Bitmap Heap Scan Comparison
-- Reading all valid orders makes Seq Scan optimal; forced plan below is for study purposes.
BEGIN;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = on;
SET LOCAL jit = off;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH first_orders AS MATERIALIZED (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
customer_repurchase AS MATERIALIZED (
  SELECT f.customer_id, f.first_order_ts, MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days')
         AS repurchased_customers,
       ROUND(100.0 * COUNT(*) FILTER (
         WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
       ) / NULLIF(COUNT(*), 0), 2) AS repurchase_rate_pct
FROM customer_repurchase;
ROLLBACK;
