import { PromptBuilder } from "../builder/prompt-builder";
import { socialCopywriterPersona } from "../personas/social-copywriter.persona";
import { socialPostPrompt } from "../prompts/social-post.prompt";
import { SOCIAL_POST_SCHEMA } from "../schemas/social-post.schema";
import { defaultProvider } from "../providers/gemini.provider";
import type { AIProvider } from "../providers/types";

export type SocialPostStyle = "globalellah" | "professional";
export type SocialPostTone = "applying" | "interesting" | "sharing";

/** Map of tone → natural language instruction injected into the prompt */
const TONE_INSTRUCTIONS: Record<SocialPostTone, string> = {
  applying:
    "The post is written as if the account owner is personally applying to this role. Express genuine interest and excitement without sounding desperate.",
  interesting:
    "This is an interesting opportunity worth noting. The post is informative and thoughtful — the account is sharing it as a notable find.",
  sharing:
    "The post is sharing this opportunity with the audience to help them. The tone is helpful and encouraging, community-minded.",
};

/** Map of platform → character limit instruction */
const PLATFORM_CHAR_LIMITS: Record<string, string> = {
  twitter: "under 280 characters",
  x: "under 280 characters",
  linkedin: "under 700 characters (LinkedIn sweet spot for engagement)",
  instagram: "under 500 characters",
  threads: "under 500 characters",
  facebook: "under 500 characters",
};

/**
 * Generates a social media post for a job opportunity.
 *
 * Uses:
 * - Social Copywriter persona (The Remote Jobs Connector)
 * - Social Post prompt template
 * - social-writing-style.md knowledge
 * - engagement-principles.md knowledge (CTA library)
 * - Selected style (default: "globalellah")
 * - Social Post output schema (quality checklist)
 *
 * @param jobTitle       - Job title
 * @param company        - Company name
 * @param jobUrl         - Direct application / job listing URL
 * @param platform       - Target platform (twitter, linkedin, instagram, threads, facebook)
 * @param tone           - Post intent: "applying" | "interesting" | "sharing"
 * @param style          - Style ID to use (default: "globalellah")
 * @param jobSummary     - Optional AI summary of the job to enrich the post
 * @param location       - Job location / remote status
 * @param employmentType - Employment type (Full-time, Part-time, Contract, etc.)
 * @param salary         - Salary range if available
 * @param provider       - AI provider (injectable for tests)
 */
export async function generateSocialPostContent(
  jobTitle: string,
  company: string,
  jobUrl: string,
  platform: string,
  tone: SocialPostTone | string = "interesting",
  style: SocialPostStyle = "globalellah",
  jobSummary = "",
  location = "Remote",
  employmentType = "Full-time",
  salary = "Not specified",
  provider: AIProvider = defaultProvider,
): Promise<string> {
  const toneInstruction =
    TONE_INSTRUCTIONS[tone as SocialPostTone] ?? TONE_INSTRUCTIONS.interesting;

  const charLimit =
    PLATFORM_CHAR_LIMITS[platform.toLowerCase()] ?? "under 500 characters";

  const prompt = new PromptBuilder()
    .withPersona(socialCopywriterPersona)
    .withKnowledge("social-writing-style.md")
    .withKnowledge("engagement-principles.md")
    .withStyle(style)
    .withTemplate(socialPostPrompt)
    .withSchema(SOCIAL_POST_SCHEMA)
    .withVars({
      PLATFORM: platform,
      JOB_TITLE: jobTitle,
      COMPANY: company,
      LOCATION: location,
      EMPLOYMENT_TYPE: employmentType,
      SALARY: salary,
      SUMMARY: jobSummary || `${jobTitle} position at ${company}`,
      APPLICATION_LINK: jobUrl,
      TONE_INSTRUCTION: toneInstruction,
      CHAR_LIMIT: charLimit,
    })
    .build();

  const result = await provider.generate(prompt, {
    maxOutputTokens: 8192,
  });

  return result.trim();
}
