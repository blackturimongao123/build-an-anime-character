/**
 * Roster display labels: short famous names for people (e.g. Levi, Mob),
 * not for in-universe titles (e.g. Beast Titan).
 */

const TITAN_FORM_ID =
  /^(ymir-(armored|attack|beast|colossal|jaw|female|warhammer)-aot|cart-aot|warhammer-aot|ymir-fritz-aot)$/;

/** If wiki page ends with "(… Titan)", use that full title. */
export function titanTitleFromWikiPage(wikiPage: string | undefined): string | undefined {
  if (!wikiPage) return undefined;
  const m = wikiPage.match(/\(([^)]+ Titan)\)\s*$/);
  return m?.[1];
}

/** Expand catalog/famous one-word titan adjectives to full titles. */
export function expandTitanDisplayName(
  id: string,
  displayName: string,
  wikiPage?: string,
): string {
  const fromWiki = titanTitleFromWikiPage(wikiPage);
  if (fromWiki) return fromWiki;
  if (!TITAN_FORM_ID.test(id)) return displayName.trim();
  const adj = displayName.trim();
  if (/titan$/i.test(adj)) return adj;
  return `${adj} Titan`;
}
