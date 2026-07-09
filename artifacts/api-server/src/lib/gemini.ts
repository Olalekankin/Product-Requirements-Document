/**
 * Compatibility shim — preserves the original public API of this module.
 *
 * All logic has moved to src/ai/. This file re-exports the same function
 * signatures so existing callers (agent-runner.ts, social.ts) require
 * zero changes.
 *
 * To use the full new API (style selection, richer context, provider injection),
 * import directly from "../ai" instead.
 */

export type { JobSummaryResult } from "../ai/schemas/job-summary.schema";
export { summarizeJob } from "../ai/services/job-ai.service";
export { generateSocialPostContent } from "../ai/services/social-ai.service";

