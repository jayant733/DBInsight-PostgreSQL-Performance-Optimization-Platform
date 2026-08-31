-- Q6 Observation window and future order checks
WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
)
SELECT COUNT(*) AS purchase_customers,
       COUNT(*) FILTER (WHERE first_order_ts > now() - INTERVAL '30 days')
         AS incomplete_30d_window_customers,
       (SELECT COUNT(*)
        FROM ecom.orders
        WHERE order_status IN ('paid', 'shipped', 'delivered')
          AND order_ts > now()) AS future_valid_orders
FROM first_orders;
