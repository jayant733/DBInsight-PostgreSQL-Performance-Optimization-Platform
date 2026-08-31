-- Q10 Population size, Top 1% count, and recent time window checks
WITH ranked AS (
  SELECT customer_id,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank,
         COUNT(*) OVER () AS customer_count
  FROM ecom.mv_customer_lifetime_revenue
)
SELECT MAX(customer_count) AS customer_count,
       CEIL(MAX(customer_count) * 0.01) AS expected_top_1pct_count,
       COUNT(*) FILTER (WHERE revenue_rank <= CEIL(customer_count * 0.01))
         AS actual_top_1pct_count
FROM ranked;

SELECT COUNT(*) AS future_valid_orders_in_lower_bound_only_window
FROM ecom.orders
WHERE order_status IN ('paid', 'shipped', 'delivered')
  AND order_ts >= now() - INTERVAL '60 days'
  AND order_ts > now();
