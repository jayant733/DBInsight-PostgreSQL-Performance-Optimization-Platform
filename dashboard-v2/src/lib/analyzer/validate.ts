import { parse } from "pgsql-ast-parser";

const MAX_SQL_LENGTH = 16_384;
const FORBIDDEN_NODE_TYPES = new Set([
  "insert",
  "update",
  "delete",
  "create table",
  "create index",
  "alter table",
  "drop table",
  "truncate table",
  "set",
]);
const FORBIDDEN_FUNCTIONS = [
  "pg_sleep",
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "lo_import",
  "lo_export",
  "set_config",
  "dblink",
];

export class SqlValidationError extends Error {}

function inspectNode(value: unknown): void {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach(inspectNode);
    return;
  }

  const node = value as Record<string, unknown>;
  if (typeof node.type === "string" && FORBIDDEN_NODE_TYPES.has(node.type)) {
    throw new SqlValidationError(`SQL operation "${node.type}" is not allowed.`);
  }
  if ("into" in node && node.into) {
    throw new SqlValidationError("SELECT INTO is not allowed.");
  }
  if ("for" in node && node.for) {
    throw new SqlValidationError("Row-locking SELECT statements are not allowed.");
  }

  Object.values(node).forEach(inspectNode);
}

export function validateReadOnlySql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) throw new SqlValidationError("Enter a SQL query.");
  if (trimmed.length > MAX_SQL_LENGTH) {
    throw new SqlValidationError("SQL must be 16 KB or smaller.");
  }

  let statements;
  try {
    statements = parse(trimmed);
  } catch {
    throw new SqlValidationError(
      "The query could not be parsed. Use one PostgreSQL SELECT or WITH query.",
    );
  }

  if (
    statements.length !== 1 ||
    !["select", "with"].includes(statements[0]?.type)
  ) {
    throw new SqlValidationError("Only one SELECT or WITH query is allowed.");
  }

  inspectNode(statements[0]);

  const astText = JSON.stringify(statements[0]).toLowerCase();
  const unsafeFunction = FORBIDDEN_FUNCTIONS.find((name) =>
    astText.includes(`"${name}"`),
  );
  if (unsafeFunction) {
    throw new SqlValidationError(`Function "${unsafeFunction}" is not allowed.`);
  }

  return trimmed.replace(/;+\s*$/, "");
}
