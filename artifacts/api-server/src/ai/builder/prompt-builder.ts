import * as fs from "fs";
import * as path from "path";
import type { Persona } from "../personas/types";
import type { PromptTemplate } from "../prompts/types";
import type { StyleDefinition } from "../styles/types";
import { loadKnowledge, resolveAssetDir } from "../knowledge/loader";
import { interpolate, type InterpolationVars } from "../renderer/interpolate";

const STYLES_DIR = resolveAssetDir("styles");

/**
 * PromptBuilder assembles the final prompt string from modular pieces.
 *
 * Usage:
 * ```ts
 * const prompt = new PromptBuilder()
 *   .withPersona(jobAnalystPersona)
 *   .withTemplate(jobSummaryPrompt)
 *   .withKnowledge("job-summary-guidelines.md")
 *   .withSchema(JOB_SUMMARY_SCHEMA)
 *   .withVars({ JOB_TITLE: title, COMPANY: company, ... })
 *   .build();
 * ```
 */
export class PromptBuilder {
  private persona: Persona | null = null;
  private template: PromptTemplate | null = null;
  private knowledgeFiles: string[] = [];
  private style: StyleDefinition | null = null;
  private schema: string | null = null;
  private vars: InterpolationVars = {};

  /** Set the persona that prefixes the prompt */
  withPersona(persona: Persona): this {
    this.persona = persona;
    return this;
  }

  /** Set the core prompt template */
  withTemplate(template: PromptTemplate): this {
    this.template = template;
    return this;
  }

  /**
   * Add a knowledge file (by filename, e.g. "social-writing-style.md").
   * Multiple calls are additive — all knowledge files are concatenated.
   */
  withKnowledge(filename: string): this {
    this.knowledgeFiles.push(filename);
    return this;
  }

  /**
   * Load and inject a style by ID (e.g. "globalellah" or "professional").
   * Reads from the styles/ directory.
   */
  withStyle(styleId: string): this {
    const filePath = path.join(STYLES_DIR, `${styleId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Style file not found: ${filePath}`);
    }
    this.style = JSON.parse(fs.readFileSync(filePath, "utf-8")) as StyleDefinition;
    return this;
  }

  /** Append a JSON schema or output constraint block */
  withSchema(schema: string): this {
    this.schema = schema;
    return this;
  }

  /** Provide runtime variable values for {{PLACEHOLDER}} interpolation */
  withVars(vars: InterpolationVars): this {
    this.vars = { ...this.vars, ...vars };
    return this;
  }

  /**
   * Assemble and return the final prompt string.
   * Section order: Persona → Knowledge → Style → Template → Schema
   */
  build(): string {
    const sections: string[] = [];

    // 1. Persona preamble
    if (this.persona) {
      const p = this.persona;
      const personaBlock = [
        p.role,
        p.expertise.length > 0 ? `\nExpertise:\n${p.expertise.map((e) => `- ${e}`).join("\n")}` : "",
        p.objectives.length > 0 ? `\nObjectives:\n${p.objectives.map((o) => `- ${o}`).join("\n")}` : "",
        p.constraints.length > 0 ? `\nConstraints:\n${p.constraints.map((c) => `- ${c}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("");
      sections.push(personaBlock);
    }

    // 2. Knowledge files
    for (const filename of this.knowledgeFiles) {
      const content = loadKnowledge(filename);
      sections.push(`--- Knowledge: ${filename} ---\n${content}`);
    }

    // 3. Style guide
    if (this.style) {
      const s = this.style;
      const styleBlock = [
        `--- Style Guide: ${s.name} ---`,
        `Voice: ${s.voice}`,
        `Emoji usage: ${s.emojiUsage}`,
        `CTA approach: ${s.ctaApproach}`,
        s.writingPrinciples.length > 0
          ? `Writing principles:\n${s.writingPrinciples.map((p) => `- ${p}`).join("\n")}`
          : "",
        s.formattingRules.length > 0
          ? `Formatting rules:\n${s.formattingRules.map((r) => `- ${r}`).join("\n")}`
          : "",
        s.forbiddenPhrases && s.forbiddenPhrases.length > 0
          ? `Forbidden phrases:\n${s.forbiddenPhrases.map((f) => `- ${f}`).join("\n")}`
          : "",
        s.openings && s.openings.length > 0
          ? `Available opening hooks (rotate, don't repeat):\n${s.openings.slice(0, 20).join(", ")}`
          : "",
        s.examplePosts && s.examplePosts.length > 0
          ? `Few-shot example posts (reference these for format, do not copy verbatim):\n\n${s.examplePosts.slice(0, 4).join("\n\n---\n\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      sections.push(styleBlock);
    }

    // 4. Core template (with variable interpolation)
    if (this.template) {
      const rendered = interpolate(this.template.template, this.vars);
      sections.push(`--- Task ---\n${rendered}`);
    }

    // 5. Output schema / constraints
    if (this.schema) {
      sections.push(`--- Output Format ---\n${this.schema}`);
    }

    return sections.join("\n\n");
  }
}
