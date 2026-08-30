-- Q2 Monthly Sales MV Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT order_month,
       order_count,
       ROUND(revenue, 2) AS revenue,
       aov
FROM ecom.mv_monthly_sales
ORDER BY order_month;
