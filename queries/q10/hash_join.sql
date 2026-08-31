-- Q10 Forced Hash Join Comparison
BEGIN;
SET LOCAL enable_hashjoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_mergejoin = off;
SET LOCAL jit = off;
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id, o.customer_id, o.order_ts, SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
),
customer_lifetime AS MATERIALIZED (
  SELECT c.customer_id, COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue
  FROM ecom.customers AS c LEFT JOIN order_totals AS ot USING (customer_id)
  GROUP BY c.customer_id
),
ranked AS MATERIALIZED (
  SELECT customer_id, lifetime_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank,
         COUNT(*) OVER () AS customer_count FROM customer_lifetime
),
top_customers AS MATERIALIZED (
  SELECT customer_id, lifetime_revenue, revenue_rank FROM ranked
  WHERE revenue_rank <= CEIL(customer_count * 0.01)
),
recent_by_customer AS MATERIALIZED (
  SELECT t.customer_id, COALESCE(SUM(ot.order_total) FILTER (
           WHERE ot.order_ts >= now() - INTERVAL '60 days'), 0)::numeric AS recent_60d_revenue
  FROM top_customers AS t LEFT JOIN order_totals AS ot USING (customer_id)
  GROUP BY t.customer_id
)
SELECT t.revenue_rank, t.customer_id, t.lifetime_revenue, r.recent_60d_revenue,
       SUM(r.recent_60d_revenue) OVER () AS top_1pct_recent_60d_revenue
FROM top_customers AS t JOIN recent_by_customer AS r USING (customer_id)
ORDER BY t.revenue_rank;
ROLLBACK;
