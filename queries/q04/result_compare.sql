-- Q4 Result and rank comparison between raw product revenue and MV
WITH direct AS (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY oi.product_id
),
compared AS (
  SELECT d.product_id,
         d.revenue AS direct_revenue,
         m.revenue AS mv_revenue,
         RANK() OVER (ORDER BY d.revenue DESC) AS direct_rank,
         RANK() OVER (ORDER BY m.revenue DESC) AS mv_rank
  FROM direct AS d
  JOIN ecom.mv_product_revenue AS m USING (product_id)
)
SELECT c.product_id,
       p.product_name,
       ROUND(c.direct_revenue, 2) AS direct_revenue,
       ROUND(c.mv_revenue, 2) AS mv_revenue,
       c.direct_rank,
       c.mv_rank,
       (c.direct_revenue = c.mv_revenue AND c.direct_rank = c.mv_rank) AS values_match
FROM compared AS c
JOIN ecom.products AS p USING (product_id)
WHERE c.direct_rank <= 20
ORDER BY c.direct_rank, c.product_id;

