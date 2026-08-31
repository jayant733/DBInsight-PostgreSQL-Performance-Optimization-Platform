-- Q8 Parity verification between raw product statistics and MV
WITH direct AS (
  SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
  FROM ecom.reviews
  GROUP BY product_id
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_product_review_stats)
  UNION ALL
  (SELECT * FROM ecom.mv_product_review_stats EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_products,
       (SELECT COUNT(*) FROM ecom.mv_product_review_stats) AS mv_products,
       COUNT(*) AS mismatch_rows
FROM diff;
