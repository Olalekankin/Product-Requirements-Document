/** Map of {{PLACEHOLDER}} key → replacement value */
export type InterpolationVars = Record<string, string | number | null | undefined>;

const PLACEHOLDER_REGEX = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * Replaces all `{{UPPER_SNAKE_CASE}}` placeholders in a template string
 * with values from the provided vars map.
 *
 * - Unrecognised keys are left as-is and a warning is logged.
 * - null / undefined values are replaced with an empty string.
 */
export function interpolate(template: string, vars: InterpolationVars): string {
  const unfilled: string[] = [];

  const result = template.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    if (!(key in vars)) {
      unfilled.push(key);
      return match; // leave placeholder visible so downstream quality checks can catch it
    }
    const value = vars[key];
    return value == null ? "" : String(value);
  });

  if (unfilled.length > 0) {
    console.warn(
      `[interpolate] Unfilled placeholders in template: ${unfilled.map((k) => `{{${k}}}`).join(", ")}`,
    );
  }

  return result;
}

/**
 * Returns all placeholder keys found in a template string.
 */
export function extractPlaceholders(template: string): string[] {
  const matches = new Set<string>();
  for (const [, key] of template.matchAll(PLACEHOLDER_REGEX)) {
    matches.add(key);
  }
  return [...matches];
}
