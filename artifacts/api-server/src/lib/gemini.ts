import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY must be set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface JobSummaryResult {
  summary: string;
  requirements: string;
  whyFits: string;
  seniority: string;
  technologies: string[];
  relevanceScore: number;
  salary: string | null;
  remote: boolean | null;
}

export async function summarizeJob(
  title: string,
  company: string,
  description: string,
  keywords: string[],
): Promise<JobSummaryResult> {
  const prompt = `You are an expert job analyst. Analyze this job posting and return a JSON object.

Job Title: ${title}
Company: ${company}
Description: ${description}

User's target keywords/roles: ${keywords.join(", ")}

Return ONLY valid JSON matching this exact schema:
{
  "summary": "2-3 sentence concise summary of the role",
  "requirements": "Key requirements as a short paragraph",
  "whyFits": "Why this job fits the user's target keywords, 1-2 sentences",
  "seniority": "Junior | Mid | Senior | Lead | Staff | Principal | Executive | Unknown",
  "technologies": ["array", "of", "tech", "mentioned"],
  "relevanceScore": 0-100 (how relevant this is to the user's keywords),
  "salary": "extracted salary range or null if not mentioned",
  "remote": true or false or null if unclear
}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? "{}";
  try {
    return JSON.parse(text) as JobSummaryResult;
  } catch {
    return {
      summary: "AI summary unavailable.",
      requirements: "",
      whyFits: "",
      seniority: "Unknown",
      technologies: [],
      relevanceScore: 50,
      salary: null,
      remote: null,
    };
  }
}

export async function generateSocialPostContent(
  jobTitle: string,
  company: string,
  jobUrl: string,
  platform: string,
  tone: string,
): Promise<string> {
  const charLimit =
    platform === "twitter" ? "under 280 characters" : "under 500 characters";

  const toneInstructions: Record<string, string> = {
    applying: "I am applying to this role. Express genuine interest and excitement.",
    interesting:
      "This is an interesting opportunity worth noting. Informative and thoughtful.",
    sharing: "Sharing this opportunity with my network. Helpful and encouraging.",
  };

  const toneText = toneInstructions[tone] ?? toneInstructions.interesting;

  const prompt = `Write a social media post for ${platform} about this job opportunity.
Tone: ${toneText}
Job: ${jobTitle} at ${company}
URL: ${jobUrl}
Length: ${charLimit}
Style: Professional but personal. No hashtags overload (max 2-3 if any). No emojis. Sound human, not like a bot.
Return ONLY the post text, nothing else.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  });

  return (response.text ?? "").trim();
}
