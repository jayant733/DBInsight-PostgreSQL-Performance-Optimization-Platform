# Query Summary

| Query | Analytical Goal | Key Bottleneck / Observation | Key Strategies Compared |
| --- | --- | --- | --- |
| Q1 | Realized revenue for the past month | Filtering valid orders within the recent timeframe | Partial Index, Index Only Scan, Daily GMV MV, Date boundary adjustment |
| Q2 | Monthly order count, revenue, and AOV | Order duplication caused by joining order items | Pre-aggregation at order level, Monthly MV |
| Q3 | Top 10 revenue categories in the past 90 days | Multi-table aggregation (Orders → Products → Categories) | Partial Index, Product pre-aggregation, Daily category MV |
| Q4 | Cumulative revenue RANK Top 20 by product | Per-product aggregation over high volume order items | Partial Index, Merge Join comparison, Product revenue MV |
| Q5 | Customer RFM | `COUNT(DISTINCT)` overhead and per-customer aggregation | Pre-aggregation at order level, Customer RFM MV |
| Q6 | Repeat purchase rate within 30 days of first purchase | Repeated table access from correlated `EXISTS` | Pre-aggregating subsequent orders, First purchase MV |
| Q7 | Low-stock products | Low selectivity across small inventory table | Partial Index vs. Seq Scan comparison, Low-stock MV |
| Q8 | High-rating & high-review products | Joining products after aggregating review metrics | Review pre-aggregation, Product review MV |
| Q9 | Average order value by coupon usage | Joining order items with order-level metrics | Pre-aggregation at order level, Coupon metrics MV |
| Q10 | Past 60-day revenue of top 1% customers by cumulative spend | Repeated join over raw order items | Join strategy comparisons, Combining cumulative revenue MV with recent raw data |

Each query directory contains baseline, tuned, plan analysis, Join/Bitmap comparisons, Materialized Views, and result comparison SQL scripts. For detailed explanations and baseline metrics, refer to [progress-summary.md](progress-summary.md).
