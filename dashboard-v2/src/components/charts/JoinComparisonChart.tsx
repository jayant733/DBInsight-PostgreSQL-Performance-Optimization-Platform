"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Nested Loop', 'Execution Time': 690.5 },
  { name: 'Hash Join', 'Execution Time': 120.3 },
  { name: 'Merge Join', 'Execution Time': 2.188 },
];

export function JoinComparisonChart() {
  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} unit=" ms" />
          <Tooltip 
            cursor={{fill: '#15171A'}}
            contentStyle={{ backgroundColor: '#111214', borderColor: '#1E2028', borderRadius: '8px' }}
            itemStyle={{ color: '#EDEDED' }}
          />
          <Bar dataKey="Execution Time" fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
