-- mv_daily_gmv naive execution plan: fast but overcounts boundary day
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(gmv) AS monthly_revenue
FROM ecom.mv_daily_gmv
WHERE day >= date_trunc('day', now() - INTERVAL '1 month');
