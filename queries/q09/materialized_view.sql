-- Q9 Coupon Usage Metrics MV
-- Averages are computed dynamically at query time as revenue / order_count.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_coupon_order_metrics AS
WITH order_totals AS (
  SELECT o.order_id,
         o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
)
SELECT coupon_used,
       COUNT(*) AS order_count,
       SUM(order_total) AS revenue
FROM order_totals
GROUP BY coupon_used
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_coupon_order_metrics_used
ON ecom.mv_coupon_order_metrics (coupon_used);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_coupon_order_metrics;

SELECT now() AS refreshed_at, COUNT(*) AS coupon_groups
FROM ecom.mv_coupon_order_metrics;
