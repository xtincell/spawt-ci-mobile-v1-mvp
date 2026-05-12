#!/usr/bin/env node
// Audit anti-drift vocabulaire SPAWT (Moka §4.3)
// Détecte les mots interdits dans le code de prod (composants, screens, libs).
// Usage : node scripts/lint-vocab.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const SCAN_DIRS = ["src", "app"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

// Patterns interdits avec exceptions explicites
const FORBIDDEN = [
  {
    pattern: /\brestaurant(s)?\b/gi,
    name: "restaurant",
    message: "Utiliser 'lieu' ou 'spot' (PRD §19, Moka §4.3)",
    allowFiles: ["i18n/", "personas/"],
  },
  {
    pattern: /\bcheck-?in\b/gi,
    name: "check-in",
    message: "Utiliser 'spawt' (PRD §19)",
    allowFiles: ["spawt.ts" /* type technique : spawt_checkin */, "i18n/"],
  },
  {
    pattern: /\bleaderboard\b|\branking\b|\bclassement\b/gi,
    name: "compétition",
    message: "Mécanique compétitive interdite (PRD §20.1 Contrat à la Tribu)",
    allowFiles: [],
  },
  {
    pattern: /\bgamif/gi,
    name: "gamification",
    message: "SPAWT ne gamifie pas (Alexandre persona)",
    allowFiles: [],
  },
];

let errors = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".expo") continue;
      walk(full);
    } else if (EXTENSIONS.has(extname(entry))) {
      checkFile(full);
    }
  }
}

function checkFile(path) {
  const content = readFileSync(path, "utf8");
  const relPath = path.replace(ROOT, "");
  for (const rule of FORBIDDEN) {
    if (rule.allowFiles.some((a) => relPath.includes(a))) continue;
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      console.error(
        `❌ ${relPath}:${lineNum} — '${match[0]}' interdit (${rule.name}). ${rule.message}`,
      );
      errors++;
    }
  }
}

for (const d of SCAN_DIRS) {
  try {
    walk(join(ROOT, d));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

if (errors > 0) {
  console.error(`\n${errors} occurrence(s) interdite(s). Voir Moka §4.3.`);
  process.exit(1);
} else {
  console.log("✓ Vocabulaire SPAWT respecté.");
}
