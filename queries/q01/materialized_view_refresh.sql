-- Initial/regular MV refresh and preparing concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_daily_gmv_day
ON ecom.mv_daily_gmv(day);
REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_daily_gmv;

SELECT now() AS refreshed_at,
       COUNT(*) AS mv_rows,
       MIN(day) AS min_day,
       MAX(day) AS max_day
FROM ecom.mv_daily_gmv;
