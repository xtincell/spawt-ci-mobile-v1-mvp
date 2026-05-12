#!/usr/bin/env node
// i18n check — Claude amendment 5.6
// Détecte les strings FR hardcodées hors fr.json dans les composants/screens.
// Usage : node scripts/i18n-check.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const SCAN_DIRS = ["src/components", "app"];
const EXTENSIONS = new Set([".tsx"]);

// Détecte des chaînes texte affichables : ouvertes par <Text>, ou retours JSX,
// avec au moins un mot français évident (accent, é, è, à, ç, ou mots typiques).
const FRENCH_LITERAL = /["'`]([A-ZÀÂÇÉÈÊËÎÏÔÙÛÜŸ][^"'`<>{}]{4,})["'`]/g;
const FRENCH_HINT = /[éèêëàâîïôùûüç]|\b(le|la|les|un|une|des|tu|ton|ta|tes|on|nous|vous|merci|bienvenue|continuer|valider)\b/i;

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
  // Skip files that are i18n setup themselves
  if (relPath.includes("i18n/")) return;

  FRENCH_LITERAL.lastIndex = 0;
  let match;
  while ((match = FRENCH_LITERAL.exec(content)) !== null) {
    const literal = match[1];
    if (!FRENCH_HINT.test(literal)) continue;
    // Ignore les imports / paths
    if (literal.startsWith("/") || literal.startsWith("./")) continue;
    const lineNum = content.slice(0, match.index).split("\n").length;
    console.error(
      `❌ ${relPath}:${lineNum} — string FR hardcodée: "${literal}" → utiliser t('clé')`,
    );
    errors++;
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
  console.error(`\n${errors} string(s) FR hardcodée(s). Extraire dans src/i18n/fr.json.`);
  process.exit(1);
} else {
  console.log("✓ Aucune string FR hardcodée hors fr.json.");
}
