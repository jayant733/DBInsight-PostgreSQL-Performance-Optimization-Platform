"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Database, LayoutDashboard, Search, BarChart3, Network, Target, Plus } from "lucide-react";
import { queries } from "@/data/queries";
import type { AnalysisSummary } from "@/types/analysis";

export function Sidebar() {
  const pathname = usePathname();
  const [customAnalyses, setCustomAnalyses] = useState<AnalysisSummary[]>([]);
  const [databaseAvailable, setDatabaseAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/analyses?limit=25")
      .then(async (response) => {
        if (!response.ok) throw new Error("Database unavailable");
        return response.json();
      })
      .then((data) => {
        if (active) {
          setCustomAnalyses(data.analyses ?? []);
          setDatabaseAvailable(true);
        }
      })
      .catch(() => {
        if (active) setDatabaseAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
    { href: "/plans", label: "Execution Plans", icon: Network },
  ];

  return (
    <div className="w-64 border-r border-border bg-surface-1 h-screen flex flex-col fixed left-0 top-0 overflow-y-auto hidden md:flex">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Target size={18} />
          </div>
          <span className="font-semibold tracking-wider text-sm">QUERYLAB</span>
        </div>

        <div className="mb-8">
          <div className="text-xs font-semibold text-muted tracking-wider mb-3">OVERVIEW</div>
          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === link.href ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground hover:bg-surface-2/50"
                }`}
              >
                <link.icon size={16} className={pathname === link.href ? "text-accent" : ""} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted tracking-wider mb-3">QUERIES</div>
          <div className="space-y-1">
            {queries.map((q) => {
              const href = `/queries/${q.id}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={q.id}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive ? "bg-surface-2 text-foreground border-l-2 border-accent" : "text-muted hover:text-foreground hover:bg-surface-2/50 border-l-2 border-transparent"
                  }`}
                >
                  <Search size={14} className={isActive ? "text-accent" : "opacity-0"} />
                  <span>Q{q.number.toString().padStart(2, "0")} — {q.title}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold text-muted tracking-wider">
              CUSTOM
            </div>
            <Link
              href="/queries/new"
              aria-label="Add new query"
              className="rounded p-1 text-accent hover:bg-accent/10"
            >
              <Plus size={15} />
            </Link>
          </div>
          <Link
            href="/queries/new"
            className={`mb-2 flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
              pathname === "/queries/new"
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/30 hover:text-foreground"
            }`}
          >
            <Plus size={15} />
            Add new query
          </Link>
          <div className="space-y-1">
            {customAnalyses.map((analysis) => {
              const href = `/queries/${analysis.id}`;
              return (
                <Link
                  key={analysis.id}
                  href={href}
                  title={analysis.title}
                  className={`block truncate rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                    pathname === href
                      ? "border-accent bg-surface-2 text-foreground"
                      : "border-transparent text-muted hover:bg-surface-2/50 hover:text-foreground"
                  }`}
                >
                  {analysis.title}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-auto p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-md border border-border">
          <Database size={16} className="text-muted" />
          <div className="flex-1">
            <div className="text-xs font-medium">PostgreSQL 17</div>
            <div className={`text-[10px] flex items-center gap-1.5 mt-0.5 ${
              databaseAvailable === false ? "text-warning" : databaseAvailable === true ? "text-accent" : "text-muted"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                databaseAvailable === false ? "bg-warning" : databaseAvailable === true ? "bg-accent animate-pulse" : "bg-muted"
              }`}></span>
              {databaseAvailable === false
                ? "Analyzer unavailable"
                : databaseAvailable === true
                  ? "Connected"
                  : "Checking…"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
