-- Q7 Tuning: Store column comparison in partial index predicate and pre-filter low-stock rows
CREATE INDEX IF NOT EXISTS idx_inventory_q7_low_stock_product
ON ecom.inventory (product_id)
INCLUDE (qty_on_hand, reorder_point, updated_at)
WHERE qty_on_hand < reorder_point;
ANALYZE ecom.inventory;

WITH low_stock AS MATERIALIZED (
  SELECT product_id, qty_on_hand, reorder_point, updated_at
  FROM ecom.inventory
  WHERE qty_on_hand < reorder_point
)
SELECT ls.product_id,
       p.sku,
       p.product_name,
       ls.qty_on_hand,
       ls.reorder_point,
       ls.reorder_point - ls.qty_on_hand AS shortage_qty,
       ls.updated_at
FROM low_stock AS ls
JOIN ecom.products AS p USING (product_id)
ORDER BY shortage_qty DESC, ls.qty_on_hand, ls.product_id;
