export type AnalysisStatus =
  | "pending"
  | "ok"
  | "suggestion_only"
  | "rejected"
  | "timeout"
  | "error";

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

export interface QueryMetrics {
  executionTime: number;
  buffers: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  rows: number;
  strategy: string;
}

export interface OptimizationSuggestion {
  ruleId: string;
  severity: "info" | "opportunity" | "warning";
  title: string;
  message: string;
  suggestedSql?: string;
}

export interface ParityResult {
  passed: boolean;
  missingRows: number;
  extraRows: number;
}

export interface CustomAnalysis {
  id: string;
  title: string;
  createdAt: string;
  sql: string;
  status: AnalysisStatus;
  rejectReason?: string;
  baselinePlan?: PlanNode;
  baselineMetrics?: QueryMetrics;
  suggestions: OptimizationSuggestion[];
  candidateSql?: string;
  candidatePlan?: PlanNode;
  candidateMetrics?: QueryMetrics;
  parity?: ParityResult;
  error?: string;
}

export interface AnalysisSummary {
  id: string;
  title: string;
  createdAt: string;
  status: AnalysisStatus;
  benchmark?: {
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
  };
}
