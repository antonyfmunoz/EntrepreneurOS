export function normalizeOptionalGoals(value: string): string | undefined {
  const normalized = value.trim();
  return normalized || undefined;
}
