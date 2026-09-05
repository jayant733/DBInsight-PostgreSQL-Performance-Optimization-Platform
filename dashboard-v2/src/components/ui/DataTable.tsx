"use client";

import { ReactNode } from "react";

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
}

export function DataTable<T>({ data, columns, onRowClick }: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto border border-border rounded-lg bg-surface-1">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted uppercase bg-surface-2/50 border-b border-border">
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={`px-4 py-3 font-medium ${col.className || ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr 
              key={i} 
              onClick={() => onRowClick && onRowClick(row)}
              className={`border-b border-border/50 last:border-0 hover:bg-surface-2/30 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
            >
              {columns.map((col, j) => (
                <td key={j} className={`px-4 py-3 whitespace-nowrap ${col.className || ""}`}>
                  {col.cell
                    ? col.cell(row)
                    : (row[col.accessorKey as keyof T] as ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
