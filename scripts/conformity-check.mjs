#!/usr/bin/env node
// SPAWT — Vérification mécanique de conformité (boucle adversariale).
// Lit documentation/conformity-checklist.yaml et exécute chaque assertion
// contre le repo réel. Zéro dépendance (Node >= 18).
//
// Usage :   node scripts/conformity-check.mjs
// Sortie :  rapport groupé par feature/section, ✅ / ❌ / ⚠️ (expected_pending)
// Exit :    1 si au moins un ❌ (les ⚠️ attendus ne cassent pas le build)
//
// Documentation : scripts/README.md

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKLIST = join(ROOT, "documentation", "conformity-checklist.yaml");

// ─────────────────────────── Mini-parseur YAML (sous-ensemble) ───────────────────────────
// Supporte exactement ce que la checklist utilise : maps imbriquées (indent 2),
// listes de scalaires (`- item`) et listes de maps (`- key: value` + suite),
// scalaires nus ou entre guillemets doubles, booléens true/false, commentaires
// pleine ligne (#). Les nombres restent des STRINGS (ex. "0040"). Tout écart de
// syntaxe non supporté doit faire échouer le parse plutôt que passer silencieusement.

function parseScalar(raw) {
  const s = raw.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return s;
}

function parseYaml(text) {
  const lines = [];
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim()) continue;
    if (/^\s*#/.test(rawLine)) continue; // commentaire pleine ligne uniquement
    const indent = rawLine.match(/^ */)[0].length;
    lines.push({ indent, content: rawLine.trim(), raw: rawLine });
  }

  function parseBlock(start, indent) {
    // Retourne { value, next }
    if (start >= lines.length) return { value: null, next: start };
    const isList = lines[start].indent === indent && lines[start].content.startsWith("- ");
    return isList ? parseList(start, indent) : parseMap(start, indent);
  }

  function parseMap(start, indent) {
    const map = {};
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.indent < indent) break;
      if (line.indent > indent) throw new Error(`YAML: indentation inattendue L${i}: ${line.raw}`);
      if (line.content.startsWith("- ")) break;
      const m = line.content.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error(`YAML: ligne non reconnue: ${line.raw}`);
      const key = m[1].trim();
      const rest = m[2].trim();
      if (rest) {
        map[key] = parseScalar(rest);
        i++;
      } else {
        const { value, next } = parseBlock(i + 1, indent + 2);
        map[key] = value;
        i = next;
      }
    }
    return { value: map, next: i };
  }

  function parseList(start, indent) {
    const arr = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.indent !== indent || !line.content.startsWith("- ")) break;
      const rest = line.content.slice(2);
      const kv = rest.match(/^([A-Za-z_][A-Za-z0-9_]*):(.*)$/);
      if (kv) {
        // item map : `- key: value` puis clés suivantes à indent+2
        const item = {};
        if (kv[2].trim()) {
          item[kv[1]] = parseScalar(kv[2]);
          i++;
        } else {
          const { value, next } = parseBlock(i + 1, indent + 4);
          item[kv[1]] = value;
          i = next;
        }
        const { value: extra, next } = parseMap(i, indent + 2);
        Object.assign(item, extra);
        i = next;
        arr.push(item);
      } else {
        arr.push(parseScalar(rest));
        i++;
      }
    }
    return { value: arr, next: i };
  }

  return parseMap(0, 0).value;
}

// ──────────────────────────────── Utilitaires de scan ────────────────────────────────

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".expo" || entry === ".git") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, exts, out);
    else if (exts.has(extname(entry))) out.push(full);
  }
  return out;
}

// Strip commentaires TS (même logique que app/scripts/lint-vocab.mjs) en
// préservant les numéros de ligne.
function stripComments(src) {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return noBlocks
    .split("\n")
    .map((line) => (/^\s*\/\//.test(line) ? "" : line))
    .join("\n");
}

function rel(p) {
  return p.slice(ROOT.length + 1).replace(/\\/g, "/");
}

const frJson = JSON.parse(readFileSync(join(ROOT, "app", "src", "i18n", "fr.json"), "utf8"));

function i18nLookup(dottedKey) {
  let node = frJson;
  for (const part of dottedKey.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

const migrationFiles = readdirSync(join(ROOT, "supabase", "migrations"));
const seedSql = readdirSync(join(ROOT, "supabase", "seed"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(ROOT, "supabase", "seed", f), "utf8"))
  .join("\n");
const appPkg = JSON.parse(readFileSync(join(ROOT, "app", "package.json"), "utf8"));

// ──────────────────────────────── Exécuteurs d'assertions ────────────────────────────────
// Chaque exécuteur retourne une liste de { ok, label, detail? }.

function checkFiles(paths = []) {
  return paths.map((p) => ({
    ok: existsSync(join(ROOT, p)),
    label: `file ${p}`,
    detail: "fichier manquant",
  }));
}

function checkSymbols(specs = []) {
  return specs.map((spec) => {
    const [file, name] = spec.split("#");
    const full = join(ROOT, file);
    if (!existsSync(full)) return { ok: false, label: `symbol ${spec}`, detail: "fichier manquant" };
    const src = readFileSync(full, "utf8");
    const decl = new RegExp(
      `(^|\\n)\\s*export\\s+(?:abstract\\s+)?(?:async\\s+)?(?:function|const|let|var|class|type|interface|enum)\\s+${name}\\b`,
    );
    const named = new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`);
    return {
      ok: decl.test(src) || named.test(src),
      label: `symbol ${spec}`,
      detail: `export \`${name}\` introuvable`,
    };
  });
}

function checkMigrations(nums = []) {
  const out = [];
  for (const n of nums) {
    const up = migrationFiles.find((f) => f.startsWith(`${n}_`) && f.endsWith(".sql") && !f.endsWith(".down.sql"));
    out.push({ ok: Boolean(up), label: `migration ${n}`, detail: "migration up manquante" });
    if (up) {
      const down = up.replace(/\.sql$/, ".down.sql");
      out.push({
        ok: migrationFiles.includes(down),
        label: `migration ${n} .down.sql`,
        detail: `${down} manquant`,
      });
    }
  }
  return out;
}

function checkI18n(keys = []) {
  return keys.map((k) => ({
    ok: i18nLookup(k) !== undefined,
    label: `i18n ${k}`,
    detail: "clé absente de fr.json",
  }));
}

function checkFlags(flags = []) {
  return flags.map((f) => ({
    ok: seedSql.includes(`'${f}'`),
    label: `flag ${f}`,
    detail: "flag_code absent des seeds supabase/seed/*.sql",
  }));
}

function checkDeps(deps = []) {
  const all = { ...(appPkg.dependencies || {}), ...(appPkg.devDependencies || {}) };
  return deps.map((d) => ({
    ok: d in all,
    label: `dep ${d}`,
    detail: "absente de app/package.json",
  }));
}

function checkAbsentPattern(pattern, { paths = ["app/src", "app/app"], stripTs = true } = {}) {
  const re = new RegExp(pattern, "i");
  const hits = [];
  for (const p of paths) {
    for (const file of walk(join(ROOT, p), new Set([".ts", ".tsx", ".json"]))) {
      let src = readFileSync(file, "utf8");
      if (stripTs && /\.tsx?$/.test(file)) src = stripComments(src);
      const m = src.match(re);
      if (m) hits.push(`${rel(file)} → « ${m[0]} »`);
    }
  }
  return [
    {
      ok: hits.length === 0,
      label: `absent /${pattern}/i`,
      detail: hits.slice(0, 5).join(" ; "),
    },
  ];
}

// ──────────────────────────────── Rapport ────────────────────────────────

let pass = 0;
let warn = 0;
let fail = 0;
const failures = [];

function report(sectionLabel, entryLabel, results, expectedPending, note) {
  const bad = results.filter((r) => !r.ok);
  let icon = "✅";
  if (bad.length > 0) icon = expectedPending ? "⚠️ " : "❌";
  else if (expectedPending && results.length === 0) icon = "⚠️ ";
  console.log(`${icon} ${entryLabel} (${results.length - bad.length}/${results.length} assertions)`);
  if (note && (bad.length > 0 || results.length === 0)) console.log(`     ↳ note : ${note}`);
  for (const r of results) {
    if (r.ok) pass++;
    else if (expectedPending) {
      warn++;
      console.log(`     ⚠ ${r.label} — ${r.detail} (expected_pending)`);
    } else {
      fail++;
      console.log(`     ✗ ${r.label} — ${r.detail}`);
      failures.push(`${sectionLabel} / ${entryLabel} : ${r.label}`);
    }
  }
}

const doc = parseYaml(readFileSync(CHECKLIST, "utf8"));

console.log("SPAWT — Conformité cahier (documentation/conformity-checklist.yaml)\n");

// ── Features ──
const features = doc.features || [];
console.log(`── Features (${features.length}) ──`);
for (const f of features) {
  const results = [
    ...checkFiles(f.files),
    ...checkSymbols(f.symbols),
    ...checkMigrations(f.migrations),
    ...checkI18n(f.i18n),
    ...checkFlags(f.flags),
    ...checkDeps(f.deps),
    ...(f.absent_pattern ? checkAbsentPattern(f.absent_pattern) : []),
  ];
  report("features", `${f.id} ${f.name}`, results, f.expected_pending === true, f.note);
}

// ── note_maj ──
console.log("\n── Note MAJ (textes exacts + OTP + R13) ──");
for (const t of doc.note_maj?.texts || []) {
  const actual = i18nLookup(t.key);
  report("note_maj", `${t.ref} ${t.key}`, [
    {
      ok: actual === t.equals,
      label: `texte exact`,
      detail: `attendu « ${t.equals} », trouvé « ${String(actual)} »`,
    },
  ]);
}
for (const c of doc.note_maj?.contains || []) {
  const full = join(ROOT, c.file);
  const src = existsSync(full) ? readFileSync(full, "utf8") : "";
  report("note_maj", `${c.ref} ${c.file}`, [
    {
      ok: src.includes(c.contains),
      label: `contient ${JSON.stringify(c.contains)}`,
      detail: "occurrence introuvable",
    },
  ]);
}
{
  const cfg = doc.note_maj?.no_on_pronoun;
  if (cfg) {
    // R13 — aucun pronom « on » dans les VALEURS de fr.json (tutoiement admis),
    // hors citations explicitement admises (allowlist).
    const allow = cfg.allow || [];
    const pronoun = /(^|[^\p{L}\p{N}_'’-])[Oo]n(?=$|[^\p{L}\p{N}_-])/u;
    const offenders = [];
    (function visit(node, path) {
      if (typeof node === "string") {
        let v = node;
        for (const a of allow) v = v.split(a).join("");
        if (pronoun.test(v)) offenders.push(path);
      } else if (node && typeof node === "object") {
        for (const [k, child] of Object.entries(node)) visit(child, path ? `${path}.${k}` : k);
      }
    })(frJson, "");
    report("note_maj", `${cfg.ref} purge du pronom « on » (${cfg.file})`, [
      {
        ok: offenders.length === 0,
        label: "aucun « on » hors allowlist",
        detail: offenders.slice(0, 8).join(", "),
      },
    ]);
  }
}

// ── contrat_spawt ──
console.log("\n── Contrat SPAWT (anti-compétition) ──");
for (const c of doc.contrat_spawt?.sql_table_lacks_column || []) {
  const up = migrationFiles.find(
    (f) => f.startsWith(`${c.migration}_`) && f.endsWith(".sql") && !f.endsWith(".down.sql"),
  );
  const results = [];
  if (!up) {
    results.push({ ok: false, label: `migration ${c.migration}`, detail: "introuvable" });
  } else {
    const sql = readFileSync(join(ROOT, "supabase", "migrations", up), "utf8");
    const tableRe = new RegExp(`CREATE TABLE[^(]*\\b${c.table}\\b\\s*\\(([\\s\\S]*?)\\n\\);`);
    const m = sql.match(tableRe);
    if (!m) {
      results.push({ ok: false, label: `CREATE TABLE ${c.table}`, detail: `bloc introuvable dans ${up}` });
    } else {
      results.push({
        ok: !new RegExp(`\\b${c.column}\\b`).test(m[1]),
        label: `${c.table} sans colonne ${c.column}`,
        detail: `colonne ${c.column} présente — violation du Contrat`,
      });
    }
  }
  report("contrat_spawt", `${c.migration}/${c.table} ⊬ ${c.column}`, results, false, c.note);
}
for (const g of doc.contrat_spawt?.grep_absent || []) {
  const results = checkAbsentPattern(g.pattern, {
    paths: g.paths,
    stripTs: g.strip_comments !== false,
  });
  report("contrat_spawt", g.id, results, false, g.note);
}

// ── da ──
console.log("\n── Direction artistique ──");
{
  const cfg = doc.da?.hex_scan;
  if (cfg) {
    const exclude = new Set((cfg.exclude || []).map((p) => join(ROOT, p)));
    const hexRe = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
    const hits = [];
    for (const p of cfg.paths || []) {
      for (const file of walk(join(ROOT, p), new Set([".ts", ".tsx"]))) {
        if (exclude.has(file)) continue;
        const src = readFileSync(file, "utf8");
        let m;
        hexRe.lastIndex = 0;
        while ((m = hexRe.exec(src)) !== null) {
          const line = src.slice(0, m.index).split("\n").length;
          hits.push(`${rel(file)}:${line} → ${m[0]}`);
        }
      }
    }
    report(
      "da",
      "aucun hex hors app/src/theme/tokens.ts",
      [{ ok: hits.length === 0, label: "hex scan", detail: hits.slice(0, 8).join(" ; ") }],
      false,
      cfg.note,
    );
  }
}

// ── enveloppe ──
console.log("\n── Enveloppe de livraison ──");
report("enveloppe", "deps natives figées (app/package.json)", checkDeps(doc.enveloppe?.deps || []));
{
  const cfg = doc.enveloppe?.eas_submit;
  if (cfg) {
    const src = readFileSync(join(ROOT, cfg.file), "utf8");
    const pending = src.includes(cfg.placeholder_marker);
    report(
      "enveloppe",
      `eas submit configuré (${cfg.file})`,
      [
        {
          ok: !pending,
          label: `aucun placeholder ${cfg.placeholder_marker}*`,
          detail: "identifiants stores non renseignés",
        },
      ],
      cfg.expected_pending === true,
      cfg.note,
    );
  }
}

// ── Résumé ──
console.log(`\nRésumé : ${pass} ✅ · ${warn} ⚠️ (expected_pending) · ${fail} ❌`);
if (fail > 0) {
  console.error("\nÉchecs bloquants :");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Conformité cahier : OK.");
