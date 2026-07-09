import { db, settingsTable } from "@workspace/db";
import { logger } from "./logger";
import { publishDuePosts } from "../routes/social-connections";

let lastScannedHour = -1;
let lastScannedDay = -1;
let lastScanned15Min = -1;

export function startCronScheduler() {
  logger.info("Starting background cron scheduler daemon");

  // Run check loop every 1 minute
  setInterval(async () => {
    try {
      // 1. Process scheduled social posts that are due
      await publishDuePosts().catch((err) =>
        logger.warn({ err }, "cron-scheduler: publishDuePosts failed"),
      );

      // 2. Fetch scheduler settings
      const settings = await db.select().from(settingsTable).limit(1);
      const freq = settings[0]?.schedulerFrequency ?? "1hour";

      if (freq === "manual") {
        return;
      }

      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const day = now.getDate();

      let shouldScan = false;

      if (freq === "15min") {
        const intervalId = Math.floor(minute / 15);
        const lastIntervalHash = day * 100 + hour * 10 + intervalId; // Unique id per 15-minute slot
        if (minute % 15 === 0 && lastScanned15Min !== lastIntervalHash) {
          shouldScan = true;
          lastScanned15Min = lastIntervalHash;
        }
      } else {
        // Hour-based frequencies
        const dayHash = day * 100 + hour; // Unique id per hour slot
        if (lastScannedHour !== dayHash) {
          if (freq === "1hour") {
            shouldScan = true;
          } else if (freq === "6x_daily") {
            // Run every 4 hours: 02:00, 06:00, 10:00, 14:00, 18:00, 22:00
            const targetHours = [2, 6, 10, 14, 18, 22];
            if (targetHours.includes(hour)) {
              shouldScan = true;
            }
          } else if (freq === "2xdaily") {
            // Run twice daily: 10:00 and 22:00
            const targetHours = [10, 22];
            if (targetHours.includes(hour)) {
              shouldScan = true;
            }
          } else if (freq === "daily") {
            // Run once daily at 10:00 AM
            if (hour === 10) {
              shouldScan = true;
            }
          }

          if (shouldScan) {
            lastScannedHour = dayHash;
            lastScannedDay = day;
          }
        }
      }

      if (shouldScan) {
        logger.info(
          { frequency: freq, time: now.toISOString() },
          "Time-based scan triggered by background cron daemon",
        );

        const port = process.env.PORT || "8080";
        const triggerUrl = `http://localhost:${port}/api/scheduler/trigger`;

        // Make HTTP call to own endpoint to run the scan pipeline
        fetch(triggerUrl, { method: "POST" })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              logger.info({ data }, "Background cron scan triggered and completed successfully");
            } else {
              logger.error(
                { status: res.status, statusText: res.statusText },
                "Background cron scan endpoint returned error",
              );
            }
          })
          .catch((err) => {
            logger.error({ err }, "Cron failed to fetch scan endpoint");
          });
      }
    } catch (err) {
      logger.error({ err }, "Error in cron scheduler loop iteration");
    }
  }, 60000); // Check every minute
}
