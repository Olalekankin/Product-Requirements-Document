# Job Summary Guidelines

Use these guidelines when analysing a job posting.

## Core Rules

- Extract only facts present in the posting. Do not infer or invent.
- Salary: extract verbatim if mentioned (e.g. "$120k–$150k/yr"). Return null if absent.
- Remote: return true only if the listing explicitly states "remote", "work from anywhere", or equivalent. Return false if it states "on-site" or "in-office". Return null if ambiguous.
- Seniority: infer from title and requirements, not from vague words alone. A "Senior" in title with only 1 year required is still Senior by label.
- Technologies: list only tools, languages, frameworks, and platforms explicitly named — no generic terms like "good communication skills".

## Relevance Scoring (0–100)

| Score | Meaning |
|-------|---------|
| 90–100 | Direct match — job title and most keywords align exactly |
| 70–89 | Strong match — core keywords align, minor gaps |
| 50–69 | Partial match — some keywords overlap |
| 30–49 | Weak match — tangential relevance |
| 0–29 | Poor match — little or no keyword alignment |

## Summary Quality

- `summary`: 2–3 sentences. Describe what the company is, what the role does, and the key seniority/scope.
- `requirements`: 1 short paragraph summarising the must-haves (experience, skills, qualifications).
- `whyFits`: 1–2 sentences connecting the role to the user's keywords directly.

## Forbidden Behaviours

- Do not fabricate any detail not in the source text.
- Do not give opinions ("This is a great opportunity").
- Do not use placeholder text in output fields.
