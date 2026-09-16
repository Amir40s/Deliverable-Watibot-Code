export function parseDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const trimmed = description.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.description || null;
    } catch {
     }
  }
  return description;
}

export function mergeDescription(existing: string | null | undefined, newText: string | null | undefined): string {
  const text = newText || "";
  if (existing) {
    const trimmed = existing.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        parsed.description = text;
        return JSON.stringify(parsed);
      } catch {
       }
    }
  }
  return text;
}
