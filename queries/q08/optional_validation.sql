-- Q8 Result boundary and data quality checks
SELECT COUNT(*) AS total_reviews,
       COUNT(DISTINCT product_id) AS reviewed_products,
       COUNT(*) FILTER (WHERE rating NOT BETWEEN 1 AND 5) AS invalid_ratings
FROM ecom.reviews;

SELECT COUNT(*) AS qualified_products,
       MIN(review_count) AS min_qualified_review_count,
       MIN(avg_rating) AS min_qualified_avg_rating
FROM ecom.mv_product_review_stats
WHERE avg_rating >= 4.5
  AND review_count >= 50;
