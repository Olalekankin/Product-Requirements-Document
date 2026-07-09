import type { PromptTemplate } from "./types";

export const jobSummaryPrompt: PromptTemplate = {
  id: "job-summary",
  description: "Analyzes a job posting and extracts structured summary data",
  template: `Analyze the following job posting carefully and return a structured JSON response.

Job Title: {{JOB_TITLE}}
Company: {{COMPANY}}
Description:
{{DESCRIPTION}}

User's target keywords / roles: {{KEYWORDS}}

Instructions:
- Extract only facts present in the listing — do not invent or assume details
- Calculate a relevance score (0–100) based purely on how well the role matches the target keywords
- If salary is not mentioned, return null
- If remote status is ambiguous, return null
- Seniority must be one of: Junior | Mid | Senior | Lead | Staff | Principal | Executive | Unknown`,
  requiredVars: ["JOB_TITLE", "COMPANY", "DESCRIPTION", "KEYWORDS"],
};
