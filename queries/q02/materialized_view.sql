-- Q2 Create and refresh Monthly Sales Materialized View for recurring reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_monthly_sales AS
WITH order_totals AS (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
)
SELECT order_month,
       COUNT(order_id) AS order_count,
       SUM(order_total) AS revenue,
       ROUND(AVG(order_total), 2) AS aov
FROM order_totals
GROUP BY order_month
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_monthly_sales_month
ON ecom.mv_monthly_sales (order_month);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_monthly_sales;

SELECT now() AS refreshed_at,
       COUNT(*) AS mv_rows,
       MIN(order_month) AS min_month,
       MAX(order_month) AS max_month
FROM ecom.mv_monthly_sales;
