/**
 * Sync roster-form-policy.json from current characters.json form groups.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const charsPath = resolve(root, "data/characters.json");
const policyPath = resolve(root, "data/roster-form-policy.json");

function plainCharacterName(displayName) {
  return displayName
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+SSJ\d+$/i, "")
    .trim();
}

function rosterFormIdentity(c) {
  const name = plainCharacterName(c.displayName);
  const lower = name.toLowerCase();
  if (lower.includes("goku")) return "goku";
  if (lower.startsWith("vegeta")) return "vegeta";
  if (/sung\s+jin/i.test(name)) return "sung jinwoo";
  if (/kirito/i.test(name)) return "kirito";
  if (/shigeo|mob\b/i.test(name)) return "shigeo kageyama";
  if (/midoriya|deku/i.test(name)) return "deku";
  if (/meliodas/i.test(name)) return "meliodas";
  return lower;
}

const chars = JSON.parse(readFileSync(charsPath, "utf8"));
const groups = new Map();
for (const c of chars) {
  const identity = rosterFormIdentity(c);
  const key = `${c.series}\0${identity}`;
  const list = groups.get(key) ?? [];
  list.push(c.id);
  groups.set(key, list);
}

let extendedMax = 1;
const extendedIdentities = [];
for (const [key, ids] of groups) {
  const identity = key.split("\0")[1] ?? "";
  if (ids.length <= 1) continue;
  extendedIdentities.push(identity);
  if (ids.length > extendedMax) extendedMax = ids.length;
}

extendedIdentities.sort((a, b) => a.localeCompare(b));

const policy = {
  defaultMaxForms: 1,
  extendedMaxForms: extendedMax,
  extendedIdentities,
};
writeFileSync(policyPath, JSON.stringify(policy, null, 2) + "\n", "utf8");
console.log(
  `extendedMaxForms=${extendedMax}, identities=${extendedIdentities.length}`,
);
