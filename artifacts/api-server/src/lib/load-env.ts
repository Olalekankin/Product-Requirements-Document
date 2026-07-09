import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

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

export function loadEnv() {
  const envPath = findEnvFile([process.cwd(), path.dirname(fileURLToPath(import.meta.url))]);
  config({ path: envPath });
}
