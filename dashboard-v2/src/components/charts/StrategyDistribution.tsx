"use client";

import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

const data = [
  { name: 'Pre-aggregation', size: 400, fill: '#00FF88' },
  { name: 'Partial Indexes', size: 300, fill: '#10B981' },
  { name: 'Materialized Views', size: 300, fill: '#059669' },
  { name: 'Merge Join', size: 100, fill: '#047857' },
  { name: 'Correlated Subquery Elimination', size: 150, fill: '#022C22' },
];

export function StrategyDistribution() {
  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#08090A"
          content={<CustomizedContent />}
        >
          <Tooltip 
            formatter={(value, name) => [`${Math.round(Number(value)/1250 * 100)}% usage`, name]}
            contentStyle={{ backgroundColor: '#111214', borderColor: '#1E2028', borderRadius: '8px' }}
            itemStyle={{ color: '#EDEDED' }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { fill?: string };
  name?: string;
}

const CustomizedContent = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  name,
}: TreemapContentProps) => {

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={payload?.fill || "#111214"}
        stroke="#08090A"
        strokeWidth={2}
      />
      {width > 50 && height > 30 ? (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
          fontWeight={500}
        >
          {name}
        </text>
      ) : null}
    </g>
  );
};
