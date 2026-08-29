-- Q1 Baseline Result
DROP INDEX IF EXISTS ecom.idx_orders_revenue_ts_order_id;
ANALYZE ecom.orders;
ANALYZE ecom.order_items;

SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';
