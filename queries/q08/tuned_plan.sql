-- Q8 Tuned Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
WITH review_stats AS MATERIALIZED (
  SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
  FROM ecom.reviews
  GROUP BY product_id
  HAVING AVG(rating) >= 4.5
     AND COUNT(*) >= 50
)
SELECT rs.product_id, p.product_name, rs.review_count, ROUND(rs.avg_rating, 2) AS avg_rating
FROM review_stats AS rs
JOIN ecom.products AS p USING (product_id)
ORDER BY avg_rating DESC, rs.review_count DESC, rs.product_id;
