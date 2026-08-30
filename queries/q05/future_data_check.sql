-- Seed data quality note: Future-dated orders can produce negative recency_days.
SELECT COUNT(*) AS future_valid_orders,
       MIN(order_ts) AS first_future_order,
       MAX(order_ts) AS last_future_order
FROM ecom.orders
WHERE order_status IN ('paid', 'shipped', 'delivered')
  AND order_ts > now();
