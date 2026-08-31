-- Q9 Parity verification between raw group metrics and MV
WITH order_totals AS (
  SELECT o.order_id,
         o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
),
direct AS (
  SELECT coupon_used, COUNT(*) AS order_count, SUM(order_total) AS revenue
  FROM order_totals
  GROUP BY coupon_used
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_coupon_order_metrics)
  UNION ALL
  (SELECT * FROM ecom.mv_coupon_order_metrics EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_groups,
       (SELECT COUNT(*) FROM ecom.mv_coupon_order_metrics) AS mv_groups,
       COUNT(*) AS mismatch_rows
FROM diff;
