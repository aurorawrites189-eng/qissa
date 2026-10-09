/** Tiny shared string helpers. */

/** Interpolate {placeholders} in dictionary templates. */
export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v === null || v === undefined ? `{${key}}` : String(v);
  });
}
