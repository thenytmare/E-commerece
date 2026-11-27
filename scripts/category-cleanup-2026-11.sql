-- Prime Accessories Kenya: category clean-up (33 categories down to 11)
--
-- HOW TO USE
--   1. In Coolify, take a backup of the database first.
--   2. Open the database resource, then Terminal, and start psql
--      (psql -U <POSTGRES_USER> -d <POSTGRES_DB>).
--   3. Paste this whole file. It runs as a PREVIEW: it prints what it would
--      change and then undoes everything (ROLLBACK). Nothing is saved.
--   4. If the report looks right, change the last line from ROLLBACK to
--      COMMIT, paste the file again, and the change is saved.
--
-- If anything looks wrong, the script stops with an error and changes nothing.

BEGIN;

-- 1. The 11 categories the shop will keep. Existing rows with the same slug
--    are kept as they are; the others are created.
CREATE TEMP TABLE target_cats (slug text PRIMARY KEY, name text NOT NULL, sort int NOT NULL) ON COMMIT DROP;
INSERT INTO target_cats VALUES
  ('earbuds-earphones',     'Earbuds & Earphones',     1),
  ('headphones',            'Headphones',              2),
  ('speakers',              'Speakers',                3),
  ('smart-watches',         'Smart Watches',           4),
  ('power-banks',           'Power Banks',             5),
  ('chargers-cables',       'Chargers & Cables',       6),
  ('power-solutions',       'Power Solutions',         7),
  ('storage',               'Storage',                 8),
  ('gaming-equipment',      'Gaming Equipment',        9),
  ('phone-car-accessories', 'Phone & Car Accessories', 10),
  ('home-personal-care',    'Home & Personal Care',    11);

-- 2. Which old category goes into which new one.
CREATE TEMP TABLE cat_map (old_slug text PRIMARY KEY, new_slug text NOT NULL) ON COMMIT DROP;
INSERT INTO cat_map VALUES
  ('earbuds', 'earbuds-earphones'), ('earpods', 'earbuds-earphones'), ('open-ear', 'earbuds-earphones'),
  ('open-ear-clip-buds', 'earbuds-earphones'), ('neck-bands', 'earbuds-earphones'),
  ('bluetooth-speakers', 'speakers'),
  ('wireless-powerbanks', 'power-banks'),
  ('chargers', 'chargers-cables'), ('charging-solutions', 'chargers-cables'),
  ('cables-adapters', 'chargers-cables'), ('oraimo-powergan', 'chargers-cables'),
  ('power-station', 'power-solutions'), ('router-power-solutions', 'power-solutions'),
  ('extensions', 'power-solutions'),
  ('sandisc-external-storage', 'storage'),
  ('car-accessories', 'phone-car-accessories'), ('phone-holders', 'phone-car-accessories'),
  ('home-appliances', 'home-personal-care'), ('oraimo-home-appliances', 'home-personal-care'),
  ('trimmers', 'home-personal-care'), ('electric-toothbrush', 'home-personal-care');

-- 3. Mixed categories (brands, "Others", test). Each product is placed by hand.
--    The pattern is matched against the product name, only inside the old category.
CREATE TEMP TABLE mixed_map (old_slug text, name_pattern text, new_slug text NOT NULL) ON COMMIT DROP;
INSERT INTO mixed_map VALUES
  ('oraimo',            'Oraimo Powerdock%',          'chargers-cables'),
  ('oraimo',            '%ThermoGo%',                 'home-personal-care'),
  ('oraimo',            '%PowerHub 2%',               'power-solutions'),
  ('oraimo',            '%Hotspot Elf%',              'phone-car-accessories'),
  ('oraimo',            '%SmartKettle%',              'home-personal-care'),
  ('others',            '%PowerSpark%',               'phone-car-accessories'),
  ('others',            '300W Multi-Port Car Power Converter%', 'phone-car-accessories'),
  ('jbl',               'JBL Charge 6%',              'speakers'),
  ('jbl',               'JBL Flip 7%',                'speakers'),
  ('itel',              'Itel Led Makeup Mirror%',    'home-personal-care'),
  ('budi',              'Budi iphone earphones%',     'earbuds-earphones'),
  ('xiaomi-redmi-mi',   'Xiaomi Type-c Wired Earphones%', 'earbuds-earphones'),
  ('soundcore-anker',   'Anker Nano 45W%',            'chargers-cables'),
  ('soundcore-anker',   'Anker High Speed 65W%',      'chargers-cables');

CREATE TEMP TABLE mixed_old (slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO mixed_old VALUES ('oraimo'), ('others'), ('jbl'), ('itel'), ('budi'), ('xiaomi-redmi-mi'), ('soundcore-anker'), ('test');

-- 4. Create any missing new categories. A new one takes the picture of the
--    first old category in its group that has one.
INSERT INTO categories (id, name, slug, sort_order, is_active, is_featured, image_url, updated_at)
SELECT gen_random_uuid()::text, t.name, t.slug, t.sort, true, false,
       (SELECT c.image_url FROM categories c JOIN cat_map m ON m.old_slug = c.slug
         WHERE m.new_slug = t.slug AND c.image_url IS NOT NULL AND c.deleted_at IS NULL
         ORDER BY c.sort_order, c.name LIMIT 1),
       now()
FROM target_cats t
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = t.slug);

-- Make sure the kept categories are visible, correctly named and in order.
UPDATE categories c
   SET name = t.name, sort_order = t.sort, is_active = true, deleted_at = NULL, parent_id = NULL, updated_at = now()
  FROM target_cats t
 WHERE c.slug = t.slug;

-- 5. Remember where every product was, for the report.
CREATE TEMP TABLE moved (product_id text PRIMARY KEY, product_name text, brand text, old_cat text, new_cat text) ON COMMIT DROP;

-- 5a. Hand-placed products from the mixed categories.
INSERT INTO moved
SELECT p.id, p.name, b.name, oc.name, nc.name
  FROM mixed_map mm
  JOIN categories oc ON oc.slug = mm.old_slug
  JOIN products p ON p.category_id = oc.id AND p.name ILIKE mm.name_pattern
  JOIN brands b ON b.id = p.brand_id
  JOIN categories nc ON nc.slug = mm.new_slug
ON CONFLICT (product_id) DO NOTHING;

UPDATE products p SET category_id = nc.id, updated_at = now()
  FROM mixed_map mm
  JOIN categories oc ON oc.slug = mm.old_slug
  JOIN categories nc ON nc.slug = mm.new_slug
 WHERE p.category_id = oc.id AND p.name ILIKE mm.name_pattern;

-- 5b. Everything in a merged category moves as a whole.
INSERT INTO moved
SELECT p.id, p.name, b.name, oc.name, nc.name
  FROM cat_map m
  JOIN categories oc ON oc.slug = m.old_slug
  JOIN products p ON p.category_id = oc.id
  JOIN brands b ON b.id = p.brand_id
  JOIN categories nc ON nc.slug = m.new_slug
ON CONFLICT (product_id) DO NOTHING;

UPDATE products p SET category_id = nc.id, updated_at = now()
  FROM cat_map m
  JOIN categories oc ON oc.slug = m.old_slug
  JOIN categories nc ON nc.slug = m.new_slug
 WHERE p.category_id = oc.id;

-- 6. Safety check. No product may be left in a category that is about to go.
DO $$
DECLARE left_over text;
BEGIN
  SELECT string_agg(p.name || ' (in ' || c.name || ')', '; ') INTO left_over
    FROM products p JOIN categories c ON c.id = p.category_id
   WHERE c.slug IN (SELECT old_slug FROM cat_map UNION SELECT slug FROM mixed_old);
  IF left_over IS NOT NULL THEN
    RAISE EXCEPTION 'Stopped, nothing changed. These products still need a new category: %', left_over;
  END IF;
END $$;

-- 7. Remove the old categories (kept in the database as deleted, not erased).
UPDATE categories
   SET deleted_at = now(), is_active = false, updated_at = now()
 WHERE slug IN (SELECT old_slug FROM cat_map UNION SELECT slug FROM mixed_old)
   AND slug NOT IN (SELECT slug FROM target_cats);

-- 8. REPORT -----------------------------------------------------------------
\echo
\echo '=== Products per category after the change ==='
SELECT c.sort_order AS "#", c.name AS category, count(p.id) AS products
  FROM categories c LEFT JOIN products p ON p.category_id = c.id
 WHERE c.deleted_at IS NULL AND c.is_active
 GROUP BY c.sort_order, c.name ORDER BY c.sort_order;

\echo
\echo '=== Products that came out of the brand / mixed categories ==='
SELECT old_cat AS "was in", product_name AS product, brand, new_cat AS "now in"
  FROM moved WHERE old_cat IN ('Oraimo','Others','Jbl','Itel','Budi','Xiaomi Redmi Mi','Soundcore Anker')
 ORDER BY old_cat, product_name;

\echo
\echo '=== Check the brand on these (a Jbl product should have brand JBL) ==='
SELECT old_cat AS "was in", brand AS "brand on the product", count(*) AS products
  FROM moved WHERE old_cat IN ('Jbl','Itel','Budi','Xiaomi Redmi Mi','Soundcore Anker','Sandisc External Storage')
 GROUP BY old_cat, brand ORDER BY old_cat;

\echo
\echo '=== Total products moved ==='
SELECT count(*) AS moved FROM moved;

-- PREVIEW ONLY. To save the change, replace the word ROLLBACK with COMMIT.
ROLLBACK;
