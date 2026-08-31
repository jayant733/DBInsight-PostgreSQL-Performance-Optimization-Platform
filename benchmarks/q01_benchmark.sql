/* Q1 Repeated Performance Measurement: Helper script to reduce single-run variance on small datasets */
BEGIN;

-- Use identical 1-month cutoff reference timestamp across both runs
SELECT now() AS benchmark_as_of;

-- Cache warming
SELECT SUM(oi.line_total)
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';

-- Pre-tuning plan (orders Seq Scan): 500 iterations
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = off;

DO $$
DECLARE
  i integer;
  revenue numeric;
  started_at timestamptz := clock_timestamp();
  elapsed_ms numeric;
BEGIN
  FOR i IN 1..500 LOOP
    SELECT SUM(oi.line_total)
      INTO revenue
    FROM ecom.orders AS o
    JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
    WHERE o.order_status IN ('paid', 'shipped', 'delivered')
      AND o.order_ts >= now() - INTERVAL '1 month';
  END LOOP;

  elapsed_ms := EXTRACT(epoch FROM clock_timestamp() - started_at) * 1000;
  RAISE NOTICE 'before(seq scan): total=% ms, average=% ms',
    ROUND(elapsed_ms, 3), ROUND(elapsed_ms / 500, 3);
END $$;

-- Post-tuning default plan (Index Only Scan): 500 iterations
SET LOCAL enable_indexscan = on;
SET LOCAL enable_indexonlyscan = on;
SET LOCAL enable_bitmapscan = on;

DO $$
DECLARE
  i integer;
  revenue numeric;
  started_at timestamptz := clock_timestamp();
  elapsed_ms numeric;
BEGIN
  FOR i IN 1..500 LOOP
    SELECT SUM(oi.line_total)
      INTO revenue
    FROM ecom.orders AS o
    JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
    WHERE o.order_status IN ('paid', 'shipped', 'delivered')
      AND o.order_ts >= now() - INTERVAL '1 month';
  END LOOP;

  elapsed_ms := EXTRACT(epoch FROM clock_timestamp() - started_at) * 1000;
  RAISE NOTICE 'after(index only scan): total=% ms, average=% ms',
    ROUND(elapsed_ms, 3), ROUND(elapsed_ms / 500, 3);
END $$;

ROLLBACK;
