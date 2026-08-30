-- Q3 Result comparison between direct query, naive daily MV, and boundary-corrected MV
WITH bounds AS MATERIALIZED (
  SELECT now() - INTERVAL '90 days' AS cutoff
),
direct AS (
  SELECT c.category_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  JOIN ecom.products AS p ON p.product_id = oi.product_id
  JOIN ecom.categories AS c ON c.category_id = p.category_id
  CROSS JOIN bounds AS b
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= b.cutoff
  GROUP BY c.category_id
),
simple_mv AS (
  SELECT m.category_id, SUM(m.gmv) AS revenue
  FROM ecom.mv_daily_category_gmv AS m
  CROSS JOIN bounds AS b
  WHERE m.day >= date_trunc('day', b.cutoff)
  GROUP BY m.category_id
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
SELECT c.category_id,
       c.category_name,
       ROUND(d.revenue, 2) AS direct_revenue,
       ROUND(s.revenue, 2) AS simple_mv_revenue,
       ROUND(e.revenue, 2) AS exact_mv_revenue,
       ROUND(s.revenue - d.revenue, 2) AS boundary_overcount,
       (d.revenue = e.revenue) AS exact_match
FROM direct AS d
JOIN simple_mv AS s USING (category_id)
JOIN exact_mv AS e USING (category_id)
JOIN ecom.categories AS c USING (category_id)
ORDER BY d.revenue DESC, c.category_id
LIMIT 10;

