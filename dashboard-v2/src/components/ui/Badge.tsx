interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "warning" | "neutral";
}

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  const variants = {
    success: "bg-accent/10 text-accent border border-accent/20",
    warning: "bg-warning/10 text-warning border border-warning/20",
    neutral: "bg-surface-2 text-muted border border-border"
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}
