-- Q5 Create and refresh Customer RFM Materialized View for recurring reporting
-- Since recency_days shifts over time, the MV stores last_order_ts and computes recency at query time.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_customer_rfm AS
WITH order_totals AS (
  SELECT o.order_id,
         o.customer_id,
         o.order_ts,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
)
SELECT customer_id,
       MAX(order_ts) AS last_order_ts,
       COUNT(order_id) AS frequency,
       SUM(order_total) AS monetary
FROM order_totals
GROUP BY customer_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_customer_rfm_customer
ON ecom.mv_customer_rfm (customer_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_customer_rfm;

SELECT now() AS refreshed_at,
       COUNT(*) AS mv_customers,
       MAX(last_order_ts) AS latest_order_ts
FROM ecom.mv_customer_rfm;
