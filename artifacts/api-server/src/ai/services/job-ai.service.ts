import { PromptBuilder } from "../builder/prompt-builder";
import { jobAnalystPersona } from "../personas/job-analyst.persona";
import { jobSummaryPrompt } from "../prompts/job-summary.prompt";
import {
  JOB_SUMMARY_SCHEMA,
  JOB_SUMMARY_FALLBACK,
  type JobSummaryResult,
} from "../schemas/job-summary.schema";
import { defaultProvider } from "../providers/gemini.provider";
import type { AIProvider } from "../providers/types";

/**
 * Analyses a job posting and returns a structured summary.
 *
 * Uses:
 * - Job Analyst persona
 * - Job Summary prompt template
 * - Job summary guidelines knowledge
 * - Job Summary output schema
 *
 * @param title       - Job title from the listing
 * @param company     - Company name
 * @param description - Full job description text
 * @param keywords    - User's target keywords / roles for relevance scoring
 * @param provider    - AI provider (defaults to GeminiProvider; injectable for tests)
 */
export async function summarizeJob(
  title: string,
  company: string,
  description: string,
  keywords: string[],
  provider: AIProvider = defaultProvider,
): Promise<JobSummaryResult> {
  const prompt = new PromptBuilder()
    .withPersona(jobAnalystPersona)
    .withKnowledge("job-summary-guidelines.md")
    .withTemplate(jobSummaryPrompt)
    .withSchema(JOB_SUMMARY_SCHEMA)
    .withVars({
      JOB_TITLE: title,
      COMPANY: company,
      DESCRIPTION: description,
      KEYWORDS: keywords.join(", "),
    })
    .build();

  const text = await provider.generate(prompt, {
    responseMimeType: "application/json",
    maxOutputTokens: 8192,
  });

  try {
    return JSON.parse(text) as JobSummaryResult;
  } catch {
    console.error("[job-ai.service] Failed to parse AI response as JSON:", text.slice(0, 200));
    return JOB_SUMMARY_FALLBACK;
  }
}

export type { JobSummaryResult };
