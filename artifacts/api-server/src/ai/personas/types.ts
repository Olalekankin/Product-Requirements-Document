export interface Persona {
  /** Short identifier used for referencing this persona */
  id: string;
  /** The role description prepended to every prompt */
  role: string;
  /** Domain expertise bullet points */
  expertise: string[];
  /** What this persona is trying to achieve */
  objectives: string[];
  /** Reasoning/behaviour constraints for this persona */
  constraints: string[];
}
