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

config({ path: findEnvFile([process.cwd(), path.dirname(fileURLToPath(import.meta.url))]) });

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
