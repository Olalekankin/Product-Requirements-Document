/**
 * Public surface of the AI module.
 *
 * Consumers should import from here, not from internal subpaths.
 */

// Provider abstraction
export type { AIProvider, GenerateOptions } from "./providers/types";
export { GeminiProvider, defaultProvider } from "./providers/gemini.provider";

// Persona types
export type { Persona } from "./personas/types";
export { jobAnalystPersona } from "./personas/job-analyst.persona";
export { socialCopywriterPersona } from "./personas/social-copywriter.persona";

// Prompt template types
export type { PromptTemplate } from "./prompts/types";
export { jobSummaryPrompt } from "./prompts/job-summary.prompt";
export { socialPostPrompt } from "./prompts/social-post.prompt";

// Schemas + result types
export type { JobSummaryResult } from "./schemas/job-summary.schema";
export { JOB_SUMMARY_SCHEMA, JOB_SUMMARY_FALLBACK } from "./schemas/job-summary.schema";
export { SOCIAL_POST_SCHEMA } from "./schemas/social-post.schema";

// Style types
export type { StyleDefinition } from "./styles/types";

// Knowledge utilities
export { loadKnowledge, loadKnowledgeJson, clearKnowledgeCache } from "./knowledge/loader";

// Renderer
export { interpolate, extractPlaceholders } from "./renderer/interpolate";
export type { InterpolationVars } from "./renderer/interpolate";

// Builder
export { PromptBuilder } from "./builder/prompt-builder";

// Services (primary public API)
export { summarizeJob } from "./services/job-ai.service";
export {
  generateSocialPostContent,
  type SocialPostStyle,
  type SocialPostTone,
} from "./services/social-ai.service";
