-- Q7 Low-Stock Products MV for recurring reporting
-- When inventory updates, this MV must be refreshed immediately or periodically.
CREATE MATERIALIZED VIEW IF NOT EXISTS ecom.mv_low_stock_products AS
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
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_low_stock_products_product
ON ecom.mv_low_stock_products (product_id);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_low_stock_products;

SELECT now() AS refreshed_at, COUNT(*) AS low_stock_products
FROM ecom.mv_low_stock_products;
