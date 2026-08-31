-- Q9 Average Order Value Execution Plan based on MV
EXPLAIN (ANALYZE, BUFFERS)
SELECT coupon_used,
       order_count,
       ROUND(revenue / NULLIF(order_count, 0), 2) AS avg_order_amount,
       revenue
FROM ecom.mv_coupon_order_metrics
ORDER BY coupon_used DESC;
