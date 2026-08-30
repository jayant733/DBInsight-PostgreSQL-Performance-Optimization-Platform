-- Q3 Create and refresh Daily Category Sales MV for recurring reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_daily_category_gmv AS
SELECT date_trunc('day', o.order_ts) AS day,
       c.category_id,
       c.category_name,
       SUM(oi.line_total) AS gmv
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
JOIN ecom.products AS p ON p.product_id = oi.product_id
JOIN ecom.categories AS c ON c.category_id = p.category_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY date_trunc('day', o.order_ts), c.category_id, c.category_name
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_daily_category_gmv_day_category
ON ecom.mv_daily_category_gmv (day, category_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_daily_category_gmv;

SELECT now() AS refreshed_at,
       COUNT(*) AS mv_rows,
       MIN(day) AS min_day,
       MAX(day) AS max_day
FROM ecom.mv_daily_category_gmv;

