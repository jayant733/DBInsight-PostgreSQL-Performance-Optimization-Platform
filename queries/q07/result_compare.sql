-- Q7 Parity verification between raw query and low-stock MV: mismatch_rows must be 0.
WITH direct AS (
  SELECT i.product_id,
         p.sku,
         p.product_name,
         i.qty_on_hand,
         i.reorder_point,
         i.reorder_point - i.qty_on_hand AS shortage_qty,
         i.updated_at
  FROM ecom.inventory AS i
  JOIN ecom.products AS p USING (product_id)
  WHERE i.qty_on_hand < i.reorder_point
),
diff AS (
  (SELECT * FROM direct EXCEPT ALL SELECT * FROM ecom.mv_low_stock_products)
  UNION ALL
  (SELECT * FROM ecom.mv_low_stock_products EXCEPT ALL SELECT * FROM direct)
)
SELECT (SELECT COUNT(*) FROM direct) AS direct_products,
       (SELECT COUNT(*) FROM ecom.mv_low_stock_products) AS mv_products,
       COUNT(*) AS mismatch_rows
FROM diff;
