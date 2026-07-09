import type { PromptTemplate } from "./types";

export const socialPostPrompt: PromptTemplate = {
  id: "social-post",
  description: "Generates a platform-specific social media post for a job listing",
  template: `Write a single social media post for {{PLATFORM}} about the following job opportunity.

Job Title: {{JOB_TITLE}}
Company: {{COMPANY}}
Location / Remote Status: {{LOCATION}}
Employment Type: {{EMPLOYMENT_TYPE}}
Salary: {{SALARY}}
Job Summary: {{SUMMARY}}
Application Link: {{APPLICATION_LINK}}

Tone intent: {{TONE_INSTRUCTION}}
Character limit: {{CHAR_LIMIT}}

Instructions:
- Use a {{PLATFORM}}-appropriate opening hook from the style library provided
- Follow one of the post structures from the style library
- Use the application link on its own line
- End with exactly one call-to-action from the CTA library
- Do not include any placeholder text — every field must be filled with the real data above
- Do not mention that this was AI-generated`,
  requiredVars: [
    "PLATFORM",
    "JOB_TITLE",
    "COMPANY",
    "LOCATION",
    "EMPLOYMENT_TYPE",
    "SALARY",
    "SUMMARY",
    "APPLICATION_LINK",
    "TONE_INSTRUCTION",
    "CHAR_LIMIT",
  ],
};
