/** Output constraints appended to the social post prompt by PromptBuilder */
export const SOCIAL_POST_SCHEMA = `Output rules:
- Return ONLY the post text — no preamble, no explanation, no markdown code fences
- The post must be ready to copy-paste directly into {{PLATFORM}}
- Stay strictly within the character limit
- Every {{PLACEHOLDER}} in the template must be replaced with real data
- The output must pass this quality checklist before being returned:
  1. Does the first line stop the scroll without being clickbait?
  2. Is every claim factually grounded in the job data provided?
  3. Are all placeholders filled with no visible brackets or errors?
  4. Is the application link on its own line?
  5. Does the post contain no more than one CTA?
  6. Is emoji usage within 0-4, functional not decorative?
  7. Does the post avoid all forbidden phrases?
  8. Is the tone conversational and human, not robotic?
  9. Is the post free of fake urgency or unverifiable claims?
  10. Is the post scannable in under 10 seconds?`;
