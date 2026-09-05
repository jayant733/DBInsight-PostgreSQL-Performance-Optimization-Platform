"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Trash2,
} from "lucide-react";
import type { CustomAnalysis } from "@/types/analysis";
import { Badge } from "@/components/ui/Badge";
import { ComparisonPanel } from "@/components/ui/ComparisonPanel";
import { SqlViewer } from "@/components/ui/SqlViewer";
import { PlanGraph } from "@/components/plans/PlanGraph";

export function CustomAnalysisDetail({
  analysis,
}: {
  analysis: CustomAnalysis;
}) {
  const router = useRouter();
  const baseline = analysis.baselineMetrics;
  const candidate = analysis.candidateMetrics;

  async function remove() {
    if (!window.confirm("Delete this saved analysis?")) return;
    const response = await fetch(`/api/analyses/${analysis.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="space-y-12 pb-20">
      <header className="border-b border-border/50 pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Badge>LIVE ANALYSIS</Badge>
          <span className="font-mono text-xs text-muted">
            {analysis.id.slice(0, 8)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <Clock3 size={13} />
            {new Date(analysis.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-3 text-4xl font-light tracking-tight">
              {analysis.title}
            </h1>
            <p className="text-muted">
              Measured live against the local PostgreSQL database.
            </p>
          </div>
          <button
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:border-warning/50 hover:text-warning"
          >
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </header>

      {(analysis.status === "rejected" ||
        analysis.status === "error" ||
        analysis.status === "timeout") && (
        <section className="rounded-lg border border-warning/30 bg-warning/10 p-6">
          <div className="mb-2 flex items-center gap-2 font-medium text-warning">
            <AlertTriangle size={18} />
            {analysis.status === "rejected"
              ? "Query rejected"
              : analysis.status === "timeout"
                ? "Query timed out"
                : "Analysis failed"}
          </div>
          <p className="text-sm text-foreground/80">
            {analysis.rejectReason ?? analysis.error}
          </p>
        </section>
      )}

      {baseline && (
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-medium">Performance comparison</h2>
            {analysis.parity?.passed && (
              <Badge variant="success">EXACT MATCH ✓</Badge>
            )}
          </div>
          <div
            className={`grid grid-cols-1 gap-6 ${
              candidate ? "lg:grid-cols-2" : ""
            }`}
          >
            <ComparisonPanel
              title="BASELINE"
              executionTime={baseline.executionTime}
              buffers={baseline.buffers}
              rows={baseline.rows}
              strategy={baseline.strategy}
            />
            {candidate && (
              <ComparisonPanel
                title="RULE CANDIDATE"
                executionTime={candidate.executionTime}
                buffers={candidate.buffers}
                rows={candidate.rows}
                strategy={candidate.strategy}
                isOptimized={
                  analysis.parity?.passed === true &&
                  candidate.executionTime < baseline.executionTime
                }
              />
            )}
          </div>
          {!candidate && (
            <p className="mt-4 text-sm text-muted">
              No provably safe rewrite was generated, so optimized metrics are
              intentionally not shown.
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-6 text-xl font-medium">SQL</h2>
        <div
          className={`grid min-h-[420px] grid-cols-1 gap-6 ${
            analysis.candidateSql ? "lg:grid-cols-2" : ""
          }`}
        >
          <SqlViewer code={analysis.sql} title="Submitted SQL" />
          {analysis.candidateSql && (
            <SqlViewer
              code={analysis.candidateSql}
              title="Rule-generated candidate"
            />
          )}
        </div>
      </section>

      {analysis.suggestions.length > 0 && (
        <section>
          <h2 className="mb-6 text-xl font-medium">Optimization advice</h2>
          <div className="space-y-4">
            {analysis.suggestions.map((suggestion) => (
              <article
                key={`${suggestion.ruleId}-${suggestion.title}`}
                className="rounded-lg border border-border bg-surface-1 p-6"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Lightbulb size={17} className="text-accent" />
                  <h3 className="font-medium">{suggestion.title}</h3>
                  <Badge
                    variant={
                      suggestion.severity === "warning"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    {suggestion.severity}
                  </Badge>
                </div>
                <p className="text-sm leading-6 text-muted">
                  {suggestion.message}
                </p>
                {suggestion.suggestedSql && (
                  <div className="mt-4 min-h-[150px]">
                    <SqlViewer
                      code={suggestion.suggestedSql}
                      title="Suggested index SQL — not applied"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {analysis.baselinePlan && (
        <section>
          <h2 className="mb-6 text-xl font-medium">Execution plans</h2>
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Baseline plan
              </h3>
              <PlanGraph plan={analysis.baselinePlan} />
            </div>
            {analysis.candidatePlan && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Candidate plan
                </h3>
                <PlanGraph plan={analysis.candidatePlan} />
              </div>
            )}
          </div>
        </section>
      )}

      {analysis.parity && (
        <section className="rounded-lg border border-border bg-surface-1 p-6">
          <div
            className={`flex items-center gap-2 font-medium ${
              analysis.parity.passed ? "text-accent" : "text-warning"
            }`}
          >
            {analysis.parity.passed ? (
              <CheckCircle2 size={19} />
            ) : (
              <AlertTriangle size={19} />
            )}
            {analysis.parity.passed
              ? "Exact result parity passed"
              : "Candidate rejected: results differ"}
          </div>
          <p className="mt-2 text-sm text-muted">
            Missing rows: {analysis.parity.missingRows.toLocaleString()} · Extra
            rows: {analysis.parity.extraRows.toLocaleString()}
          </p>
        </section>
      )}
    </div>
  );
}
