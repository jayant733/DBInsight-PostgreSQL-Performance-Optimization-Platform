-- Q8 High-Performing Products Execution Plan based on MV
EXPLAIN (ANALYZE, BUFFERS)
SELECT m.product_id,
       p.product_name,
       m.review_count,
       ROUND(m.avg_rating, 2) AS avg_rating
FROM ecom.mv_product_review_stats AS m
JOIN ecom.products AS p USING (product_id)
WHERE m.avg_rating >= 4.5
  AND m.review_count >= 50
ORDER BY avg_rating DESC, m.review_count DESC, m.product_id;
