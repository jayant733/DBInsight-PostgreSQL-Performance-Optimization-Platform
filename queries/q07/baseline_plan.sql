-- Q7 Baseline Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
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
