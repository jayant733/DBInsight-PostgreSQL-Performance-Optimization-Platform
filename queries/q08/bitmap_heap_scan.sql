-- Q8 Bitmap Heap Scan Instructional Comparison
-- HAVING is a post-aggregation condition; individual reviews cannot be pre-filtered.
-- Builds temporary index on all NOT NULL product_id to observe Bitmap inefficiency, then ROLLBACKs.
BEGIN;
CREATE INDEX idx_reviews_q8_bitmap_experiment
ON ecom.reviews (product_id)
WHERE product_id IS NOT NULL;
ANALYZE ecom.reviews;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = on;
SET LOCAL jit = off;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
WITH review_stats AS MATERIALIZED (
  SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
  FROM ecom.reviews
  WHERE product_id IS NOT NULL
  GROUP BY product_id
  HAVING AVG(rating) >= 4.5 AND COUNT(*) >= 50
)
SELECT rs.product_id, p.product_name, rs.review_count, ROUND(rs.avg_rating, 2) AS avg_rating
FROM review_stats AS rs
JOIN ecom.products AS p USING (product_id)
ORDER BY avg_rating DESC, rs.review_count DESC, rs.product_id;
ROLLBACK;
