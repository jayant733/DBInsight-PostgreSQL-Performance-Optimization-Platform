-- Q10 Verify raw join and order pre-aggregation yield identical Top 30 / recent 60-day figures
WITH raw_customer AS (
  SELECT c.customer_id,
         COALESCE(SUM(oi.line_total), 0)::numeric AS lifetime_revenue,
         COALESCE(SUM(oi.line_total) FILTER (
           WHERE o.order_ts >= now() - INTERVAL '60 days'
         ), 0)::numeric AS recent_60d_revenue
  FROM ecom.customers AS c
  LEFT JOIN ecom.orders AS o
    ON o.customer_id = c.customer_id
   AND o.order_status IN ('paid', 'shipped', 'delivered')
  LEFT JOIN ecom.order_items AS oi USING (order_id)
  GROUP BY c.customer_id
),
order_totals AS MATERIALIZED (
  SELECT o.order_id, o.customer_id, o.order_ts, SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
),
preagg_customer AS (
  SELECT c.customer_id,
         COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue,
         COALESCE(SUM(ot.order_total) FILTER (
           WHERE ot.order_ts >= now() - INTERVAL '60 days'
         ), 0)::numeric AS recent_60d_revenue
  FROM ecom.customers AS c
  LEFT JOIN order_totals AS ot USING (customer_id)
  GROUP BY c.customer_id
),
baseline AS (
  SELECT customer_id, lifetime_revenue, recent_60d_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank
  FROM raw_customer
),
tuned AS (
  SELECT customer_id, lifetime_revenue, recent_60d_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank
  FROM preagg_customer
),
diff AS (
  (SELECT * FROM baseline WHERE revenue_rank <= 30
   EXCEPT ALL
   SELECT * FROM tuned WHERE revenue_rank <= 30)
  UNION ALL
  (SELECT * FROM tuned WHERE revenue_rank <= 30
   EXCEPT ALL
   SELECT * FROM baseline WHERE revenue_rank <= 30)
)
SELECT COUNT(*) AS mismatch_rows FROM diff;
