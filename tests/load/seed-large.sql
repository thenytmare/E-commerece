-- Load-test catalogue: 10 categories, 20 brands, 500 products (one variant
-- each, 1,000 units of stock, one image). Prices run KSh 500 to 25,000, so
-- some orders fall under the free-delivery threshold and some over.
--
-- Run on a TEST database only, after migrations and `pnpm db:seed`:
--   psql "$DATABASE_URL" -f tests/load/seed-large.sql
-- Safe to re-run: everything it creates has an id starting with 'lt-'.

BEGIN;

DELETE FROM product_images  WHERE product_id LIKE 'lt-%';
DELETE FROM inventory       WHERE variant_id LIKE 'lt-%';
DELETE FROM product_variants WHERE product_id LIKE 'lt-%';
DELETE FROM products        WHERE id LIKE 'lt-%';
DELETE FROM brands          WHERE id LIKE 'lt-%';
DELETE FROM categories      WHERE id LIKE 'lt-%';

INSERT INTO categories (id, name, slug, sort_order, is_active, updated_at)
SELECT 'lt-cat-' || g, 'Load Category ' || g, 'load-category-' || g, 100 + g, true, now()
FROM generate_series(1, 10) g;

INSERT INTO brands (id, name, slug, is_active, updated_at)
SELECT 'lt-brand-' || g, 'Load Brand ' || g, 'load-brand-' || g, true, now()
FROM generate_series(1, 20) g;

INSERT INTO products (id, brand_id, category_id, name, slug, description, base_price, status, is_featured, is_active, updated_at)
SELECT 'lt-p-' || g,
       'lt-brand-' || (1 + g % 20),
       'lt-cat-' || (1 + g % 10),
       'Load Test Gadget ' || g || CASE WHEN g % 3 = 0 THEN ' Power Bank' WHEN g % 3 = 1 THEN ' Earbuds' ELSE ' Charger' END,
       'load-test-gadget-' || g,
       'Load test product ' || g || '. Fast charging, long battery life, one-year warranty.',
       500 + (g * 49) % 24500,
       'active',
       g % 25 = 0,
       true,
       now()
FROM generate_series(1, 500) g;

INSERT INTO product_variants (id, product_id, sku, price, is_default, updated_at)
SELECT 'lt-v-' || g, 'lt-p-' || g, 'LT-SKU-' || g, 500 + (g * 49) % 24500, true, now()
FROM generate_series(1, 500) g;

INSERT INTO inventory (id, variant_id, quantity, reserved)
SELECT 'lt-i-' || g, 'lt-v-' || g, 1000, 0
FROM generate_series(1, 500) g;

INSERT INTO product_images (id, product_id, url, sort_order, is_featured)
SELECT 'lt-img-' || g, 'lt-p-' || g,
       CASE WHEN g % 2 = 0 THEN '/images/products/oraimo-anti-scratch-smart-watch-watch-6r-osw-823-image.webp'
            ELSE '/images/products/oraimo-Power-Bank-PowerNova-Q31-OPB-7300Q-mainimage.webp' END,
       0, true
FROM generate_series(1, 500) g;

COMMIT;

SELECT count(*) AS load_test_products FROM products WHERE id LIKE 'lt-%';
