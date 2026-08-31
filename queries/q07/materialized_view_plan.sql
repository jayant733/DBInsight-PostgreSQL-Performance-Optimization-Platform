-- Q7 Low-Stock MV Execution Plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT product_id, sku, product_name, qty_on_hand, reorder_point, shortage_qty, updated_at
FROM ecom.mv_low_stock_products
ORDER BY shortage_qty DESC, qty_on_hand, product_id;
