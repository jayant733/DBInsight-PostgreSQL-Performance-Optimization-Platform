-- Q7 Risk summary and MV freshness checks
SELECT COUNT(*) AS low_stock_products,
       COUNT(*) FILTER (WHERE qty_on_hand = 0) AS out_of_stock_products,
       MAX(reorder_point - qty_on_hand) AS max_shortage_qty,
       MAX(updated_at) AS latest_inventory_update
FROM ecom.inventory
WHERE qty_on_hand < reorder_point;

SELECT MAX(updated_at) AS mv_latest_inventory_update
FROM ecom.mv_low_stock_products;
