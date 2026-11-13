/** Shared tabber DOM parse (also used from wiki-stats.ts). */

export function extractTabberPanels(
  tabberHtml: string,
): { hashes: string[]; panels: string[] } | null {
  const tabsUl = tabberHtml.match(/<ul class="wds-tabs">([\s\S]*?)<\/ul>/);
  if (!tabsUl) return null;
  const hashes: string[] = [];
  for (const m of tabsUl[1].matchAll(/data-hash="([^"]+)"/g)) hashes.push(m[1]);
  if (!hashes.length) return null;

  const wrapperEnd = tabberHtml.indexOf(tabsUl[0]) + tabsUl[0].length;
  let rest = tabberHtml.slice(wrapperEnd);
  const close = rest.indexOf("</div>");
  if (close >= 0) rest = rest.slice(close + "</div>".length);

  const panels: string[] = [];
  for (let i = 0; i < hashes.length; i++) {
    const open = rest.match(/<div class="wds-tab__content[^"]*">/);
    if (!open || open.index === undefined) break;
    const start = open.index;
    const innerStart = start + open[0].length;
    const next = rest
      .slice(innerStart)
      .search(/<div class="wds-tab__content[^"]*">/);
    const end = next >= 0 ? innerStart + next : rest.length;
    panels.push(rest.slice(start, end));
    rest = rest.slice(end);
  }
  return panels.length ? { hashes, panels } : null;
}
