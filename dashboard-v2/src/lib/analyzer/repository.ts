import type {
  AnalysisStatus,
  AnalysisSummary,
  CustomAnalysis,
  OptimizationSuggestion,
  ParityResult,
  PlanNode,
  QueryMetrics,
} from "@/types/analysis";
import { queryRows } from "./db";

interface AnalysisRow {
  id: string;
  title: string;
  created_at: Date | string;
  sql_text: string;
  status: AnalysisStatus;
  reject_reason: string | null;
  baseline_plan: PlanNode | null;
  baseline_metrics: QueryMetrics | null;
  suggestions: OptimizationSuggestion[] | null;
  candidate_sql: string | null;
  candidate_plan: PlanNode | null;
  candidate_metrics: QueryMetrics | null;
  parity: ParityResult | null;
  error: string | null;
}

function toAnalysis(row: AnalysisRow): CustomAnalysis {
  return {
    id: row.id,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
    sql: row.sql_text,
    status: row.status,
    rejectReason: row.reject_reason ?? undefined,
    baselinePlan: row.baseline_plan ?? undefined,
    baselineMetrics: row.baseline_metrics ?? undefined,
    suggestions: row.suggestions ?? [],
    candidateSql: row.candidate_sql ?? undefined,
    candidatePlan: row.candidate_plan ?? undefined,
    candidateMetrics: row.candidate_metrics ?? undefined,
    parity: row.parity ?? undefined,
    error: row.error ?? undefined,
  };
}

export async function createPendingAnalysis(
  title: string,
  sql: string,
  sqlHash: string,
): Promise<string> {
  const rows = await queryRows<{ id: string }>(
    `INSERT INTO analyzer.analyses
       (title, sql_text, sql_hash, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id`,
    [title, sql, sqlHash],
  );
  return rows[0].id;
}

export async function updateAnalysis(
  id: string,
  values: {
    status: AnalysisStatus;
    rejectReason?: string;
    baselinePlan?: PlanNode;
    baselineMetrics?: QueryMetrics;
    suggestions?: OptimizationSuggestion[];
    candidateSql?: string;
    candidatePlan?: PlanNode;
    candidateMetrics?: QueryMetrics;
    parity?: ParityResult;
    error?: string;
  },
): Promise<void> {
  await queryRows(
    `UPDATE analyzer.analyses
     SET status = $2,
         reject_reason = $3,
         baseline_plan = $4,
         baseline_metrics = $5,
         suggestions = $6,
         candidate_sql = $7,
         candidate_plan = $8,
         candidate_metrics = $9,
         parity = $10,
         error = $11,
         updated_at = now()
     WHERE id = $1`,
    [
      id,
      values.status,
      values.rejectReason ?? null,
      values.baselinePlan ? JSON.stringify(values.baselinePlan) : null,
      values.baselineMetrics ? JSON.stringify(values.baselineMetrics) : null,
      JSON.stringify(values.suggestions ?? []),
      values.candidateSql ?? null,
      values.candidatePlan ? JSON.stringify(values.candidatePlan) : null,
      values.candidateMetrics ? JSON.stringify(values.candidateMetrics) : null,
      values.parity ? JSON.stringify(values.parity) : null,
      values.error ?? null,
    ],
  );
}

export async function getAnalysis(
  id: string,
): Promise<CustomAnalysis | null> {
  const rows = await queryRows<AnalysisRow>(
    `SELECT id, title, created_at, sql_text, status, reject_reason,
            baseline_plan, baseline_metrics, suggestions, candidate_sql,
            candidate_plan, candidate_metrics, parity, error
     FROM analyzer.analyses
     WHERE id = $1`,
    [id],
  );
  return rows[0] ? toAnalysis(rows[0]) : null;
}

export async function listAnalyses(limit = 50): Promise<AnalysisSummary[]> {
  const rows = await queryRows<AnalysisRow>(
    `SELECT id, title, created_at, sql_text, status, reject_reason,
            baseline_plan, baseline_metrics, suggestions, candidate_sql,
            candidate_plan, candidate_metrics, parity, error
     FROM analyzer.analyses
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );

  return rows.map((row) => {
    const analysis = toAnalysis(row);
    const baseline = analysis.baselineMetrics;
    const candidate = analysis.candidateMetrics;
    const hasComparison =
      baseline && candidate && analysis.parity?.passed === true;

    return {
      id: analysis.id,
      title: analysis.title,
      createdAt: analysis.createdAt,
      status: analysis.status,
      benchmark: hasComparison
        ? {
            id: analysis.id,
            query: analysis.title,
            optimization:
              analysis.suggestions[0]?.title ?? "Rule-based optimization",
            baselineTime: baseline.executionTime,
            optimizedTime: candidate.executionTime,
            speedup:
              ((baseline.executionTime - candidate.executionTime) /
                baseline.executionTime) *
              100,
            baselineBuffers: baseline.buffers,
            optimizedBuffers: candidate.buffers,
            bufferReduction:
              baseline.buffers > 0
                ? ((baseline.buffers - candidate.buffers) / baseline.buffers) *
                  100
                : 0,
            correctness: true,
          }
        : undefined,
    };
  });
}

export async function listAnalysesWithPlans(
  limit = 20,
): Promise<CustomAnalysis[]> {
  const rows = await queryRows<AnalysisRow>(
    `SELECT id, title, created_at, sql_text, status, reject_reason,
            baseline_plan, baseline_metrics, suggestions, candidate_sql,
            candidate_plan, candidate_metrics, parity, error
     FROM analyzer.analyses
     WHERE baseline_plan IS NOT NULL
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 50)],
  );
  return rows.map(toAnalysis);
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const rows = await queryRows<{ id: string }>(
    "DELETE FROM analyzer.analyses WHERE id = $1 RETURNING id",
    [id],
  );
  return rows.length > 0;
}
