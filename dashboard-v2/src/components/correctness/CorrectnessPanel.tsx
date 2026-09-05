import { Badge } from "../ui/Badge";
import { QueryScenario } from "@/data/queries";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface CorrectnessPanelProps {
  data: QueryScenario['correctness'];
}

export function CorrectnessPanel({ data }: CorrectnessPanelProps) {
  const isExactMatch = data.mismatchRows === 0 && data.baselineRows === data.optimizedRows;

  return (
    <div className="border border-border rounded-lg bg-surface-1 overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-surface-2/30 flex justify-between items-center">
        <h3 className="font-semibold tracking-wide text-foreground">Correctness Verification</h3>
        <Badge variant={isExactMatch ? "success" : "warning"}>
          {isExactMatch ? "EXACT MATCH ✓" : "MISMATCH"}
        </Badge>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">Baseline rows</span>
            <span className="font-mono text-foreground">{data.baselineRows.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">Optimized rows</span>
            <span className="font-mono text-foreground">{data.optimizedRows.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">Result comparison</span>
            <span className={`font-medium flex items-center gap-2 ${isExactMatch ? 'text-accent' : 'text-warning'}`}>
              {isExactMatch ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {isExactMatch ? "PASSED" : "FAILED"}
            </span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">Boundary tests</span>
            <span className="text-accent flex items-center gap-2"><CheckCircle2 size={16} /> {data.boundaryTests}</span>
          </div>
          
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">NULL handling</span>
            <span className="text-accent flex items-center gap-2"><CheckCircle2 size={16} /> {data.nullHandling}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border/50">
            <span className="text-muted">Duplicate handling</span>
            <span className="text-accent flex items-center gap-2"><CheckCircle2 size={16} /> {data.duplicateHandling}</span>
          </div>
        </div>
        
        {isExactMatch && (
          <div className="mt-8 p-4 bg-accent/10 border border-accent/20 rounded-md flex items-center justify-center gap-2 text-accent font-medium tracking-wide">
            <CheckCircle2 size={18} />
            Optimization Accepted
          </div>
        )}
      </div>
    </div>
  );
}
