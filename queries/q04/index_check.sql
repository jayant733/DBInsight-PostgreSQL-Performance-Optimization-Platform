-- Q4 Verify partial index creation status and size
SELECT to_regclass('ecom.idx_orders_q4_valid_order_id') AS index_name,
       pg_size_pretty(
         pg_relation_size('ecom.idx_orders_q4_valid_order_id')
       ) AS index_size;
