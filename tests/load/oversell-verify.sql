-- Expect: quantity 5, reserved 5, available 0, orders 5, units ordered 5.
SELECT i.quantity, i.reserved, i.quantity - i.reserved AS available,
       (SELECT count(DISTINCT oi.order_id) FROM order_items oi WHERE oi.variant_id = 'lt-last5-v') AS orders,
       (SELECT coalesce(sum(oi.quantity), 0) FROM order_items oi WHERE oi.variant_id = 'lt-last5-v') AS units_ordered
FROM inventory i WHERE i.variant_id = 'lt-last5-v';
