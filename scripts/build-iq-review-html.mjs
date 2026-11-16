/**
 * Builds data/iq-revision-review.html from characters.json + IQ_REVISION_PROPOSAL.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIqRoster, renderIqReviewHtml } from "./lib/iq-review-build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const { roster, seedEdits, framework } = buildIqRoster(root);
const html = renderIqReviewHtml(
  roster,
  seedEdits,
  framework,
  path.join(__dirname, "iq-revision-review.template.html"),
);
fs.writeFileSync(path.join(dataDir, "iq-revision-review.html"), "\uFEFF" + html, "utf8");

const placeholderIq = roster.filter((c) => c.iqPlaceholder).length;
console.log(
  `Wrote data/iq-revision-review.html (${roster.length} characters, ${placeholderIq} placeholder IQ)`,
);
