import { initializeDatabase } from "@workspace/db/init";
import { loadEnv } from "./lib/load-env";
import app from "./app";
import { logger } from "./lib/logger";
import { startCronScheduler } from "./lib/cron-scheduler";
import { startAgentRunner } from "./workers/agent-runner";

loadEnv();

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    await initializeDatabase();
  } catch (err) {
    logger.error({ err }, "Database initialization failed");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startCronScheduler();

    // Run the AI agent processor in-process unless explicitly disabled
    if (process.env.START_AGENT_IN_PROCESS !== "false") {
      startAgentRunner();
    }
  });
}

startServer();
