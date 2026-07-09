export interface StyleDefinition {
  /** Unique identifier for this style */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this style produces */
  description: string;
  /** Preferred tone voice */
  voice: string;
  /** Writing principles specific to this style */
  writingPrinciples: string[];
  /** Preferred CTA approach */
  ctaApproach: string;
  /** Emoji usage guidance */
  emojiUsage: string;
  /** Formatting rules */
  formattingRules: string[];
  /** Phrases to avoid */
  forbiddenPhrases?: string[];
  /** Example post openings to rotate through */
  openings?: string[];
  /** Few-shot example posts (raw text with {{PLACEHOLDER}} tokens) */
  examplePosts?: string[];
}
