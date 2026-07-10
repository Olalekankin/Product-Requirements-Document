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

  // Run the workspace-level pnpm script for the db package. Using --filter
  // from the repository root avoids issues with import.meta.url resolution
  // when this code is bundled into other packages.
  const repoRoot = process.cwd();
  const cmd = getPnpmCommand();
  const args = ["--filter", "@workspace/db", "run", "push"];

  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Database initialization failed with exit code ${result.status ?? "unknown"}.`);
  }
}
