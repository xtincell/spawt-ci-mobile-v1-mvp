// =============================================================================
// SPAWT — recette de la console admin, au navigateur, contre le vrai backend
// =============================================================================
// Ce que ça prouve, et que les tests unitaires ne prouvaient pas : que la
// console **s'ouvre**, que la **connexion staff aboutit**, et que chaque écran
// **rend quelque chose** en lisant la vraie base.
//
// Prérequis :
//   cd spawt-admin && VITE_SUPABASE_URL=<url du relais> \
//     VITE_SUPABASE_ANON_KEY=<clé anon> npm run build
//   (l'URL du backend est figée dans le bundle par Vite — c'est le piège qui a
//   laissé admin.spawt.online pointer des semaines vers un projet supprimé)
//
// Usage :
//   SUPABASE_URL=https://api.spawt.online STAFF_EMAIL=… STAFF_PASSWORD=… \
//     node scripts/recette/admin.mjs [dossier-de-sortie]
// =============================================================================

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser, startHarness } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "..", "spawt-admin", "dist");
const OUT = process.argv[2] ?? join(HERE, "..", "..", "recette-admin");

const BACKEND = process.env.SUPABASE_URL ?? "https://api.spawt.online";
const EMAIL = process.env.STAFF_EMAIL;
const PASSWORD = process.env.STAFF_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("[recette] STAFF_EMAIL et STAFF_PASSWORD requis.");
  process.exit(1);
}

/** Les écrans que l'exploitation doit pouvoir ouvrir, dans l'ordre du menu. */
const ECRANS = [
  ["/lieux", "Lieux"],
  ["/moderation", "Modération"],
  ["/signalements", "Signalements"],
  ["/suggestions", "Suggestions de lieux"],
  ["/evenements", "Événements"],
  ["/promotions", "Promotions"],
  ["/defis", "Défis collectifs"],
  ["/comptes", "Comptes"],
  ["/metriques", "Métriques"],
  ["/fonctionnalites", "Fonctionnalités"],
  ["/b2b", "B2B"],
  ["/push", "Campagnes push"],
  ["/explore", "Explore"],
];

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const h = await startHarness({ distDir: DIST, backend: BACKEND, port: Number(process.env.RECETTE_PORT ?? 18081) });
  const { browser, page, errors } = await openBrowser();
  const rapport = [];
  let n = 0;
  const shot = async (nom) => {
    n += 1;
    const f = join(OUT, `${String(n).padStart(2, "0")}-${nom}.png`);
    await page.screenshot({ path: f, fullPage: true });
    return f;
  };

  try {
    // ── 1. La console s'ouvre-t-elle ? ──────────────────────────────────────
    await page.goto(h.url + "/", { waitUntil: "networkidle", timeout: 45000 });
    const texteAccueil = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    await shot("login");
    rapport.push({ etape: "ouverture", url: page.url(), extrait: texteAccueil.slice(0, 160) });

    if (/configuration incomplète/i.test(texteAccueil)) {
      throw new Error("la console affiche l'écran de configuration manquante — bundle mal construit");
    }

    // ── 2. Connexion staff réelle ───────────────────────────────────────────
    await page.fill('input[type="email"], input[name="email"]', EMAIL);
    await page.fill('input[type="password"], input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(5000);
    const apresLogin = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
    await shot("apres-connexion");
    const connecte = !/mot de passe|identifiants|invalid/i.test(apresLogin) && !page.url().endsWith("/login");
    rapport.push({ etape: "connexion", reussie: connecte, url: page.url(), extrait: apresLogin.slice(0, 200) });
    if (!connecte) throw new Error("connexion staff refusée — voir la capture");

    // ── 3. Chaque écran s'ouvre-t-il ? ──────────────────────────────────────
    for (const [route, nom] of ECRANS) {
      await page.goto(h.url + route, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1200);
      const t = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();
      const f = await shot(route.slice(1).replace(/\//g, "-"));
      // Un écran « vide » (0 ligne) est un résultat légitime ; un écran qui
      // n'affiche RIEN du tout, ou une erreur, ne l'est pas.
      const casse = t.length < 40 || /Something went wrong|Erreur inattendue|TypeError/i.test(t);
      rapport.push({ etape: nom, route, ok: !casse, capture: f, extrait: t.slice(0, 180) });
      console.log(`  ${casse ? "ÉCHEC " : "ok    "} ${nom.padEnd(24)} ${t.slice(0, 70).replace(/\n/g, " ")}`);
    }
  } catch (e) {
    rapport.push({ etape: "ERREUR", message: e.message });
    console.error("[recette] " + e.message);
  } finally {
    const resume = {
      date: new Date().toISOString(),
      backend: BACKEND,
      erreurs_console: errors.slice(0, 20),
      appels_api: h.apiCalls.slice(-60),
      etapes: rapport,
    };
    await writeFile(join(OUT, "rapport.json"), JSON.stringify(resume, null, 2));
    console.log(`\n[recette] ${n} captures + rapport.json dans ${OUT}`);
    console.log(`[recette] erreurs console : ${errors.length}`);
    await browser.close();
    await h.close();
  }
};

main();
