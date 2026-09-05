"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { benchmarks as staticBenchmarks, type Benchmark } from '@/data/benchmarks';

export function BufferChart({ benchmarks = staticBenchmarks }: { benchmarks?: Benchmark[] }) {
  const data = benchmarks.map(b => ({
    name: b.id.toUpperCase(),
    Baseline: b.baselineBuffers,
    Optimized: b.optimizedBuffers,
  }));

  return (
    <div className="h-[400px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={50} />
          <Tooltip 
            cursor={{fill: '#15171A'}}
            contentStyle={{ backgroundColor: '#111214', borderColor: '#1E2028', borderRadius: '8px' }}
            itemStyle={{ color: '#EDEDED' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="Baseline" fill="#333333" radius={[0, 4, 4, 0]} />
          <Bar dataKey="Optimized" fill="#F59E0B" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
