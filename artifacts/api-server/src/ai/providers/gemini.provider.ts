import { GoogleGenAI } from "@google/genai";
import type { AIProvider, GenerateOptions } from "./types";

export class GeminiProvider implements AIProvider {
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor(model = "gemini-2.5-flash") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY must be set.");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.model = model;
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: options.responseMimeType,
        maxOutputTokens: options.maxOutputTokens ?? 8192,
        temperature: options.temperature,
      },
    });
    return (response.text ?? "").trim();
  }
}

/** Singleton default provider — used by services unless overridden (e.g. in tests). */
export const defaultProvider = new GeminiProvider();
