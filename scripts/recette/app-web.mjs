// =============================================================================
// SPAWT — recette de l'APP, au navigateur, contre le vrai backend
// =============================================================================
// C'est LE contrôle qui manquait le jour où un APK est parti vide : tout était
// vérifié par les tests, rien par l'usage. Un binaire dont la configuration de
// build est absente se dégrade silencieusement — les tests, eux, ne voient
// jamais la configuration de build.
//
// Ce que ça prouve, dans l'ordre où ça compte :
//   1. l'app démarre et n'affiche PAS « Configuration manquante » ;
//   2. l'onboarding va jusqu'au bout (OTP réel côté serveur, session GoTrue) ;
//   3. le feed affiche de VRAIS lieux, ceux de la base — pas des fixtures.
//
// Le point 3 est le seul qui distingue un APK utile d'un APK vide.
//
// Prérequis : l'app exportée en web AVEC l'URL du relais, cache vidé.
//   cd app && rm -rf .expo && EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:18083 \
//     EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon> npx expo export --platform web --clear \
//     --output-dir <dist>
//   ⚠️ Sans `--clear`, Metro sert un bundle en cache où la variable n'est pas
//   inlinée : on croit tester la configuration, on teste la précédente.
//
// Usage :
//   SUPABASE_URL=https://api.spawt.online APP_DIST=<dist> \
//     node scripts/recette/app-web.mjs [dossier-de-sortie]
// =============================================================================

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openBrowser, startHarness } from "./harness.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = process.env.APP_DIST;
const OUT = process.argv[2] ?? join(HERE, "..", "..", "recette-app");
const BACKEND = process.env.SUPABASE_URL ?? "https://api.spawt.online";
/** Numéro de recette + code du mock OTP (`MOCK_TERMII=true` côté serveur).
 *  Format E.164 COMPLET : l'écran valide sur `^\+225(0[1-9]\d{8}|2\d{8})$` et
 *  garde le bouton inactif sinon. Un numéro local sans indicatif n'affiche
 *  aucune erreur — le bouton reste simplement gris, ce qui ressemble à une
 *  panne quand on pilote au navigateur. */
const TEL = process.env.RECETTE_PHONE ?? "+2250700000199";
const CODE = process.env.RECETTE_OTP ?? "123456";

if (!DIST) {
  console.error("[recette] APP_DIST requis (dossier d'export web de l'app).");
  process.exit(1);
}

/** Des lieux RÉELS de la base — s'ils apparaissent, l'app ne sert pas de fixtures. */
const LIEUX_REELS = ["Bushman", "Kaiten", "Kajazoma", "Texas Grillz", "The Rooph", "Sam's", "Le Paon"];

const main = async () => {
  await mkdir(OUT, { recursive: true });
  const h = await startHarness({
    distDir: DIST,
    backend: BACKEND,
    port: Number(process.env.RECETTE_PORT ?? 18083),
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

  try {
    // ── 1. L'app démarre-t-elle branchée ? ──────────────────────────────────
    await page.goto(h.url + "/", { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(6000);
    const accueil = await texte();
    await shot("demarrage");
    const configManquante = /configuration manquante/i.test(accueil);
    rapport.push({
      etape: "démarrage",
      config_manquante: configManquante,
      extrait: accueil.slice(0, 220),
    });
    if (configManquante) {
      throw new Error("l'app démarre sur « Configuration manquante » — build non branché");
    }

    // ── 2. L'onboarding ─────────────────────────────────────────────────────
    // On pilote par testID plutôt qu'en cliquant « le dernier bouton visible » :
    // le parcours a un écran de consentement (obligation ARTCI) dont le bouton
    // reste inactif tant que les deux cases ne sont pas cochées. Un pilotage
    // aveugle s'y arrête sans rien dire — c'est ce qui s'est passé au premier
    // essai, et ça ressemblait à une panne alors que l'écran faisait son travail.
    const cliquer = async (id) => {
      const el = page.getByTestId(id);
      if ((await el.count()) === 0) return false;
      await el.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(900);
      return true;
    };

    // Écran d'accueil : un seul bouton « Rejoindre la bande ».
    await page.locator('[role="button"], button').last().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Consentement : les deux cases, puis continuer.
    await cliquer("consent-cgv");
    await cliquer("consent-geoloc");
    await shot("consentement");
    await cliquer("consent-continue");
    await page.waitForTimeout(2500);
    rapport.push({ etape: "consentement", extrait: (await texte()).slice(0, 160) });

    // Téléphone.
    const champTel = page.getByTestId("phone-input");
    if ((await champTel.count()) === 0) {
      await shot("bloque-avant-telephone");
      rapport.push({ etape: "onboarding", atteint_le_telephone: false, extrait: (await texte()).slice(0, 260) });
      throw new Error("écran téléphone jamais atteint");
    }
    await champTel.first().fill(TEL);
    await page.waitForTimeout(500);
    await shot("telephone");
    await cliquer("phone-send");
    await page.waitForTimeout(6000);
    await shot("otp-envoye");

    // Code : six cellules distinctes, une par chiffre.
    for (let i = 0; i < CODE.length; i += 1) {
      const cell = page.getByTestId(`otp-cell-${i}`);
      if ((await cell.count()) === 0) break;
      await cell.first().fill(CODE[i]).catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(9000);
    const apresOtp = await texte();
    await shot("apres-otp");
    rapport.push({ etape: "OTP", extrait: apresOtp.slice(0, 240) });

    // ── 3. Le profil ────────────────────────────────────────────────────────
    // Le bouton « Continuer » est inactif tant que nom + commune + date de
    // naissance ne sont pas valides. Les Select sont des bottom-sheets : il
    // faut ouvrir puis choisir une option, pas taper dans un champ.
    const choisir = async (id, cle) => {
      const champ = page.getByTestId(id);
      if ((await champ.count()) === 0) return false;
      await champ.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(800);
      const option = page.getByTestId(`${id}-option-${cle}`);
      if ((await option.count()) === 0) return false;
      await option.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(700);
      return true;
    };

    const champNom = page.getByTestId("profile-name");
    if ((await champNom.count()) > 0) {
      await champNom.first().fill("Recette Auto");
      await choisir("profile-commune", "cocody");
      // Date de naissance : ce n'est PAS un <input type="date"> mais un champ
      // texte masqué en JJ/MM/AAAA. Y écrire une date ISO donne « 19/92/0514 »,
      // le masque réordonne les chiffres et le bouton reste gris — sans le
      // moindre message d'erreur. Vu à l'écran, pas déduit.
      const dob = page.getByTestId("profile-dob-web");
      if ((await dob.count()) > 0) {
        await dob.first().fill("").catch(() => {});
        await dob.first().type("14051992", { delay: 60 }).catch(async () => {
          await dob.first().fill("14/05/1992").catch(() => {});
        });
      }
      await page.waitForTimeout(600);
      await shot("profil");
      await cliquer("profile-continue");
      await page.waitForTimeout(4000);
      rapport.push({ etape: "profil", extrait: (await texte()).slice(0, 200) });
    }

    // ── 4. Le feed sert-il de VRAIS lieux ? ─────────────────────────────────
    // Après le profil restent la calibration du Palais et la révélation
    // d'archétype. On les traverse par leurs boutons nommés plutôt qu'en
    // cliquant « le dernier bouton visible » : ce pilotage aveugle finissait par
    // ouvrir une feuille modale, puis un écran blanc — on croyait à un plantage
    // de l'app alors que c'était la recette qui se perdait.
    for (let i = 0; i < 30; i += 1) {
      const avance =
        (await cliquer("calibration-next")) ||
        (await cliquer("palais-reveal-continue")) ||
        (await cliquer("profile-continue"));
      if (!avance) {
        // Aucun bouton connu : soit on est arrivé, soit un écran intermédiaire
        // n'a qu'un CTA anonyme. On tente le premier bouton visible, une fois.
        const b = page.locator('[role="button"], button').first();
        if ((await b.count()) === 0) break;
        await b.click({ timeout: 3000 }).catch(() => {});
      }
      await page.waitForTimeout(1200);
      if ((await texte()).includes("ÉDITION DU JOUR")) break;
    }

    // Le feed est la racine : on y va explicitement plutôt que d'espérer y
    // tomber. La session est déjà en place, le routeur n'y renvoie pas à
    // l'onboarding.
    await page.goto(h.url + "/", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(7000);
    const final = await texte();
    const f = await shot("feed");
    const trouves = LIEUX_REELS.filter((l) => final.includes(l));
    rapport.push({
      etape: "feed",
      lieux_reels_affiches: trouves,
      capture: f,
      extrait: final.slice(0, 320),
    });

    // Le bouton central : la promesse fondatrice. Il doit soit lister des spots
    // proches, soit proposer d'en ajouter un — jamais être un cul-de-sac.
    // Le bouton central n'a pas de testID ; on le prend par sa position dans
    // la barre d'onglets (entre CARTE et LA BANDE).
    const fab = page.locator('[role="button"]').filter({ hasText: /^$/ }).last();
    if ((await fab.count()) > 0) {
      await fab.first().click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(5000);
      const t = await texte();
      const g = await shot("bouton-central");
      rapport.push({
        etape: "bouton central",
        lieux_proches: LIEUX_REELS.filter((l) => t.includes(l)),
        propose_d_ajouter: /ajoute-le/i.test(t),
        capture: g,
        extrait: t.slice(0, 220),
      });
    }
  } catch (e) {
    rapport.push({ etape: "ERREUR", message: e.message });
    console.error("[recette] " + e.message);
  } finally {
    const appels = h.apiCalls.filter((c) => /\/rest\/|\/functions\//.test(c.path ?? c.url ?? ""));
    await writeFile(
      join(OUT, "rapport.json"),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          backend: BACKEND,
          appels_backend: appels.slice(-40),
          erreurs_console: errors.slice(0, 25),
          etapes: rapport,
        },
        null,
        2,
      ),
    );
    for (const r of rapport) console.log("  " + JSON.stringify(r).slice(0, 400));
    console.log(`\n[recette] ${n} captures + rapport.json dans ${OUT}`);
    console.log(`[recette] appels backend observés : ${appels.length}`);
    await browser.close();
    await h.close();
  }
};

main();
