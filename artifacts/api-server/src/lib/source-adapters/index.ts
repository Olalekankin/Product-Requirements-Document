import { Source } from "@workspace/db";
import { rssAdapter } from "./rss";
import { logger } from "../logger";
import { RawJob } from "./types";

const adapters: Record<string, typeof rssAdapter> = {
  [rssAdapter.type]: rssAdapter,
};

export function getSourceAdapter(type: string) {
  return adapters[type];
}

export async function discoverJobs(sources: Source[], keywords: string[]): Promise<RawJob[]> {
  const jobs: RawJob[] = [];

  for (const source of sources) {
    const adapter = getSourceAdapter(source.type);
    if (!adapter) {
      logger.warn({ source: source.slug, type: source.type }, "No adapter registered for source type");
      continue;
    }

    try {
      const discovered = await adapter.discover(source, keywords);
      jobs.push(...discovered);
    } catch (err) {
      logger.warn({ err, source: source.slug, type: source.type }, "Source adapter discovery failed");
    }
  }

  return jobs;
}
