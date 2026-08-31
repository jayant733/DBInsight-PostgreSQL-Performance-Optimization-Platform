-- Q7 Result comparison: Baseline vs. Low-stock pre-filtered tuning
WITH baseline AS (
  SELECT i.product_id, p.sku, p.product_name, i.qty_on_hand, i.reorder_point,
         i.reorder_point - i.qty_on_hand AS shortage_qty, i.updated_at
  FROM ecom.inventory AS i
  JOIN ecom.products AS p USING (product_id)
  WHERE i.qty_on_hand < i.reorder_point
),
low_stock AS MATERIALIZED (
  SELECT product_id, qty_on_hand, reorder_point, updated_at
  FROM ecom.inventory
  WHERE qty_on_hand < reorder_point
),
tuned AS (
  SELECT ls.product_id, p.sku, p.product_name, ls.qty_on_hand, ls.reorder_point,
         ls.reorder_point - ls.qty_on_hand AS shortage_qty, ls.updated_at
  FROM low_stock AS ls
  JOIN ecom.products AS p USING (product_id)
),
diff AS (
  (SELECT * FROM baseline EXCEPT ALL SELECT * FROM tuned)
  UNION ALL
  (SELECT * FROM tuned EXCEPT ALL SELECT * FROM baseline)
)
SELECT COUNT(*) AS mismatch_rows FROM diff;
