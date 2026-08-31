-- Q6 Customer First and Subsequent Purchase Timestamps MV
-- 30-day qualification is computed at query time from first_order_ts and first_repurchase_ts.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_customer_first_purchase AS
WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
)
SELECT f.customer_id,
       f.first_order_ts,
       MIN(r.order_ts) AS first_repurchase_ts
FROM first_orders AS f
LEFT JOIN ecom.orders AS r
  ON r.customer_id = f.customer_id
 AND r.order_status IN ('paid', 'shipped', 'delivered')
 AND r.order_ts > f.first_order_ts
GROUP BY f.customer_id, f.first_order_ts
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_customer_first_purchase_customer
ON ecom.mv_customer_first_purchase (customer_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_customer_first_purchase;

SELECT now() AS refreshed_at, COUNT(*) AS mv_customers
FROM ecom.mv_customer_first_purchase;
