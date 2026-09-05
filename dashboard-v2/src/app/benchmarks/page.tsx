"use client";

import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { benchmarks as staticBenchmarks } from "@/data/benchmarks";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCustomBenchmarks } from "@/hooks/useCustomBenchmarks";

export default function BenchmarksPage() {
  const benchmarks = [...staticBenchmarks, ...useCustomBenchmarks()];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="mb-10">
        <h1 className="text-3xl font-light tracking-tight mb-2">Comprehensive Benchmarks</h1>
        <p className="text-muted tracking-wide text-sm">
          The 10 built-in scenarios plus saved custom analyses with verified candidates.
        </p>
      </header>

      <div className="bg-surface-1 border border-border rounded-lg p-6">
        <DataTable 
          data={benchmarks}
          columns={[
            { 
              header: "Query", 
              accessorKey: "id",
              cell: (item) => (
                <Link href={`/queries/${item.id}`} className="font-mono text-accent hover:underline flex items-center gap-2">
                  {/^q\d+$/i.test(item.id) ? item.id.toUpperCase() : "CUSTOM"}
                  <ArrowRight size={14} className="opacity-50" />
                </Link>
              )
            },
            { header: "Description", accessorKey: "query" },
            { header: "Optimization Applied", accessorKey: "optimization" },
            { 
              header: "Time Speedup", 
              accessorKey: "speedup",
              cell: (item) => (
                <span className={item.speedup > 0 ? "text-accent" : item.speedup < 0 ? "text-warning" : "text-muted"}>
                  {item.speedup > 0 ? "+" : ""}{item.speedup.toFixed(1)}%
                </span>
              )
            },
            { 
              header: "Buffer Reduction", 
              accessorKey: "bufferReduction",
              cell: (item) => (
                <span className={item.bufferReduction > 0 ? "text-accent" : "text-muted"}>
                  {item.bufferReduction > 0 ? "-" : ""}{item.bufferReduction.toFixed(1)}%
                </span>
              )
            },
            { 
              header: "Base Time", 
              accessorKey: "baselineTime",
              cell: (item) => <span className="font-mono text-muted">{item.baselineTime.toFixed(3)} ms</span>
            },
            { 
              header: "Opt Time", 
              accessorKey: "optimizedTime",
              cell: (item) => <span className="font-mono text-foreground">{item.optimizedTime.toFixed(3)} ms</span>
            },
            { 
              header: "Base Buffers", 
              accessorKey: "baselineBuffers",
              cell: (item) => <span className="font-mono text-muted">{item.baselineBuffers.toLocaleString()}</span>
            },
            { 
              header: "Opt Buffers", 
              accessorKey: "optimizedBuffers",
              cell: (item) => <span className="font-mono text-foreground">{item.optimizedBuffers.toLocaleString()}</span>
            },
            { 
              header: "Verify", 
              accessorKey: "correctness",
              cell: (item) => (
                <Badge variant={item.correctness ? "success" : "warning"}>
                  {item.correctness ? "PASS ✓" : "FAIL"}
                </Badge>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
