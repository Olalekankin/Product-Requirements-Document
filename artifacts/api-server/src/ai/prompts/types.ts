export interface PromptTemplate {
  /** Short identifier for this template */
  id: string;
  /** Human-readable description */
  description: string;
  /**
   * The raw prompt text.
   * Use {{UPPER_SNAKE_CASE}} placeholders for runtime variable injection.
   * Business logic must NOT live here.
   */
  template: string;
  /** All placeholder keys this template expects */
  requiredVars: string[];
}
