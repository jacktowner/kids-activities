export function parseCategories(value: string): string[] {
  return value
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function normalizeCategories(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : parseCategories(String(input ?? ""));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const c = item.trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      result.push(c);
    }
  }
  return result;
}

export function formatCategories(categories: string[]): string {
  return categories.join(", ");
}
