import { Pool, type PoolClient, type QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://querylab_app:querylab@127.0.0.1:5434/postgres";

if (
  process.env.NODE_ENV !== "production" &&
  !connectionString.includes("127.0.0.1") &&
  !connectionString.includes("localhost")
) {
  throw new Error("The local analyzer only accepts a loopback DATABASE_URL.");
}

const globalForPg = globalThis as unknown as { queryLabPool?: Pool };

export const pool =
  globalForPg.queryLabPool ??
  new Pool({
    connectionString,
    max: 5,
    application_name: "querylab-dashboard",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.queryLabPool = pool;
}

export async function withClient<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function queryRows<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}
