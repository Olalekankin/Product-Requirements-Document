/** Typed result returned by summarizeJob */
export interface JobSummaryResult {
  summary: string;
  requirements: string;
  whyFits: string;
  seniority: "Junior" | "Mid" | "Senior" | "Lead" | "Staff" | "Principal" | "Executive" | "Unknown";
  technologies: string[];
  relevanceScore: number;
  salary: string | null;
  remote: boolean | null;
}

/** Fallback when AI returns unparseable output */
export const JOB_SUMMARY_FALLBACK: JobSummaryResult = {
  summary: "AI summary unavailable.",
  requirements: "",
  whyFits: "",
  seniority: "Unknown",
  technologies: [],
  relevanceScore: 50,
  salary: null,
  remote: null,
};

/** JSON schema string appended to the prompt by PromptBuilder */
export const JOB_SUMMARY_SCHEMA = `Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "summary": "2-3 sentence concise summary of the role",
  "requirements": "Key requirements as a short paragraph",
  "whyFits": "Why this job fits the user's target keywords, 1-2 sentences",
  "seniority": "Junior | Mid | Senior | Lead | Staff | Principal | Executive | Unknown",
  "technologies": ["array", "of", "tech", "mentioned"],
  "relevanceScore": 0-100,
  "salary": "extracted salary range as a string, or null if not mentioned",
  "remote": true or false or null if unclear
}`;
