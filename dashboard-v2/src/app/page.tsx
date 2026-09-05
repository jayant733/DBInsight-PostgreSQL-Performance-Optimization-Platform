"use client";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ExecutionTimeChart } from "@/components/charts/ExecutionTimeChart";
import { BufferChart } from "@/components/charts/BufferChart";
import { StrategyDistribution } from "@/components/charts/StrategyDistribution";
import { benchmarks as staticBenchmarks } from "@/data/benchmarks";
import { Activity, Zap, HardDrive, CheckCircle2, Plus } from "lucide-react";
import Link from "next/link";
import { useCustomBenchmarks } from "@/hooks/useCustomBenchmarks";

export default function Dashboard() {
  const customBenchmarks = useCustomBenchmarks();
  const benchmarks = [...staticBenchmarks, ...customBenchmarks];
  const averageSpeedup =
    benchmarks.reduce((sum, benchmark) => sum + benchmark.speedup, 0) /
    benchmarks.length;
  const maxBufferReduction = Math.max(
    ...benchmarks.map((benchmark) => benchmark.bufferReduction),
  );
  const verifiedCount = benchmarks.filter(
    (benchmark) => benchmark.correctness,
  ).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-light tracking-tight mb-2">PostgreSQL Query Optimization Lab</h1>
          <p className="text-muted tracking-wide text-sm flex items-center gap-2">
            <span>Measure</span>
            <span className="text-border">→</span>
            <span>Optimize</span>
            <span className="text-border">→</span>
            <span>Compare</span>
            <span className="text-border">→</span>
            <span className="text-accent">Verify</span>
          </p>
        </div>
        <Link
          href="/queries/new"
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-surface-0"
        >
          <Plus size={16} />
          Add new query
        </Link>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Queries Tested" 
          value={benchmarks.length} 
          subtitle="Verified comparisons"
          icon={<Activity size={18} />}
        />
        <KpiCard 
          title="Avg Speedup" 
          value={`${averageSpeedup.toFixed(1)}%`} 
          subtitle="Across all queries"
          icon={<Zap size={18} />}
        />
        <KpiCard 
          title="Buffer Reduction" 
          value={`${maxBufferReduction.toFixed(1)}%`} 
          subtitle="Largest measured reduction"
          icon={<HardDrive size={18} />}
        />
        <KpiCard 
          title="Correctness" 
          value={`${verifiedCount}/${benchmarks.length}`} 
          subtitle="Exact match verified"
          icon={<CheckCircle2 size={18} />}
          className="border-accent/30 shadow-[0_0_15px_rgba(0,255,136,0.05)]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-1 border border-border rounded-lg p-6 flex flex-col">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted mb-6">Execution Time Comparison (ms)</h2>
          <div className="flex-1 min-h-[400px]">
            <ExecutionTimeChart benchmarks={benchmarks} />
          </div>
        </div>
        
        <div className="bg-surface-1 border border-border rounded-lg p-6 flex flex-col">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted mb-6">Buffer Usage Comparison (I/O)</h2>
          <div className="flex-1 min-h-[400px]">
            <BufferChart benchmarks={benchmarks} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-1 border border-border rounded-lg p-6">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted mb-6">Performance Summary</h2>
          <DataTable 
            data={benchmarks}
            columns={[
              { 
                header: "Query", 
                accessorKey: "id",
                cell: (item) => (
                  <Link href={`/queries/${item.id}`} className="font-mono text-accent hover:underline">
                    {/^q\d+$/i.test(item.id) ? item.id.toUpperCase() : "CUSTOM"}
                  </Link>
                )
              },
              { header: "Optimization", accessorKey: "optimization", className: "max-w-[200px] truncate" },
              { 
                header: "Speedup", 
                accessorKey: "speedup",
                cell: (item) => (
                  <span className={item.speedup > 0 ? "text-accent" : item.speedup < 0 ? "text-warning" : "text-muted"}>
                    {item.speedup > 0 ? "+" : ""}{item.speedup.toFixed(1)}%
                  </span>
                )
              },
              { 
                header: "Base (ms)", 
                accessorKey: "baselineTime",
                cell: (item) => <span className="font-mono text-muted">{item.baselineTime.toFixed(2)}</span>
              },
              { 
                header: "Opt (ms)", 
                accessorKey: "optimizedTime",
                cell: (item) => <span className="font-mono text-foreground">{item.optimizedTime.toFixed(2)}</span>
              },
              { 
                header: "Correctness", 
                accessorKey: "correctness",
                cell: (item) => (
                  <Badge variant={item.correctness ? "success" : "warning"}>
                    {item.correctness ? "PASS" : "FAIL"}
                  </Badge>
                )
              }
            ]}
          />
        </div>
        
        <div className="bg-surface-1 border border-border rounded-lg p-6 flex flex-col">
          <h2 className="text-sm font-semibold tracking-wider uppercase text-muted mb-6">Strategy Distribution</h2>
          <div className="flex-1 min-h-[300px]">
            <StrategyDistribution />
          </div>
        </div>
      </div>
    </div>
  );
}
