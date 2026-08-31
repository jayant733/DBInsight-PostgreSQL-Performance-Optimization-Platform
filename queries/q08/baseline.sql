-- Q8 Baseline: Joining reviews and products first, then aggregating with HAVING
SELECT r.product_id,
       p.product_name,
       COUNT(*) AS review_count,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM ecom.reviews AS r
JOIN ecom.products AS p USING (product_id)
GROUP BY r.product_id, p.product_name
HAVING AVG(r.rating) >= 4.5
   AND COUNT(*) >= 50
ORDER BY avg_rating DESC, review_count DESC, r.product_id;
