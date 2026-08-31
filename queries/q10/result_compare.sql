-- Q10 Parity verification between raw customer lifetime revenue and MV
WITH order_totals AS (
  SELECT o.order_id, o.customer_id, SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id
),
direct AS (
  SELECT c.customer_id,
         COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue
  FROM ecom.customers AS c
  LEFT JOIN order_totals AS ot USING (customer_id)
  GROUP BY c.customer_id
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_customer_lifetime_revenue)
  UNION ALL
  (SELECT * FROM ecom.mv_customer_lifetime_revenue EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_customers,
       (SELECT COUNT(*) FROM ecom.mv_customer_lifetime_revenue) AS mv_customers,
       COUNT(*) AS mismatch_rows
FROM diff;
