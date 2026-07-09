export interface GenerateOptions {
  /** MIME type for structured output (e.g. "application/json") */
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  /**
   * Send a fully-assembled prompt string to the AI and return the raw text response.
   */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
}
