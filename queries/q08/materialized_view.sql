-- Q8 Product Review Statistics MV
-- Thresholds are not hardcoded in the MV, allowing reuse for different rating/review criteria.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_product_review_stats AS
SELECT product_id,
       COUNT(*) AS review_count,
       AVG(rating) AS avg_rating
FROM ecom.reviews
GROUP BY product_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_product_review_stats_product
ON ecom.mv_product_review_stats (product_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_product_review_stats;

SELECT now() AS refreshed_at,
       COUNT(*) AS reviewed_products,
       COUNT(*) FILTER (WHERE avg_rating >= 4.5 AND review_count >= 50) AS qualified_products
FROM ecom.mv_product_review_stats;
