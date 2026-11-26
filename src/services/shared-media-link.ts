export function extractSharedMediaUrl(
  text: string,
  isValidUrl: (url: string) => boolean,
): string | null {
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const candidate = match[0].replace(/[),.;!?]+$/, "");
    if (isValidUrl(candidate)) return candidate;
  }
  return null;
}
