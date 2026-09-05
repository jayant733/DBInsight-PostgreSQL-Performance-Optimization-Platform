import { queries } from "@/data/queries";
import { executionPlans } from "@/data/executionPlans";
import { PlanGraph } from "@/components/plans/PlanGraph";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listAnalysesWithPlans } from "@/lib/analyzer/repository";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const plansWithData = queries.filter(q => executionPlans[q.id]);
  let customPlans: Awaited<ReturnType<typeof listAnalysesWithPlans>> = [];
  try {
    customPlans = await listAnalysesWithPlans();
  } catch {
    // The built-in plans remain usable while local PostgreSQL is offline.
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="mb-10">
        <h1 className="text-3xl font-light tracking-tight mb-2">Execution Plan Visualization</h1>
        <p className="text-muted tracking-wide text-sm max-w-2xl">
          Interactive node graphs representing the PostgreSQL query planner&apos;s execution strategies.
          Blue nodes represent data scans, purple for joins, and yellow for aggregations.
        </p>
      </header>

      <div className="space-y-16">
        {plansWithData.map((query) => {
          const plan = executionPlans[query.id];
          if (!plan) return null;

          return (
            <section key={query.id} className="border border-border rounded-lg bg-surface-1 overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-surface-2/30 flex justify-between items-center">
                <div>
                  <h2 className="font-semibold tracking-wide text-foreground">
                    Q{query.number.toString().padStart(2, '0')} — {query.title}
                  </h2>
                  <div className="text-sm text-muted mt-1">{query.optimization}</div>
                </div>
                <Link href={`/queries/${query.id}`} className="text-sm text-accent hover:underline flex items-center gap-1">
                  View full analysis <ArrowRight size={14} />
                </Link>
              </div>
              
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs font-semibold tracking-wider text-muted uppercase mb-4">Baseline Plan</h3>
                  <div className="text-sm font-mono text-muted mb-4 bg-surface-0 p-2 rounded inline-block">
                    {query.baseline.strategy}
                  </div>
                  <PlanGraph plan={plan.baseline} />
                </div>
                <div>
                  <h3 className="text-xs font-semibold tracking-wider text-muted uppercase mb-4">Optimized Plan</h3>
                  <div className="text-sm font-mono text-accent mb-4 bg-surface-0 p-2 rounded inline-block">
                    {query.tuned.strategy}
                  </div>
                  <PlanGraph plan={plan.tuned} />
                </div>
              </div>
            </section>
          );
        })}

        {customPlans.map((analysis) => (
          <section
            key={analysis.id}
            className="overflow-hidden rounded-lg border border-border bg-surface-1"
          >
            <div className="flex items-center justify-between border-b border-border bg-surface-2/30 px-6 py-4">
              <div>
                <h2 className="font-semibold tracking-wide text-foreground">
                  Live — {analysis.title}
                </h2>
                <div className="mt-1 text-sm text-muted">
                  {analysis.candidatePlan
                    ? "Measured candidate and exact result check"
                    : "Baseline plan with suggestion-only analysis"}
                </div>
              </div>
              <Link
                href={`/queries/${analysis.id}`}
                className="flex items-center gap-1 text-sm text-accent hover:underline"
              >
                View full analysis <ArrowRight size={14} />
              </Link>
            </div>

            <div
              className={`grid grid-cols-1 gap-8 p-6 ${
                analysis.candidatePlan ? "xl:grid-cols-2" : ""
              }`}
            >
              {analysis.baselinePlan && (
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Baseline Plan
                  </h3>
                  <PlanGraph plan={analysis.baselinePlan} />
                </div>
              )}
              {analysis.candidatePlan && (
                <div>
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
                    Rule Candidate Plan
                  </h3>
                  <PlanGraph plan={analysis.candidatePlan} />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
