# QueryLab — Video Script

---

## 1. What I Built

> "I built **QueryLab**, a PostgreSQL 17 performance optimization platform and interactive benchmark dashboard for e-commerce reporting."

---

## 2. Why I Built It

> "Most slow database systems suffer from bad query design and poor indexing—not a lack of server RAM or CPU.
>
> In e-commerce, reports answer critical business questions like monthly revenue, customer retention, and top-selling products. When queries scan entire tables or join incorrectly, they stall the database. Worse, naive optimizations often return inaccurate numbers.
>
> I built this lab to prove three things:
> 1. How to diagnose bottlenecks using `EXPLAIN ANALYZE` and buffer I/O rather than guessing.
> 2. How to systematically tune queries using partial indexes, early aggregation, and materialized views.
> 3. How to guarantee that optimized queries return the **exact same results** as baselines using `EXCEPT ALL` correctness checks."

---

## 3. Tech Stack

> "The tech stack includes:
> - **Database:** PostgreSQL 17 running in Docker with a synthetic e-commerce schema (customers, orders, line items, products, reviews).
> - **Database Profiling:** Raw SQL, `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, and automated bidirectional `EXCEPT ALL` tests.
> - **Dashboard:** Next.js (React 19, TypeScript) with Tailwind CSS, Recharts for benchmark visualization, and XYFlow for visual query plan trees."

---

## 4. Page-by-Page Walkthrough

### **Page 1: Overview (`/`)**
* **Action:** Open `http://localhost:3000` (or `3001`), show the KPI cards and high-level charts.
* **Say:**
  > "Here on the Home dashboard, you see the aggregate metrics across 10 distinct reporting queries: an average execution time reduction of roughly 40%, a peak buffer I/O reduction of 98.4%, and a 10 out of 10 PASS rate on correctness. We measure both execution time and buffer reads because I/O is what kills a database under concurrent load."

---

### **Page 2: Benchmarks Scoreboard (`/benchmarks`)**
* **Action:** Click **Benchmarks** in the navigation bar.
* **Say:**
  > "The Benchmarks page shows the side-by-side comparison for all 10 queries.
  > - Notice **Q01** and **Q05**, where execution time dropped by over 50%.
  > - Look at **Q06**: runtime stayed around 2.4 milliseconds, but memory buffers dropped from 4,756 down to 78.
  > - Look at **Q07**: the tuned query was actually 70% slower because forcing an index on a 600-row table is worse than a simple sequential scan. This lab highlights real tradeoffs, not fake wins.
  > - Most importantly, every single query passed verification in the PASS column."

---

### **Page 3: Execution Plans (`/plans`)**
* **Action:** Click **Execution Plans** in the navigation bar. Scroll down to show node trees.
* **Say:**
  > "This page visualizes PostgreSQL execution trees node by node. You can visually inspect where sequential scans turned into index-only scans, where expensive nested loops were replaced with hash joins, and where aggregation happened."

---

### **Page 4: Deep Dive — Q01 (`/queries/q01`)**
* **Action:** Click **Queries** → **Q01 (Realized Revenue)**.
* **Say:**
  > "Q01 calculates realized revenue from the past month.
  > - We introduced a partial index covering only paid, shipped, and delivered orders, enabling an index-only scan.
  > - The big engineering lesson here was a date-edge trap: a daily pre-aggregated materialized view overcounted revenue by including an entire extra cutoff day. We fixed this with a hybrid query that pulls historical days from the view and raw hours for the boundary, achieving a 52% speedup while matching the baseline to the penny."

---

### **Page 5: Deep Dive — Q06 (`/queries/q06`)**
* **Action:** Click **Queries** → **Q06 (30-Day Repeat Purchase Rate)**.
* **Say:**
  > "Q06 determines how many first-time buyers return within 30 days.
  > - The baseline used a correlated `EXISTS` subquery that repeatedly scanned the orders table for every customer, hitting 4,756 buffers.
  > - By rewriting this into a set-based join with pre-aggregated first purchase dates, buffer reads dropped to just 78—a 98.4% reduction in disk and memory pressure."

---

### **Page 6: Live Query Analyzer (`/query-analyzer`)**
* **Action:** Click **Add New Query** in the sidebar. Click **Load Example**, then **Analyze & Save**.
* **Say:**
  > "Unlike the pre-recorded benchmarks, this section connects live to the local PostgreSQL database. It runs a safe, read-only `EXPLAIN ANALYZE`, parses the cost and buffer I/O, renders the interactive plan graph, and offers rule-based optimization suggestions."

---

### **Conclusion (Return to `/`)**
* **Action:** Click the **QueryLab** logo to return to the home screen.
* **Say:**
  > "In summary, QueryLab demonstrates that real database optimization is about measuring I/O, choosing the right query patterns, knowing when not to index, and always validating that the final numbers match the business truth."
