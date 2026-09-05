import { notFound } from "next/navigation";
import { queries } from "@/data/queries";
import { executionPlans } from "@/data/executionPlans";
import { ComparisonPanel } from "@/components/ui/ComparisonPanel";
import { SqlViewer } from "@/components/ui/SqlViewer";
import { PlanGraph } from "@/components/plans/PlanGraph";
import { CorrectnessPanel } from "@/components/correctness/CorrectnessPanel";
import { Badge } from "@/components/ui/Badge";
import { JoinComparisonChart } from "@/components/charts/JoinComparisonChart";
import { CustomAnalysisDetail } from "@/components/analysis/CustomAnalysisDetail";
import { getAnalysis } from "@/lib/analyzer/repository";

export const dynamicParams = true;

export function generateStaticParams() {
  return queries.map((q) => ({
    id: q.id,
  }));
}

export default async function QueryDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const query = queries.find((q) => q.id === params.id);
  
  if (!query) {
    let customAnalysis = null;
    try {
      customAnalysis = await getAnalysis(params.id);
    } catch {
      // Treat an unavailable or unknown custom analysis as not found.
    }
    if (!customAnalysis) notFound();
    return <CustomAnalysisDetail analysis={customAnalysis} />;
  }

  const plan = executionPlans[query.id];

  const bufferReduction = ((query.baseline.buffers - query.tuned.buffers) / query.baseline.buffers) * 100;

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <header className="border-b border-border/50 pb-8">
        <div className="flex items-center gap-4 mb-3">
          <Badge>{query.tag}</Badge>
          <span className="text-muted text-sm font-mono">{query.id.toUpperCase()}</span>
        </div>
        <h1 className="text-4xl font-light tracking-tight mb-4">
          Q{query.number.toString().padStart(2, '0')} — {query.title}
        </h1>
        <p className="text-muted text-lg max-w-3xl">
          {query.goal}
        </p>
        <div className="mt-6 flex gap-2">
          <Badge variant="success">Optimization: {query.optimization}</Badge>
        </div>
      </header>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">Performance Comparison</h2>
          <div className="text-accent font-mono">
            {bufferReduction > 0 && `${bufferReduction.toFixed(1)}% fewer buffers`}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ComparisonPanel
            title="BASELINE"
            executionTime={query.baseline.executionTime}
            buffers={query.baseline.buffers}
            rows={query.baseline.rows}
            strategy={query.baseline.strategy}
          />
          
          <ComparisonPanel
            title="OPTIMIZED"
            executionTime={query.tuned.executionTime}
            buffers={query.tuned.buffers}
            rows={query.tuned.rows}
            strategy={query.tuned.strategy}
            isOptimized={true}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-6">SQL Implementation</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
          <SqlViewer code={query.baseline.sql} title="Baseline SQL" />
          <SqlViewer code={query.tuned.sql} title="Optimized SQL" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-medium mb-6">Execution Plan Analysis</h2>
        {plan ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-muted uppercase mb-4">Optimized Plan Graph</h3>
              <PlanGraph plan={plan.tuned} />
            </div>
          </div>
        ) : (
          <div className="p-12 border border-border border-dashed rounded-lg flex items-center justify-center text-muted">
            Execution plan visualization not available for this query.
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-medium mb-6">Correctness Verification</h2>
          <CorrectnessPanel data={query.correctness} />
        </div>
        
        <div>
          <h2 className="text-xl font-medium mb-6">Key Insight</h2>
          <div className="bg-surface-1 border border-border rounded-lg p-6 h-[calc(100%-3rem)] flex flex-col justify-center">
            <p className="text-lg leading-relaxed text-foreground/90 font-light border-l-2 border-accent pl-6">
              &ldquo;{query.keyInsight}&rdquo;
            </p>
            {query.id === "q10" && (
              <div className="mt-8">
                <JoinComparisonChart />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
