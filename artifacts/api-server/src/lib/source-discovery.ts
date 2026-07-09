import { db, sourcesTable, type Source } from "@workspace/db";
import { logger } from "./logger";
import { eq } from "drizzle-orm";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  results: TavilyResult[];
}

/**
 * Validates whether a target URL returns an RSS/XML structure.
 */
async function isValidRssFeed(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "JobScoutDiscovery/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    const text = (await response.text()).slice(0, 1000).toLowerCase();

    // Check header or basic XML signature for RSS/Atom
    return (
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      text.includes("<rss") ||
      text.includes("<feed") ||
      (text.includes("<channel") && text.includes("<link"))
    );
  } catch (err) {
    clearTimeout(timeout);
    return false;
  }
}

/**
 * Searches Tavily for potential RSS feeds related to the provided keywords.
 */
export async function discoverNewSources(keywords: string[]): Promise<Source[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    logger.warn("TAVILY_API_KEY is not set. Skipping source auto-discovery.");
    return [];
  }

  if (keywords.length === 0) {
    logger.info("No active keywords to discover sources for.");
    return [];
  }

  const addedSources: Source[] = [];
  const query = `hiring remote ${keywords.join(" OR ")} jobs rss feed url`;

  logger.info({ query }, "Querying Tavily for new job sources");

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 8,
      }),
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Tavily search API request failed");
      return [];
    }

    const data = (await response.json()) as TavilyResponse;
    const results = data.results || [];

    for (const result of results) {
      const url = result.url;
      if (!url) continue;

      // Clean up/ignore duplicate URLs
      const existing = await db
        .select()
        .from(sourcesTable)
        .where(eq(sourcesTable.url, url))
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      logger.info({ url }, "Validating candidate feed discovered from Tavily");

      const isRss = await isValidRssFeed(url);
      if (isRss) {
        // Generate a clean slug
        let name = result.title.replace(/rss|feed|job|scout/gi, "").trim();
        name = name ? `${name} Jobs` : "Discovered Job Feed";
        const slug = `discovered-${Math.random().toString(36).substring(2, 8)}`;

        try {
          const [inserted] = await db
            .insert(sourcesTable)
            .values({
              name,
              slug,
              type: "rss",
              url,
              enabled: true,
              config: {},
            })
            .returning();

          if (inserted) {
            logger.info({ name, url }, "Automatically registered new RSS job source");
            addedSources.push(inserted);
          }
        } catch (dbErr) {
          logger.error({ dbErr, url }, "Failed to insert discovered source into database");
        }
      }
    }
  } catch (error) {
    logger.error({ error }, "Error during autonomous source discovery");
  }

  return addedSources;
}
