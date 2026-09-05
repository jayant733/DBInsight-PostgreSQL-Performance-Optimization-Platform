"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, DatabaseZap, ShieldCheck } from "lucide-react";
import Link from "next/link";

const exampleSql = `SELECT ROUND(SUM(oi.line_total), 2) AS monthly_revenue
FROM ecom.orders AS o
JOIN ecom.order_items AS oi ON oi.order_id = o.order_id
WHERE o.order_status IN ('paid', 'shipped', 'delivered')
  AND o.order_ts >= now() - INTERVAL '1 month';`;

export default function NewQueryPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [sql, setSql] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sql }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Analysis failed.");
      router.push(`/queries/${data.analysis.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not analyze the query.",
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>

      <header>
        <div className="mb-4 flex items-center gap-3 text-accent">
          <DatabaseZap size={24} />
          <span className="text-xs font-semibold tracking-[0.18em]">
            LIVE POSTGRESQL ANALYZER
          </span>
        </div>
        <h1 className="mb-3 text-4xl font-light tracking-tight">
          Add a new query
        </h1>
        <p className="max-w-3xl text-muted">
          Paste one read-only query. QueryLab will run the real PostgreSQL plan,
          measure time and buffers, then apply conservative optimization rules.
        </p>
      </header>

      <div className="flex gap-3 rounded-lg border border-accent/20 bg-accent/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 shrink-0 text-accent" size={18} />
        <p className="text-foreground/80">
          Only one SELECT or WITH query is accepted. It runs in a read-only
          transaction with an 8-second timeout. Suggested indexes are never
          applied automatically.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-6 rounded-lg border border-border bg-surface-1 p-6"
      >
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
            Query title
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
            placeholder="Example: Revenue by active customer"
            className="w-full rounded-md border border-border bg-surface-0 px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
            PostgreSQL SELECT / WITH
          </span>
          <textarea
            value={sql}
            onChange={(event) => setSql(event.target.value)}
            required
            spellCheck={false}
            placeholder={exampleSql}
            className="min-h-[360px] w-full resize-y rounded-md border border-border bg-surface-0 p-4 font-mono text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted/40 focus:border-accent/60"
          />
        </label>

        {error && (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setTitle("Monthly realized revenue");
              setSql(exampleSql);
            }}
            className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Load example
          </button>
          <button
            type="submit"
            disabled={isRunning || !title.trim() || !sql.trim()}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-surface-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DatabaseZap size={17} />
            {isRunning ? "Analyzing…" : "Analyze & save"}
          </button>
        </div>
      </form>
    </div>
  );
}
