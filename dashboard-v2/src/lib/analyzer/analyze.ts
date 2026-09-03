import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { CustomAnalysis, ParityResult } from "@/types/analysis";
import { withClient } from "./db";
import { parseExplain } from "./plan";
import {
  createPendingAnalysis,
  getAnalysis,
  updateAnalysis,
} from "./repository";
import { analyzeRules } from "./rules";
import { SqlValidationError, validateReadOnlySql } from "./validate";

const timeoutMs = Math.min(
  Math.max(Number(process.env.ANALYZER_STATEMENT_TIMEOUT_MS ?? 8_000), 1_000),
  30_000,
);

async function explain(client: PoolClient, sql: string) {
  const result = await client.query(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
  );
  return parseExplain(result.rows[0]["QUERY PLAN"]);
}

async function checkParity(
  client: PoolClient,
  baselineSql: string,
  candidateSql: string,
): Promise<ParityResult> {
  const result = await client.query(
    `WITH
      baseline_result AS MATERIALIZED (${baselineSql}),
      candidate_result AS MATERIALIZED (${candidateSql})
    SELECT
      (SELECT count(*)::int FROM (
        SELECT * FROM baseline_result
        EXCEPT ALL
        SELECT * FROM candidate_result
      ) missing) AS missing_rows,
      (SELECT count(*)::int FROM (
        SELECT * FROM candidate_result
        EXCEPT ALL
        SELECT * FROM baseline_result
      ) extra) AS extra_rows`,
  );
  const missingRows = Number(result.rows[0].missing_rows);
  const extraRows = Number(result.rows[0].extra_rows);
  return {
    passed: missingRows === 0 && extraRows === 0,
    missingRows,
    extraRows,
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Unknown analyzer error.";
}

export async function analyzeAndSave(
  title: string,
  originalSql: string,
): Promise<CustomAnalysis> {
  const hash = createHash("sha256").update(originalSql).digest("hex");
  const id = await createPendingAnalysis(title, originalSql, hash);

  let sql: string;
  try {
    sql = validateReadOnlySql(originalSql);
  } catch (error) {
    const reason =
      error instanceof SqlValidationError
        ? error.message
        : "The query was rejected.";
    await updateAnalysis(id, {
      status: "rejected",
      rejectReason: reason,
    });
    return (await getAnalysis(id))!;
  }

  try {
    const result = await withClient(async (client) => {
      await client.query("BEGIN READ ONLY");
      try {
        await client.query(`SET LOCAL statement_timeout = '${timeoutMs}ms'`);
        await client.query("SET LOCAL lock_timeout = '1s'");
        await client.query(
          "SET LOCAL idle_in_transaction_session_timeout = '10s'",
        );
        await client.query("SET LOCAL search_path = ecom, pg_catalog");

        const baseline = await explain(client, sql);
        const ruleResult = analyzeRules(sql, baseline.plan);
        const safeCandidate = (() => {
          if (!ruleResult.candidateSql) return undefined;
          try {
            return validateReadOnlySql(ruleResult.candidateSql);
          } catch {
            return undefined;
          }
        })();

        if (!safeCandidate) {
          await client.query("COMMIT");
          return {
            status: "suggestion_only" as const,
            baseline,
            suggestions: ruleResult.suggestions,
          };
        }

        const candidateSql = safeCandidate;
        const candidate = await explain(client, candidateSql);
        const parity = await checkParity(client, sql, candidateSql);
        await client.query("COMMIT");

        return {
          status: "ok" as const,
          baseline,
          suggestions: ruleResult.suggestions,
          candidateSql,
          candidate,
          parity,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });

    await updateAnalysis(id, {
      status: result.status,
      baselinePlan: result.baseline.plan,
      baselineMetrics: result.baseline.metrics,
      suggestions: result.suggestions,
      candidateSql: result.candidateSql,
      candidatePlan: result.candidate?.plan,
      candidateMetrics: result.candidate?.metrics,
      parity: result.parity,
    });
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    await updateAnalysis(id, {
      status: code === "57014" ? "timeout" : "error",
      error:
        code === "57014"
          ? `The query exceeded the ${timeoutMs / 1_000}-second limit.`
          : safeErrorMessage(error),
    });
  }

  return (await getAnalysis(id))!;
}
