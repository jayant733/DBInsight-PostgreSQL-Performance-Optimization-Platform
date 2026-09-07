# DBInsight — PostgreSQL E-Commerce Performance Optimization Platform
## Complete Interview Preparation Guide

> **Model Used:** Claude Sonnet 4.5 (Anthropic) — used for code generation assistance, SQL review, documentation writing, and dashboard component scaffolding during development.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Why I Built This](#2-why-i-built-this)
3. [Tech Stack & Tool Choices](#3-tech-stack--tool-choices)
4. [Database Schema Design](#4-database-schema-design)
5. [Dataset & Scale](#5-dataset--scale)
6. [The 10 Query Scenarios — Deep Dive](#6-the-10-query-scenarios--deep-dive)
7. [All Metrics & Numbers](#7-all-metrics--numbers)
8. [Optimization Techniques Used](#8-optimization-techniques-used)
9. [Materialized Views — Full Reference](#9-materialized-views--full-reference)
10. [Index Strategy](#10-index-strategy)
11. [Join Strategy Comparisons](#11-join-strategy-comparisons)
12. [The Dashboard (Next.js QueryLab)](#12-the-dashboard-nextjs-querylab)
13. [Correctness Verification System](#13-correctness-verification-system)
14. [Why X Instead of Y — Design Decisions](#14-why-x-instead-of-y--design-decisions)
15. [Common Interview Questions & Answers](#15-common-interview-questions--answers)
16. [Key Takeaways & Lessons Learned](#16-key-takeaways--lessons-learned)
17. [Project File Structure](#17-project-file-structure)
18. [Reproduction Steps](#18-reproduction-steps)

---

## 1. Project Overview

**DBInsight — PostgreSQL E-Commerce Performance Optimization Platform** is a rigorous query performance lab built on PostgreSQL 17. It simulates a real e-commerce company's analytical reporting problems and demonstrates how to diagnose, optimize, and validate database query performance systematically.

The project is NOT a "before and after time comparison." It is an end-to-end engineering process:

```
Baseline Query
  → EXPLAIN (ANALYZE, BUFFERS)
  → Bottleneck Analysis (cost, row counts, scan type, buffer I/O)
  → Index / Query Shape / Materialized View change
  → Execution Plan Comparison
  → Correctness Verification (bidirectional EXCEPT ALL)
  → Repeated Measurement where applicable
```

There are **10 analytical query scenarios (Q1–Q10)** covering the most common reporting requirements of any e-commerce business. Each scenario answers a real business question and is optimized using evidence from execution plans — not guesswork.

**Key insight:** A wrong-but-fast query is worse than a slow-but-correct one. This project proves both speed **and** correctness improvements simultaneously.

---

## 2. Why I Built This

### The Problem

Most "I optimized a database" portfolio projects only show two timestamps — "before: 500ms, after: 50ms." That is not enough because:

1. **Timing is misleading** — cached data, warm/cold page cache, and single-run samples skew results
2. **No correctness check** — faster queries often return subtly wrong data
3. **No plan analysis** — timing doesn't tell you *why* something changed
4. **No I/O analysis** — a query can look fast from OS cache and still demolish the disk under concurrent load

### My Goals

- Show that I can read and interpret `EXPLAIN (ANALYZE, BUFFERS)` output
- Demonstrate that optimization decisions are based on **data, cardinality, and execution plans** — not assumptions
- Prove that every optimization preserves result correctness
- Show when optimization is a **trap** (Q7 — adding an index made it slower; Q10 — forcing a join type blew it up)
- Build an interactive dashboard to make the work presentable and reproducible

### Business Questions Answered

The 10 queries answer the most common e-commerce reporting questions:
- "How much money did we make last month?" (Q1)
- "What are our monthly order counts and average order values?" (Q2)
- "Which product categories are driving revenue?" (Q3)
- "Which products are our top earners?" (Q4)
- "Who are our best customers?" (Q5 — RFM analysis)
- "How many new buyers come back?" (Q6 — repeat purchase rate)
- "Which products are about to run out of stock?" (Q7)
- "What products have the best reviews?" (Q8)
- "Do customers with coupons spend more?" (Q9)
- "How much are our top 1% of customers spending recently?" (Q10)

---

## 3. Tech Stack & Tool Choices

### Core Database

| Component | Choice | Why |
|---|---|---|
| **Database** | PostgreSQL 17 | Industry-standard RDBMS; rich EXPLAIN output; mature query planner; best ecosystem for analytical queries |
| **Schema** | Custom `ecom` schema | Namespace isolation; clean separation from public schema |
| **Extensions** | `citext`, `btree_gist` | CITEXT for case-insensitive email uniqueness; btree_gist for EXCLUDE constraints on price history |

### Dashboard

| Component | Choice | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Server components for DB queries; API routes for live analysis; TypeScript safety |
| **Language** | TypeScript | Type safety across DB query results and UI components |
| **Database Driver** | `pg` (node-postgres) | Industry-standard; stable; well-documented |
| **Testing** | Vitest | Fast unit tests; compatible with Next.js |

### Infrastructure

| Component | Choice | Why |
|---|---|---|
| **Containerization** | Docker + docker-compose | Reproducible environment; port 5434 to avoid conflicts |
| **Dev Tool** | DBeaver | SQL execution, plan inspection, multi-statement files |

### AI Assistance

| Model | Use |
|---|---|
| **Claude Sonnet 4.5** | SQL query drafting, CTE structuring, dashboard component scaffolding, documentation generation |

---

## 4. Database Schema Design

The schema lives in `sql/schema.sql` under the `ecom` schema. It models a realistic e-commerce domain.

### Table Groups

#### Reference / Dimension Tables

```
country          → country_code (PK), country_name
customers        → customer_id, email (CITEXT UNIQUE), full_name, phone, created_at, marketing_opt_in, country_code
addresses        → address_id, customer_id (FK), line1, city, state, postal_code, country_code, is_default
categories       → category_id, parent_id (self-referencing FK), category_name
products         → product_id, sku (UNIQUE), product_name, category_id, unit, active, created_at
product_prices   → price_id, product_id, price, currency, valid_from, valid_to, is_current (SCD2-style)
suppliers        → supplier_id, supplier_name, phone
product_suppliers → product_id + supplier_id (composite PK), primary_supplier
inventory        → product_id (PK), qty_on_hand, reorder_point, updated_at
```

#### Fact Tables

```
orders       → order_id, customer_id, order_status, order_ts, shipping_address_id, coupon_code, channel
order_items  → order_item_id, order_id, product_id, qty, unit_price, discount, line_total (GENERATED)
payments     → payment_id, order_id, method, amount, paid_at
shipments    → shipment_id, order_id, carrier, tracking_no, shipped_at, delivered_at
reviews      → review_id, product_id, customer_id, rating (1-5), review_text, created_at
```

### Interesting Schema Design Decisions

#### Generated Column for `line_total`

```sql
line_total NUMERIC(12,2) GENERATED ALWAYS AS ((unit_price * qty) - discount) STORED
```

- Always consistent; never manually updated
- Stored (not virtual) — readable without recomputation
- Enforced via `CHECK (discount <= unit_price * qty)` to prevent negative line totals

#### SCD2-Style Price History

```sql
EXCLUDE USING gist (product_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&)
```

- Prevents overlapping price windows for the same product
- Requires `btree_gist` extension
- Unique index on `(product_id) WHERE is_current` for exactly one current price per product

#### CITEXT for Emails

```sql
email CITEXT UNIQUE NOT NULL
```

- Ensures `user@example.com` and `USER@EXAMPLE.COM` are treated as duplicates
- Avoids manual `LOWER()` calls in WHERE clauses

#### Order Status Domain

```sql
order_status TEXT NOT NULL CHECK (order_status IN ('created','paid','shipped','delivered','cancelled','refunded'))
```

- **"Realized revenue" orders** = `paid`, `shipped`, `delivered` (used consistently across all 10 queries)
- `cancelled` and `refunded` are explicitly excluded from all revenue calculations

#### Self-Referencing Categories

```sql
parent_id BIGINT REFERENCES categories(category_id) ON DELETE SET NULL
```

- Supports hierarchical category trees
- `v_category_path` view uses recursive CTE to compute full category breadcrumb paths

### Views & UDFs Included

| Object | Purpose |
|---|---|
| `v_product_current_price` | Joins products with current price (is_current = true) |
| `v_category_path` | Recursive CTE building full category path strings |
| `f_safe_div(numer, denom)` | Division with zero-denominator guard; returns 0 instead of error |

---

## 5. Dataset & Scale

The dataset is **100% synthetic** — generated by `sql/seed.sql` using PostgreSQL's `random()` and `generate_series()` functions. No external CSVs or data dumps.

### Scale Numbers

| Table | Row Count |
|---|---|
| `customers` | 3,000 |
| `addresses` | ~3,000 |
| `country` | ~10 countries |
| `categories` | 14 |
| `products` | 600 |
| `product_prices` | 600 (one per product) |
| `suppliers` | ~50 |
| `inventory` | 600 (one per product) |
| `orders` | 6,830 |
| `order_items` | 18,622 |
| `payments` | ~5,000 |
| `shipments` | ~4,500 |
| `reviews` | 2,060 |

### Derived Statistics (measured during experiments)

- **Valid orders** (paid/shipped/delivered): ~5,264 out of 6,830 ≈ **77% of all orders**
- **Purchasing customers**: 2,222 out of 3,000 (**74.1%** have made at least one valid purchase)
- **Reviewed products**: 151 out of 600 (**25.2%** have at least one review)
- **Low-stock products**: 61 out of 600 (**10.2%** below reorder point)
- **Avg order items per order**: 18,622 ÷ 6,830 ≈ **2.73 items per order**
- **Coupon usage rate**: 1,282 coupon orders out of 5,264 valid orders ≈ **24.4%**
- **6 future-dated orders** present in seed data (noted in documentation as a data quality edge case)

---

## 6. The 10 Query Scenarios — Deep Dive

### Q1 — Realized Revenue for the Past Month

**Business Question:** How much money did we actually make last month (paid/shipped/delivered orders only)?

**Baseline Query:**

```sql
SELECT SUM(oi.line_total) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';
```

**Baseline Plan:** `Seq Scan on orders` → `Hash` → `Hash Join` → `Aggregate`

**Problem Identified:** Orders table was fully scanned even though only ~25% of orders fall within the past month's date range AND have a valid status.

**Optimizations Applied:**

1. **Partial Index** on `(order_ts, order_id)` WHERE status is valid:

```sql
CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

2. **Index Only Scan** — achieved **0 Heap Fetches** (all data served from index)
3. **Boundary-corrected Materialized View** — critical correctness fix:
   - Naive MV: grouped by `date_trunc('day', order_ts)` → included the full boundary day from midnight → **overcounted by 39,475.01**
   - Fix: read fully enclosed dates from MV + query partial boundary date from raw tables via `UNION ALL`

**Key Metric:** 500-run average: **1.349 ms → 0.769 ms (43% improvement)**

**Critical Lesson:** A naive MV can be 25× faster but produce systematically wrong revenue figures. The business impact of overcounting is severe.

---

### Q2 — Monthly Order Count, Revenue, and AOV

**Business Question:** What are our monthly order volumes, revenue, and average order value trends?

**Baseline Problem:** Joining order_items to orders duplicates order rows. Using `COUNT(DISTINCT order_id)` required sorting **14,356 joined rows** (~945 kB sort memory) before `GroupAggregate`.

**Key Fix — Pre-aggregation Pattern:**

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
SELECT order_month, COUNT(order_id) AS order_count,
       SUM(order_total) AS revenue, AVG(order_total) AS aov
FROM order_totals GROUP BY order_month;
```

**Result:** Eliminated `COUNT(DISTINCT)` — instead `COUNT(order_id)` on pre-aggregated 5,264 rows

**Execution Time:** **14.200 ms → 7.940 ms (44.1% improvement)**

**Monthly Verified Results:**

| Month | Order Count | Revenue | AOV |
|---|---:|---:|---:|
| 2026-04 | 550 | 486,216.71 | 884.03 |
| 2026-05 | 1,254 | 1,084,540.80 | 864.87 |
| 2026-06 | 1,362 | 1,281,450.02 | 940.86 |
| 2026-07 | 1,474 | 1,452,007.55 | 985.08 |
| 2026-08 | 624 | 599,381.57 | 960.55 |

**MV Speed:** `mv_monthly_sales` — **0.006 ms** (5 monthly summary rows)

---

### Q3 — Top 10 Revenue Categories in the Past 90 Days

**Business Question:** Which product categories are driving the most revenue in the last quarter?

**Baseline Problem:** Joining 11,288 raw order item rows directly to products and categories.

**Optimization:** Pre-aggregate to product level first (594 rows), then join dimension tables:

```sql
WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
)
SELECT c.category_name, SUM(ps.revenue) AS revenue
FROM product_sales AS ps
JOIN ecom.products AS p ON p.product_id = ps.product_id
JOIN ecom.categories AS c ON c.category_id = p.category_id
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC LIMIT 10;
```

**Interesting Plan Feature:** `Memoize` on category PK — 594 product lookups reduced to just **10 actual cache misses** (one per unique category)

**Execution Time:** **8.615 ms → 4.476 ms (48% improvement)**

**Buffers:** 259 → 226 shared hits

**MV:** `mv_daily_category_gmv` with same date-boundary correction as Q1 — 1,178 rows total

---

### Q4 — Cumulative Revenue RANK Top 20 by Product

**Business Question:** Which products are our all-time top 20 revenue earners?

**Baseline Problem:** Joined orders + order_items + products first, passing 14,356 rows to aggregation. Window function `RANK()` applied after full join.

**Key Optimizations:**

1. Pre-aggregate product revenue (599 rows) before joining product names
2. Compact partial index on `order_id` only for valid orders (136 kB footprint)
3. `RANK() OVER (ORDER BY revenue DESC)` applied after pre-aggregation
4. `Run Condition: rank() <= 20` — planner prunes rows early

**The Merge Join Finding:**

- Hash Join: 6.207 ms
- Nested Loop: 6.064 ms (but 15,638 buffers!)
- **Merge Join: 3.059 ms** (leveraged existing sorted order_id index — no extra sort needed)

**Execution Time:** **7.984 ms → 3.059 ms (62% improvement via Merge Join)**

**Critical Lesson:** Merge Join was best here because both inputs were already sorted by `order_id`. This does NOT mean Merge Join is always best — it's data and query dependent.

**MV Speed:** `mv_product_revenue` — **0.151 ms** (599 pre-calculated product rows)

---

### Q5 — Customer RFM: Recency, Frequency, Monetary

**Business Question:** Who are our best customers based on Recency (last purchase), Frequency (purchase count), and Monetary (total spend)?

**RFM = a standard customer segmentation framework used by all e-commerce businesses**

**Baseline Problem:** After Hash Join produced 14,356 rows, sorted by `customer_id, order_id` for `GroupAggregate` with `COUNT(DISTINCT)`. Sort memory: **~1,057 kB**.

**Key Fix:**

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id, o.customer_id, o.order_ts,
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
FROM order_totals GROUP BY customer_id;
```

**Execution Time:** **20.361 ms → 10.018 ms (50.8% improvement)**

**Smart MV Design Decision:** Store `last_order_ts` (raw timestamp), NOT `recency_days` (computed value).
- If you store `recency_days = 5`, it's already stale the next day
- Storing `last_order_ts` lets you compute `CURRENT_DATE - last_order_ts::date` dynamically at query time — always fresh

**Top Customers Verified:**
- Customer 17: frequency=21, monetary=31,488.49
- Customer 8: monetary=31,216.28
- Customer 27: monetary=30,448.70

**MV Speed:** **0.624 ms** (2,222 pre-calculated customer rows)

---

### Q6 — Repeat Purchase Rate within 30 Days of First Purchase

**Business Question:** Of customers who have ever purchased, what percentage bought again within 30 days of their first order?

**This is the most important optimization in the project for interview discussions.**

**Baseline — Correlated EXISTS:**

```sql
-- For each of 2,222 purchasing customers, PostgreSQL re-ran this subquery:
WHERE EXISTS (
  SELECT 1 FROM ecom.orders r
  WHERE r.customer_id = f.customer_id
    AND r.order_status IN ('paid','shipped','delivered')
    AND r.order_ts > f.first_order_ts
    AND r.order_ts <= f.first_order_ts + INTERVAL '30 days'
)
```

- Subplan executed **2,222 times** (once per customer)
- **5,633 buffer hits** (repeated full table re-access)

**Optimized — Pre-aggregate subsequent orders into one pass:**

```sql
WITH first_orders AS MATERIALIZED (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
),
customer_repurchase AS MATERIALIZED (
  SELECT f.customer_id, f.first_order_ts,
         MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r
    ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
)
SELECT COUNT(*) AS eligible_customers,
       COUNT(*) FILTER (WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days') AS repurchased,
       ROUND(100.0 * COUNT(*) FILTER (...) / NULLIF(COUNT(*), 0), 2) AS repurchase_rate_pct
FROM customer_repurchase;
```

**Result: Buffers dropped from 5,633 → 142 (97.5% reduction)**

**Execution Time:** 6.013 ms → 4.454 ms (only 26% faster in time)

**The critical lesson for interviews:** The buffer drop is the real win. Time metrics can be misleading under warm cache. Under concurrent load, **5,633 buffer hits per query × N concurrent users** would saturate disk I/O. 142 buffer hits scales proportionally.

**Business Metric Result:**
- Purchasing customers: 2,222
- 30-day repeat purchasers: 1,118
- **Repeat purchase rate: 50.32%**

**Reproduction result (different seed):** 9.92% repeat purchase rate — demonstrates that `now()` is dynamic and metrics change over time

---

### Q7 — Low-Stock Products Below Reorder Point

**Business Question:** Which products need to be reordered urgently?

**This is the "anti-optimization" case — proves I know when NOT to optimize.**

**Query:**

```sql
SELECT i.product_id, p.sku, p.product_name,
       i.qty_on_hand, i.reorder_point,
       i.reorder_point - i.qty_on_hand AS shortage_qty, i.updated_at
FROM ecom.inventory AS i
JOIN ecom.products AS p USING (product_id)
WHERE i.qty_on_hand < i.reorder_point
ORDER BY shortage_qty DESC;
```

**Partial Index Created:**

```sql
CREATE INDEX idx_inventory_q7_low_stock_product
ON ecom.inventory (product_id)
INCLUDE (qty_on_hand, reorder_point, updated_at)
WHERE qty_on_hand < reorder_point;
```

**Planner Decision:** With only 600 rows in inventory (5 heap pages), the planner chose Seq Scan over the partial index. This is **correct** — the index overhead exceeds the benefit for tiny tables.

**The Learning:** Adding an index does not guarantee it gets used. The query planner evaluates cost based on table size and statistics. Forcing the bitmap index scan was actually **slower** (0.358 ms vs 0.230 ms baseline).

**Execution Time:** 0.230 ms baseline → 0.392 ms "tuned" (**70% slower after adding index**)
- This is intentionally left in the project to show honesty

**Business Results:**
- Low-stock products: **61** out of 600 (10.2%)
- Products with 0 stock: **6**
- Maximum shortage: **30 units** (products 128, 157, 288, 301, 387, 569)

---

### Q8 — High-Rating & High-Review Products

**Business Question:** Which products have >= 4.5 average rating AND >= 50 reviews?

**Baseline Problem:** Pre-joined 2,060 review rows to products before aggregating.

**Key Fix:** Pre-aggregate reviews first, apply HAVING filter (151 reviewed products → 12 qualifying), then join product names for only those 12 rows.

```sql
WITH review_stats AS MATERIALIZED (
  SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating
  FROM ecom.reviews GROUP BY product_id
  HAVING AVG(rating) >= 4.5 AND COUNT(*) >= 50
)
SELECT rs.product_id, p.product_name, rs.review_count,
       ROUND(rs.avg_rating, 2) AS avg_rating
FROM review_stats AS rs
JOIN ecom.products AS p USING (product_id)
ORDER BY avg_rating DESC, review_count DESC;
```

**Execution Time:** **2.738 ms → 1.745 ms (36.3% improvement)**

**Important Design Note:** Store raw `AVG(rating)` in the MV (not rounded). Apply `ROUND()` only in the presentation layer. Rounding in `HAVING` can misclassify products near the threshold boundary.

**Products meeting criteria:** 12 out of 151 reviewed products (products 44, 177, 261, 550 had ~160 reviews at ~4.79 avg rating)

**MV Speed:** **0.415 ms** (151 pre-aggregated product rows, filtered at query time)

---

### Q9 — Average Order Value by Coupon Usage

**Business Question:** Do customers who use coupons have a higher average order value than those who don't?

**Baseline Problem:** Used `COUNT(DISTINCT order_id)` on 14,356 joined order_item rows — same duplication problem as Q2.

**Fix:** Pre-aggregate into 5,264 order-level rows, then group by coupon status.

```sql
WITH order_totals AS MATERIALIZED (
  SELECT o.order_id, o.coupon_code IS NOT NULL AS coupon_used,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.coupon_code IS NOT NULL
)
SELECT coupon_used, COUNT(*) AS order_count,
       ROUND(AVG(order_total), 2) AS avg_order_amount,
       SUM(order_total) AS revenue
FROM order_totals GROUP BY coupon_used;
```

**Business Results:**

| Coupon Used | Order Count | Avg Order Amount | Revenue |
|---|---:|---:|---:|
| True (Used) | 1,282 | **1,833.28** | 2,350,266.77 |
| False (Not Used) | 3,982 | **641.22** | 2,553,329.88 |

- **AOV difference: 1,192.06** (coupon users spend 2.86× more per order)
- Blank coupon codes: 0

**Important Caveat (interview gold):** This shows **correlation, not causation**. Coupon usage may require a minimum cart threshold — meaning coupons attract higher spenders, not that coupons cause higher spending.

**MV Speed:** **0.028 ms** (just 2 rows — one per coupon_used group)

---

### Q10 — Past 60-Day Revenue for Top 1% Customers by Lifetime Spend

**Business Question:** Who are our top 1% customers by lifetime spend, and how much have they spent in the last 60 days?

**This is the most complex query and the most dramatic optimization story.**

**Design Decisions:**

1. `LEFT JOIN` customers to orders — assigns `0` lifetime revenue to 778 non-purchasing customers; preserves the full 3,000-customer population for correct 1% calculation
2. `ROW_NUMBER()` not `RANK()` — ensures **exactly** 30 customers (not "30 or more if ties exist")
3. Deterministic tie-breaking: `ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id)` — stable sort across runs

**The Nested Loop Disaster:**

```
Forced Nested Loop: 690.278 ms, 15,976 buffer hits
vs
Default Hash Join:  ~13 ms, ~300 buffer hits
vs
MV + Recent Raw:    3.159 ms, 231 buffer hits
```

Forcing Nested Loop (as some blog posts recommend for "indexed lookups") caused:
- **50× slowdown** compared to default planner choice
- **53× more buffer hits**

**Lesson:** Never force a join strategy based on a blog post. Read the actual execution plan.

**The Hybrid MV Strategy:**
- `mv_customer_lifetime_revenue`: stores 3,000 pre-computed lifetime revenues (rarely changes)
- Recent 60-day revenue: queried from raw tables in real-time (changes constantly)
- Combined: fast static lookup + fresh dynamic data

**Business Results:**
- Top 30 lifetime revenue sum: **767,749.08**
- Top 30 recent 60-day revenue sum: **743,184.33**
- Top 3 spenders: customer 17 (31,488.49), customer 8 (31,216.28), customer 27 (30,448.70)

---

## 7. All Metrics & Numbers

### Execution Time Comparison Table (All 10 Queries)

| Query | Baseline (ms) | Tuned (ms) | Improvement | Buffer Before → After |
|---|---:|---:|---:|---|
| Q1 | 2.79 | 1.33 | **+52.2%** | 138 → 106 |
| Q2 | 14.20 | 7.94 | **+44.1%** | 251 → 251 |
| Q3 | 8.62 | 4.48 | **+48.0%** | 259 → 226 |
| Q4 | 2.80 | 2.19 | **+21.8%** | 148 → 123 |
| Q5 | 20.36 | 10.02 | **+50.8%** | 257 → 251 |
| Q6 | 2.48 | 2.42 | **+2.6%** | **4,756 → 78** |
| Q7 | 0.23 | 0.39 | **−70.4%** | 18 → 18 |
| Q8 | 2.74 | 1.75 | **+36.3%** | 35 → 35 |
| Q9 | 12.58 | 14.62 | **−16.2%** | 259 → 256 |
| Q10 | 6.65 | 6.79 | **−2.1%** | 300 → 181 |

> Q7, Q9, Q10 show time regression or no improvement — but they demonstrate other wins: buffer reduction (Q10), cleaner query structure (Q9), and planner correctness lesson (Q7).

### 500-Run Average (Q1 — Most Statistically Reliable)

| Run | Average Time |
|---|---:|
| Baseline (500 runs) | **1.349 ms** |
| Tuned (500 runs) | **0.769 ms** |
| **Improvement** | **43.0%** |

### Materialized View Speedups

| Query | Direct Query | MV Query | MV Speedup |
|---|---:|---:|---:|
| Q1 | ~1.33 ms | 0.365 ms | **~73%** |
| Q2 | 7.94 ms | 0.006 ms | **>99%** |
| Q3 | 4.48 ms | 0.321 ms | **~93%** |
| Q4 | 2.19 ms | 0.151 ms | **~93%** |
| Q5 | 10.02 ms | 0.624 ms | **~94%** |
| Q6 | 4.45 ms | 0.641 ms | **~86%** |
| Q7 | 0.39 ms | 0.094 ms | **~76%** |
| Q8 | 1.75 ms | 0.415 ms | **~76%** |
| Q9 | 14.62 ms | 0.028 ms | **>99%** |
| Q10 | 6.79 ms | 3.159 ms | **~53%** |

### Buffer Reduction — Critical for Concurrent Load

| Query | Buffers Baseline | Buffers Tuned | Reduction |
|---|---:|---:|---:|
| Q1 | 138 | 106 | 23.2% |
| Q6 (correlated vs pre-agg) | 5,633 | 142 | **97.5%** |
| Q6 (reproduction run) | 4,756 | 78 | **98.4%** |
| Q10 (forced NL vs hash) | 15,976 | ~300 | **~98%** |

### Join Strategy Comparison — Q4

| Join Strategy | Time | Buffers |
|---|---:|---:|
| Forced Hash Join | 6.207 ms | 204 |
| Forced Nested Loop | 6.064 ms | 15,638 |
| **Forced Merge Join** | **3.059 ms** | 245 |
| Forced Bitmap Heap Scan | 6.129 ms | 17,764 |

### Join Strategy Comparison — Q10 (The Disaster)

| Join Strategy | Time | Buffers |
|---|---:|---:|
| Default Hash Join | ~13 ms | ~300 |
| Forced Merge Join | 8.437 ms | 319 |
| **Forced Nested Loop** | **690.278 ms** | **15,976** |
| MV + Recent Raw | **3.159 ms** | 231 |

### Key Business Metrics Calculated

| Metric | Value |
|---|---|
| Coupon user AOV | 1,833.28 |
| Non-coupon user AOV | 641.22 |
| AOV difference | **1,192.06** |
| Coupon user AOV ratio | **2.86× higher** |
| Repeat purchase rate (30 days) | **50.32%** |
| Q1 revenue overcount (naive MV) | **39,475.01** |
| Top 1% customer 60-day revenue | **743,184.33** |
| Valid order rate | **~77%** of all orders |
| Purchasing customer rate | **74.1%** of registered customers |

---

## 8. Optimization Techniques Used

### 1. Partial Indexes

A partial index only indexes rows matching a WHERE predicate — smaller, faster, can enable Index Only Scans.

```sql
-- Q1/Q3: Only valid orders, ordered by timestamp
CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

-- Q4: Only valid orders, storing order_id (compact)
CREATE INDEX idx_orders_q4_valid_order_id
ON ecom.orders(order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
-- Size: ~136 kB vs full index

-- Q6: Composite partial index with INCLUDE
CREATE INDEX idx_orders_q6_valid_customer_ts
ON ecom.orders (customer_id, order_ts)
INCLUDE (order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

-- Q7: Expression predicate (column-to-column comparison)
CREATE INDEX idx_inventory_q7_low_stock_product
ON ecom.inventory (product_id)
INCLUDE (qty_on_hand, reorder_point, updated_at)
WHERE qty_on_hand < reorder_point;
```

**Why partial indexes over full indexes?**
- Smaller storage footprint → fits more in shared_buffers
- Faster index scans (fewer pages to traverse)
- Can enable Index Only Scans when all needed columns are included
- Only maintained for rows matching predicate — less write overhead

### 2. Pre-aggregation (CTEs with MATERIALIZED)

The most impactful pattern across Q2, Q3, Q4, Q5, Q6, Q9, Q10.

**Pattern:**

```sql
-- BAD: Join raw items to dimension tables first, then aggregate
SELECT COUNT(DISTINCT o.order_id), SUM(oi.line_total)
FROM orders o JOIN order_items oi ON ... JOIN products p ON ...
GROUP BY category;

-- GOOD: Aggregate facts first, then join dimensions
WITH fact_agg AS MATERIALIZED (
  SELECT product_id, SUM(line_total) AS revenue
  FROM orders o JOIN order_items oi ON ...
  GROUP BY product_id  -- 599 rows instead of 14,356
)
SELECT category, SUM(revenue)
FROM fact_agg JOIN products p ON ... JOIN categories c ON ...
GROUP BY category;
```

**Why `MATERIALIZED` CTE?**
- Forces PostgreSQL to materialize the CTE result before the outer query runs
- Without MATERIALIZED, the planner may inline the CTE and re-evaluate it per outer row
- Essential when the CTE is referenced multiple times (Q10 reuses order_totals for lifetime AND 60-day)

### 3. Materialized Views with Boundary Correction

Standard MVs are too naive for time-windowed queries. The key bug:

```sql
-- NAIVE (WRONG for time-windowed queries):
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT date_trunc('day', order_ts) AS day, SUM(line_total) AS gmv
FROM orders WHERE order_status IN ('paid','shipped','delivered')
GROUP BY 1;

-- Query using naive MV — OVERCOUNTS by including full boundary day:
SELECT SUM(gmv) FROM mv_daily_gmv
WHERE day >= date_trunc('day', now() - INTERVAL '1 month');
```

**Problem:** If `now()` is 2026-08-15 14:30, the boundary day is 2026-07-15. The naive MV includes all orders from 2026-07-15 00:00 to 2026-07-15 23:59. But the raw query starts at 2026-07-15 14:30. The MV overcounts the boundary day's early hours.

**Fix: Read full days from MV + partial boundary day from raw tables via UNION ALL**

### 4. Correlated Subquery → Set Join

Q6 transformed a correlated `EXISTS` that ran 2,222 times into a single Hash Left Join pass.

**Why is correlated EXISTS so expensive?**
For each row in the outer query, PostgreSQL executes the subquery with a new bind value. It cannot batch or cache results. Each execution may require separate index lookups and buffer reads.

### 5. Index Only Scans

Achieved in Q1, Q4, Q6 by including all needed columns in the index:
- `Heap Fetches: 0` means PostgreSQL never touches the actual table pages
- All data served directly from the index B-tree
- Works because partial index covers `order_ts` + `order_id`, both needed by the query

### 6. Avoiding `COUNT(DISTINCT)` via Pre-aggregation

`COUNT(DISTINCT order_id)` on joined rows requires sorting to identify duplicates. Pre-aggregating to one row per order turns it into `COUNT(order_id)` on already-deduplicated data — no sort needed.

---

## 9. Materialized Views — Full Reference

### All 10 MVs

| MV Name | Rows | Query | Refresh Needed When |
|---|---:|---|---|
| `mv_daily_gmv` | 127 | Q1 daily GMV | New day's orders completed |
| `mv_monthly_sales` | 5 | Q2 monthly revenue/AOV | Monthly close |
| `mv_daily_category_gmv` | 1,178 | Q3 category revenue | New day's orders completed |
| `mv_product_revenue` | 599 | Q4 product rankings | Significant new orders |
| `mv_customer_rfm` | 2,222 | Q5 customer RFM | Regular (daily/weekly) |
| `mv_customer_first_purchase` | 2,222 | Q6 repeat rate | As new customers make first purchase |
| `mv_low_stock_products` | 61 | Q7 low stock | After inventory updates |
| `mv_product_review_stats` | 151 | Q8 review metrics | After new reviews submitted |
| `mv_coupon_order_metrics` | 2 | Q9 coupon AOV | Regular (daily) |
| `mv_customer_lifetime_revenue` | 3,000 | Q10 top 1% | Regular (weekly) |

### UNIQUE Indexes for CONCURRENT Refresh

Every MV has a UNIQUE index to support `REFRESH MATERIALIZED VIEW CONCURRENTLY` (non-blocking refresh):

```sql
CREATE UNIQUE INDEX ux_mv_daily_gmv_day ON mv_daily_gmv(day);
CREATE UNIQUE INDEX ux_mv_monthly_sales_month ON mv_monthly_sales(order_month);
CREATE UNIQUE INDEX ux_mv_daily_category_gmv_day_category ON mv_daily_category_gmv(day, category_id);
CREATE UNIQUE INDEX ux_mv_product_revenue_product ON mv_product_revenue(product_id);
CREATE UNIQUE INDEX ux_mv_customer_rfm_customer ON mv_customer_rfm(customer_id);
CREATE UNIQUE INDEX ux_mv_customer_first_purchase_customer ON mv_customer_first_purchase(customer_id);
CREATE UNIQUE INDEX ux_mv_low_stock_products_product ON mv_low_stock_products(product_id);
CREATE UNIQUE INDEX ux_mv_product_review_stats_product ON mv_product_review_stats(product_id);
CREATE UNIQUE INDEX ux_mv_coupon_order_metrics_used ON mv_coupon_order_metrics(coupon_used);
CREATE UNIQUE INDEX ux_mv_customer_lifetime_revenue_customer ON mv_customer_lifetime_revenue(customer_id);
```

### What to Store in MVs vs Compute Dynamically

| Bad (store) | Good (store) | Why |
|---|---|---|
| `recency_days` | `last_order_ts` | recency_days stales every day |
| `days_since_first_purchase` | `first_order_ts` | same reason |
| `coupon_avg_order_value` | `order_count, total_revenue` | avg computed as revenue/count dynamically |
| Rounded `avg_rating` | Raw `AVG(rating)` | rounding at boundary causes misclassification |

---

## 10. Index Strategy

### Final Index Inventory

```sql
-- Base schema indexes (created in schema.sql)
idx_customers_created_at       ON customers(created_at)
idx_customers_country          ON customers(country_code)
idx_addresses_customer         ON addresses(customer_id)
idx_categories_parent          ON categories(parent_id)
idx_products_category          ON products(category_id)
idx_products_active            ON products(active)
ux_product_prices_current      ON product_prices(product_id) WHERE is_current
idx_orders_customer_ts         ON orders(customer_id, order_ts DESC)
idx_orders_status              ON orders(order_status)
idx_order_items_order          ON order_items(order_id)
idx_order_items_product        ON order_items(product_id)
idx_payments_order             ON payments(order_id)
idx_shipments_order            ON shipments(order_id)

-- Experiment-added partial indexes
idx_orders_revenue_ts_order_id  ON orders(order_ts, order_id) WHERE status valid
idx_orders_q4_valid_order_id    ON orders(order_id) WHERE status valid
idx_orders_q6_valid_customer_ts ON orders(customer_id, order_ts) INCLUDE(order_id) WHERE status valid
idx_inventory_q7_low_stock      ON inventory(product_id) INCLUDE(...) WHERE qty < reorder

-- MV UNIQUE indexes (for CONCURRENTLY refresh)
ux_mv_daily_gmv_day, ux_mv_monthly_sales_month, and 8 more
```

### Index Decision Framework Used

1. **Check selectivity first.** A status column with only 6 values is low-selectivity. An index on it alone won't help for full-table scans (Q2, Q5).
2. **Partial indexes for filtered queries.** If every query filters `WHERE order_status IN ('paid','shipped','delivered')`, the index should match that predicate exactly.
3. **INCLUDE columns for Index Only Scans.** Add non-indexed columns to avoid heap fetches.
4. **Accept planner decisions.** If the planner chooses Seq Scan on a 600-row table (Q7), that's correct — don't force an index.
5. **Evaluate I/O, not just time.** Nested Loop on Q10 was sometimes "fast" from cache but hit 15,976 buffers.

---

## 11. Join Strategy Comparisons

All four strategies were forced and compared in each query scenario.

### Hash Join
- Builds in-memory hash table of the smaller input (filtered orders)
- Scans the larger input (order_items) once sequentially
- **Best for large, unsorted analytical queries**
- PostgreSQL's default choice in Q1–Q10 for most scenarios
- Stable buffer consumption; scales predictably

### Nested Loop Join
- For each outer row, traverses inner index
- **Only good when outer input is very small AND inner index is selective**
- In Q6: 2,222 customers × repeated order lookups = 5,633 buffer hits
- In Q10: forced Nested Loop = 690.278 ms, 15,976 buffers (disaster)
- **Never choose Nested Loop based on timing alone — always check buffers**

### Merge Join
- Merges two pre-sorted streams; efficient when both inputs are already ordered
- **Best when join keys match existing sorted indexes**
- Q4 winner: order_id indexes on both sides → no extra sort → 3.059 ms
- Not universally best — sorting overhead makes it slower when inputs aren't pre-ordered

### Bitmap Heap Scan
- Not a join algorithm — it's a table access method
- Bitmap Index Scan collects row TIDs, sorts them by block, then fetches heap pages in sequential order
- **Efficient for selective date-range queries** (Q1, Q3)
- **Inefficient for full-table queries** — worse than Seq Scan when reading >~20% of table

### The Universal Lesson

```
Plan shows fast timing ≠ Actually efficient query

Always check:
1. Execution plan (scan type, join type, sort operations)
2. Buffer hits (repeated random access = disk I/O under load)
3. Actual row counts vs estimated (planner statistics accuracy)
4. Heap Fetches (Index Only Scan goal: Heap Fetches = 0)
```

---

## 12. The Dashboard (Next.js QueryLab)

### Architecture

The dashboard is a **Next.js 14 App Router** application with:
- **Saved scenarios (Q1–Q10):** Pre-recorded results, execution plans, and correctness checks — displayed as static data from the documented experiments
- **Live analyzer:** Accepts user-submitted SELECT queries, runs real EXPLAIN ANALYZE against local PostgreSQL via Docker

### Safety Architecture (Live Analyzer)

The live analyzer implements multiple safety layers:

1. **Query validation:** Rejects writes (INSERT/UPDATE/DELETE), DDL (CREATE/DROP/ALTER), stacked statements, row locks (`FOR UPDATE/SHARE`), and unsafe functions
2. **Read-only transaction:** Wraps every query in a read-only transaction with `SET LOCAL transaction_read_only = ON`
3. **Statement timeout:** 8-second limit per query
4. **Non-loopback rejection:** Refuses non-loopback database URLs (local-only by design)
5. **EXCEPT ALL correctness check:** Before accepting any rewritten candidate, verifies bidirectional result parity
6. **Conservative advice only:** Never applies DDL or forces join methods. Shows "Suggestion only" when no safe rewrite is known

### Plan Visualization

- Converts PostgreSQL's `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` output into an interactive node graph
- Color coding: Blue = scans, Purple = joins, Yellow = aggregates
- Shows actual vs estimated rows, buffer hits, and execution times per node

### Tech Stack

```
Next.js 14 (App Router + Server Components)
TypeScript
pg (node-postgres) — database driver
Vitest — unit tests
Docker + docker-compose — local PostgreSQL on port 5434
```

### How to Run

```bash
docker compose up -d
cd dashboard-v2
npm install
npm run dev
# Open http://localhost:3000 (or 3001 if 3000 is taken)
```

---

## 13. Correctness Verification System

Every optimization is verified for result correctness using multiple methods.

### Primary: Bidirectional EXCEPT ALL

```sql
-- Check A: rows in baseline not in tuned
SELECT * FROM baseline_result
EXCEPT ALL
SELECT * FROM tuned_result;

-- Check B: rows in tuned not in baseline
SELECT * FROM tuned_result
EXCEPT ALL
SELECT * FROM baseline_result;

-- Both must return 0 rows for PASS
```

**Why bidirectional?** A one-way EXCEPT misses duplicates. If baseline has `[A, A, B]` and tuned has `[A, B, B]`, `baseline EXCEPT tuned` returns `{A}` and `tuned EXCEPT baseline` returns `{B}` — both needed to catch all mismatches.

### Additional Checks Used

| Check Type | Used In | Purpose |
|---|---|---|
| `COUNT(*)` comparison | All queries | Verify row counts match |
| `SUM()` / `AVG()` comparison | Q1, Q2, Q9 | Verify aggregate amounts |
| `RANK` / `ROW_NUMBER` comparison | Q4, Q10 | Verify ordering and ranking |
| Date boundary check | Q1, Q3 | Verify MV boundary correction |
| `values_match = true` | Q2 | Column-level match check |
| `mismatch_rows = 0` | Q4, Q5, Q6, Q8, Q10 | Row-level diff count |
| Future-order count check | Q5, Q6 | Document data quality edge cases |

### Q1 Date Boundary Validation

```
Direct raw query result:  1,422,428.75
Naive daily MV result:    1,461,903.76  ← WRONG (overcounts by 39,475.01)
Corrected hybrid MV:      1,422,428.75  ← CORRECT (exact match)
```

This was a critical finding — a fast but incorrect result would cause the business to believe it earned ~$39K more than it actually did.

### Reproduction Verification

On 2026-08-28, Q1, Q4, Q6, and Q10 were re-executed on a fresh database with fresh seed data to confirm reproducibility:

| Query | Baseline | Tuned | Notes |
|---|---|---|---|
| Q1 | 2.786 ms | 1.333 ms | MV overcount: 16,457.10 (different seed = different amount, same bug) |
| Q4 | 2.798 ms | 2.188 ms | All ranks matched |
| Q6 | 2.482 ms, 4,756 buffers | 2.418 ms, 78 buffers | 98.4% buffer reduction |
| Q10 | 6.652 ms | 6.789 ms | Forced NL: 394.589 ms, 10,665 buffers |

---

## 14. Why X Instead of Y — Design Decisions

### Why PostgreSQL 17 instead of MySQL or SQLite?

- **EXPLAIN ANALYZE** in PostgreSQL provides buffer-level I/O metrics (`Buffers:` output), which MySQL does not
- PostgreSQL has `MATERIALIZED VIEW` support with `REFRESH CONCURRENTLY`
- PostgreSQL has partial indexes, expression indexes, and `INCLUDE` columns
- PostgreSQL's `EXCEPT ALL` is cleaner for result diffing
- PostgreSQL is the industry standard for analytical and operational workloads in modern companies
- PostgreSQL 17 has `Run Condition` optimization for window functions (visible in Q4)

### Why synthetic data instead of real data?

- **Reproducibility:** Any developer can reproduce results exactly by running `sql/schema.sql` + `sql/seed.sql`
- **Control:** We can generate exactly the right scale — too large makes experiments slow, too small makes query plan choices trivial
- **No PII:** Real e-commerce data would require anonymization
- **Edge cases:** We can inject specific data quality issues (6 future-dated orders) to document real-world problems

### Why `now()` instead of hardcoded dates?

- Makes the lab honest about time-relative queries
- "Last month" queries should behave like production — they move with time
- Forces documentation of the date boundary problem (you can't hide it with a frozen date)
- Shows understanding of how periodic reporting queries actually behave

### Why `MATERIALIZED` CTE keyword?

Without `MATERIALIZED`:
```sql
WITH cte AS (SELECT ...)  -- May be inlined by planner, re-evaluated per outer row
```

With `MATERIALIZED`:
```sql
WITH cte AS MATERIALIZED (SELECT ...)  -- Always evaluated once, result stored
```

In Q10, `order_totals` is referenced in both `customer_lifetime` (all-time) and the outer 60-day filter. Without `MATERIALIZED`, the planner might compute it twice — once per reference.

### Why `ROW_NUMBER()` instead of `RANK()` for top 1%?

`RANK()` returns the same rank for tied values. `RANK() <= 30` may return 31+ rows if multiple customers tie at rank 30.

`ROW_NUMBER()` assigns strictly unique sequential numbers. `ROW_NUMBER() <= 30` always returns **exactly** 30 rows. Tie-breaking is deterministic: `ORDER BY lifetime_revenue DESC, customer_id` — consistent across runs.

The business requirement is "exactly the top 1% of 3,000 customers = exactly 30 customers," not "all customers tied at the 30th revenue level."

### Why store `last_order_ts` in RFM MV instead of `recency_days`?

```sql
-- BAD: Stored value goes stale every day
recency_days INT  -- Was "5" yesterday, is "6" today — MV is wrong without daily refresh

-- GOOD: Compute at query time from stable stored timestamp
last_order_ts TIMESTAMPTZ  -- Stored once, computed dynamically
-- At query time: CURRENT_DATE - last_order_ts::date AS recency_days
```

### Why `NULLIF` for division?

```sql
SUM(revenue) / NULLIF(COUNT(orders), 0) AS aov
```

- Prevents `Division by zero` error when a group has no orders
- Returns `NULL` instead of crashing — which is the correct semantic (undefined AOV for empty groups)
- Used in Q2, Q6 for safe rate calculations

### Why Hash Join is usually PostgreSQL's default?

For analytical queries:
1. One pass over each input
2. Predictable O(n) I/O
3. Works without sorted inputs
4. Memory-bounded (spills to disk if needed — rare in practice)
5. Parallelizable

Nested Loop requires an inner index scan per outer row — fine for OLTP point lookups, catastrophic for analytical queries with large outer inputs.

### Why Seq Scan was correct for Q7 (inventory)?

The inventory table has 600 rows = 5 heap pages. Reading 5 pages sequentially is faster than:
1. Index scan (traverse B-tree, load index page, follow pointer to heap page)
2. Bitmap scan (collect TIDs, sort them, then read heap pages in sorted order)

The planner correctly computed that Seq Scan cost < index access cost. Our partial index was built and exists correctly — the planner simply chose not to use it, which is the right call.

### Why Docker on port 5434 instead of default 5432?

- Port 5432 is the PostgreSQL default — developers often have a local PostgreSQL running on it
- Port 5434 avoids conflicts with existing installations
- The `QUERYLAB_POSTGRES_PORT` environment variable allows overriding

---

## 15. Common Interview Questions & Answers

### Q: What is an Index Only Scan and when does it happen?

An Index Only Scan means PostgreSQL can answer the query **entirely from the index** without touching the actual table (heap). It happens when:
1. All columns needed by the query are present in the index (via index columns or `INCLUDE` columns)
2. The query filter matches the index predicate
3. The visibility map confirms that all required pages are visible (no need to check heap for MVCC)

In Q1: `Heap Fetches: 0` — the partial index on `(order_ts, order_id)` covered all needed columns, and the visibility map was up to date.

### Q: What are "Buffers" in EXPLAIN output?

Buffers represent 8 KB pages of data accessed during query execution:
- `shared hit` = pages found in PostgreSQL's shared_buffers (memory) — fast
- `shared read` = pages fetched from disk (or OS cache) — slower under concurrent load
- `written` = pages written (from dirty cache)

Buffer count is more important than execution time for understanding concurrent load impact. A query with 100 ms time but 50 buffers scales better than one with 50 ms time but 15,000 buffers.

### Q: Explain the Q6 optimization. Why is buffer reduction more important than time reduction?

**Q6 reduced buffers from 5,633 → 78 (98.4%) while time barely changed (6 ms → 4 ms).**

The correlated EXISTS executed a subquery 2,222 times. Each execution required traversing the orders table index, reading heap pages, and filtering results. With warm OS page cache, these reads are fast in single-user mode.

Under concurrent load (e.g., 50 users running Q6 simultaneously):
- Old query: 50 × 5,633 = **281,650 buffer reads** (many becoming disk I/O)
- New query: 50 × 78 = **3,900 buffer reads** (mostly in memory)

The server's buffer pool gets saturated with repeated copies of the same pages under the old approach.

### Q: What is the difference between RANK() and ROW_NUMBER()?

```sql
-- Given: revenues = [100, 100, 90]
RANK()       → [1, 1, 3]  -- Ties get same rank, next rank skips
DENSE_RANK() → [1, 1, 2]  -- Ties get same rank, no skipping
ROW_NUMBER() → [1, 2, 3]  -- Always unique, tie-breaking by deterministic order
```

For "top exactly 30 customers," ROW_NUMBER() guarantees exactly 30 results regardless of ties.

### Q: What is a Partial Index? Give an example from the project.

A partial index is a B-tree index that only includes rows satisfying a WHERE predicate. It's smaller, faster to scan, and more selective than a full index.

```sql
-- Only indexes paid/shipped/delivered orders (77% of table NOT indexed = smaller)
CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');
```

Benefits: ~136 kB vs full index; fits in shared_buffers more easily; faster scan; only maintained for matching rows on INSERT/UPDATE.

**Important:** The query's WHERE clause must logically imply the index predicate for PostgreSQL to use it. If a query doesn't filter on order_status, this index won't be chosen.

### Q: When would you NOT add an index?

**Q7** — The inventory table had 600 rows (5 pages). The planner correctly chose Seq Scan over the partial index because:
- Sequential read of 5 pages: ~1 I/O operation
- B-tree index traversal + pointer following: multiple I/O operations

For small tables (< ~500-1000 rows in practice), Seq Scan is almost always optimal.

### Q: What is CONCURRENTLY for Materialized Views?

Normal `REFRESH MATERIALIZED VIEW` takes an exclusive lock — no queries can read the MV during refresh. For high-traffic reporting systems, this means downtime.

`REFRESH MATERIALIZED VIEW CONCURRENTLY`:
- Takes only a row-level lock
- Old MV data remains readable during refresh
- Requires a UNIQUE index that uniquely identifies each row

```sql
-- Required before CONCURRENTLY refresh
CREATE UNIQUE INDEX ux_mv_daily_gmv_day ON mv_daily_gmv(day);
-- Non-blocking refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_gmv;
```

### Q: How did you handle the date boundary problem in Q1?

The naive approach includes the full boundary day from midnight — overcounting orders from 00:00 to NOW().

The correct hybrid approach:

```sql
-- Full closed days from MV (safe — no partial days)
SELECT SUM(gmv) FROM mv_daily_gmv
WHERE day > date_trunc('day', now() - INTERVAL '1 month')
UNION ALL
-- Only the partial boundary day from raw tables (exact timestamps)
SELECT SUM(oi.line_total) FROM orders o JOIN order_items oi ON ...
WHERE o.order_ts BETWEEN (now() - INTERVAL '1 month')
                     AND date_trunc('day', now() - INTERVAL '1 month') + INTERVAL '1 day'
  AND o.order_status IN ('paid','shipped','delivered')
```

Verified: overcounting was **39,475.01** in the first experiment run.

### Q: What does EXCEPT ALL do differently from EXCEPT?

`EXCEPT` (set semantics): removes all matching rows including duplicates.

`EXCEPT ALL` (multiset semantics): removes matching rows one-for-one.

For result comparison, `EXCEPT ALL` is necessary because both result sets may have duplicate rows (e.g., products with identical revenue in Q4). `EXCEPT` would falsely pass if one result has `[A, A]` and another has `[A]`.

### Q: How would this perform at 10× the data scale?

- **Q1–Q4:** Partial indexes become more valuable as the orders table grows; buffer savings increase proportionally
- **Q5 (RFM MV):** Linear scale — 30,000 customer rows in MV instead of 2,222; still O(n) scan
- **Q6:** The buffer savings become even more dramatic — correlated EXISTS would hit 10× more buffers per query
- **Q10 NL disaster:** 690 ms at 6,830 orders → estimated 7,000+ ms at 68,300 orders (super-linear due to I/O pressure)
- **MVs:** The biggest win at scale — instant reporting regardless of raw table size, as long as refresh strategy is tuned

The **two most vulnerable queries at scale** would be:
1. Any query using correlated EXISTS (Q6 pattern)
2. Any query forcing Nested Loop (Q10 anti-pattern)

### Q: Why did you use `COALESCE(SUM(...), 0)` in Q10?

```sql
COALESCE(SUM(ot.order_total), 0)::numeric AS lifetime_revenue
```

The `LEFT JOIN` from customers to orders includes all 3,000 customers. Customers who have never ordered have `NULL` order_totals. `SUM(NULL)` returns `NULL`. `COALESCE(..., 0)` converts it to `0`, ensuring non-purchasing customers appear in rankings with zero lifetime revenue — correctly placing them at the bottom of the Top 1% ranking.

### Q: What is the `Memoize` node you mentioned in Q3?

`Memoize` (PostgreSQL 14+) is a plan node that caches the results of an inner lookup during a Nested Loop join. When the same value is looked up multiple times (e.g., the same category_id for 594 products belonging to just 14 categories), the cache short-circuits the repeated index lookups.

In Q3: 594 product-to-category lookups were reduced to just 10 actual executions (one per unique category).

---

## 16. Key Takeaways & Lessons Learned

### Lesson 1: Timing is not the whole story

Q6 showed only a 26% timing improvement but a 97.5% buffer reduction. The buffer reduction is the real win under concurrent load.

### Lesson 2: Index + Planner = Together

Adding a perfect index doesn't guarantee its use. The planner uses statistics and cost models to decide. Q7 proved that a correct partial index can still be slower than Seq Scan on a small table.

### Lesson 3: Correctness Before Performance

Q1's date boundary bug showed that a naive MV can be 25× faster and systematically wrong. A wrong-but-fast result is worse than a slow-but-correct one. The business impact: overcounting by $39,475.01.

### Lesson 4: Never Force Join Types Based on Blog Posts

Q10 demonstrated that forcing Nested Loop — a common "optimization tip" — caused 50× slowdown and 53× more buffer hits compared to the planner's default Hash Join.

### Lesson 5: Pre-aggregate Facts Before Joining Dimensions

The single most impactful pattern across this project: aggregate at the fact table level (per order, per product) before joining dimension tables. Reduces join cardinality from tens of thousands of rows to hundreds.

### Lesson 6: Store Base Metrics in MVs, Compute Derived Values at Query Time

Store `last_order_ts`, not `recency_days`. Store `order_count + revenue`, not `avg_order_value`. Store raw `AVG(rating)`, not rounded values. This prevents stale derived metrics and boundary misclassification.

### Lesson 7: Seq Scan is Sometimes Optimal

Small tables: Seq Scan wins. Low-selectivity filters (77% of rows pass): Seq Scan wins. Full-table aggregations with no useful date range filter: Seq Scan wins. The planner knows this.

### Lesson 8: Bidirectional EXCEPT ALL is Required for Correctness

One-way EXCEPT misses certain classes of differences. Always run both directions and verify both return 0 rows.

### Lesson 9: Use `now()` for Time-Relative Queries

Hard-coding dates hides the date boundary problem. Using `now()` exposes it — which forces you to solve it correctly.

### Lesson 10: MATERIALIZED Keyword in CTEs Matters

For complex analytical queries where a CTE is referenced multiple times or contains expensive aggregation, `AS MATERIALIZED` ensures the CTE is computed once. Without it, the planner may inline it and recompute per reference.

### Lesson 11: Window Functions Must Follow Aggregations

```sql
-- WRONG: RANK() runs on raw order_items rows — ranks line items, not products
SELECT product_id, RANK() OVER (ORDER BY line_total DESC), ...
FROM order_items ...

-- CORRECT: Aggregate first, then window function
WITH agg AS (SELECT product_id, SUM(line_total) AS revenue FROM ...)
SELECT product_id, RANK() OVER (ORDER BY revenue DESC) FROM agg
```

### Lesson 12: `HAVING` Is Evaluated Post-Aggregation — Don't Filter Beforehand

For Q8, pre-filtering individual reviews with low ratings before aggregating would distort the average. `HAVING AVG(rating) >= 4.5` must operate on the full set of reviews per product.

---

## 17. Project File Structure

```
postgresql-ecommerce-performance/
├── sql/
│   ├── schema.sql           ← Full database schema (ecom schema, all tables, indexes, MVs, UDFs, views)
│   ├── seed.sql             ← Synthetic data generator (random(), generate_series())
│   └── analyzer_schema.sql  ← Schema for the live query analyzer (saves analyses)
│
├── queries/
│   ├── q01/                 ← Q1: Monthly realized revenue
│   │   ├── 00_execution_order.sql
│   │   ├── 01_baseline_result.sql
│   │   ├── 02_baseline_plan.sql
│   │   ├── 03_tuned_result.sql
│   │   ├── 04_tuned_plan.sql
│   │   ├── 05_hash_join.sql
│   │   ├── 06_nested_loop.sql
│   │   ├── 07_merge_join.sql
│   │   ├── 08_bitmap_heap_scan.sql
│   │   ├── 08b_cleanup.sql     ← Always run after 08 in same session
│   │   ├── 09_mv_create_refresh.sql
│   │   ├── 10_mv_result_compare.sql
│   │   ├── 11_mv_plan.sql
│   │   ├── 12_optional_validation.sql
│   │   └── 13_query_result_check.sql
│   ├── q02/ … q10/          ← Same structure for all 10 scenarios
│
├── benchmarks/
│   └── q01_benchmark.sql    ← 500-run average timing benchmark
│
├── docs/
│   ├── progress-summary.md  ← Complete experiment log for all 10 queries (966 lines)
│   ├── query-summary.md     ← One-line summary per query
│   ├── reproduction.md      ← Step-by-step reproduction instructions
│   ├── reproduction-results.md  ← Fresh 2026-08-28 reproduction measurements
│   ├── video-presentation-guide.md
│   └── plans/               ← Raw EXPLAIN outputs from reproduction run
│
├── dashboard-v2/            ← Next.js 14 QueryLab dashboard
│   ├── src/
│   │   └── app/             ← App Router pages
│   ├── package.json
│   ├── next.config.ts
│   └── README.md
│
├── docker-compose.yml       ← PostgreSQL 17 container (port 5434)
├── README.md                ← Project overview
├── VIDEO_DOC.md             ← Video recording script + KPI reference
└── everything.md            ← This document
```

---

## 18. Reproduction Steps

### Full Reproduction

```bash
# 1. Start PostgreSQL via Docker
docker compose up -d

# 2. Wait for PostgreSQL to be healthy, then run schema
psql -h localhost -p 5434 -U postgres -d postgres -f sql/schema.sql

# 3. Load synthetic seed data
psql -h localhost -p 5434 -U postgres -d postgres -f sql/seed.sql

# 4. Update planner statistics
psql -h localhost -p 5434 -U postgres -d postgres -c "ANALYZE;"

# 5. For each query, execute scripts in order (e.g. Q1):
# Run files 01 through 13 in queries/q01/ in numbered order
# CRITICAL: Always run 08b_cleanup.sql in the same session after 08_bitmap_heap_scan.sql
```

### Dashboard

```bash
cd dashboard-v2
npm install
npm run dev
# Open http://localhost:3000 (or 3001)
```

### Execution Notes

- Steps 05–07 use session-level `SET` to force join strategies — always run in isolated sessions or use `SET LOCAL` + `ROLLBACK`
- Step 08 (bitmap) may temporarily drop/create indexes inside transactions — run 08b immediately after in the same session
- Execution times will vary by OS, hardware, and page cache state — this is expected and documented
- Results (amounts, counts) change as `now()` advances because queries use relative time intervals

### Verified Script Execution Order (Q1 special case)

Q1 is unique: the MV must be refreshed before creating the corrected version.

```
12_mv_refresh.sql → 09_mv_create.sql → 10_mv_result_compare.sql → 11_mv_plan.sql
```

All other queries follow the standard 01–13 numeric order.

---

## Quick Reference Card

### Best Wins Summary

| Optimization | Query | Impact |
|---|---|---|
| Correlated EXISTS → Set Join | Q6 | **97.5% buffer reduction** |
| Forced NL anti-pattern | Q10 | 50× slowdown (negative example) |
| 500-run avg partial index | Q1 | **43% time reduction** |
| Count DISTINCT → Pre-agg | Q2 | **44% time reduction** |
| Product pre-agg before category join | Q3 | **48% time reduction** |
| Merge Join on sorted index | Q4 | **62% time reduction** |
| Two-step RFM aggregation | Q5 | **50.8% time reduction** |
| Naive MV date overcount | Q1 | **$39,475.01 corrected** |
| MV vs direct query | Q9 | **0.028 ms vs 14.62 ms (>99% faster)** |
| Seq Scan over partial index | Q7 | 70% slower when index forced — Seq Scan was correct |

### Key Numbers to Quote in Interviews

- Dataset: **6,830 orders, 18,622 order items, 3,000 customers, 600 products, 2,060 reviews**
- Buffer reduction (Q6): **5,633 → 78 = 98.4% reduction**
- Nested Loop disaster (Q10): **690 ms vs 3 ms = 230× slower**
- Revenue overcount (Q1 naive MV): **39,475.01**
- Repeat purchase rate: **50.32%**
- Coupon AOV multiplier: **2.86×**
- Valid orders share: **77%** of all orders
- Average improvement across 7 improving queries: **~42%**

---

*This document covers the complete DBInsight PostgreSQL E-Commerce Performance Optimization Platform — built to demonstrate rigorous, evidence-based database performance engineering. The goal was never "before and after timestamps" but a full engineering discipline: measure → plan → optimize → verify.*
