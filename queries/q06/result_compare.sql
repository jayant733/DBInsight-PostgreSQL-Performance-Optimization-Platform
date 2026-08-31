-- Q6 Parity verification between raw query and MV: mismatch_rows must be 0.
WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
direct AS (
  SELECT f.customer_id,
         f.first_order_ts,
         MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_customer_first_purchase)
  UNION ALL
  (SELECT * FROM ecom.mv_customer_first_purchase EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_customers,
       (SELECT COUNT(*) FROM ecom.mv_customer_first_purchase) AS mv_customers,
       COUNT(*) AS mismatch_rows
FROM diff;
