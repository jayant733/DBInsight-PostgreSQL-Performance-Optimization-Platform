import type { PlanNode, QueryMetrics } from "@/types/analysis";

type ExplainNode = Record<string, unknown> & { Plans?: ExplainNode[] };
type ExplainDocument = {
  Plan: ExplainNode;
  "Planning Time"?: number;
  "Execution Time"?: number;
};

const DETAIL_KEYS = [
  "Filter",
  "Index Cond",
  "Hash Cond",
  "Merge Cond",
  "Join Filter",
  "Sort Key",
  "Group Key",
  "Rows Removed by Filter",
  "Index Name",
  "Actual Loops",
  "Subplan Name",
  "Parent Relationship",
] as const;

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function convertNode(node: ExplainNode, path: string): PlanNode {
  const details: Record<string, string> = {};
  for (const key of DETAIL_KEYS) {
    if (node[key] !== undefined) {
      details[key] = Array.isArray(node[key])
        ? (node[key] as unknown[]).join(", ")
        : String(node[key]);
    }
  }

  const sharedHitBlocks = numberValue(node["Shared Hit Blocks"]);
  const sharedReadBlocks = numberValue(node["Shared Read Blocks"]);

  return {
    id: `live-${path}`,
    type: String(node["Node Type"] ?? "Unknown"),
    table: node["Relation Name"]
      ? `${node["Relation Name"]}${node.Alias ? ` ${node.Alias}` : ""}`
      : undefined,
    actualRows: numberValue(node["Actual Rows"]),
    estimatedRows: numberValue(node["Plan Rows"]),
    executionTime: numberValue(node["Actual Total Time"]),
    buffers: sharedHitBlocks + sharedReadBlocks,
    cost: `${numberValue(node["Startup Cost"]).toFixed(2)}..${numberValue(
      node["Total Cost"],
    ).toFixed(2)}`,
    details,
    children: node.Plans?.map((child, index) =>
      convertNode(child, `${path}-${index}`),
    ),
  };
}

export function parseExplain(rawValue: unknown): {
  raw: ExplainDocument;
  plan: PlanNode;
  metrics: QueryMetrics;
} {
  let value = rawValue;
  if (typeof value === "string") value = JSON.parse(value);
  const document = (Array.isArray(value) ? value[0] : value) as ExplainDocument;

  if (!document?.Plan) {
    throw new Error("PostgreSQL returned an invalid EXPLAIN document.");
  }

  const plan = convertNode(document.Plan, "root");
  return {
    raw: document,
    plan,
    metrics: {
      executionTime: numberValue(
        document["Execution Time"] ?? document.Plan["Actual Total Time"],
      ),
      buffers: plan.buffers,
      sharedHitBlocks: numberValue(document.Plan["Shared Hit Blocks"]),
      sharedReadBlocks: numberValue(document.Plan["Shared Read Blocks"]),
      rows: numberValue(document.Plan["Actual Rows"]),
      strategy: String(document.Plan["Node Type"] ?? "Unknown"),
    },
  };
}

export function flattenPlan(root: PlanNode): PlanNode[] {
  return [root, ...(root.children?.flatMap(flattenPlan) ?? [])];
}
