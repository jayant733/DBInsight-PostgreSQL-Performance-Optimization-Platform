import { describe, expect, it } from "vitest";
import { queries } from "@/data/queries";
import type { PlanNode } from "@/types/analysis";
import { analyzeRules } from "./rules";

function plan(overrides: Partial<PlanNode> = {}): PlanNode {
  return {
    id: "root",
    type: "Seq Scan",
    table: "inventory i",
    actualRows: 100,
    estimatedRows: 100,
    executionTime: 0.2,
    buffers: 5,
    cost: "0.00..10.00",
    details: { "Rows Removed by Filter": "500" },
    ...overrides,
  };
}

describe("analyzeRules", () => {
  it("does not recommend an index for a tiny table", () => {
    const result = analyzeRules(
      "SELECT * FROM ecom.inventory WHERE qty_on_hand < reorder_point",
      plan(),
    );
    expect(result.candidateSql).toBeUndefined();
    expect(result.suggestions.map((item) => item.ruleId)).toContain(
      "tiny_table_seq_scan_ok",
    );
    expect(
      result.suggestions.some((item) => item.suggestedSql?.includes("INDEX")),
    ).toBe(false);
  });

  it("suggests reviewable index SQL for a selective large scan", () => {
    const result = analyzeRules(
      "SELECT * FROM ecom.orders WHERE order_ts > now() - interval '1 month'",
      plan({
        table: "orders o",
        actualRows: 100,
        details: {
          Filter: "(order_ts > (now() - '1 mon'::interval))",
          "Rows Removed by Filter": "4900",
        },
      }),
    );
    expect(result.suggestions[0].ruleId).toBe("selective_seq_scan");
    expect(result.suggestions[0].suggestedSql).toContain("CREATE INDEX");
  });

  it("emits the verified candidate only for an exact known query", () => {
    const q02 = queries.find((query) => query.id === "q02")!;
    const result = analyzeRules(q02.baseline.sql, plan());
    expect(result.candidateSql).toContain("WITH order_totals");
    expect(result.candidateSql).not.toContain("MATERIALIZED");
  });

  it("keeps index DDL out of the runnable candidate", () => {
    const q03 = queries.find((query) => query.id === "q03")!;
    const result = analyzeRules(q03.baseline.sql, plan());
    expect(q03.tuned.sql).toContain("CREATE INDEX");
    expect(result.candidateSql).toBeDefined();
    expect(result.candidateSql).not.toMatch(/create\s+index/i);
    expect(
      result.suggestions.some((item) =>
        item.suggestedSql?.match(/create\s+index/i),
      ),
    ).toBe(true);
  });

  it("never emits planner join settings", () => {
    const q10 = queries.find((query) => query.id === "q10")!;
    const result = analyzeRules(q10.baseline.sql, plan());
    expect(result.candidateSql).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/enable_(nestloop|hashjoin|mergejoin)/);
  });
});
