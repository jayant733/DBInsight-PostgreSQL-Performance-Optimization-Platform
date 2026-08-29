-- Accurate hybrid MV query reading boundary period from raw tables
EXPLAIN (ANALYZE, BUFFERS)
WITH p AS MATERIALIZED (
  SELECT now() - INTERVAL '1 month' AS cutoff
)
SELECT SUM(amount) AS monthly_revenue
FROM (
  SELECT m.gmv AS amount
  FROM ecom.mv_daily_gmv m CROSS JOIN p
  WHERE m.day > date_trunc('day', p.cutoff)
  UNION ALL
  SELECT oi.line_total
  FROM ecom.orders o
  JOIN ecom.order_items oi ON oi.order_id = o.order_id
  CROSS JOIN p
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= p.cutoff
    AND o.order_ts < date_trunc('day', p.cutoff) + INTERVAL '1 day'
) s;
