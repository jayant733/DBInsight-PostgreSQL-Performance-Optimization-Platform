-- Q4 Create and refresh Product Cumulative Revenue MV for recurring reporting
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_product_revenue AS
SELECT oi.product_id,
       SUM(oi.line_total) AS revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY oi.product_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_product_revenue_product
ON ecom.mv_product_revenue (product_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_product_revenue;

SELECT now() AS refreshed_at,
       COUNT(*) AS mv_products,
       ROUND(SUM(revenue), 2) AS total_revenue
FROM ecom.mv_product_revenue;

