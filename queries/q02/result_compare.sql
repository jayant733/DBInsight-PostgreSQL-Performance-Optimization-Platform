-- Q2 Parity comparison between direct aggregation and Monthly Sales MV
WITH order_totals AS (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
),
direct AS (
  SELECT order_month,
         COUNT(order_id) AS order_count,
         ROUND(SUM(order_total), 2) AS revenue,
         ROUND(AVG(order_total), 2) AS aov
  FROM order_totals
  GROUP BY order_month
)
SELECT d.order_month,
       d.order_count AS direct_orders,
       m.order_count AS mv_orders,
       d.revenue AS direct_revenue,
       ROUND(m.revenue, 2) AS mv_revenue,
       d.aov AS direct_aov,
       m.aov AS mv_aov,
       (d.order_count = m.order_count
        AND d.revenue = ROUND(m.revenue, 2)
        AND d.aov = m.aov) AS values_match
FROM direct AS d
JOIN ecom.mv_monthly_sales AS m
  USING (order_month)
ORDER BY d.order_month;
