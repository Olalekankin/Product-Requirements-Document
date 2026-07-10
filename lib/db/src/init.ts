import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getPnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

export async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set before initializing the database.");
  }

  const dbPackageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = spawnSync(getPnpmCommand(), ["run", "push"], {
    cwd: dbPackageDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Database initialization failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}
