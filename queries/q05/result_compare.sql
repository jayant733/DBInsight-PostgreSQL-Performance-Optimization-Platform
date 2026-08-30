-- Q5 Parity verification between direct pre-aggregation and RFM MV
-- mismatch_rows must be 0.
WITH order_totals AS (
  SELECT o.order_id,
         o.customer_id,
         o.order_ts,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
),
direct AS (
  SELECT customer_id,
         MAX(order_ts) AS last_order_ts,
         COUNT(order_id) AS frequency,
         SUM(order_total) AS monetary
  FROM order_totals
  GROUP BY customer_id
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_customer_rfm)
  UNION ALL
  (SELECT * FROM ecom.mv_customer_rfm EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_customers,
       (SELECT COUNT(*) FROM ecom.mv_customer_rfm) AS mv_customers,
       COUNT(*) AS mismatch_rows
FROM diff;
