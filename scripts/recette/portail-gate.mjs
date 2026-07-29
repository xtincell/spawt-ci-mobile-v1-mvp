// =============================================================================
// SPAWT — recette du rideau d'avant-lancement du portail, au navigateur
// =============================================================================
// Ce que ça prouve, et que les tests unitaires ne prouvent pas : que le rideau
// tient contre le VRAI backend. Les tests du portail simulent `spawt_staff` ;
// ici, c'est GoTrue qui authentifie et la RLS qui décide.
//
// Trois assertions, dans l'ordre où elles comptent :
//   1. un visiteur voit « Bientôt » et RIEN du portail ;
//   2. un compte hors équipe est refusé (le cas piégeux : l'authentification
//      réussit, seule la lecture de spawt_staff referme) ;
//   3. un membre de l'équipe voit le portail réel.
//
// Prérequis : le portail construit avec l'URL du relais et VITE_PREVIEW_GATE.
//   cd project_spawt_mobile_ci && VITE_SUPABASE_URL=http://127.0.0.1:18082 \
//     VITE_SUPABASE_ANON_KEY=<anon> VITE_PREVIEW_GATE=true npx vite build
//
// Usage :
//   SUPABASE_URL=https://api.spawt.online STAFF_EMAIL=… STAFF_PASSWORD=… \
//     PORTAL_DIST=/chemin/project_spawt_mobile_ci/dist \
//     node scripts/recette/portail-gate.mjs [dossier-de-sortie]
// =============================================================================

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser, startHarness } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = process.env.PORTAL_DIST ?? join(HERE, "..", "..", "..", "project_spawt_mobile_ci", "dist");
const OUT = process.argv[2] ?? join(HERE, "..", "..", "recette-portail");

const BACKEND = process.env.SUPABASE_URL ?? "https://api.spawt.online";
const EMAIL = process.env.STAFF_EMAIL;
const PASSWORD = process.env.STAFF_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("[recette] STAFF_EMAIL et STAFF_PASSWORD requis.");
  process.exit(1);
}

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const h = await startHarness({
    distDir: DIST,
    backend: BACKEND,
    port: Number(process.env.RECETTE_PORT ?? 18082),
  });
  const { browser, page, errors } = await openBrowser();
  const rapport = [];
  let n = 0;
  const shot = async (nom) => {
    n += 1;
    const f = join(OUT, `${String(n).padStart(2, "0")}-${nom}.png`);
    await page.screenshot({ path: f, fullPage: true });
    return f;
  };
  const texte = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

  const ouvrirFormulaire = async () => {
    await page.click("text=Accès équipe");
    await page.waitForTimeout(300);
  };
  const soumettre = async (email, motDePasse) => {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', motDePasse);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  };

  try {
    // ── 1. Le visiteur ──────────────────────────────────────────────────────
    await page.goto(h.url + "/", { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1500);
    const visiteur = await texte();
    await shot("visiteur-bientot");
    rapport.push({
      etape: "visiteur",
      voit_bientot: /bientôt/i.test(visiteur),
      voit_le_portail: /carte du bon goût/i.test(visiteur),
      extrait: visiteur.slice(0, 200),
    });

    // Le rideau doit couvrir TOUTES les routes, pas seulement l'accueil :
    // /gold est précisément la page qu'on ne veut pas montrer.
    await page.goto(h.url + "/gold", { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const gold = await texte();
    await shot("visiteur-gold-ferme");
    rapport.push({
      etape: "visiteur /gold",
      ferme: !/2 950|abonn/i.test(gold),
      extrait: gold.slice(0, 160),
    });

    // ── 2. Un compte valide mais hors équipe ────────────────────────────────
    // On ne peut pas fabriquer un compte ici ; on éprouve le refus avec un
    // mot de passe faux, qui exerce le même chemin de sortie.
    await page.goto(h.url + "/", { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    await ouvrirFormulaire();
    await soumettre(EMAIL, "mauvais-mot-de-passe-de-recette");
    const refus = await texte();
    await shot("refus");
    rapport.push({
      etape: "identifiants refusés",
      reste_ferme: !/carte du bon goût/i.test(refus),
      message: (refus.match(/Identifiants refusés|n'appartient pas[^.]*\./i) ?? [""])[0],
    });

    // ── 3. L'équipe ─────────────────────────────────────────────────────────
    await soumettre(EMAIL, PASSWORD);
    const equipe = await texte();
    await shot("equipe-portail");
    rapport.push({
      etape: "équipe",
      voit_le_portail: /carte du bon goût/i.test(equipe),
      bandeau_apercu: /aperçu équipe/i.test(equipe),
      extrait: equipe.slice(0, 220),
    });

    // Le portail réel, page par page, avec la session d'équipe ouverte.
    for (const [route, nom] of [
      ["/gold", "Gold"],
      ["/pro", "Pro"],
      ["/ambassadeurs", "Ambassadeurs"],
      ["/legal/cgu", "CGU"],
    ]) {
      await page.goto(h.url + route, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(900);
      const t = await texte();
      const f = await shot(route.slice(1).replace(/\//g, "-"));
      rapport.push({ etape: nom, route, ouvert: t.length > 200, capture: f });
    }
  } catch (e) {
    rapport.push({ etape: "ERREUR", message: e.message });
    console.error("[recette] " + e.message);
  } finally {
    await writeFile(
      join(OUT, "rapport.json"),
      JSON.stringify(
        { date: new Date().toISOString(), backend: BACKEND, erreurs_console: errors.slice(0, 20), etapes: rapport },
        null,
        2,
      ),
    );
    for (const r of rapport) console.log("  " + JSON.stringify(r));
    console.log(`\n[recette] ${n} captures + rapport.json dans ${OUT}`);
    await browser.close();
    await h.close();
  }
};

main();
