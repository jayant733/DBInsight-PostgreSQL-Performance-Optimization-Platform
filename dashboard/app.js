// PostgreSQL Performance Lab Dashboard Application Logic

const scenariosData = [
  {
    id: "q01",
    tag: "Q1 • REVENUE",
    title: "Q1: Realized Monthly Revenue",
    desc: "Calculate sum of line totals for paid, shipped, and delivered orders over the past month. Explores Index Only Scans and Boundary-Safe Hybrid MVs.",
    baselineLatency: "4.46 ms",
    tunedLatency: "3.18 ms (0.36 ms MV)",
    baselineBuffers: "251 buffers",
    tunedBuffers: "189 (44 MV)",
    improvement: "73% Speedup",
    baselinePlan: `-> Aggregate (cost=540.22..540.23 rows=1)
   -> Hash Join (cost=210.00..510.00 rows=6000)
        Hash Cond: (oi.order_id = o.order_id)
        -> Seq Scan on order_items oi (cost=0.00..250.00 rows=18622)
        -> Hash (cost=180.00..180.00 rows=2400)
             -> Seq Scan on orders o (cost=0.00..180.00 rows=2400)
                  Filter: (order_status IN ('paid','shipped','delivered') 
                           AND order_ts >= now() - '1 month'::interval)
Buffers: shared hit=251
Execution Time: 4.462 ms`,
    tunedPlan: `-> Aggregate (cost=320.00..320.01 rows=1)
   -> Hash Join (cost=110.00..300.00 rows=6000)
        -> Seq Scan on order_items oi (cost=0.00..250.00 rows=18622)
        -> Hash (cost=85.00..85.00 rows=2400)
             -> Index Only Scan using idx_orders_revenue_ts_order_id on orders o
                  Index Cond: (order_ts >= now() - '1 month'::interval)
                  Heap Fetches: 0
Buffers: shared hit=189 (shared hit=44 in hybrid MV)
Execution Time: 3.184 ms (0.365 ms in hybrid MV)`
  },
  {
    id: "q02",
    tag: "Q2 • AGGREGATION",
    title: "Q2: Monthly Order Count, Revenue & AOV",
    desc: "Monthly order metrics using date_trunc. Replaces costly COUNT(DISTINCT) over joined rows with order-level pre-aggregation.",
    baselineLatency: "14.20 ms",
    tunedLatency: "7.94 ms (0.006 ms MV)",
    baselineBuffers: "251 buffers",
    tunedBuffers: "251 (1 MV)",
    improvement: "44% Speedup",
    baselinePlan: `-> GroupAggregate (cost=1250.00..1380.00 rows=5)
   -> Sort (cost=1250.00..1285.00 rows=14356)
        Sort Key: (date_trunc('month', o.order_ts)), o.order_id
        Sort Method: quicksort Memory: 945kB
        -> Hash Join (cost=180.00..450.00 rows=14356)
             -> Seq Scan on order_items oi
             -> Hash -> Seq Scan on orders o
Buffers: shared hit=251
Execution Time: 14.200 ms`,
    tunedPlan: `-> HashAggregate (cost=480.00..480.20 rows=5)
   -> HashAggregate (cost=350.00..402.00 rows=5264)
        Group Key: o.order_id, date_trunc('month', o.order_ts)
        -> Hash Join (cost=180.00..310.00 rows=14356)
             -> Seq Scan on order_items oi
             -> Hash -> Seq Scan on orders o
Buffers: shared hit=251 (shared hit=1 in monthly MV)
Execution Time: 7.940 ms (0.006 ms in monthly MV)`
  },
  {
    id: "q03",
    tag: "Q3 • DIMENSIONS",
    title: "Q3: Top 10 Revenue Categories in Past 90 Days",
    desc: "Orders → Products → Categories multi-table join. Pre-aggregates product sales to 594 rows before dimension joins.",
    baselineLatency: "8.61 ms",
    tunedLatency: "4.48 ms (0.32 ms MV)",
    baselineBuffers: "259 buffers",
    tunedBuffers: "226 (82 MV)",
    improvement: "48% Speedup",
    baselinePlan: `-> Limit (cost=850.00..850.02 rows=10)
   -> Sort (cost=850.00..850.10 rows=14)
        -> HashAggregate -> Hash Join -> Hash Join
             -> Seq Scan on orders o
             -> Seq Scan on order_items oi
             -> Seq Scan on products p
             -> Seq Scan on categories c
Buffers: shared hit=259
Execution Time: 8.615 ms`,
    tunedPlan: `-> Limit (cost=420.00..420.02 rows=10)
   -> Sort (cost=420.00..420.05 rows=14)
        -> Hash Join (categories c)
             -> Hash Join (products p)
                  -> CTE Scan on product_sales ps (594 rows)
Buffers: shared hit=226 (shared hit=82 in category MV)
Execution Time: 4.476 ms (0.321 ms in category MV)`
  },
  {
    id: "q04",
    tag: "Q4 • WINDOW FUNCS",
    title: "Q4: Cumulative Revenue RANK Top 20 by Product",
    desc: "Per-product cumulative revenue with RANK() window function. Exploits ordered indexes for zero-sort Merge Joins.",
    baselineLatency: "7.98 ms",
    tunedLatency: "3.06 ms (Merge Join)",
    baselineBuffers: "258 buffers",
    tunedBuffers: "245 (11 MV)",
    improvement: "62% Speedup",
    baselinePlan: `-> WindowAgg (cost=750.00..900.00 rows=600)
   Run Condition: (rank() OVER (...) <= 20)
   -> Sort (cost=750.00..765.00 rows=600)
        -> HashAggregate -> Hash Join -> orders & order_items
Buffers: shared hit=258
Execution Time: 7.984 ms`,
    tunedPlan: `-> WindowAgg (cost=350.00..420.00 rows=600)
   -> Merge Join (cost=0.56..310.00 rows=14356)
        Merge Cond: (o.order_id = oi.order_id)
        -> Index Only Scan using idx_orders_q4_valid_order_id on orders o
        -> Index Scan using idx_order_items_order on order_items oi
Buffers: shared hit=245 (shared hit=11 in product MV)
Execution Time: 3.059 ms (0.151 ms in product MV)`
  },
  {
    id: "q05",
    tag: "Q5 • CUSTOMER RFM",
    title: "Q5: Customer RFM (Recency, Frequency, Monetary)",
    desc: "Computes last order timestamp, frequency, and total spend across 2,222 purchasing customers.",
    baselineLatency: "20.36 ms",
    tunedLatency: "10.02 ms (0.62 ms MV)",
    baselineBuffers: "257 buffers",
    tunedBuffers: "251 (17 MV)",
    improvement: "51% Speedup",
    baselinePlan: `-> GroupAggregate (cost=1450.00..1620.00 rows=2222)
   -> Sort (cost=1450.00..1485.00 rows=14356) [Memory: 1057kB]
        Sort Key: o.customer_id, o.order_id
        -> Hash Join on orders & order_items
Buffers: shared hit=257
Execution Time: 20.361 ms`,
    tunedPlan: `-> HashAggregate (cost=520.00..560.00 rows=2222)
   -> CTE Scan on order_totals (5,264 pre-aggregated order rows)
Buffers: shared hit=251 (shared hit=17 in RFM MV)
Execution Time: 10.018 ms (0.624 ms in RFM MV)`
  },
  {
    id: "q06",
    tag: "Q6 • COHORT ANALYSIS",
    title: "Q6: 30-Day Cohort Repeat Purchase Rate",
    desc: "Replaces correlated EXISTS subquery (2,222 loops) with single-pass CTE pre-aggregation, slashing buffer I/O by 97.5%.",
    baselineLatency: "6.01 ms",
    tunedLatency: "4.45 ms (0.64 ms MV)",
    baselineBuffers: "5,633 buffers",
    tunedBuffers: "142 buffers",
    improvement: "97.5% Buffer Cut",
    baselinePlan: `-> Aggregate (cost=504.00..504.01 rows=1)
   -> Seq Scan on orders o (cost=0.00..180.00 rows=2222)
        SubPlan 1 (Correlated EXISTS)
          -> Index Scan using idx_orders_customer_ts on orders r (loops=2222)
               Index Cond: (customer_id = o.customer_id AND order_ts > o.order_ts)
Buffers: shared hit=5633
Execution Time: 6.013 ms`,
    tunedPlan: `-> Aggregate (cost=280.00..280.01 rows=1)
   -> Hash Left Join (cost=142.00..260.00 rows=2222)
        Hash Cond: (r.customer_id = f.customer_id)
        -> CTE Scan on first_orders f (2,222 rows)
        -> Hash -> Seq Scan on orders r
Buffers: shared hit=142 (shared hit=15 in first purchase MV)
Execution Time: 4.454 ms (0.641 ms in first purchase MV)`
  },
  {
    id: "q07",
    tag: "Q7 • PARTIAL INDEX",
    title: "Q7: Low-Stock Inventory Below Reorder Point",
    desc: "Evaluates partial index with expression predicate (qty_on_hand < reorder_point) vs sequential scan cost on 600 items.",
    baselineLatency: "0.23 ms",
    tunedLatency: "0.39 ms (0.09 ms MV)",
    baselineBuffers: "18 buffers",
    tunedBuffers: "18 (7 MV)",
    improvement: "Cost Model Check",
    baselinePlan: `-> Sort (cost=25.00..25.15 rows=61)
   -> Hash Join (cost=12.00..22.00 rows=61)
        -> Seq Scan on inventory i (Filter: qty_on_hand < reorder_point)
        -> Hash -> Seq Scan on products p
Buffers: shared hit=18
Execution Time: 0.230 ms`,
    tunedPlan: `-> Sort -> Hash Join -> Pre-filtered low-stock rows
   (Planner confirms Seq Scan is optimal for 600 rows/5 pages)
Buffers: shared hit=18 (shared hit=7 in low stock MV)
Execution Time: 0.392 ms (0.094 ms in low stock MV)`
  },
  {
    id: "q08",
    tag: "Q8 • REVIEW METRICS",
    title: "Q8: High-Rating & High-Review Products (Rating >= 4.5)",
    desc: "Groups 2,060 reviews first, reducing product join inputs from 2,060 rows to just 12 qualified products.",
    baselineLatency: "2.74 ms",
    tunedLatency: "1.75 ms (0.41 ms MV)",
    baselineBuffers: "35 buffers",
    tunedBuffers: "35 (14 MV)",
    improvement: "36% Speedup",
    baselinePlan: `-> Sort (cost=120.00..120.10 rows=12)
   -> HashAggregate (Filter: avg(rating) >= 4.5 AND count >= 50)
        -> Hash Join (2060 rows joined to products first)
Buffers: shared hit=35
Execution Time: 2.738 ms`,
    tunedPlan: `-> Sort (cost=65.00..65.05 rows=12)
   -> Hash Join (only 12 qualified items joined to products)
        -> CTE Scan on review_stats (Filtered 151 reviewed items to 12)
Buffers: shared hit=35 (shared hit=14 in review MV)
Execution Time: 1.745 ms (0.415 ms in review MV)`
  },
  {
    id: "q09",
    tag: "Q9 • COUPON LIFT",
    title: "Q9: Average Order Value by Coupon Usage",
    desc: "Pre-aggregates into 5,264 orders before evaluating coupon split, preventing Cartesian line-item AOV corruption.",
    baselineLatency: "12.58 ms",
    tunedLatency: "14.62 ms (0.028 ms MV)",
    baselineBuffers: "259 buffers",
    tunedBuffers: "256 (6 MV)",
    improvement: "Structural Parity",
    baselinePlan: `-> HashAggregate (cost=620.00..620.05 rows=2)
   -> Hash Join -> 14,356 joined rows evaluated with DISTINCT
Buffers: shared hit=259
Execution Time: 12.581 ms`,
    tunedPlan: `-> HashAggregate (cost=450.00..450.05 rows=2)
   -> CTE Scan on order_totals (5,264 pre-aggregated orders)
Buffers: shared hit=256 (shared hit=6 in coupon MV)
Execution Time: 14.617 ms (0.028 ms in coupon MV)`
  },
  {
    id: "q10",
    tag: "Q10 • TOP 1% SPENDERS",
    title: "Q10: Past 60-Day Revenue of Top 1% Spenders",
    desc: "Ranks 3,000 customers by lifetime spend via ROW_NUMBER, then calculates past 60-day revenue strictly for top 30 spenders.",
    baselineLatency: "14.46 ms",
    tunedLatency: "3.16 ms (Hybrid MV)",
    baselineBuffers: "480 buffers",
    tunedBuffers: "231 buffers",
    improvement: "78% Speedup",
    baselinePlan: `-> Hash Join (re-joining order_items twice for lifetime & 60-day)
   -> Sort 3000 customers
   -> Aggregate 60-day orders
Buffers: shared hit=480 (15,976 buffers if forced Nested Loop)
Execution Time: 14.457 ms (690.28 ms in forced Nested Loop)`,
    tunedPlan: `-> Hash Join (Lifetime MV top 30 joined to 60-day raw index scan)
   -> Index Only Scan using idx_orders_q6_valid_customer_ts
Buffers: shared hit=231
Execution Time: 3.159 ms`
  }
];

// Initialize on DOM Load
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupScenarioList();
  renderScenarioDetail(scenariosData[0].id);
  initCharts();
});

// Tab Navigation
function setupNavigation() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");

      navBtns.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// Scenario Sidebar List
function setupScenarioList() {
  const listContainer = document.getElementById("scenario-nav-list");
  if (!listContainer) return;

  listContainer.innerHTML = scenariosData.map((s, idx) => `
    <button class="scenario-item-btn ${idx === 0 ? 'active' : ''}" data-id="${s.id}">
      <span class="sib-tag">${s.tag}</span>
      <span class="sib-title">${s.title.split(':')[1] || s.title}</span>
    </button>
  `).join('');

  listContainer.querySelectorAll(".scenario-item-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      listContainer.querySelectorAll(".scenario-item-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const sId = btn.getAttribute("data-id");
      renderScenarioDetail(sId);
    });
  });
}

// Render Scenario Detail View
function renderScenarioDetail(scenarioId) {
  const scenario = scenariosData.find(s => s.id === scenarioId) || scenariosData[0];
  const container = document.getElementById("scenario-detail-view");
  if (!container) return;

  container.innerHTML = `
    <div class="sd-header">
      <div>
        <span class="sd-badge">${scenario.tag}</span>
        <h2 class="sd-title">${scenario.title}</h2>
        <p class="sd-desc">${scenario.desc}</p>
      </div>
      <span class="badge-best" style="font-size: 0.9rem; padding: 0.4rem 0.8rem; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px;">${scenario.improvement}</span>
    </div>

    <div class="sd-metrics-row">
      <div class="sd-metric-box">
        <div class="sd-m-lbl">Baseline Latency</div>
        <div class="sd-m-val">${scenario.baselineLatency}</div>
      </div>
      <div class="sd-metric-box">
        <div class="sd-m-lbl">Tuned Latency</div>
        <div class="sd-m-val highlight">${scenario.tunedLatency}</div>
      </div>
      <div class="sd-metric-box">
        <div class="sd-m-lbl">Baseline Buffers</div>
        <div class="sd-m-val">${scenario.baselineBuffers}</div>
      </div>
      <div class="sd-metric-box">
        <div class="sd-m-lbl">Tuned Buffers</div>
        <div class="sd-m-val highlight">${scenario.tunedBuffers}</div>
      </div>
    </div>

    <div class="sd-plan-comparison">
      <div class="sd-plan-card">
        <div class="sd-pc-head">
          <span>❌ Baseline Execution Plan</span>
          <span style="color: var(--accent-rose);">Un-optimized</span>
        </div>
        <pre class="sd-pc-code">${escapeHtml(scenario.baselinePlan)}</pre>
      </div>

      <div class="sd-plan-card">
        <div class="sd-pc-head">
          <span>✅ Tuned Execution Plan</span>
          <span style="color: var(--accent-green);">Optimized & Verified</span>
        </div>
        <pre class="sd-pc-code">${escapeHtml(scenario.tunedPlan)}</pre>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Chart.js Graphs
function initCharts() {
  const ctxLatency = document.getElementById('latencyChart');
  const ctxBuffers = document.getElementById('buffersChart');

  if (ctxLatency) {
    new Chart(ctxLatency, {
      type: 'bar',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'],
        datasets: [
          {
            label: 'Baseline (ms)',
            data: [4.46, 14.20, 8.61, 7.98, 20.36, 6.01, 0.23, 2.74, 12.58, 14.46],
            backgroundColor: 'rgba(244, 63, 94, 0.65)',
            borderColor: '#f43f5e',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Tuned Query (ms)',
            data: [3.18, 7.94, 4.48, 5.65, 10.02, 4.45, 0.39, 1.75, 14.62, 13.55],
            backgroundColor: 'rgba(59, 130, 246, 0.65)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Materialized View (ms)',
            data: [0.36, 0.006, 0.32, 0.15, 0.62, 0.64, 0.09, 0.41, 0.028, 3.16],
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' }, title: { display: true, text: 'Execution Time (ms)', color: '#6b7280' } }
        }
      }
    });
  }

  if (ctxBuffers) {
    new Chart(ctxBuffers, {
      type: 'bar',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6 (EXISTS)', 'Q7', 'Q8', 'Q9', 'Q10'],
        datasets: [
          {
            label: 'Baseline Buffers',
            data: [251, 251, 259, 258, 257, 5633, 18, 35, 259, 480],
            backgroundColor: 'rgba(139, 92, 246, 0.65)',
            borderColor: '#8b5cf6',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Tuned Buffers',
            data: [189, 251, 226, 204, 251, 142, 18, 35, 256, 294],
            backgroundColor: 'rgba(6, 182, 212, 0.75)',
            borderColor: '#06b6d4',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 11 } } }
        },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } },
          y: { 
            type: 'logarithmic',
            grid: { color: 'rgba(255,255,255,0.05)' }, 
            ticks: { color: '#9ca3af' }, 
            title: { display: true, text: 'Shared Buffer Pages (Log Scale)', color: '#6b7280' } 
          }
        }
      }
    });
  }
}
