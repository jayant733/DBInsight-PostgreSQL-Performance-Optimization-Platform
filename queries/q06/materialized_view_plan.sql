-- Q6 Repurchase Rate Execution Plan based on MV
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (
         WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
       ) AS repurchased_customers,
       ROUND(
         100.0 * COUNT(*) FILTER (
           WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
         ) / NULLIF(COUNT(*), 0),
         2
       ) AS repurchase_rate_pct
FROM ecom.mv_customer_first_purchase;
