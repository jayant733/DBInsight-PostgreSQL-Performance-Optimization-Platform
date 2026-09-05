import { Handle, Position } from '@xyflow/react';
import { Database, Layers, ArrowDownUp, FastForward, Sigma, Hash } from 'lucide-react';
import { PlanNode as PlanNodeType } from '@/data/executionPlans';

interface PlanNodeProps {
  data: PlanNodeType;
}

export function PlanNode({ data }: PlanNodeProps) {
  const isScan = data.type.includes('Scan');
  const isJoin = data.type.includes('Join');
  const isAgg = data.type.includes('Aggregate') || data.type.includes('WindowAgg');
  const isSort = data.type.includes('Sort');

  let borderColor = 'border-border';
  let bgColor = 'bg-surface-1';
  let icon = <Layers size={14} />;

  if (isScan) {
    borderColor = 'border-blue-500/50';
    bgColor = 'bg-blue-500/10';
    icon = <Database size={14} className="text-blue-500" />;
  } else if (isJoin) {
    borderColor = 'border-purple-500/50';
    bgColor = 'bg-purple-500/10';
    icon = <ArrowDownUp size={14} className="text-purple-500" />;
  } else if (isAgg) {
    borderColor = 'border-amber-500/50';
    bgColor = 'bg-amber-500/10';
    icon = <Sigma size={14} className="text-amber-500" />;
  } else if (isSort) {
    borderColor = 'border-accent/50';
    bgColor = 'bg-accent/10';
    icon = <FastForward size={14} className="text-accent" />;
  } else {
    icon = <Hash size={14} className="text-muted" />;
  }

  return (
    <div className={`px-4 py-2 shadow-md rounded-md border ${borderColor} ${bgColor} min-w-[200px]`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-muted border-none" />
      
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/50">
        {icon}
        <div className="font-semibold text-xs tracking-wide">{data.type}</div>
      </div>
      
      {data.table && (
        <div className="text-[10px] text-muted mb-2 uppercase tracking-wider font-mono bg-surface-0 px-2 py-1 rounded inline-block">
          {data.table}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="text-muted">Time:</div>
        <div className="text-right font-mono">{data.executionTime.toFixed(3)}ms</div>
        
        <div className="text-muted">Rows:</div>
        <div className="text-right font-mono">{data.actualRows}</div>
        
        <div className="text-muted">Buffers:</div>
        <div className="text-right font-mono">{data.buffers}</div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-muted border-none" />
    </div>
  );
}
