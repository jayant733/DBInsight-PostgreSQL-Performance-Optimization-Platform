export interface PlanNode {
  id: string;
  type: string;
  table?: string;
  actualRows: number;
  estimatedRows: number;
  executionTime: number;
  buffers: number;
  cost: string;
  details: Record<string, string>;
  children?: PlanNode[];
}

export const executionPlans: Record<string, { baseline: PlanNode, tuned: PlanNode }> = {
  "q01": {
    baseline: {
      id: "agg-1", type: "Aggregate", actualRows: 1, estimatedRows: 1, executionTime: 2.748, buffers: 138, cost: "364.72..364.73",
      details: {},
      children: [
        {
          id: "hj-1", type: "Hash Join", actualRows: 2567, estimatedRows: 2462, executionTime: 2.545, buffers: 138, cost: "130.46..358.56",
          details: { "Hash Cond": "(oi.order_id = o.order_id)" },
          children: [
            {
              id: "ss-1", type: "Seq Scan", table: "order_items oi", actualRows: 10223, estimatedRows: 10223, executionTime: 0.618, buffers: 99, cost: "0.00..201.23", details: {}
            },
            {
              id: "h-1", type: "Hash", actualRows: 949, estimatedRows: 908, executionTime: 0.918, buffers: 39, cost: "119.11..119.11",
              details: { "Buckets": "1024", "Batches": "1", "Memory Usage": "46kB" },
              children: [
                {
                  id: "ss-2", type: "Seq Scan", table: "orders o", actualRows: 949, estimatedRows: 908, executionTime: 0.825, buffers: 39, cost: "0.00..119.11",
                  details: { "Filter": "order_status IN ('paid','shipped','delivered')", "Rows Removed by Filter": "2821" }
                }
              ]
            }
          ]
        }
      ]
    },
    tuned: {
      id: "agg-1", type: "Aggregate", actualRows: 1, estimatedRows: 1, executionTime: 1.289, buffers: 106, cost: "281.78..281.79",
      details: {},
      children: [
        {
          id: "hj-1", type: "Hash Join", actualRows: 2567, estimatedRows: 2462, executionTime: 1.172, buffers: 106, cost: "47.52..275.62",
          details: { "Hash Cond": "(oi.order_id = o.order_id)" },
          children: [
            {
              id: "ss-1", type: "Seq Scan", table: "order_items oi", actualRows: 10223, estimatedRows: 10223, executionTime: 0.456, buffers: 99, cost: "0.00..201.23", details: {}
            },
            {
              id: "h-1", type: "Hash", actualRows: 949, estimatedRows: 908, executionTime: 0.103, buffers: 7, cost: "36.17..36.17",
              details: { "Buckets": "1024", "Batches": "1", "Memory Usage": "46kB" },
              children: [
                {
                  id: "ios-1", type: "Index Only Scan", table: "orders o", actualRows: 949, estimatedRows: 908, executionTime: 0.056, buffers: 7, cost: "0.28..36.17",
                  details: { "Index Cond": "(order_ts >= (now() - '1 mon'::interval))", "Heap Fetches": "0", "Index": "idx_orders_revenue_ts_order_id" }
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "q04": {
    baseline: {
      id: "sort-1", type: "Sort", actualRows: 20, estimatedRows: 592, executionTime: 2.798, buffers: 148, cost: "502.11..503.59",
      details: { "Sort Key": "rank() DESC" },
      children: [
        {
          id: "w-1", type: "WindowAgg", actualRows: 584, estimatedRows: 592, executionTime: 2.712, buffers: 148, cost: "460.18..471.53",
          details: {},
          children: [
            {
              id: "agg-1", type: "HashAggregate", actualRows: 584, estimatedRows: 592, executionTime: 2.510, buffers: 148, cost: "395.92..403.32",
              details: { "Group Key": "p.product_id, p.product_name" },
              children: [
                {
                  id: "hj-1", type: "Hash Join", actualRows: 8162, estimatedRows: 8159, executionTime: 1.820, buffers: 148, cost: "140.03..355.13",
                  details: { "Hash Cond": "(oi.order_id = o.order_id)" },
                  children: [
                    { id: "ss-1", type: "Seq Scan", table: "order_items oi", actualRows: 10223, estimatedRows: 10223, executionTime: 0.412, buffers: 99, cost: "0.00..201.23", details: {} },
                    { id: "ss-2", type: "Seq Scan", table: "orders o", actualRows: 5264, estimatedRows: 5264, executionTime: 0.520, buffers: 39, cost: "0.00..119.11", details: {} }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    tuned: {
      id: "sort-1", type: "Sort", actualRows: 20, estimatedRows: 592, executionTime: 2.119, buffers: 123, cost: "502.11..503.59",
      details: { "Sort Key": "(rank() OVER (?)), ps.product_id" },
      children: [
        {
          id: "w-1", type: "WindowAgg", actualRows: 20, estimatedRows: 592, executionTime: 2.107, buffers: 120, cost: "61.18..71.53",
          details: { "Run Condition": "(rank() OVER (?) <= 20)" },
          children: [
            {
              id: "hj-2", type: "Hash Join", actualRows: 584, estimatedRows: 592, executionTime: 1.906, buffers: 117, cost: "20.50..33.91",
              details: { "Hash Cond": "(ps.product_id = p.product_id)" },
              children: [
                {
                  id: "cte-1", type: "CTE Scan", table: "product_sales ps", actualRows: 584, estimatedRows: 592, executionTime: 1.843, buffers: 110, cost: "0.00..11.84",
                  details: {},
                  children: [
                    {
                      id: "ha-1", type: "HashAggregate", actualRows: 584, estimatedRows: 592, executionTime: 1.842, buffers: 110, cost: "395.92..403.32",
                      details: { "Group Key": "oi.product_id" },
                      children: [
                        {
                          id: "hj-1", type: "Hash Join", actualRows: 8162, estimatedRows: 8159, executionTime: 0.230, buffers: 110, cost: "127.03..355.13",
                          details: { "Hash Cond": "(oi.order_id = o.order_id)" },
                          children: [
                            { id: "ss-1", type: "Seq Scan", table: "order_items oi", actualRows: 10223, estimatedRows: 10223, executionTime: 0.002, buffers: 99, cost: "0.00..201.23", details: {} },
                            {
                              id: "ios-1", type: "Index Only Scan", table: "orders o", actualRows: 3009, estimatedRows: 3009, executionTime: 0.005, buffers: 11, cost: "0.28..89.42",
                              details: { "Index": "idx_orders_q4_valid_order_id", "Heap Fetches": "0" }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                { id: "ss-2", type: "Seq Scan", table: "products p", actualRows: 600, estimatedRows: 600, executionTime: 0.003, buffers: 7, cost: "0.00..13.00", details: {} }
              ]
            }
          ]
        }
      ]
    }
  },
  "q06": {
    baseline: {
      id: "agg-1", type: "Aggregate", actualRows: 1, estimatedRows: 1, executionTime: 2.419, buffers: 4756, cost: "21834.91..21834.93",
      details: {},
      children: [
        {
          id: "cte-1", type: "CTE Scan", table: "customer_repurchase", actualRows: 2247, estimatedRows: 2598, executionTime: 2.344, buffers: 4756, cost: "0.00..51.96",
          details: {},
          children: [
             {
               id: "sub-1", type: "SubPlan 2 (Correlated EXISTS)", actualRows: 0, estimatedRows: 1, executionTime: 2.167, buffers: 4717, cost: "0.28..8.31",
               details: { "Executions": "2247" },
               children: [
                 { id: "is-1", type: "Index Scan", table: "orders r", actualRows: 0, estimatedRows: 1, executionTime: 0.000, buffers: 4717, cost: "0.28..8.31", details: {} }
               ]
             }
          ]
        }
      ]
    },
    tuned: {
      id: "agg-1", type: "Aggregate", actualRows: 1, estimatedRows: 1, executionTime: 2.364, buffers: 78, cost: "446.18..446.20",
      details: {},
      children: [
        {
          id: "cte-1", type: "CTE Scan", table: "customer_repurchase", actualRows: 2247, estimatedRows: 260, executionTime: 2.097, buffers: 78, cost: "0.00..5.20",
          details: {},
          children: [
             {
               id: "ha-1", type: "HashAggregate", actualRows: 2247, estimatedRows: 260, executionTime: 1.891, buffers: 78, cost: "303.92..306.52",
               details: { "Group Key": "f.customer_id, f.first_order_ts" },
               children: [
                 {
                   id: "hlj-1", type: "Hash Left Join", actualRows: 2779, estimatedRows: 2598, executionTime: 1.499, buffers: 78, cost: "128.45..284.43",
                   details: { "Hash Cond": "f.customer_id = r.customer_id" },
                   children: [
                     { id: "cte-2", type: "CTE Scan", table: "first_orders f", actualRows: 2247, estimatedRows: 2598, executionTime: 0.804, buffers: 39, cost: "0.00..51.96", details: {} },
                     { id: "h-1", type: "Hash", actualRows: 3009, estimatedRows: 3009, executionTime: 0.429, buffers: 39, cost: "90.84..90.84", details: {} }
                   ]
                 }
               ]
             }
          ]
        }
      ]
    }
  },
  "q10": {
    baseline: {
      id: "agg-1", type: "Aggregate", actualRows: 30, estimatedRows: 30, executionTime: 6.652, buffers: 300, cost: "1420.12..1425.40",
      details: { "Group Key": "t.customer_id, t.lifetime_revenue" },
      children: [
        {
          id: "hj-1", type: "Hash Join", actualRows: 480, estimatedRows: 512, executionTime: 5.820, buffers: 280, cost: "820.00..1200.00",
          details: { "Hash Cond": "(oi.order_id = o.order_id)" },
          children: [
            { id: "ss-1", type: "Seq Scan", table: "order_items oi", actualRows: 10223, estimatedRows: 10223, executionTime: 0.510, buffers: 99, cost: "0.00..201.23", details: {} },
            {
              id: "hj-2", type: "Hash Join", actualRows: 300, estimatedRows: 320, executionTime: 4.100, buffers: 181, cost: "400.00..700.00",
              details: { "Hash Cond": "(o.customer_id = t.customer_id)" },
              children: [
                { id: "ss-2", type: "Seq Scan", table: "orders o", actualRows: 5264, estimatedRows: 5264, executionTime: 0.650, buffers: 71, cost: "0.00..119.11", details: {} },
                { id: "top-1", type: "CTE Scan", table: "top_customers t", actualRows: 30, estimatedRows: 30, executionTime: 3.100, buffers: 110, cost: "0.00..300.00", details: {} }
              ]
            }
          ]
        }
      ]
    },
    tuned: {
      id: "agg-1", type: "Aggregate", actualRows: 30, estimatedRows: 30, executionTime: 6.789, buffers: 181, cost: "950.12..955.40",
      details: { "Group Key": "t.customer_id, t.lifetime_revenue" },
      children: [
        {
          id: "hlj-1", type: "Hash Left Join", actualRows: 300, estimatedRows: 320, executionTime: 5.200, buffers: 181, cost: "520.00..850.00",
          details: { "Hash Cond": "(ot.customer_id = t.customer_id)" },
          children: [
            {
              id: "cte-ot", type: "CTE Scan", table: "order_totals ot (Pre-aggregated)", actualRows: 5264, estimatedRows: 5264, executionTime: 2.100, buffers: 110, cost: "0.00..350.00",
              details: { "Filter": "order_ts >= (now() - '60 days'::interval)" }
            },
            {
              id: "top-1", type: "CTE Scan", table: "top_customers t", actualRows: 30, estimatedRows: 30, executionTime: 2.800, buffers: 71, cost: "0.00..150.00", details: {}
            }
          ]
        }
      ]
    }
  }
};
