import { Badge } from "./Badge";

interface ComparisonPanelProps {
  title: string;
  executionTime: number;
  buffers: number;
  rows: number;
  strategy: string;
  isOptimized?: boolean;
}

export function ComparisonPanel({ 
  title, 
  executionTime, 
  buffers, 
  rows, 
  strategy,
  isOptimized = false
}: ComparisonPanelProps) {
  return (
    <div className={`p-6 border rounded-lg flex flex-col gap-6 ${isOptimized ? 'bg-surface-1 border-accent/30 shadow-[0_0_15px_rgba(0,255,136,0.05)]' : 'bg-surface-1 border-border'}`}>
      <div className="flex justify-between items-center pb-4 border-b border-border/50">
        <h3 className={`font-semibold tracking-wide ${isOptimized ? 'text-accent' : 'text-muted'}`}>
          {title}
        </h3>
        {isOptimized && <Badge variant="success">OPTIMIZED</Badge>}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Execution Time</div>
          <div className="text-2xl font-light text-foreground">{executionTime.toFixed(3)} ms</div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Buffers (I/O)</div>
          <div className="text-2xl font-light text-foreground">{buffers.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Rows Processed</div>
          <div className="text-lg text-foreground">{rows.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-muted mb-1 uppercase tracking-wider">Strategy</div>
          <div className="text-sm font-mono text-foreground mt-1 px-2 py-1 bg-surface-2 rounded inline-block">{strategy}</div>
        </div>
      </div>
    </div>
  );
}
