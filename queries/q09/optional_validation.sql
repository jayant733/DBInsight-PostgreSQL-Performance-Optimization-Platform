-- Q9 AOV difference, multiplier, and empty string coupon checks
WITH metrics AS (
  SELECT coupon_used,
         revenue / NULLIF(order_count, 0) AS avg_order_amount
  FROM ecom.mv_coupon_order_metrics
)
SELECT ROUND(MAX(avg_order_amount) FILTER (WHERE coupon_used)
             - MAX(avg_order_amount) FILTER (WHERE NOT coupon_used), 2) AS avg_amount_difference,
       ROUND(MAX(avg_order_amount) FILTER (WHERE coupon_used)
             / NULLIF(MAX(avg_order_amount) FILTER (WHERE NOT coupon_used), 0), 2)
         AS coupon_to_no_coupon_ratio,
       (SELECT COUNT(*) FROM ecom.orders WHERE coupon_code = '') AS empty_coupon_codes
FROM metrics;
