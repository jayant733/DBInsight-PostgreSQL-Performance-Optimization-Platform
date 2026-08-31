-- Q9 Baseline Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.coupon_code IS NOT NULL AS coupon_used,
       COUNT(DISTINCT o.order_id) AS order_count,
       ROUND(SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2)
         AS avg_order_amount,
       SUM(oi.line_total) AS revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi USING (order_id)
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY o.coupon_code IS NOT NULL
ORDER BY coupon_used DESC;
