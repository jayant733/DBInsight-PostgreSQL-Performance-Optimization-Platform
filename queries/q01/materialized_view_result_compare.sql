-- Result comparison between direct query, naive daily MV, and boundary-corrected MV
WITH p AS MATERIALIZED (
  SELECT now() - INTERVAL '1 month' AS cutoff
),
direct AS (
  SELECT SUM(oi.line_total) AS revenue
  FROM ecom.orders o
  JOIN ecom.order_items oi ON oi.order_id = o.order_id
  CROSS JOIN p
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= p.cutoff
),
daily_mv AS (
  SELECT SUM(m.gmv) AS revenue
  FROM ecom.mv_daily_gmv m CROSS JOIN p
  WHERE m.day >= date_trunc('day', p.cutoff)
),
exact_mv AS (
  SELECT SUM(amount) AS revenue
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
  ) s
)
SELECT ROUND(direct.revenue, 2) AS direct_revenue,
       ROUND(daily_mv.revenue, 2) AS daily_mv_revenue,
       ROUND(exact_mv.revenue, 2) AS exact_mv_revenue,
       ROUND(daily_mv.revenue - direct.revenue, 2) AS boundary_overcount
FROM direct, daily_mv, exact_mv;
