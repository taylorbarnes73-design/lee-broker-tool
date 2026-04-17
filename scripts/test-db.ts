import "dotenv/config";
import { createDatabasePool, getDatabasePoolConfig } from "../server/db";

async function main() {
  const config = getDatabasePoolConfig();

  if (!config) {
    throw new Error("DATABASE_URL is not set.");
  }

  console.log("Testing database connection...");
  console.log(
    JSON.stringify(
      {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        sslEnabled: Boolean(config.ssl),
      },
      null,
      2
    )
  );

  const pool = createDatabasePool();
  if (!pool) {
    throw new Error("Failed to create database pool.");
  }

  try {
    const [rows] = await pool.promise().query("select current_timestamp as now");
    console.log("Database connection succeeded.");
    console.log(rows);
  } finally {
    await pool.promise().end();
  }
}

main().catch(error => {
  console.error("Database connection failed.");
  console.error(error);
  process.exit(1);
});
