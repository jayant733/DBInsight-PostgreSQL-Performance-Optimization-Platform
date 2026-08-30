-- Q5 Customer RFM MV Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id,
       last_order_ts,
       CURRENT_DATE - last_order_ts::date AS recency_days,
       frequency,
       monetary
FROM ecom.mv_customer_rfm
ORDER BY monetary DESC, customer_id;
