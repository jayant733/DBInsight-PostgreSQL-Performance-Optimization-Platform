-- Q3 Execution Plan: Boundary-corrected hybrid MV query
EXPLAIN (ANALYZE, BUFFERS)
WITH bounds AS MATERIALIZED (
  SELECT now() - INTERVAL '90 days' AS cutoff
),
exact_mv AS (
  SELECT category_id, SUM(amount) AS revenue
  FROM (
    SELECT m.category_id, m.gmv AS amount
    FROM ecom.mv_daily_category_gmv AS m
    CROSS JOIN bounds AS b
    WHERE m.day > date_trunc('day', b.cutoff)
    UNION ALL
    SELECT c.category_id, oi.line_total AS amount
    FROM ecom.orders AS o
    JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
    JOIN ecom.products AS p ON p.product_id = oi.product_id
    JOIN ecom.categories AS c ON c.category_id = p.category_id
    CROSS JOIN bounds AS b
    WHERE o.order_status IN ('paid', 'shipped', 'delivered')
      AND o.order_ts >= b.cutoff
      AND o.order_ts < date_trunc('day', b.cutoff) + INTERVAL '1 day'
  ) AS x
  GROUP BY category_id
)
SELECT c.category_id, c.category_name, e.revenue
FROM exact_mv AS e
JOIN ecom.categories AS c USING (category_id)
ORDER BY e.revenue DESC, c.category_id
LIMIT 10;
