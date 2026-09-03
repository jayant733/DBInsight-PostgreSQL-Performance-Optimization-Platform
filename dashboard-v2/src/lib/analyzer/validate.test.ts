import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "./validate";

describe("validateReadOnlySql", () => {
  it.each([
    "SELECT * FROM ecom.orders",
    "WITH recent AS (SELECT * FROM ecom.orders) SELECT * FROM recent",
  ])("accepts a read-only statement", (sql) => {
    expect(validateReadOnlySql(sql)).toBe(sql);
  });

  it.each([
    "DELETE FROM ecom.orders",
    "INSERT INTO ecom.country VALUES ('ZZ', 'Unsafe')",
    "UPDATE ecom.orders SET order_status = 'paid'",
    "DROP TABLE ecom.orders",
    "SET enable_nestloop = off",
    "SELECT * FROM ecom.orders; DELETE FROM ecom.orders",
    "WITH removed AS (DELETE FROM ecom.orders RETURNING *) SELECT * FROM removed",
    "SELECT * INTO stolen_orders FROM ecom.orders",
    "SELECT * FROM ecom.orders FOR UPDATE",
  ])("rejects unsafe SQL: %s", (sql) => {
    expect(() => validateReadOnlySql(sql)).toThrow();
  });

  it.each([
    "SELECT pg_sleep(1)",
    "SELECT pg_read_file('/etc/passwd')",
    "SELECT set_config('search_path', 'public', false)",
  ])("rejects unsafe functions: %s", (sql) => {
    expect(() => validateReadOnlySql(sql)).toThrow();
  });

  it("rejects oversized SQL", () => {
    expect(() => validateReadOnlySql(`SELECT '${"x".repeat(17_000)}'`)).toThrow(
      "16 KB",
    );
  });
});
