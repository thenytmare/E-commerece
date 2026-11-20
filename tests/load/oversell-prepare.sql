-- A product with exactly 5 units for tests/load/oversell.js. Re-runnable.
DELETE FROM inventory WHERE variant_id = 'lt-last5-v';
DELETE FROM order_items WHERE variant_id = 'lt-last5-v';
DELETE FROM cart_items WHERE variant_id = 'lt-last5-v';
DELETE FROM product_variants WHERE id = 'lt-last5-v';
DELETE FROM products WHERE id = 'lt-last5';
INSERT INTO products (id, brand_id, category_id, name, slug, base_price, status, is_active, updated_at)
SELECT 'lt-last5', 'lt-brand-1', 'lt-cat-1', 'Load Test Last Five', 'load-test-last-five', 1500, 'active', true, now();
INSERT INTO product_variants (id, product_id, sku, price, is_default, updated_at)
VALUES ('lt-last5-v', 'lt-last5', 'LT-LAST5', 1500, true, now());
INSERT INTO inventory (id, variant_id, quantity, reserved) VALUES ('lt-last5-i', 'lt-last5-v', 5, 0);
