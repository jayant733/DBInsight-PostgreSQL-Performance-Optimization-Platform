-- Q7 Baseline: Joining inventory and products then filtering low-stock items
DROP INDEX IF EXISTS ecom.idx_inventory_q7_low_stock_product;
ANALYZE ecom.inventory;

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
ORDER BY shortage_qty DESC, i.qty_on_hand, i.product_id;
