export interface Benchmark {
  id: string;
  query: string;
  optimization: string;
  baselineTime: number;
  optimizedTime: number;
  speedup: number;
  baselineBuffers: number;
  optimizedBuffers: number;
  bufferReduction: number;
  correctness: boolean;
}

export const benchmarks: Benchmark[] = [
  {
    id: "q01",
    query: "Q1 Realized Revenue",
    optimization: "Partial Index / Index Only Scan",
    baselineTime: 2.786,
    optimizedTime: 1.333,
    speedup: 52.2,
    baselineBuffers: 138,
    optimizedBuffers: 106,
    bufferReduction: 23.2,
    correctness: true,
  },
  {
    id: "q02",
    query: "Q2 Monthly Order Metrics",
    optimization: "Order-level Pre-aggregation",
    baselineTime: 14.200,
    optimizedTime: 7.940,
    speedup: 44.1,
    baselineBuffers: 251,
    optimizedBuffers: 251,
    bufferReduction: 0,
    correctness: true,
  },
  {
    id: "q03",
    query: "Q3 Top 10 Categories",
    optimization: "Product Pre-aggregation",
    baselineTime: 8.615,
    optimizedTime: 4.476,
    speedup: 48.0,
    baselineBuffers: 259,
    optimizedBuffers: 226,
    bufferReduction: 12.7,
    correctness: true,
  },
  {
    id: "q04",
    query: "Q4 Product Ranking",
    optimization: "Merge Join (Ordered Index)",
    baselineTime: 2.798,
    optimizedTime: 2.188,
    speedup: 21.8,
    baselineBuffers: 148,
    optimizedBuffers: 123,
    bufferReduction: 16.9,
    correctness: true,
  },
  {
    id: "q05",
    query: "Q5 Customer RFM",
    optimization: "Order-level Pre-aggregation",
    baselineTime: 20.361,
    optimizedTime: 10.018,
    speedup: 50.8,
    baselineBuffers: 257,
    optimizedBuffers: 251,
    bufferReduction: 2.3,
    correctness: true,
  },
  {
    id: "q06",
    query: "Q6 Repeat Purchase Rate",
    optimization: "Correlated EXISTS → Pre-Aggregation",
    baselineTime: 2.482,
    optimizedTime: 2.418,
    speedup: 2.6,
    baselineBuffers: 4756,
    optimizedBuffers: 78,
    bufferReduction: 98.4,
    correctness: true,
  },
  {
    id: "q07",
    query: "Q7 Low-Stock Products",
    optimization: "Partial Index Pre-filter",
    baselineTime: 0.230,
    optimizedTime: 0.392,
    speedup: -70.4, // Planners correctly chose Seq Scan, so forcing partial index was slower
    baselineBuffers: 18,
    optimizedBuffers: 18,
    bufferReduction: 0,
    correctness: true,
  },
  {
    id: "q08",
    query: "Q8 High-Rating Products",
    optimization: "Review Pre-aggregation",
    baselineTime: 2.738,
    optimizedTime: 1.745,
    speedup: 36.3,
    baselineBuffers: 35,
    optimizedBuffers: 35,
    bufferReduction: 0,
    correctness: true,
  },
  {
    id: "q09",
    query: "Q9 AOV by Coupon Usage",
    optimization: "Order-level Pre-aggregation",
    baselineTime: 12.581,
    optimizedTime: 14.617,
    speedup: -16.2, // Clean query shape prevents duplicates as data scales, even if slightly slower
    baselineBuffers: 259,
    optimizedBuffers: 256,
    bufferReduction: 1.2,
    correctness: true,
  },
  {
    id: "q10",
    query: "Q10 Top 1% Customer Spend",
    optimization: "Pre-aggregation Reused",
    baselineTime: 6.652,
    optimizedTime: 6.789,
    speedup: -2.1,
    baselineBuffers: 300,
    optimizedBuffers: 181,
    bufferReduction: 39.7,
    correctness: true,
  },
];
