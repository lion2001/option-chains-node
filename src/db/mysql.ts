import mysql, { Pool, PoolConnection } from "mysql2/promise";

import { env } from "../config/env";

let pool: Pool | null = null;

const configureSessionSqlMode = async (connection: PoolConnection): Promise<void> => {
  await connection.query(
    "SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'NO_ZERO_DATE', ''))"
  );
  await connection.query(
    "SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'STRICT_TRANS_TABLES', ''))"
  );
};

export const getPool = (): Pool => {
  if (!pool) {
    console.log(
      `[数据库] 创建 MySQL 连接池 host=${env.mysql.host} port=${env.mysql.port} database=${env.mysql.database}`
    );

    pool = mysql.createPool({
      host: env.mysql.host,
      port: env.mysql.port,
      user: env.mysql.user,
      password: env.mysql.password,
      database: env.mysql.database,
      connectionLimit: env.mysql.connectionLimit,
      waitForConnections: true,
      namedPlaceholders: true
    });
  }

  return pool;
};

export const verifyDatabaseConnection = async (): Promise<void> => {
  console.log("[数据库] 开始校验 MySQL 连接");
  const currentPool = getPool();
  const connection = await currentPool.getConnection();

  try {
    await configureSessionSqlMode(connection);
    await connection.ping();
    console.log("[数据库] MySQL 连接校验成功，已移除 NO_ZERO_DATE 和 STRICT_TRANS_TABLES");
  } finally {
    connection.release();
  }
};

export const withDatabaseSession = async <T>(
  handler: (connection: PoolConnection) => Promise<T>
): Promise<T> => {
  const currentPool = getPool();
  const connection = await currentPool.getConnection();

  try {
    await configureSessionSqlMode(connection);
    return await handler(connection);
  } finally {
    connection.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (!pool) {
    return;
  }

  console.log("[数据库] 开始关闭 MySQL 连接池");
  await pool.end();
  pool = null;
  console.log("[数据库] MySQL 连接池已关闭");
};
