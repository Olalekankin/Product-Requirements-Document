/// <reference types="node" />

import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

config({ path: findEnvFile([process.cwd(), __dirname]) });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
