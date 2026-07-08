import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

function findEnvFile(startPaths: string[]) {
  for (const startPath of startPaths) {
    let currentDir = path.resolve(startPath);
    while (true) {
      const candidate = path.join(currentDir, ".env");
      if (existsSync(candidate)) {
        return candidate;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
  }

  return path.resolve(process.cwd(), ".env");
}

config({ path: findEnvFile([process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
