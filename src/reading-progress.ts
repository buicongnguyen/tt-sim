export function parseReadingProgress(value: string | null): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, checked]) => typeof checked === "boolean"));
  } catch {
    return {};
  }
}
