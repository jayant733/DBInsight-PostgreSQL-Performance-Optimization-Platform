-- Q8 Result comparison: Baseline join-then-aggregate vs. Tuned review pre-aggregation
WITH baseline AS (
  SELECT r.product_id, p.product_name, COUNT(*) AS review_count,
         ROUND(AVG(r.rating), 2) AS avg_rating
  FROM ecom.reviews AS r
  JOIN ecom.products AS p USING (product_id)
  GROUP BY r.product_id, p.product_name
  HAVING AVG(r.rating) >= 4.5 AND COUNT(*) >= 50
),
review_stats AS MATERIALIZED (
  SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
  FROM ecom.reviews
  GROUP BY product_id
  HAVING AVG(rating) >= 4.5 AND COUNT(*) >= 50
),
tuned AS (
  SELECT rs.product_id, p.product_name, rs.review_count, ROUND(rs.avg_rating, 2) AS avg_rating
  FROM review_stats AS rs
  JOIN ecom.products AS p USING (product_id)
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows FROM diff;
