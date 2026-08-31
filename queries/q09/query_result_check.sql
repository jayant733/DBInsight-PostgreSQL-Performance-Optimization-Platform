-- Q9 Result comparison: Baseline DISTINCT vs. Tuned order pre-aggregation
WITH baseline AS (
  SELECT o.coupon_code IS NOT NULL AS coupon_used,
         COUNT(DISTINCT o.order_id) AS order_count,
         ROUND(SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0), 2)
           AS avg_order_amount,
         SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.coupon_code IS NOT NULL
),
order_totals AS MATERIALIZED (
  SELECT o.order_id, o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
),
tuned AS (
  SELECT coupon_used, COUNT(*) AS order_count, ROUND(AVG(order_total), 2) AS avg_order_amount,
         SUM(order_total) AS revenue
  FROM order_totals GROUP BY coupon_used
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows FROM diff;
