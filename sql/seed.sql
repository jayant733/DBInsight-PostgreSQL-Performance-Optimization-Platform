-- Synthetic e-commerce seed data for the ecom schema (PostgreSQL 14+)
-- This script is rerunnable after sql/schema.sql.

SET search_path = ecom, public;

------------------------------------------------------------
-- Extensions (register extensions)
------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS btree_gist;

------------------------------------------------------------
-- 0) RESET (rerunnable)
------------------------------------------------------------
TRUNCATE TABLE
  ecom.reviews, ecom.shipments, ecom.payments, ecom.order_items, ecom.orders,
  ecom.inventory, ecom.product_suppliers, ecom.product_prices,
  ecom.products, ecom.suppliers, ecom.addresses, ecom.customers, ecom.categories, ecom.country
RESTART IDENTITY CASCADE;

------------------------------------------------------------
-- 0.5) product_prices exclusion constraint: [) (touch OK, overlap NO)
------------------------------------------------------------
ALTER TABLE ecom.product_prices
  DROP CONSTRAINT IF EXISTS product_prices_product_id_tstzrange_excl;

ALTER TABLE ecom.product_prices
  ADD CONSTRAINT product_prices_product_id_tstzrange_excl
  EXCLUDE USING gist (
    product_id WITH =,
    tstzrange(valid_from, valid_to, '[)') WITH &&
  );

------------------------------------------------------------
-- 1) Master data
------------------------------------------------------------

-- Countries
INSERT INTO ecom.country(country_code, country_name) VALUES
('US','United States'),('KR','Korea'),('JP','Japan'),('DE','Germany'),('GB','United Kingdom')
ON CONFLICT DO NOTHING;

-- Categories (tree)
WITH roots AS (
  INSERT INTO ecom.categories(parent_id, category_name)
  VALUES
    (NULL,'Electronics'),
    (NULL,'Home & Kitchen'),
    (NULL,'Fashion'),
    (NULL,'Sports')
  RETURNING category_id, category_name
)
INSERT INTO ecom.categories(parent_id, category_name)
SELECT r.category_id, v.child_name
FROM roots r
JOIN LATERAL (
  VALUES
    (CASE WHEN r.category_name='Electronics'     THEN 'Phones' END),
    (CASE WHEN r.category_name='Electronics'     THEN 'Laptops' END),
    (CASE WHEN r.category_name='Electronics'     THEN 'Audio' END),
    (CASE WHEN r.category_name='Home & Kitchen'  THEN 'Appliances' END),
    (CASE WHEN r.category_name='Home & Kitchen'  THEN 'Cookware' END),
    (CASE WHEN r.category_name='Fashion'         THEN 'Men' END),
    (CASE WHEN r.category_name='Fashion'         THEN 'Women' END),
    (CASE WHEN r.category_name='Fashion'         THEN 'Shoes' END),
    (CASE WHEN r.category_name='Sports'          THEN 'Outdoor' END),
    (CASE WHEN r.category_name='Sports'          THEN 'Fitness' END)
) AS v(child_name) ON v.child_name IS NOT NULL;

-- Suppliers
INSERT INTO ecom.suppliers(supplier_name, phone)
SELECT 'Supplier ' || gs::text, '+1-555-10' || lpad(gs::text,3,'0')
FROM generate_series(1,50) gs;

------------------------------------------------------------
-- Products (600): Uniform distribution across leaf categories (minimize skew)
------------------------------------------------------------
WITH leaf AS (
  SELECT category_id,
        row_number() OVER (ORDER BY random()) AS rn
  FROM ecom.categories
  WHERE parent_id IS NOT NULL
),
leaf_cnt AS (
  SELECT count(*)::int AS cnt FROM leaf
),
prod AS (
  SELECT gs,
        row_number() OVER (ORDER BY gs) AS rn
  FROM generate_series(1,600) gs
)
INSERT INTO ecom.products(sku, product_name, category_id, unit, active, created_at)
SELECT
  'SKU-' || to_char(p.gs,'FM000000') AS sku,
  'Product ' || p.gs::text          AS product_name,
  l.category_id                      AS category_id,
  'each'                             AS unit,
  true                               AS active,
  now() - (random()*365 || ' days')::interval AS created_at
FROM prod p
CROSS JOIN leaf_cnt c
JOIN leaf l
  ON l.rn = ((p.rn - 1) % c.cnt) + 1;

------------------------------------------------------------
-- Product Suppliers
--    supplier_id randomly selected per row using LATERAL (prevents static values)
------------------------------------------------------------
INSERT INTO ecom.product_suppliers(product_id, supplier_id, primary_supplier)
SELECT
  p.product_id,
  s.supplier_id,
  (random() < 0.2)
FROM ecom.products p
CROSS JOIN LATERAL (
  SELECT supplier_id
  FROM ecom.suppliers
  ORDER BY random()
  LIMIT 1
) s;

------------------------------------------------------------
-- 2) Price history (SCD2): 3 segments
------------------------------------------------------------

-- Past 1: 365~180 days ago
INSERT INTO ecom.product_prices(product_id, price, currency, valid_from, valid_to, is_current)
SELECT p.product_id,
      round((10 + random()*190)::numeric, 2),
      'USD',
      now() - interval '365 days',
      now() - interval '180 days',
      false
FROM ecom.products p;

-- Past 2: 180~30 days ago
INSERT INTO ecom.product_prices(product_id, price, currency, valid_from, valid_to, is_current)
SELECT p.product_id,
      round((10 + random()*190)::numeric, 2),
      'USD',
      now() - interval '180 days',
      now() - interval '30 days',
      false
FROM ecom.products p;

-- Current: 30 days ago ~ 365 days future
INSERT INTO ecom.product_prices(product_id, price, currency, valid_from, valid_to, is_current)
SELECT p.product_id,
      round((10 + random()*190)::numeric, 2),
      'USD',
      now() - interval '30 days',
      now() + interval '365 days',
      true
FROM ecom.products p;

------------------------------------------------------------
-- 3) Inventory (Q7)
------------------------------------------------------------

INSERT INTO ecom.inventory(product_id, qty_on_hand, reorder_point, updated_at)
SELECT p.product_id,
      (20 + (random()*400)::int),
      30,
      now()
FROM ecom.products p;

-- Force 50 products into low-stock
UPDATE ecom.inventory i
SET qty_on_hand = (random()*10)::int,
    reorder_point = 30,
    updated_at = now()
WHERE i.product_id IN (SELECT product_id FROM ecom.products ORDER BY random() LIMIT 50);

------------------------------------------------------------
-- 4) Customers / Addresses
------------------------------------------------------------

-- Customers (3000)
INSERT INTO ecom.customers(email, full_name, phone, created_at, marketing_opt_in, country_code)
SELECT 'user' || gs::text || '@example.com',
      'Customer ' || gs::text,
      '+82-10-' || lpad((10000000 + gs)::text,8,'0'),
      now() - (random()*720 || ' hours')::interval,
      (random() < 0.4),
      (ARRAY['US','KR','JP','DE','GB'])[1 + (random()*4)::int]
FROM generate_series(1,3000) gs;

-- Default address
INSERT INTO ecom.addresses(customer_id, line1, line2, city, state, postal_code, country_code, is_default, created_at)
SELECT c.customer_id,
      'Street ' || (1 + (random()*999)::int),
      NULL,
      (ARRAY['Seoul','Busan','New York','London','Tokyo','Berlin'])[1 + (random()*5)::int],
      NULL,
      lpad((10000 + (random()*89999)::int)::text,5,'0'),
      COALESCE(c.country_code, 'US'),
      true,
      now() - (random()*365 || ' days')::interval
FROM ecom.customers c;

-- Second address (~35%)
INSERT INTO ecom.addresses(customer_id, line1, line2, city, state, postal_code, country_code, is_default, created_at)
SELECT c.customer_id,
      'Apt ' || (1 + (random()*999)::int),
      'Unit ' || (1 + (random()*30)::int),
      (ARRAY['Seoul','Busan','New York','London','Tokyo','Berlin'])[1 + (random()*5)::int],
      NULL,
      lpad((10000 + (random()*89999)::int)::text,5,'0'),
      COALESCE(c.country_code, 'US'),
      false,
      now() - (random()*365 || ' days')::interval
FROM ecom.customers c
WHERE random() < 0.35;

------------------------------------------------------------
-- 5) Orders
------------------------------------------------------------

-- (A) Normal customers: status mix (r once per row)
INSERT INTO ecom.orders(customer_id, order_status, order_ts, shipping_address_id, coupon_code, channel)
SELECT c.customer_id,
      CASE
        WHEN rr.r < 0.08 THEN 'created'
        WHEN rr.r < 0.18 THEN 'cancelled'
        WHEN rr.r < 0.26 THEN 'refunded'
        WHEN rr.r < 0.52 THEN 'paid'
        WHEN rr.r < 0.72 THEN 'shipped'
        ELSE 'delivered'
      END AS order_status,
      now() - (random()*120 || ' days')::interval AS order_ts,
      (SELECT address_id
        FROM ecom.addresses a
        WHERE a.customer_id = c.customer_id
        ORDER BY random()
        LIMIT 1),
      CASE WHEN random() < 0.22 THEN 'SAVE10' END,
      (ARRAY['web','mobile','marketplace'])[1 + (random()*2)::int]
FROM ecom.customers c
CROSS JOIN LATERAL generate_series(1, (random()*4)::int) g
CROSS JOIN LATERAL (
  -- Includes outer reference to prevent query flattening/constant folding
  SELECT (random() + (c.customer_id * 0)) AS r
) rr;

-- (B) Heavy customers: 1~30 create many recent revenue orders (Q10)
INSERT INTO ecom.orders(customer_id, order_status, order_ts, shipping_address_id, coupon_code, channel)
SELECT c.customer_id,
      (ARRAY['paid','shipped','delivered'])[1 + (random()*2)::int],
      now() - (random()*60 || ' days')::interval,
      (SELECT address_id
        FROM ecom.addresses a
        WHERE a.customer_id = c.customer_id
        ORDER BY random()
        LIMIT 1),
      CASE WHEN random() < 0.35 THEN 'SAVE10' END,
      (ARRAY['web','mobile','marketplace'])[1 + (random()*2)::int]
FROM ecom.customers c
CROSS JOIN LATERAL generate_series(1, 10 + (random()*14)::int) g  -- 10~24/orders
WHERE c.customer_id BETWEEN 1 AND 30;

------------------------------------------------------------
-- 6) Order Items (coupon effect + FIXED qty/discount consistency)
------------------------------------------------------------

INSERT INTO ecom.order_items(order_id, product_id, qty, unit_price, discount)
SELECT o.order_id,
      x.product_id,
      x.qty,
      x.unit_price,
      x.discount
FROM ecom.orders o
CROSS JOIN LATERAL generate_series(
  1,
  CASE
    WHEN o.coupon_code IS NOT NULL THEN 2 + (random()*3)::int   -- 2~5 items
    ELSE 1 + (random()*3)::int                                 -- 1~4 items
  END
) g
CROSS JOIN LATERAL (
  WITH picked AS (
    SELECT
      p.product_id,
      pp.price AS unit_price,
      CASE
        WHEN o.coupon_code IS NOT NULL THEN 1 + (random()*4)::int  -- 1~5
        ELSE 1 + (random()*3)::int                                 -- 1~4
      END AS qty
    FROM ecom.products p
    JOIN ecom.product_prices pp
      ON pp.product_id = p.product_id
    AND o.order_ts >= pp.valid_from AND o.order_ts < pp.valid_to
    ORDER BY
      -- If coupon is used, bias towards higher-priced products
      CASE WHEN o.coupon_code IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN o.coupon_code IS NOT NULL THEN pp.price END DESC,
      CASE WHEN o.coupon_code IS NULL THEN random() END,
      random()
    LIMIT 1
  )
  SELECT
    product_id,
    qty,
    unit_price,
    CASE
      WHEN o.coupon_code = 'SAVE10'
        THEN round((unit_price * qty) * 0.10, 2)
      ELSE 0
    END AS discount
  FROM picked
) x;

------------------------------------------------------------
-- 7) Repurchase guarantee (Q6): 200 customers buy again within 30 days
------------------------------------------------------------

WITH paid_orders AS (
  SELECT customer_id, order_id, order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid','shipped','delivered')
),
first_buy AS (
  SELECT customer_id, min(order_ts) AS first_ts
  FROM paid_orders
  GROUP BY customer_id
),
target AS (
  SELECT customer_id, first_ts
  FROM first_buy
  WHERE customer_id NOT BETWEEN 1 AND 30
  ORDER BY random()
  LIMIT 200
),
ins_orders AS (
  INSERT INTO ecom.orders(customer_id, order_status, order_ts, shipping_address_id, coupon_code, channel)
  SELECT t.customer_id,
        (ARRAY['paid','delivered'])[1 + (random()*1)::int],
        t.first_ts + ((7 + (random()*18)::int) || ' days')::interval,
        (SELECT address_id FROM ecom.addresses a WHERE a.customer_id = t.customer_id ORDER BY random() LIMIT 1),
        CASE WHEN random() < 0.25 THEN 'SAVE10' END,
        (ARRAY['web','mobile','marketplace'])[1 + (random()*2)::int]
  FROM target t
  RETURNING order_id, order_ts, coupon_code
)
INSERT INTO ecom.order_items(order_id, product_id, qty, unit_price, discount)
SELECT o.order_id,
      x.product_id,
      x.qty,
      x.unit_price,
      x.discount
FROM ins_orders o
CROSS JOIN LATERAL generate_series(
  1,
  CASE WHEN o.coupon_code IS NOT NULL THEN 2 + (random()*2)::int ELSE 1 + (random()*2)::int END
) g
CROSS JOIN LATERAL (
  WITH picked AS (
    SELECT
      p.product_id,
      pp.price AS unit_price,
      CASE WHEN o.coupon_code IS NOT NULL THEN 1 + (random()*3)::int ELSE 1 + (random()*2)::int END AS qty
    FROM ecom.products p
    JOIN ecom.product_prices pp
      ON pp.product_id = p.product_id
    AND o.order_ts >= pp.valid_from AND o.order_ts < pp.valid_to
    ORDER BY random()
    LIMIT 1
  )
  SELECT
    product_id,
    qty,
    unit_price,
    CASE WHEN o.coupon_code='SAVE10' THEN round((unit_price * qty)*0.10, 2) ELSE 0 END AS discount
  FROM picked
) x;

------------------------------------------------------------
-- 8) Payments / Shipments (consistency)
------------------------------------------------------------

INSERT INTO ecom.payments(order_id, method, amount, paid_at)
SELECT o.order_id,
      (ARRAY['card','bank','paypal','cod'])[1 + (random()*3)::int],
      COALESCE(
        (SELECT round(sum(oi.qty * oi.unit_price - oi.discount), 2)
          FROM ecom.order_items oi
          WHERE oi.order_id = o.order_id),
        0
      ) AS amount,
      o.order_ts + (random()*2) * INTERVAL '1 hour'
FROM ecom.orders o
WHERE o.order_status IN ('paid','shipped','delivered','refunded');

INSERT INTO ecom.shipments(order_id, carrier, tracking_no, shipped_at, delivered_at)
SELECT o.order_id,
      (ARRAY['DHL','UPS','FedEx','CJ','Kerry'])[1 + (random()*4)::int],
      'TRK' || o.order_id::text,
      o.order_ts + interval '1 day',
      CASE WHEN o.order_status = 'delivered' THEN o.order_ts + interval '3 days' END
FROM ecom.orders o
WHERE o.order_status IN ('shipped','delivered');

------------------------------------------------------------
-- 9) Reviews (Q8): ensure >= 12 hero products avg>=4.5 and cnt>=60
------------------------------------------------------------

WITH hero_products AS (
  SELECT product_id
  FROM ecom.products
  ORDER BY random()
  LIMIT 12
),
reviewers AS (
  SELECT customer_id
  FROM ecom.customers
  ORDER BY random()
  LIMIT 1500
),
pairs AS (
  SELECT hp.product_id, r.customer_id,
        CASE WHEN random() < 0.78 THEN 5 ELSE 4 END AS rating
  FROM hero_products hp
  CROSS JOIN LATERAL (
    SELECT customer_id FROM reviewers ORDER BY random() LIMIT 160
  ) r
)
INSERT INTO ecom.reviews(product_id, customer_id, rating, review_text, created_at)
SELECT product_id, customer_id, rating,
      'Great product ' || product_id::text,
      now() - (random()*120 || ' days')::interval
FROM pairs
ON CONFLICT (product_id, customer_id) DO NOTHING;

-- Extra random reviews to create long tail
INSERT INTO ecom.reviews(product_id, customer_id, rating, review_text, created_at)
SELECT p.product_id, c.customer_id,
      1 + (random()*4)::int,
      'Review ' || p.product_id::text,
      now() - (random()*180 || ' days')::interval
FROM ecom.products p
JOIN LATERAL (SELECT customer_id FROM ecom.customers ORDER BY random() LIMIT 1) c ON true
WHERE random() < 0.22
ON CONFLICT (product_id, customer_id) DO NOTHING;

------------------------------------------------------------
-- (Optional) Q11 helper: safe division function
------------------------------------------------------------
CREATE OR REPLACE FUNCTION ecom.safe_div(n numeric, d numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN d IS NULL OR d = 0 THEN NULL ELSE n / d END
$$;
