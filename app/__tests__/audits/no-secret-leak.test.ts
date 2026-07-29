// Story 2.3 — AC #8-5 : aucun secret server-side ne fuit dans le bundle mobile.
// Vérifie qu'aucune référence littérale à TERMII, SERVICE_ROLE, ou clés Edge
// n'apparaît dans `app/src` ou `app/app`.

import * as fs from "node:fs";
import * as path from "node:path";

const ROOTS = [
  path.resolve(__dirname, "../../app"),
  path.resolve(__dirname, "../../src"),
];

const FORBIDDEN = [
  /\bTERMII_API_KEY\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bservice_role\b/i,
];

const EXTS = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
}

describe("Audit secret leak (Story 2.3)", () => {
  const files: string[] = [];
  for (const root of ROOTS) walk(root, files);

  it.each(FORBIDDEN.map((re) => [re.source]))(
    "aucun fichier mobile ne contient le pattern %s",
    (pattern: string) => {
      const re = new RegExp(pattern);
      const offenders = files.filter((f) => re.test(fs.readFileSync(f, "utf-8")));
      expect(offenders).toEqual([]);
    },
  );
});
