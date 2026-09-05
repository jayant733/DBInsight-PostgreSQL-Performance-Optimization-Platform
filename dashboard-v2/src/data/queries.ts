export interface QueryScenario {
  id: string;
  number: number;
  title: string;
  tag: string;
  goal: string;
  optimization: string;
  optimizationShort: string;
  baseline: {
    executionTime: number;
    buffers: number;
    strategy: string;
    rows: number;
    sql: string;
  };
  tuned: {
    executionTime: number;
    buffers: number;
    strategy: string;
    rows: number;
    sql: string;
  };
  mv: {
    executionTime: number;
    buffers: number;
    rows: number;
  };
  correctness: {
    baselineRows: number;
    optimizedRows: number;
    mismatchRows: number;
    boundaryTests: string;
    nullHandling: string;
    duplicateHandling: string;
    dateBoundaryTests: string;
  };
  keyInsight: string;
}

export const queries: QueryScenario[] = [
  {
    id: "q01",
    number: 1,
    title: "Realized Revenue",
    tag: "REVENUE",
    goal: "Calculate realized revenue for the past month. Filtering valid orders within the recent timeframe.",
    optimization: "Partial Index, Index Only Scan, Daily GMV MV, Date boundary adjustment",
    optimizationShort: "Seq Scan → Index Only Scan",
    baseline: {
      executionTime: 2.786,
      buffers: 138,
      strategy: "Seq Scan + Hash Join",
      rows: 1,
      sql: `SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';`,
    },
    tuned: {
      executionTime: 1.333,
      buffers: 106,
      strategy: "Index Only Scan + Hash Join",
      rows: 1,
      sql: `CREATE INDEX idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';`,
    },
    mv: {
      executionTime: 0.365,
      buffers: 44,
      rows: 1,
    },
    correctness: {
      baselineRows: 1,
      optimizedRows: 1,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "The naive daily MV overcounted by 16,457.10 due to date boundaries. A hybrid approach ensures 100% exact match.",
  },
  {
    id: "q02",
    number: 2,
    title: "Monthly Order Metrics",
    tag: "METRICS",
    goal: "Calculate monthly realized order counts, revenue, and average order value (AOV). Avoid order duplication from item joins.",
    optimization: "Order-level Pre-aggregation, Eliminating COUNT(DISTINCT)",
    optimizationShort: "Sort + GroupAggregate → Pre-aggregation",
    baseline: {
      executionTime: 14.200,
      buffers: 251,
      strategy: "Hash Join + GroupAggregate",
      rows: 5,
      sql: `SELECT date_trunc('month', o.order_ts) AS order_month,
       COUNT(DISTINCT o.order_id) AS order_count,
       ROUND(SUM(oi.line_total), 2) AS revenue,
       ROUND(
         SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0),
         2
       ) AS aov
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY date_trunc('month', o.order_ts)
ORDER BY order_month;`,
    },
    tuned: {
      executionTime: 7.940,
      buffers: 251,
      strategy: "Order-level Pre-aggregation",
      rows: 5,
      sql: `WITH order_totals AS MATERIALIZED (
  SELECT o.order_id,
         date_trunc('month', o.order_ts) AS order_month,
         SUM(oi.line_total) AS order_total
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, date_trunc('month', o.order_ts)
)
SELECT order_month,
       COUNT(order_id) AS order_count,
       ROUND(SUM(order_total), 2) AS revenue,
       ROUND(AVG(order_total), 2) AS aov
FROM order_totals
GROUP BY order_month
ORDER BY order_month;`,
    },
    mv: {
      executionTime: 0.006,
      buffers: 1,
      rows: 5,
    },
    correctness: {
      baselineRows: 5,
      optimizedRows: 5,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Joining raw order_items duplicates order rows, forcing an expensive Sort + GroupAggregate for COUNT(DISTINCT). Pre-aggregating order totals first cuts runtime by 44.1%.",
  },
  {
    id: "q03",
    number: 3,
    title: "Top 10 Categories",
    tag: "CATEGORIES",
    goal: "Identify top 10 categories by realized revenue over the past 90 days across orders, products, and categories.",
    optimization: "Partial Index, Product Pre-aggregation, Category Memoize",
    optimizationShort: "Seq Scan → Partial Index + Pre-agg",
    baseline: {
      executionTime: 8.615,
      buffers: 259,
      strategy: "Seq Scan + 3-way Hash Join",
      rows: 10,
      sql: `SELECT c.category_id,
       c.category_name,
       ROUND(SUM(oi.line_total), 2) AS revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi
  ON oi.order_id = o.order_id
JOIN ecom.products AS p
  ON p.product_id = oi.product_id
JOIN ecom.categories AS c
  ON c.category_id = p.category_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '90 days'
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC, c.category_id
LIMIT 10;`,
    },
    tuned: {
      executionTime: 4.476,
      buffers: 226,
      strategy: "Partial Index + Product Pre-aggregation",
      rows: 10,
      sql: `CREATE INDEX IF NOT EXISTS idx_orders_revenue_ts_order_id
ON ecom.orders (order_ts, order_id)
WHERE order_status IN ('paid', 'shipped', 'delivered');

WITH product_sales AS MATERIALIZED (
  SELECT oi.product_id,
         SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi
    ON oi.order_id = o.order_id
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
    AND o.order_ts >= now() - INTERVAL '90 days'
  GROUP BY oi.product_id
)
SELECT c.category_id,
       c.category_name,
       ROUND(SUM(ps.revenue), 2) AS revenue
FROM product_sales AS ps
JOIN ecom.products AS p
  ON p.product_id = ps.product_id
JOIN ecom.categories AS c
  ON c.category_id = p.category_id
GROUP BY c.category_id, c.category_name
ORDER BY revenue DESC, c.category_id
LIMIT 10;`,
    },
    mv: {
      executionTime: 0.321,
      buffers: 82,
      rows: 10,
    },
    correctness: {
      baselineRows: 10,
      optimizedRows: 10,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Pre-aggregating item lines into 594 product rows before joining dimensions reduced outer join volume by 95%, allowing Memoize on category PKs to replace repeated lookups.",
  },
  {
    id: "q04",
    number: 4,
    title: "Product Ranking",
    tag: "WINDOW FUNCS",
    goal: "Cumulative revenue RANK Top 20 by product. Per-product aggregation over high volume order items.",
    optimization: "Partial Index, Pre-aggregation, Merge Join, Product revenue MV",
    optimizationShort: "Hash Join → Merge Join",
    baseline: {
      executionTime: 2.798,
      buffers: 148,
      strategy: "Hash Join + WindowAgg",
      rows: 20,
      sql: `SELECT p.product_name, SUM(oi.line_total) AS revenue,
       RANK() OVER (ORDER BY SUM(oi.line_total) DESC) AS rank
FROM ecom.orders AS o
JOIN ecom.order_items AS oi USING (order_id)
JOIN ecom.products AS p USING (product_id)
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY p.product_id, p.product_name
ORDER BY rank LIMIT 20;`,
    },
    tuned: {
      executionTime: 2.188,
      buffers: 123,
      strategy: "Merge Join (Ordered)",
      rows: 20,
      sql: `WITH product_sales AS (
  SELECT oi.product_id, SUM(oi.line_total) AS revenue
  FROM ecom.orders AS o
  JOIN ecom.order_items AS oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY oi.product_id
), ranked AS (
  SELECT product_id, p.product_name, revenue,
         RANK() OVER (ORDER BY revenue DESC) AS rank
  FROM product_sales
  JOIN ecom.products p USING (product_id)
)
SELECT * FROM ranked WHERE rank <= 20;`,
    },
    mv: {
      executionTime: 0.273,
      buffers: 17,
      rows: 20,
    },
    correctness: {
      baselineRows: 20,
      optimizedRows: 20,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Merge Join leverages the ordered order_id index to eliminate sorting overhead for the join, reducing execution time.",
  },
  {
    id: "q05",
    number: 5,
    title: "Customer RFM",
    tag: "RFM",
    goal: "Calculate Customer Recency, Frequency, and Monetary metrics across all purchasing customers.",
    optimization: "Order-level Pre-aggregation, Persisting Last Order Timestamp",
    optimizationShort: "Sort DISTINCT → Two-stage HashAggregate",
    baseline: {
      executionTime: 20.361,
      buffers: 257,
      strategy: "Hash Join + Sort + GroupAggregate",
      rows: 2222,
      sql: `SELECT o.customer_id,
       MAX(o.order_ts) AS last_order_ts,
       CURRENT_DATE - MAX(o.order_ts)::date AS recency_days,
       COUNT(DISTINCT o.order_id) AS frequency,
       ROUND(SUM(oi.line_total), 2) AS monetary
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY o.customer_id
ORDER BY monetary DESC, o.customer_id;`,
    },
    tuned: {
      executionTime: 10.018,
      buffers: 251,
      strategy: "Two-stage HashAggregate",
      rows: 2222,
      sql: `WITH order_totals AS MATERIALIZED (
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
       ROUND(SUM(order_total), 2) AS monetary
FROM order_totals
GROUP BY customer_id
ORDER BY monetary DESC, customer_id;`,
    },
    mv: {
      executionTime: 0.624,
      buffers: 17,
      rows: 2222,
    },
    correctness: {
      baselineRows: 2222,
      optimizedRows: 2222,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Two-stage HashAggregate eliminates the 1MB sort needed for COUNT(DISTINCT). Persisting last_order_ts instead of recency_days in the MV prevents daily cache invalidation.",
  },
  {
    id: "q06",
    number: 6,
    title: "Repeat Purchase Rate",
    tag: "COHORTS",
    goal: "Identify customers who repurchased within 30 days of their first order.",
    optimization: "Correlated EXISTS elimination, Pre-aggregating subsequent orders",
    optimizationShort: "Correlated EXISTS → Pre-Aggregation",
    baseline: {
      executionTime: 2.482,
      buffers: 4756,
      strategy: "Correlated SubPlan (EXISTS)",
      rows: 1,
      sql: `WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
), customer_repurchase AS (
  SELECT f.customer_id,
         EXISTS (
           SELECT 1 FROM ecom.orders AS r
           WHERE r.customer_id = f.customer_id
             AND r.order_status IN ('paid', 'shipped', 'delivered')
             AND r.order_ts > f.first_order_ts
             AND r.order_ts <= f.first_order_ts + INTERVAL '30 days'
         ) AS repurchased_30d
  FROM first_orders AS f
)
SELECT COUNT(*) AS eligible, COUNT(*) FILTER (WHERE repurchased_30d) AS repurchased FROM customer_repurchase;`,
    },
    tuned: {
      executionTime: 2.418,
      buffers: 78,
      strategy: "Hash Left Join + Pre-aggregation",
      rows: 1,
      sql: `WITH first_orders AS (
  SELECT customer_id, MIN(order_ts) AS first_order_ts
  FROM ecom.orders WHERE order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY customer_id
), customer_repurchase AS (
  SELECT f.customer_id, f.first_order_ts, MIN(r.order_ts) AS first_repurchase_ts
  FROM first_orders AS f
  LEFT JOIN ecom.orders AS r ON r.customer_id = f.customer_id
   AND r.order_status IN ('paid', 'shipped', 'delivered')
   AND r.order_ts > f.first_order_ts
  GROUP BY f.customer_id, f.first_order_ts
)
SELECT COUNT(*) AS eligible, COUNT(*) FILTER (WHERE first_repurchase_ts <= first_order_ts + INTERVAL '30 days') AS repurchased
FROM customer_repurchase;`,
    },
    mv: {
      executionTime: 0.354,
      buffers: 16,
      rows: 1,
    },
    correctness: {
      baselineRows: 1,
      optimizedRows: 1,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Removing the correlated SubPlan decreased buffer accesses by 98.4% without sacrificing result parity.",
  },
  {
    id: "q07",
    number: 7,
    title: "Low-Stock Products",
    tag: "INVENTORY",
    goal: "Identify products where inventory is below the reorder point, sorted by shortage quantity.",
    optimization: "Expression Comparison Partial Index, Inventory Pre-filtering",
    optimizationShort: "Seq Scan vs Partial Index Comparison",
    baseline: {
      executionTime: 0.230,
      buffers: 18,
      strategy: "Inventory Seq Scan + Hash Join",
      rows: 61,
      sql: `SELECT i.product_id,
       p.sku,
       p.product_name,
       i.qty_on_hand,
       i.reorder_point,
       i.reorder_point - i.qty_on_hand AS shortage_qty,
       i.updated_at
FROM ecom.inventory AS i
JOIN ecom.products AS p USING (product_id)
WHERE i.qty_on_hand < i.reorder_point
ORDER BY shortage_qty DESC, i.qty_on_hand, i.product_id;`,
    },
    tuned: {
      executionTime: 0.392,
      buffers: 18,
      strategy: "Partial Index Expression Pre-filter",
      rows: 61,
      sql: `CREATE INDEX IF NOT EXISTS idx_inventory_q7_low_stock_product
ON ecom.inventory (product_id)
INCLUDE (qty_on_hand, reorder_point, updated_at)
WHERE qty_on_hand < reorder_point;

WITH low_stock AS MATERIALIZED (
  SELECT product_id, qty_on_hand, reorder_point, updated_at
  FROM ecom.inventory
  WHERE qty_on_hand < reorder_point
)
SELECT ls.product_id,
       p.sku,
       p.product_name,
       ls.qty_on_hand,
       ls.reorder_point,
       ls.reorder_point - ls.qty_on_hand AS shortage_qty,
       ls.updated_at
FROM low_stock AS ls
JOIN ecom.products AS p USING (product_id)
ORDER BY shortage_qty DESC, ls.qty_on_hand, ls.product_id;`,
    },
    mv: {
      executionTime: 0.094,
      buffers: 7,
      rows: 61,
    },
    correctness: {
      baselineRows: 61,
      optimizedRows: 61,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "On small tables (600 rows), PostgreSQL's cost planner correctly prefers a 5-page Seq Scan over index overhead. Forcing an index actually increased runtime by 70%.",
  },
  {
    id: "q08",
    number: 8,
    title: "High-Rating Products",
    tag: "REVIEWS",
    goal: "Find products with an average rating >= 4.5 and at least 50 customer reviews.",
    optimization: "Review Pre-aggregation with HAVING, Dimension Join Pruning",
    optimizationShort: "Pre-join Aggregate → Dimension Pruning",
    baseline: {
      executionTime: 2.738,
      buffers: 35,
      strategy: "Reviews Pre-join + HashAggregate",
      rows: 12,
      sql: `SELECT r.product_id,
       p.product_name,
       COUNT(*) AS review_count,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM ecom.reviews AS r
JOIN ecom.products AS p USING (product_id)
GROUP BY r.product_id, p.product_name
HAVING AVG(r.rating) >= 4.5
   AND COUNT(*) >= 50
ORDER BY avg_rating DESC, review_count DESC, r.product_id;`,
    },
    tuned: {
      executionTime: 1.745,
      buffers: 35,
      strategy: "Review Pre-aggregation + Pruned Join",
      rows: 12,
      sql: `WITH review_stats AS MATERIALIZED (
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
ORDER BY avg_rating DESC, rs.review_count DESC, rs.product_id;`,
    },
    mv: {
      executionTime: 0.415,
      buffers: 14,
      rows: 12,
    },
    correctness: {
      baselineRows: 12,
      optimizedRows: 12,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Filtering 151 reviewed products down to 12 via HAVING before joining products avoids joining 2,060 raw review lines to product dimensions.",
  },
  {
    id: "q09",
    number: 9,
    title: "AOV by Coupon Usage",
    tag: "PROMOTIONS",
    goal: "Compare order count, total revenue, and average order value between coupon users and non-users.",
    optimization: "Order-level Pre-aggregation, Dynamic Ratio Metric",
    optimizationShort: "Raw DISTINCT → Order Totals Aggregation",
    baseline: {
      executionTime: 12.581,
      buffers: 259,
      strategy: "Hash Join + GroupAggregate (DISTINCT)",
      rows: 2,
      sql: `SELECT o.coupon_code IS NOT NULL AS coupon_used,
       COUNT(DISTINCT o.order_id) AS order_count,
       ROUND(
         SUM(oi.line_total) / NULLIF(COUNT(DISTINCT o.order_id), 0),
         2
       ) AS avg_order_amount,
       SUM(oi.line_total) AS revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi USING (order_id)
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
GROUP BY o.coupon_code IS NOT NULL
ORDER BY coupon_used DESC;`,
    },
    tuned: {
      executionTime: 14.617,
      buffers: 256,
      strategy: "Order-level Pre-aggregation CTE",
      rows: 2,
      sql: `WITH order_totals AS MATERIALIZED (
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
GROUP BY coupon_used
ORDER BY coupon_used DESC;`,
    },
    mv: {
      executionTime: 0.028,
      buffers: 6,
      rows: 2,
    },
    correctness: {
      baselineRows: 2,
      optimizedRows: 2,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Coupon users generated an AOV of $1,833.28 vs $641.22 for non-users (2.86x higher). Pre-aggregation guarantees clean scalability without duplicate line-item counting.",
  },
  {
    id: "q10",
    number: 10,
    title: "Top Customer Spend",
    tag: "LIFETIME",
    goal: "Past 60-day revenue of top 1% customers by cumulative spend.",
    optimization: "Join strategy comparisons, Combining MV with real-time raw data",
    optimizationShort: "Repeated CTE → Pre-aggregation",
    baseline: {
      executionTime: 6.652,
      buffers: 300,
      strategy: "Two Raw Joins",
      rows: 30,
      sql: `WITH customer_lifetime AS (
  SELECT c.customer_id, COALESCE(SUM(oi.line_total), 0) AS lifetime_revenue
  FROM ecom.customers AS c
  LEFT JOIN ecom.orders o ON o.customer_id = c.customer_id AND o.order_status IN ('paid', 'shipped', 'delivered')
  LEFT JOIN ecom.order_items oi ON oi.order_id = o.order_id
  GROUP BY c.customer_id
),
ranked AS (
  SELECT customer_id, lifetime_revenue,
         ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS rank,
         COUNT(*) OVER () AS customer_count
  FROM customer_lifetime
),
top_customers AS (
  SELECT * FROM ranked WHERE rank <= CEIL(customer_count * 0.01)
)
SELECT t.customer_id, t.lifetime_revenue, COALESCE(SUM(oi.line_total), 0) AS recent_revenue
FROM top_customers t
LEFT JOIN ecom.orders o ON o.customer_id = t.customer_id AND o.order_status IN ('paid', 'shipped', 'delivered') AND o.order_ts >= now() - INTERVAL '60 days'
LEFT JOIN ecom.order_items oi ON oi.order_id = o.order_id
GROUP BY t.customer_id, t.lifetime_revenue;`,
    },
    tuned: {
      executionTime: 6.789,
      buffers: 181,
      strategy: "Pre-aggregation Reused",
      rows: 30,
      sql: `WITH order_totals AS (
  SELECT o.order_id, o.customer_id, o.order_ts, SUM(oi.line_total) AS order_total
  FROM ecom.orders o JOIN ecom.order_items oi USING (order_id)
  WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  GROUP BY o.order_id, o.customer_id, o.order_ts
),
customer_lifetime AS (
  SELECT c.customer_id, COALESCE(SUM(ot.order_total), 0) AS lifetime_revenue
  FROM ecom.customers c LEFT JOIN order_totals ot USING (customer_id)
  GROUP BY c.customer_id
),
ranked AS (
  SELECT customer_id, lifetime_revenue, ROW_NUMBER() OVER (ORDER BY lifetime_revenue DESC, customer_id) AS rank, COUNT(*) OVER () AS count
  FROM customer_lifetime
),
top_customers AS ( SELECT * FROM ranked WHERE rank <= CEIL(count * 0.01) )
SELECT t.customer_id, t.lifetime_revenue, COALESCE(SUM(ot.order_total), 0) AS recent_revenue
FROM top_customers t
LEFT JOIN order_totals ot ON ot.customer_id = t.customer_id AND ot.order_ts >= now() - INTERVAL '60 days'
GROUP BY t.customer_id, t.lifetime_revenue;`,
    },
    mv: {
      executionTime: 3.036,
      buffers: 154,
      rows: 30,
    },
    correctness: {
      baselineRows: 30,
      optimizedRows: 30,
      mismatchRows: 0,
      boundaryTests: "PASSED ✓",
      nullHandling: "PASSED ✓",
      duplicateHandling: "PASSED ✓",
      dateBoundaryTests: "PASSED ✓",
    },
    keyInsight: "Forcing a Nested Loop here would cause execution time to jump to 690ms. Combining a lifetime MV with raw 60-day aggregations yielded the best result (3.0ms).",
  }
];
