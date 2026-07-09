import * as fs from "fs";
import * as path from "path";

/**
 * Robustly finds the absolute path of the target asset directory.
 * Searches multiple possible locations to handle running from:
 * - src/ (development)
 * - dist/ (production build bundle)
 * - various CWD contexts (monorepo root or package subdirectory)
 */
export function resolveAssetDir(type: "knowledge" | "styles"): string {
  const possiblePaths = [
    // 1. Relative to __dirname (handles bundled in dist/ or running from src/)
    path.join(__dirname, "..", type),
    path.join(__dirname, "../..", type),
    path.join(__dirname, type),
    // 2. Relative to process.cwd() (handles package directory)
    path.join(process.cwd(), "src/ai", type),
    path.join(process.cwd(), "artifacts/api-server/src/ai", type),
    // 3. Absolute fallback relative to __dirname
    path.join(__dirname, "../src/ai", type),
    path.join(__dirname, "../../src/ai", type),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return p;
    }
  }

  throw new Error(
    `[resolveAssetDir] Failed to find the '${type}' directory. Tried paths:\n` +
      possiblePaths.map((p) => `  - ${p}`).join("\n")
  );
}

const KNOWLEDGE_DIR = resolveAssetDir("knowledge");

const cache = new Map<string, string>();

/**
 * Loads a knowledge file by name from the knowledge/ directory.
 * Supports .md and .json files. Results are cached after first load.
 *
 * @param filename - e.g. "social-writing-style.md" or "engagement-principles.md"
 */
export function loadKnowledge(filename: string): string {
  if (cache.has(filename)) {
    return cache.get(filename)!;
  }

  const filePath = path.join(KNOWLEDGE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Knowledge file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  cache.set(filename, content);
  return content;
}

/**
 * Loads a JSON knowledge file and returns the parsed object.
 */
export function loadKnowledgeJson<T = unknown>(filename: string): T {
  const raw = loadKnowledge(filename);
  return JSON.parse(raw) as T;
}

/** Clears the in-memory cache (useful in tests). */
export function clearKnowledgeCache(): void {
  cache.clear();
}
