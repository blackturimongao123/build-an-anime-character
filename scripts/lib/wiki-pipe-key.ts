function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Labels from VS Battles `Key:` pipe row (one per stats column). */
export function extractPipeColumnLabels(html: string): string[] | null {
  const re = /<p>\s*<b>\s*Key:\s*<\/b>\s*([\s\S]*?)<\/p>/i;
  const m = html.match(re);
  if (!m?.[1]) return null;
  const parts = stripHtml(m[1])
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

export function countPipeColumns(html: string): number {
  const labels = extractPipeColumnLabels(html);
  if (labels?.length) return labels.length;
  const re = /<a[^>]*href="\/wiki\/Attack_Potency"[^>]*>[\s\S]*?<\/p>/gi;
  let best = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = stripHtml(match[0]);
    const pipes = (text.match(/\|/g) ?? []).length;
    best = Math.max(best, pipes + 1);
  }
  return Math.max(1, best);
}
