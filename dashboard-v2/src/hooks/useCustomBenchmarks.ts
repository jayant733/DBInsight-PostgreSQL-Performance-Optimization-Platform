"use client";

import { useEffect, useState } from "react";
import type { Benchmark } from "@/data/benchmarks";
import type { AnalysisSummary } from "@/types/analysis";

export function useCustomBenchmarks(): Benchmark[] {
  const [rows, setRows] = useState<Benchmark[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/analyses?limit=100")
      .then(async (response) => {
        if (!response.ok) throw new Error("Analyzer unavailable");
        return response.json();
      })
      .then((data: { analyses?: AnalysisSummary[] }) => {
        if (!active) return;
        setRows(
          (data.analyses ?? [])
            .flatMap((analysis) =>
              analysis.benchmark ? [analysis.benchmark] : [],
            ),
        );
      })
      .catch(() => {
        if (active) setRows([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return rows;
}
