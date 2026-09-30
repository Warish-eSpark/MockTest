import mysql from "mysql2/promise";

const globalForDb = globalThis as unknown as {
  mockTestPool?: mysql.Pool;
};

export const db =
  globalForDb.mockTestPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "mock_test_platform",
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 1500,
  });

if (process.env.NODE_ENV !== "production") globalForDb.mockTestPool = db;