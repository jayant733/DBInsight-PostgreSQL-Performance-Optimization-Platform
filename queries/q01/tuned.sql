-- Q1 Tuned Result
CREATE INDEX IF NOT EXISTS idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
ANALYZE ecom.orders;

SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';
