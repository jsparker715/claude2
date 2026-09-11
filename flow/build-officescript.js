/**
 * Bundles the calculation engine + the Office Script glue into ONE Office Script
 * file (flow/officescript/BcbaComputeReports.osts), because Office Scripts are a
 * single module with no import/export.
 *
 * It reads the engine's TypeScript sources, strips import/export syntax, and
 * concatenates them (declarations only, so order is not runtime-sensitive),
 * followed by flow/officescript/glue.ts. Keeps the script in lockstep with the
 * tested engine — regenerate after any engine change:
 *
 *     node flow/build-officescript.js
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const engineDir = path.join(repoRoot, "src", "engine");

// Dependency order is not strictly required (all top-level are declarations), but
// this reads naturally and keeps constants near their use.
const ENGINE_FILES = [
  "dateutil.ts",
  "names.ts",
  "telehealth.ts",
  "types.ts",
  "results.ts",
  "periods.ts",
  "pto.ts",
  "metrics.ts",
  "weekly.ts",
  "compliance.ts",
  "rollover.ts",
  "bonus.ts",
  "defaults.ts",
  "index.ts",
];

/** Strip import statements (single/multi-line), re-export lines, and leading `export `. */
function stripModuleSyntax(src) {
  const lines = src.split("\n");
  const out = [];
  let skippingImport = false;
  for (let raw of lines) {
    if (skippingImport) {
      if (/;\s*$/.test(raw) || /from\s+["'][^"']+["']\s*;?\s*$/.test(raw)) skippingImport = false;
      continue;
    }
    if (/^\s*import\b/.test(raw)) {
      // single-line import ends on same line; multi-line continues until ';'
      if (!(/;\s*$/.test(raw) || /from\s+["'][^"']+["']\s*;?\s*$/.test(raw))) skippingImport = true;
      continue;
    }
    // drop re-export lines: `export * from '...'` and `export { ... } from '...'`
    if (/^\s*export\s+\*\s+from\s+/.test(raw)) continue;
    if (/^\s*export\s*\{[^}]*\}\s*from\s+/.test(raw)) continue;
    // strip leading `export ` from declarations
    raw = raw.replace(/^(\s*)export\s+(?=(const|let|var|function|interface|type|class|abstract|enum)\b)/, "$1");
    out.push(raw);
  }
  return out.join("\n");
}

let bundle = "";
bundle +=
  "/* ============================================================================\n" +
  " * BcbaComputeReports — GENERATED Office Script. DO NOT EDIT BY HAND.\n" +
  " * Rebuild with: node flow/build-officescript.js\n" +
  " * Bundles src/engine/* (the unit-tested engine) + flow/officescript/glue.ts.\n" +
  " * Paste the whole file into a new Office Script (Excel > Automate > New Script).\n" +
  " * ==========================================================================*/\n\n";

for (const f of ENGINE_FILES) {
  const src = fs.readFileSync(path.join(engineDir, f), "utf8");
  bundle += `// ---- engine/${f} ${"-".repeat(Math.max(0, 60 - f.length))}\n`;
  bundle += stripModuleSyntax(src).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n\n";
}

const glue = fs.readFileSync(path.join(__dirname, "officescript", "glue.ts"), "utf8");
bundle += stripModuleSyntax(glue).trimEnd() + "\n";

const outPath = path.join(__dirname, "officescript", "BcbaComputeReports.osts");
fs.writeFileSync(outPath, bundle);
console.log("Wrote", path.relative(repoRoot, outPath), `(${bundle.length} bytes)`);
