import { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ title, value, subtitle, icon, className = "" }: KpiCardProps) {
  return (
    <div className={`bg-surface-1 border border-border rounded-lg p-5 flex flex-col gap-3 transition-colors hover:border-accent/50 ${className}`}>
      <div className="flex justify-between items-center text-muted">
        <h3 className="text-xs font-semibold tracking-wider uppercase">{title}</h3>
        {icon && <div className="text-accent/80">{icon}</div>}
      </div>
      <div className="text-3xl font-light text-foreground">{value}</div>
      <div className="text-sm text-muted">{subtitle}</div>
    </div>
  );
}
