import { extractTabberPanels as extractTabberPanelsInner } from "./wiki-tabber-extract.js";

export type TabScope = {
  /** Fandom `data-hash` values from root to this panel (empty = full page). */
  path: string[];
  html: string;
};

function firstTabberAfter(html: string, start: number): number {
  return html.indexOf('<div class="tabber wds-tabber">', start);
}

/** Every tab panel on the page (full HTML + each tabber tab, recursively nested). */
export function enumerateTabScopes(pageHtml: string): TabScope[] {
  const seen = new Set<string>();
  const out: TabScope[] = [];

  function push(path: string[], html: string) {
    const key = path.join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ path: [...path], html });
  }

  function walk(scopeHtml: string, path: string[]) {
    push(path, scopeHtml);
    let pos = 0;
    while (pos < scopeHtml.length) {
      const idx = firstTabberAfter(scopeHtml, pos);
      if (idx < 0) break;
      const tabberSlice = scopeHtml.slice(idx);
      const closeDiv = tabberSlice.indexOf("</div>");
      const chunk =
        closeDiv > 0
          ? tabberSlice.slice(0, Math.min(tabberSlice.length, closeDiv + 20_000))
          : tabberSlice.slice(0, 50_000);
      const parsed = extractTabberPanelsInner(chunk);
      if (parsed) {
        for (let i = 0; i < parsed.hashes.length; i++) {
          const panel = parsed.panels[i];
          if (!panel) continue;
          const childPath = [...path, parsed.hashes[i]!];
          walk(panel, childPath);
        }
      }
      pos = idx + 1;
    }
  }

  walk(pageHtml, []);
  return out;
}
