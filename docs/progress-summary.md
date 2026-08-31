# E-commerce PostgreSQL Query Tuning Practice Progress Summary (Q1–Q10)

- Date: 2026-08-14
- Database: PostgreSQL 17 (Baseline Experiment Environment)
- Default Schema: `ecom`
- Session Timezone: `Asia/Seoul`
- Key Dataset Scale: 6,830 orders, 18,622 order items, 600 products / inventory records, 2,060 reviews, 14 categories, 3,000 customers
- Recognized Realized Order Statuses: `paid`, `shipped`, `delivered`

## Common Experiment Process

Scenarios Q1 to Q10 follow this execution sequence:

1. Query baseline results.
2. Inspect baseline bottlenecks using `EXPLAIN (ANALYZE, BUFFERS)`.
3. Modify indexes or query aggregation structure.
4. Verify that tuned results match baseline results exactly.
5. Inspect tuned `EXPLAIN (ANALYZE, BUFFERS)`.
6. Compare Hash Join, Nested Loop, and Merge Join strategies.
7. Compare Bitmap Heap Scan behavior.
8. Revert experimental planner settings and temporary indexes.
9. Create and refresh Materialized Views.
10. Verify result parity between raw queries and Materialized Views.
11. Inspect Materialized View execution plans.
12. Verify business boundary conditions and data quality.
13. Validate bidirectional `EXCEPT ALL` between baseline and tuned results.

In DBeaver, multi-statement files are executed with `⌥ Option + X`. Immediately after running `08_bitmap_heap_scan.sql`, run `08b_cleanup.sql` in the same editor and DB session.

> [!NOTE]
> The execution times below represent single-run observations under synthetic seed data and warm cache states. Because timings vary with execution sequence, shared buffers, and OS page cache, final evaluations examine estimated cost, actual row counts, `Buffers`, and scan methods alongside runtime.

---

## Q1. Realized Sales Revenue for the Past Month

Related files: [`queries/q01`](../queries/q01/)

### Objective

Calculate the sum of `order_items.line_total` for orders in `paid`, `shipped`, or `delivered` status within the past month from the current timestamp, accelerating reporting using date-targeted partial indexes and daily GMV Materialized Views.

### Changes Made

- Replaced the baseline sequential scan on `orders` with an Index Only Scan using a recent-period partial index.
- Compared three join algorithms and Bitmap Heap Scan separately.
- Refreshed `mv_daily_gmv` and created a UNIQUE index to support `CONCURRENTLY` refreshes.
- Identified the date boundary overcounting issue in naive daily MVs and adopted a hybrid query that reads full calendar days from the MV and only boundary period data from the raw tables.

### SQL & Indexes Used

Core query condition:

```sql
SELECT SUM(oi.line_total) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';
```

Partial index:

```sql
CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

Index for concurrent MV refresh and refresh command:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ux_mv_daily_gmv_day
ON ecom.mv_daily_gmv(day);

REFRESH MATERIALIZED VIEW CONCURRENTLY ecom.mv_daily_gmv;
```

### Execution Plan Highlights

- Baseline: `Seq Scan on orders` → `Hash` → `Hash Join` → `Aggregate`
- Tuned: `Index Only Scan using idx_orders_revenue_ts_order_id`, `Heap Fetches: 0`
- `order_items` continued using Seq Scan due to the high proportion of recent order items.
- Bitmap experiment: `Bitmap Index Scan` → `Bitmap Heap Scan` on a date-only index; candidate timestamps were fetched first and filtered by status post-scan.
- The accurate hybrid MV approach joins full dates from the MV with partial boundary dates from raw tables via `UNION ALL`.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 4.462 ms | shared hit 251, orders Seq Scan |
| Partial Index Applied | 3.184 ms | shared hit 189, Index Only Scan |
| 500-run Average Baseline | 1.349 ms | Repeated measurement |
| 500-run Average Tuned | 0.769 ms | Repeated measurement |
| Forced Hash Join | 4.683 ms | Single run |
| Forced Nested Loop | 3.544 ms | Fast under warm cache, but buffers reached 4,385 |
| Forced Merge Join | 5.264 ms | buffers 227, sorting/ordering overhead |
| Bitmap Heap Scan | 3.765 ms | Out of 1,839 candidate dates, 392 were filtered out |
| Naive Daily MV | 0.053 ms | Very fast, but overcounts boundary day |
| Boundary-Corrected MV | 0.365 ms | shared hit 44, exact match with raw query |

Accuracy comparison example at time of capture:

- Direct raw query: `1,422,428.75`
- Naive daily MV: `1,461,903.76`
- Boundary-corrected MV: `1,422,428.75`
- Boundary overcount amount: `39,475.01`

### Cautions & Considerations

- `now() - interval '1 month'` shifts continuously, meaning boundary timestamps and calculated amounts change over time.
- A naive MV using `day >= date_trunc('day', cutoff)` includes the entire boundary day from midnight, resulting in overcounting.
- In Q1, the MV refresh script is `12_mv_refresh.sql`, so the execution sequence for MV testing is `12 → 09 → 10 → 11`.
- Steps 05–07 in Q1 use session-level `SET` parameters; execute `RESET` in 08b to restore session defaults.

---

## Q2. Monthly Order Count, Revenue, and AOV

Related files: [`queries/q02`](../queries/q02/)

### Objective

Calculate monthly realized order counts, revenue, and average order value (AOV) using `date_trunc('month', order_ts)`. Because joining order items duplicates order rows, the baseline uses `COUNT(DISTINCT order_id)`, while the tuned version pre-aggregates order totals to eliminate `DISTINCT`.

### Changes Made

- Converted the baseline structure (which sorted 14,356 joined rows by month/order_id for `COUNT(DISTINCT)`) into order-level pre-aggregation.
- Confirmed that valid orders comprise ~77% of all orders, meaning a standard order index has low selectivity.
- Created `mv_monthly_sales` for recurring monthly reporting.

### SQL & Indexes Used

Baseline core query:

```sql
SELECT date_trunc('month', o.order_ts) AS order_month,
       COUNT(DISTINCT o.order_id) AS order_count,
       SUM(oi.line_total) AS revenue,
       SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0) AS aov
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY date_trunc('month', o.order_ts);
```

Tuned core query:

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
)
SELECT order_month,
       COUNT(order_id) AS order_count,
       SUM(order_total) AS revenue,
       AVG(order_total) AS aov
FROM order_totals
GROUP BY order_month;
```

MV index:

```sql
CREATE UNIQUE INDEX ux_mv_monthly_sales_month
ON ecom.mv_monthly_sales(order_month);
```

### Execution Plan Highlights

- Baseline: After `Hash Join`, sorted 14,356 rows followed by `GroupAggregate`; sort memory ~945 kB.
- Tuned: `HashAggregate` by `order_id` creates 5,264 order rows, followed by monthly `HashAggregate`.
- For full-table queries, low selectivity makes Seq Scan on `orders` and `order_items` optimal.
- Bitmap experiment observed `Bitmap Index Scan` → `Bitmap Heap Scan` using `idx_orders_status` for instructional comparison; not recommended for production.
- MV reads only 5 monthly summary rows.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 14.200 ms | shared hit 251, Sort + GroupAggregate |
| Order-level Pre-aggregation | 7.940 ms | shared hit 251, eliminated DISTINCT |
| Forced Hash Join | 14.934 ms | shared hit 254 |
| Forced Nested Loop | 18.586 ms | shared hit 15,959 |
| Forced Merge Join | 13.932 ms | shared hit 312, tested without Q4 index |
| Forced Bitmap Heap Scan | 18.137 ms | shared hit 15,967 |
| Monthly MV | 0.006 ms | shared hit 1, 5 MV rows |

Verified monthly results:

| Month | Order Count | Revenue | AOV |
|---|---:|---:|---:|
| 2026-04 | 550 | 486,216.71 | 884.03 |
| 2026-05 | 1,254 | 1,084,540.80 | 864.87 |
| 2026-06 | 1,362 | 1,281,450.02 | 940.86 |
| 2026-07 | 1,474 | 1,452,007.55 | 985.08 |
| 2026-08 | 624 | 599,381.57 | 960.55 |

`values_match` between raw queries and the MV evaluated to `true` across all months.

### Cautions & Considerations

- Using `COUNT(order_id)` on raw `order_items` joins mistakenly counts item lines as orders. Always use `COUNT(DISTINCT)` or pre-aggregate by order.
- For full-period aggregations, Seq Scan + Hash Join is often far more efficient than forcing index scans.
- `NULLIF` was used to safeguard against division by zero.

---

## Q3. Top 10 Revenue Categories in the Past 90 Days

Related files: [`queries/q03`](../queries/q03/)

### Objective

Identify the top 10 categories by realized revenue over the past 90 days by linking `order_items → products → categories`.

### Changes Made

- Reused the recent-period partial index created in Q1.
- Restructured the query: instead of joining ~11,000 raw order item rows directly to products and categories, product-level sales were pre-aggregated into 594 rows before joining dimension tables.
- Created `mv_daily_category_gmv` for recurring 90-day reporting and applied date boundary adjustments identical to Q1.

### SQL & Indexes Used

Reused partial index:

```sql
CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders(order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

Tuned core query:

```sql
WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
)
SELECT c.category_id, c.category_name, SUM(ps.revenue) AS revenue
FROM product_sales AS ps
JOIN ecom.products AS p ON p.product_id = ps.product_id
JOIN ecom.categories AS c ON c.category_id = p.category_id
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC
LIMIT 10;
```

MV UNIQUE index:

```sql
CREATE UNIQUE INDEX ux_mv_daily_category_gmv_day_category
ON ecom.mv_daily_category_gmv(day, category_id);
```

### Execution Plan Highlights

- Baseline: orders Seq Scan, total shared hit 259; 11,288 order item rows passed through to products/categories.
- Tuned: orders `Index Only Scan`, `Heap Fetches: 0`, shared hit 226.
- Outer join input reduced to 594 rows following product-level `HashAggregate`.
- `Memoize` on category PK lookups reduced 594 potential index lookups to just 10 actual executions.
- Boundary-corrected MV executed with shared hit 82.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 8.615 ms | shared hit 259, orders Seq Scan |
| Partial Index + Product Pre-aggregation | 4.476 ms | shared hit 226, orders Index Only Scan |
| Forced Hash Join | 8.417 ms | shared hit 213 |
| Forced Nested Loop | 11.590 ms | shared hit 14,230 |
| Forced Merge Join | 7.829 ms | shared hit 321 |
| Forced Bitmap Heap Scan | 9.044 ms | shared hit 14,290 |
| Boundary-Corrected Category MV | 0.321 ms | shared hit 82 |

In the baseline snapshot, top categories were Cookware, Shoes, Phones, Audio, and Men. `exact_match` for the top 10 between raw and corrected MV was `true`, and `mismatch_rows` across all categories was 0.

### Cautions & Considerations

- Because `now()` shifts over time, boundary orders and category rankings may fluctuate depending on execution time.
- Naive daily MVs overcount per category starting from midnight of the cutoff date.
- `08_bitmap_heap_scan.sql` temporarily drops the Q1 partial index inside a transaction; execute 08b to restore it.
- This scenario evaluates direct product categories. Hierarchical category rollups require recursive CTEs or `v_category_path`.

---

## Q4. Cumulative Revenue RANK Top 20 by Product

Related files: [`queries/q04`](../queries/q04/)

### Objective

Calculate total cumulative realized revenue per product, apply `RANK() OVER (ORDER BY revenue DESC)`, and return the top 20 ranked products.

### Changes Made

- Restructured the query to aggregate product revenue first before joining product names, rather than joining products to raw order items upfront.
- Added a compact partial index storing only `order_id` for valid orders.
- Created `mv_product_revenue` for cumulative product revenue.

### SQL & Indexes Used

Partial index:

```sql
CREATE INDEX idx_orders_q4_valid_order_id
ON ecom.orders(order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

Index footprint was ~136 kB on the test dataset.

Tuned core query:

```sql
WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY oi.product_id
),
ranked AS (
  SELECT ps.product_id,
         p.product_name,
         ps.revenue,
         RANK() OVER (ORDER BY ps.revenue DESC) AS revenue_rank
  FROM product_sales AS ps
  JOIN ecom.products AS p USING (product_id)
)
SELECT *
FROM ranked
WHERE revenue_rank <= 20;
```

MV UNIQUE index:

```sql
CREATE UNIQUE INDEX ux_mv_product_revenue_product
ON ecom.mv_product_revenue(product_id);
```

### Execution Plan Highlights

- Baseline: Joined orders and order_items, passed 14,356 rows to products, then aggregated by product.
- Tuned: `idx_orders_q4_valid_order_id` Index Only Scan, `Heap Fetches: 0`, orders buffers 17.
- Pre-aggregation meant the product join handled only 599 rows.
- `WindowAgg` applied `Run Condition: rank() <= 20`.
- Merge Join leveraged existing `order_id` index ordering to merge without sorting.
- MV query read only 599 pre-calculated product rows to compute ranks.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 7.984 ms | shared hit 258 |
| Partial Index + Product Pre-aggregation | 5.650 ms | shared hit 204 |
| Forced Hash Join | 6.207 ms | shared hit 204 |
| Forced Nested Loop | 6.064 ms | shared hit 15,638 |
| Forced Merge Join | 3.059 ms | shared hit 245, leveraged sorted index |
| Forced Bitmap Heap Scan | 6.129 ms | shared hit 17,764 |
| Product Revenue MV | 0.151 ms | shared hit 11 |

Top result examples:
1. product_id 224: `1,616,683.78`
2. product_id 489: `735,671.65`
3. product_id 312: `17,833.49`

All Top 20 revenue and rank comparisons between raw and MV evaluated to `true`, and `mismatch_rows` across all products was 0.

### Cautions & Considerations

- Applying `RANK()` directly to raw rows prior to aggregation computes line-item rank rather than cumulative product rank. Window functions must follow per-product `SUM`.
- `RANK <= 20` may return more than 20 rows if ties exist at rank 20. If strictly 20 rows are required, use `ROW_NUMBER()`.
- While Merge Join proved fastest here, Nested Loop displayed similar runtime but drastically inflated buffer reads. Never select Nested Loop based on runtime alone without reviewing I/O.

---

## Q5. Customer RFM: Recency, Frequency, Monetary

Related files: [`queries/q05`](../queries/q05/)

### Objective

Compute each customer's last order timestamp, recency in days, order frequency, and cumulative monetary spend.

### Changes Made

- Replaced raw join `COUNT(DISTINCT order_id)` calculations with order-level pre-aggregation.
- Generated one row per order, then computed customer-level `MAX`, `COUNT`, and `SUM`.
- Created `mv_customer_rfm` for recurring RFM lookups.
- Rather than persisting dynamic `recency_days` in the MV (which stales over time), persisted `last_order_ts` and computed recency at query time.

### SQL & Indexes Used

Tuned core query:

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         o.customer_id,
         o.order_ts,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
)
SELECT customer_id,
       MAX(order_ts) AS last_order_ts,
       CURRENT_DATE - MAX(order_ts)::date AS recency_days,
       COUNT(order_id) AS frequency,
       SUM(order_total) AS monetary
FROM order_totals
GROUP BY customer_id;
```

MV UNIQUE index:

```sql
CREATE UNIQUE INDEX ux_mv_customer_rfm_customer
ON ecom.mv_customer_rfm(customer_id);
```

While `idx_orders_customer_ts(customer_id, order_ts DESC)` is useful for single-customer lookups, a full-table RFM scan reading nearly all valid orders is more efficiently served by a Seq Scan.

### Execution Plan Highlights

- Baseline: Hash Join produced 14,356 rows sorted by `customer_id, order_id`; sort memory ~1,057 kB; `GroupAggregate` evaluated DISTINCT.
- Tuned: First `HashAggregate` yielded 5,264 order rows; second `HashAggregate` yielded 2,222 purchasing customer rows.
- Default scan used Seq Scan across orders (71 buffers) + order_items (180 buffers).
- Forcing Nested Loop / Bitmap scans performed 5,264 repeated index traversals, ballooning buffers to ~15,900.
- MV read only 2,222 pre-calculated customer rows and sorted by monetary spend.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 20.361 ms | shared hit 257, Sort for DISTINCT |
| Order-level Pre-aggregation | 10.018 ms | shared hit 251 |
| Forced Hash Join | 17.673 ms | shared hit 257 |
| Forced Nested Loop | 13.759 ms | shared hit 15,959 |
| Forced Merge Join | 8.651 ms | shared hit 309 |
| Forced Bitmap Heap Scan | 12.452 ms | shared hit 15,967 |
| Customer RFM MV | 0.624 ms | shared hit 17, 2,222 customer rows |

Validation results:
- Raw query customers: 2,222
- MV customers: 2,222
- `mismatch_rows`: 0
- Top customer examples: customer 17 (`frequency=21`, `monetary=31,488.49`), customer 8 (`31,216.28`), customer 27 (`30,448.70`)

### Cautions & Considerations

- `COUNT(order_id)` on raw joined rows miscalculates order item count as frequency. Pre-aggregation or `COUNT(DISTINCT)` is required.
- The seed dataset contains 6 future-dated valid orders. Including them results in negative recency for 6 customers.
- If future orders are classified as invalid in production, enforce `order_ts <= now()` consistently across queries and MV definitions.
- Persisting `last_order_ts` instead of `recency_days` prevents stored data from going stale daily.

---

## Q6. Repeat Purchase Rate within 30 Days of First Purchase

Related files: [`queries/q06`](../queries/q06/)

### Objective

Identify customers who made a valid purchase (`paid`, `shipped`, `delivered`), determine their first purchase timestamp, evaluate whether their first subsequent purchase occurred within 30 days, and calculate the overall repurchase rate among purchasing customers.

### Changes Made

- Baseline executed a correlated `EXISTS` subquery 2,222 times (once per first-time purchasing customer).
- Tuned version joined the first-purchase set with subsequent orders once and pre-aggregated the first repeat timestamp.
- Added a partial index `(customer_id, order_ts) INCLUDE (order_id)` filtering on valid order statuses.
- Created `mv_customer_first_purchase` storing first and repeat purchase timestamps, computing the 30-day window dynamically at query time.

### SQL & Indexes Used

Tuned core query:

```sql
WITH first_orders AS MATERIALIZED (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders
  WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
customer_repurchase AS MATERIALIZED (
  SELECT f.customer_id,
         f.first_order_ts,
         MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (
         WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
       ) AS repurchased_customers,
       ROUND(
         100.0 * COUNT(*) FILTER (
           WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days'
         ) / NULLIF(COUNT(*), 0), 2
       ) AS repurchase_rate_pct
FROM customer_repurchase;
```

Partial index:

```sql
CREATE INDEX idx_orders_q6_valid_customer_ts
ON ecom.orders (customer_id, order_ts)
INCLUDE (order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

### Execution Plan Highlights

- Baseline correlated SubPlan executed 2,222 times, driving buffers up to 5,633.
- Tuned plan performed two Seq Scans on orders, executed a `Hash Left Join`, and aggregated repeat timestamps with `HashAggregate`. Because valid orders comprise ~77% of data, Seq Scan was more efficient than index scans for full-population aggregation.
- Forced Nested Loop utilized the partial index but increased buffer reads to `4,504 hit + 27 read`.
- MV scanned only 2,222 customer rows sequentially.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline Correlated EXISTS | 6.013 ms | shared hit 5,633, SubPlan executed 2,222 times |
| Subsequent Order Pre-aggregation | 4.454 ms | shared hit 142, Hash Left Join |
| Forced Hash Join | 4.156 ms | shared hit 142 |
| Forced Nested Loop | 5.866 ms | shared hit 4,504, read 27 |
| Forced Merge Join | 6.364 ms | shared hit 142 |
| Forced Bitmap Heap Scan | 6.934 ms | shared hit 158 |
| First Purchase MV | 0.641 ms | shared hit 15 |

Validation results:
- Purchasing customers: 2,222
- 30-day repeat purchasers: 1,118
- Repeat purchase rate: `50.32%`
- Baseline vs. Tuned & Raw vs. MV `mismatch_rows`: 0 across all checks

### Cautions & Considerations

- The denominator represents the 2,222 purchasing customers, not the full 3,000 registered accounts.
- 118 customers made their first purchase within the past 30 days, introducing right-censoring bias in naive rates. For strict cohort analysis, filter the denominator for customers whose first purchase occurred before `now() - interval '30 days'`.
- Maintained consistency with Q1–Q5 by including the 6 future-dated valid orders. For real-time operational reporting, append `order_ts <= now()` to both raw queries and MV definitions.

---

## Q7. Low-Stock Products Below Reorder Point

Related files: [`queries/q07`](../queries/q07/)

### Objective

Identify products where `inventory.qty_on_hand < inventory.reorder_point`, sorted by shortage quantity in descending order to surface stockout risks.

### Changes Made

- Created a partial index using the full comparison predicate (`qty_on_hand < reorder_point`) rather than indexing individual columns.
- Filtered low-stock inventory rows before joining product names and SKUs.
- Created `mv_low_stock_products` for recurring queries, noting that real-time inventory requires strict refresh policies.

### SQL & Indexes Used

```sql
CREATE INDEX idx_inventory_q7_low_stock_product
ON ecom.inventory (product_id)
INCLUDE (qty_on_hand, reorder_point, updated_at)
WHERE qty_on_hand < reorder_point;
```

```sql
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
ORDER BY shortage_qty DESC, i.qty_on_hand, i.product_id;
```

### Execution Plan Highlights

- With only 600 rows in `inventory`, the planner chose a Seq Scan reading 5 heap pages. Skipping the partial index was a cost-optimal choice.
- 61 rows passed the filter (539 removed) and Hash Joined with 600 product rows.
- Forcing the partial index via Bitmap Scan provided no benefit over the Seq Scan.
- MV read only the 61 pre-filtered and pre-joined rows.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline | 0.230 ms | shared hit 18, inventory Seq Scan |
| Partial Index + Low-stock Pre-filter | 0.392 ms | shared hit 18, Seq Scan retained due to small table size |
| Forced Hash Join | 0.432 ms | shared hit 18 |
| Forced Nested Loop | 0.322 ms | shared hit 194 |
| Forced Merge Join | 0.417 ms | shared hit 18 |
| Forced Bitmap Heap Scan | 0.358 ms | shared hit 194, read 1 |
| Low-Stock MV | 0.094 ms | shared hit 7 |

Validation results:
- Low-stock products: 61
- Products with 0 stock on hand: 6
- Maximum shortage quantity: 30 units (e.g. products 128, 157, 288, 301, 387, 569)
- Baseline vs. Tuned & Raw vs. MV `mismatch_rows`: 0 across all checks

### Cautions & Considerations

- `qty_on_hand < reorder_point` is a column-to-column comparison, preventing standard b-tree range indexing on `qty_on_hand` alone from narrowing candidates without an expression predicate.
- At 600 rows, direct queries are already fast (<0.4 ms); an MV is not strictly required and can risk stale stockout alerts unless refreshed synchronously with inventory transactions.
- To treat exact reorder point matches as low-stock, change `<` to `<=` in both query and partial index predicate.

---

## Q8. Top Products with Rating >= 4.5 and >= 50 Reviews

Related files: [`queries/q08`](../queries/q08/)

### Objective

Group customer reviews by product to find products with an average rating >= 4.5 and at least 50 reviews.

### Changes Made

- Converted baseline reviews-products pre-join into a reviews-only pre-aggregation.
- Joined product details only for the 12 products that satisfied the `HAVING` clause, reducing dimension join volume.
- Populated `mv_product_review_stats` with raw review counts and unrounded average ratings per product rather than hardcoding threshold filters into the view.
- Avoided adding permanent review indexes since all reviews are required for average calculations.

### SQL Used

```sql
WITH review_stats AS MATERIALIZED (
  SELECT product_id,
         COUNT(*) AS review_count,
         AVG(rating) AS avg_rating
  FROM ecom.reviews
  GROUP BY product_id
  HAVING AVG(rating) >= 4.5
     AND COUNT(*) >= 50
)
SELECT rs.product_id,
       p.product_name,
       rs.review_count,
       ROUND(rs.avg_rating, 2) AS avg_rating
FROM review_stats AS rs
JOIN ecom.products AS p USING (product_id)
ORDER BY avg_rating DESC, review_count DESC, product_id;
```

### Execution Plan Highlights

- Baseline joined 2,060 review rows to products before aggregating.
- Tuned plan performed reviews Seq Scan → `HashAggregate`, filtering 151 reviewed products down to 12 before joining products.
- `HAVING` evaluates post-aggregation; filtering out individual low ratings beforehand would distort average scores.
- Bitmap experiment created a temporary index inside a transaction for comparison, confirming that Bitmap scans are unsuited for full-table aggregations.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline (Pre-join) | 2.738 ms | shared hit 35, aggregated 2,060 joined rows |
| Review Pre-aggregation | 1.745 ms | shared hit 35, 12 rows joined to products |
| Forced Hash Join | 1.051 ms | shared hit 35 |
| Forced Nested Loop | 0.656 ms | shared hit 64, outer input 12 rows |
| Forced Merge Join | 1.004 ms | shared hit 34 |
| Bitmap Experiment | 0.948 ms | shared hit 1,120, temporary index rolled back |
| Product Review MV | 0.415 ms | shared hit 14 |

Validation results:
- Total reviews: 2,060
- Reviewed products: 151
- Products meeting criteria: 12 (top products 44, 177, 261, 550 had 160 reviews and ~4.79 average rating)
- Baseline vs. Tuned & Raw vs. MV `mismatch_rows`: 0 across all checks

### Cautions & Considerations

- Use unrounded `AVG(rating)` in `HAVING` clauses and apply `ROUND()` strictly in the presentation layer to prevent boundary misclassifications.
- This query counts total review rows. The `(product_id, customer_id)` UNIQUE constraint ensures 1 review per customer per product.
- High reviews and ratings indicate customer sentiment, not necessarily top revenue performance.

---

## Q9. Average Order Value: Coupon Users vs. Non-Users

Related files: [`queries/q09`](../queries/q09/)

### Objective

Divide valid orders by coupon usage (`coupon_code IS NOT NULL`), aggregate line items into order-level totals, and compare average order value between the two groups.

### Changes Made

- Baseline calculated AOV across raw order items using `COUNT(DISTINCT order_id)`.
- Tuned version pre-aggregated into 5,264 order rows, computing `AVG(order_total)` at the outer group level.
- `mv_coupon_order_metrics` stores order count and revenue for both groups, computing averages dynamically as `revenue / order_count` at query time.

### SQL Used

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
)
SELECT coupon_used,
       COUNT(*) AS order_count,
       ROUND(AVG(order_total), 2) AS avg_order_amount,
       SUM(order_total) AS revenue
FROM order_totals
GROUP BY coupon_used;
```

### Execution Plan Highlights

- Baseline computed DISTINCT order counts over 14,356 joined rows.
- Tuned plan aggregated to 5,264 order rows via `HashAggregate` before grouping by coupon status.
- Single-run execution time was comparable due to CTE aggregation overhead, but the clean query shape prevents duplicate counting as data scales; recurring queries achieve near-instant execution via the 2-row MV.
- Nested Loop single run was fast but spiked buffers to 15,964. Bitmap scans experienced similar penalties.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline DISTINCT | 12.581 ms | shared hit 259 |
| Order-level Pre-aggregation | 14.617 ms | shared hit 256 |
| Forced Hash Join | 11.891 ms | shared hit 256 |
| Forced Nested Loop | 6.847 ms | shared hit 15,964 |
| Forced Merge Join | 7.044 ms | shared hit 310 |
| Forced Bitmap Heap Scan | 22.701 ms | shared hit 15,972 |
| Coupon Metrics MV | 0.028 ms | shared hit 6, 2 MV rows |

Verified results:

| Coupon Used | Order Count | Average Order Amount | Revenue |
|---|---:|---:|---:|
| True (Used) | 1,282 | 1,833.28 | 2,350,266.77 |
| False (Not Used) | 3,982 | 641.22 | 2,553,329.88 |

- Difference in AOV: `1,192.06`
- Coupon user vs. non-user AOV ratio: `2.86x`
- Blank coupon codes: 0
- Baseline vs. Tuned & Raw vs. MV `mismatch_rows`: 0 across all checks

### Cautions & Considerations

- `AVG(oi.line_total)` computes average line item amount, not average order amount. Always sum by order first, or divide total revenue by unique order count.
- `coupon_code IS NOT NULL` treats empty strings as coupon usage. In production systems with dirty data, consider `NULLIF(BTRIM(coupon_code), '') IS NOT NULL`.
- This reflects correlation, not causation; coupon usage may be tied to minimum cart thresholds or promotional campaigns.

---

## Q10. Past 60-Day Revenue for Top 1% Customers by Lifetime Spend

Related files: [`queries/q10`](../queries/q10/)

### Objective

Calculate lifetime revenue across all 3,000 customers (including non-purchasing customers), select the exact top 1% (30 customers), and aggregate their revenue over the past 60 days individually and in total.

### Changes Made

- Used a customer `LEFT JOIN` to assign 0 lifetime revenue to non-purchasing accounts, preserving the exact 3,000-customer population.
- Pre-aggregated order items to 1 row per order, reusing the CTE for both lifetime and 60-day calculations.
- Applied `ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id)` to ensure deterministic tie-breaking and exactly 30 top customers.
- `mv_customer_lifetime_revenue` stores 3,000 lifetime customer records, querying recent 60-day revenue dynamically from raw tables.

### SQL Used

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         o.customer_id,
         o.order_ts,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
),
customer_lifetime AS MATERIALIZED (
  SELECT c.customer_id,
         COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue
  FROM ecom.customers AS c
  LEFT JOIN order_totals AS ot USING (customer_id)
  GROUP BY c.customer_id
),
ranked AS MATERIALIZED (
  SELECT customer_id,
         lifetime_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS revenue_rank,
         COUNT(*) OVER () AS customer_count
  FROM customer_lifetime
),
top_customers AS MATERIALIZED (
  SELECT customer_id, lifetime_revenue, revenue_rank
  FROM ranked
  WHERE revenue_rank <= CEIL(customer_count * 0.01)
)
-- Aggregate order_ts >= now() - interval '60 days' revenue strictly for the 30 top_customers
```

### Execution Plan Highlights

- Baseline joined raw order items twice (lifetime and 60-day stages), consuming 480 buffers.
- Tuned plan aggregated 14,356 items to 5,264 orders once, sorted 3,000 customers, and filtered down to 30 rows (`Rows Removed by Filter: 2,970`).
- Forced Nested Loop caused extreme degradation (15,976 buffers, ~690 ms runtime), demonstrating the dangers of repeated index scans in analytical queries.
- MV plan sorted 3,000 pre-computed customer rows to identify Top 30, joining recent 60-day raw data via Index Only Scan on `idx_orders_q6_valid_customer_ts`.

### Measurement Results

| Item | Execution Time | Buffers / Notes |
|---|---:|---|
| Baseline (Two Raw Joins) | 14.457 ms | shared hit 480 |
| Pre-aggregation Reused | 13.546 ms | shared hit 294 |
| Forced Hash Join | 12.885 ms | shared hit 297 |
| Forced Nested Loop | 690.278 ms | shared hit 15,976 |
| Forced Merge Join | 8.437 ms | shared hit 319 |
| Forced Bitmap Heap Scan | 19.600 ms | shared hit 16,020 |
| Lifetime MV + Recent 60-Day Raw | 3.159 ms | shared hit 231 |

Validation results:
- Total customers: 3,000
- Target Top 1%: 30
- Extracted Top 1%: 30
- Top 30 lifetime revenue sum: `767,749.08`
- Top 30 recent 60-day revenue sum: `743,184.33`
- Top 3 lifetime spenders: customer 17 (`31,488.49`), 8 (`31,216.28`), 27 (`30,448.70`)
- Baseline vs. Tuned & Raw vs. MV `mismatch_rows`: 0 across all checks

### Cautions & Considerations

- `RANK() <= 30` can exceed 30 rows in case of ties. Since exactly 30 customers from the 3,000 total are required, `ROW_NUMBER()` with deterministic tie-breaking was used.
- Top 1% status is determined by lifetime spend, with the 60-day filter applied afterwards. Reversing the order transforms the scenario into a different analytical question.
- Maintained consistent lower-bound filtering, including the 6 future-dated orders. Apply `o.order_ts <= now()` if strict upper bounds are required.
- If the lifetime MV is not refreshed, customer rankings will stale even if recent 60-day orders are queried in real time.

---

## Key Conclusions from Join & Scan Comparisons

### Hash Join

- Builds an in-memory hash table of filtered orders and scans `order_items` once sequentially.
- Highly stable for analytical queries processing large row sets.
- Predominantly selected as PostgreSQL's default planner choice across Q1–Q10.

### Nested Loop Join

- Traverses inner indexes repeatedly for each outer row.
- While fast under small datasets and warm cache, buffer consumption routinely exceeded 10,000–15,000 blocks.
- Scaling data causes exponential random I/O growth; never adopt Nested Loop based purely on single-run timing without inspecting buffers.

### Merge Join

- Merges efficiently when inputs are pre-sorted by join keys; otherwise incurs sorting overhead.
- Highly effective in Q4 where both `order_id` indexes provided pre-sorted streams without extra sort cost.
- Evaluate planner choices and repeat measurements in production before forcing Merge Join.

### Bitmap Heap Scan

- A table access method rather than a join algorithm.
- Collects row pointers (TIDs) via Bitmap Index Scan and reads heap pages in sequential block order.
- Highly effective for selective date-range queries (e.g. Q1, Q3).
- For queries processing a large fraction of total orders (e.g. Q2, Q4, Q5, Q6, Q9, Q10), Seq Scan is naturally superior; Bitmap scans were tested purely for comparison.
- In Q7, the 600-row table made Seq Scan cheaper than partial index scans; in Q8, `HAVING` required all reviews, making Bitmap scans unsuitable.

---

## Current Final Database Objects

Key indexes maintained:

```text
ecom.idx_orders_revenue_ts_order_id
ecom.idx_orders_q4_valid_order_id
ecom.idx_orders_q6_valid_customer_ts
ecom.idx_inventory_q7_low_stock_product
ecom.ux_mv_daily_gmv_day
ecom.ux_mv_monthly_sales_month
ecom.ux_mv_daily_category_gmv_day_category
ecom.ux_mv_product_revenue_product
ecom.ux_mv_customer_rfm_customer
ecom.ux_mv_customer_first_purchase_customer
ecom.ux_mv_low_stock_products_product
ecom.ux_mv_product_review_stats_product
ecom.ux_mv_coupon_order_metrics_used
ecom.ux_mv_customer_lifetime_revenue_customer
```

Populated Materialized Views:

| MV | Row Count | Purpose |
|---|---:|---|
| `mv_daily_gmv` | 127 | Q1 Daily GMV |
| `mv_monthly_sales` | 5 | Q2 Monthly orders, revenue, AOV |
| `mv_daily_category_gmv` | 1,178 | Q3 Daily category GMV |
| `mv_product_revenue` | 599 | Q4 Product cumulative revenue |
| `mv_customer_rfm` | 2,222 | Q5 Customer last order / frequency / monetary |
| `mv_customer_first_purchase` | 2,222 | Q6 Customer first / repeat purchase timestamps |
| `mv_low_stock_products` | 61 | Q7 Low-stock products |
| `mv_product_review_stats` | 151 | Q8 Product review count / average rating |
| `mv_coupon_order_metrics` | 2 | Q9 Coupon usage order count / revenue |
| `mv_customer_lifetime_revenue` | 3,000 | Q10 Customer lifetime revenue |

Temporary experimental indexes have been removed, and all planner settings (`enable_hashjoin`, `enable_nestloop`, `enable_mergejoin`, `enable_seqscan`, `enable_bitmapscan`) are restored to default `on`.

---

## Reproduction & Query Authoring Checklist

Each query scenario directory follows standard script naming:

```text
00_execution_order.sql
01_baseline_result.sql
02_baseline_plan.sql
03_tuned_result.sql
04_tuned_plan.sql
05_hash_join.sql
06_nested_loop.sql
07_merge_join.sql
08_bitmap_heap_scan.sql
08b_cleanup.sql
09_mv_create_refresh.sql
10_mv_result_compare.sql
11_mv_plan.sql
12_optional_validation.sql
13_query_result_check.sql
```

Scenario validation checklist:

- Verify bidirectional `EXCEPT ALL` between baseline and tuned results returns 0 rows.
- Use `COUNT(DISTINCT order_id)` or order-level pre-aggregation if joins introduce duplicate order rows.
- Apply window functions strictly after required aggregations.
- Ensure partial index predicates match query `WHERE` clauses exactly.
- In full-table analytical queries with low selectivity, the planner selecting Seq Scan over an index is normal cost-based behavior, not a failure.
- Wrap forced join scripts in `BEGIN + SET LOCAL + EXPLAIN + ROLLBACK` to avoid leaking session settings.
- Run cleanup scripts (e.g. 08b) in the same session whenever temporary DDL changes are made.
- Store raw base metrics in MVs rather than time-decaying derived values (e.g. store timestamps instead of relative day counts).
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a UNIQUE index that uniquely identifies each MV row.
- Compare business metrics (amounts, ranks, date boundaries) during MV validation in addition to row counts.
- Report performance metrics using medians or averages across repeated runs, documenting estimated costs and buffer counts alongside execution time.
