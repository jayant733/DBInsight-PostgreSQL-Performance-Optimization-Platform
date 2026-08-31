-- Q10 Customer Lifetime Revenue MV
-- Recent 60-day revenue shifts with now() and is computed at query time rather than stored in MV.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_customer_lifetime_revenue AS
WITH order_totals AS (
  SELECT o.order_id,
         o.customer_id,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id
)
SELECT c.customer_id,
       COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue
FROM ecom.customers AS c
LEFT JOIN order_totals AS ot USING (customer_id)
GROUP BY c.customer_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_customer_lifetime_revenue_customer
ON ecom.mv_customer_lifetime_revenue (customer_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_customer_lifetime_revenue;

SELECT now() AS refreshed_at, COUNT(*) AS mv_customers
FROM ecom.mv_customer_lifetime_revenue;
