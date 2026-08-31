-- Q10 Baseline Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
WITH customer_lifetime AS MATERIALIZED (
  SELECT c.customer_id, COALESCE(SUM(oi.line_total), 0)::numeric AS lifetime_revenue
  FROM ecom.customers AS c
  LEFT JOIN ecom.orders AS o
    ON o.customer_id = c.customer_id
   AND o.order_status IN ('paid', 'shipped', 'delivered')
  LEFT JOIN ecom.order_items AS oi USING (order_id)
  GROUP BY c.customer_id
),
ranked AS MATERIALIZED (
  SELECT customer_id, lifetime_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank,
         COUNT(*) OVER () AS customer_count
  FROM customer_lifetime
),
top_customers AS MATERIALIZED (
  SELECT customer_id, lifetime_revenue, revenue_rank
  FROM ranked
  WHERE revenue_rank <= CEIL(customer_count * 0.01)
),
recent_by_customer AS MATERIALIZED (
  SELECT t.customer_id, COALESCE(SUM(oi.line_total), 0)::numeric AS recent_60d_revenue
  FROM top_customers AS t
  LEFT JOIN ecom.orders AS o
    ON o.customer_id = t.customer_id
   AND o.order_status IN ('paid', 'shipped', 'delivered')
   AND o.order_ts >= now() - INTERVAL '60 days'
  LEFT JOIN ecom.order_items AS oi USING (order_id)
  GROUP BY t.customer_id
)
SELECT t.revenue_rank, t.customer_id, t.lifetime_revenue, r.recent_60d_revenue,
       SUM(r.recent_60d_revenue) OVER () AS top_1pct_recent_60d_revenue
FROM top_customers AS t
JOIN recent_by_customer AS r USING (customer_id)
ORDER BY t.revenue_rank;
