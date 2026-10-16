// Run against an Expo DEV server in explicit demo mode. No backend writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const out = path.resolve(
  process.env.QA_OUTPUT || "outputs/accueil-bande-2026-10-13"
);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 393, height: 852 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "spawt:spawter",
      JSON.stringify({
        id: "spawter_demo_001",
        display_name: "Revue locale",
        phone_e164: "+22507000000",
        stade: "touriste",
        total_spawts: 0,
        unique_spots: 0,
        is_internal: true,
        neighborhood: "Cocody Riviera",
        country_code: "CI",
        origin_country_code: "CI",
        avatar_url: null,
        gender: "non_renseigne",
        date_of_birth: null,
        age_range: null,
        customer_id: null,
        geoloc_consent_at: null,
        cgv_accepted_at: "2026-10-13T00:00:00Z",
        quiz_archetype: null,
        pionnier_seq: null,
        created_at: "2026-10-13T00:00:00Z",
        updated_at: "2026-10-13T00:00:00Z",
      })
    );
    localStorage.setItem(
      "spawt:palais",
      JSON.stringify({
        spawter_id: "spawter_demo_001",
        axe_racines_horizons: 0,
        axe_taniere_nomade: 0,
        axe_exigeant_enthousiaste: 0,
        axe_foule_secret: 0,
        axe_maquis_table: 0,
        confidence_score: 0,
        stade: "touriste",
        total_spawts: 0,
        dominant_axes: null,
        archetype_id: null,
        updated_at: "2026-10-13T00:00:00Z",
      })
    );
  });

  await page.goto(process.env.QA_URL || "http://localhost:8084");
  await page.getByTestId("home-mode-suggestions").waitFor({ timeout: 60000 });
  await page
    .getByTestId("app-opening")
    .waitFor({ state: "hidden", timeout: 15000 });
  await page.evaluate(() => document.fonts.ready);
  const feed = page.getByTestId("home-personalized-feed");
  const originalFeed = await feed.innerText();
  const shots = [];
  async function shot(name) {
    await page.screenshot({ path: path.join(out, name + ".png") });
    shots.push(name + ".png");
  }
  async function pick(key) {
    await page.getByTestId("home-mode-" + key).click();
    assert.equal(
      await page.getByTestId("home-mode-" + key).getAttribute("aria-checked"),
      "true"
    );
    assert.equal(
      await feed.innerText(),
      originalFeed,
      "personalized feed changed"
    );
  }
  for (const key of ["suggestions", "traine", "decouvre", "selections"]) {
    const svg = await page
      .getByTestId("home-mode-disc-" + key)
      .locator("svg")
      .evaluate((el) => el.outerHTML);
    assert(!svg.includes("<image"));
    fs.writeFileSync(
      path.join(out, "icone-" + key + ".svg"),
      svg.replace(/stroke="[^"]+"/, 'stroke="currentColor"').replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    );
  }
  await shot("accueil-suggestions-393");
  await pick("traine");
  await shot("accueil-se-poser-393");
  await pick("decouvre");
  await shot("accueil-decouvrir-393");
  await pick("selections");
  await page
    .getByText("Les carnets ne sont pas encore ouverts.", { exact: false })
    .waitFor();
  await shot("accueil-selections-fermees-393");
  // Enable the existing flag in this isolated browser only (not in the database).
  await page.evaluate(() => {
    const module = [...__r.getModules().values()].find(
      (m) => m.verboseName === "src/store/feature-flags.ts"
    );
    module.publicModule.exports.useFeatureFlagsStore
      .getState()
      .setLocalOverride("mode-explore", true);
  });
  await page
    .getByRole("button", { name: /maquis/i })
    .first()
    .waitFor();
  await shot("accueil-selections-393");
  await page.getByTestId("home-editorial").getByRole("button").first().click();
  await page.waitForURL("**/explore/maquis-braise");
  await page.getByRole("button", { name: "Retour", exact: true }).click();
  await page.getByTestId("home-mode-selections").waitFor();
  assert.equal(
    await page.getByTestId("home-mode-selections").getAttribute("aria-checked"),
    "true"
  );
  for (const key of [
    "suggestions",
    "traine",
    "decouvre",
    "selections",
    "traine",
    "suggestions",
  ])
    await pick(key);
  await page.getByTestId("home-editorial").getByRole("button").first().click();
  await page.waitForURL("**/place/**");
  await page
    .getByRole("button", { name: "Retour", exact: true })
    .first()
    .click();
  await page.getByTestId("home-mode-suggestions").waitFor();
  assert.equal(await feed.innerText(), originalFeed);
  // Real official cover in the pre-existing Bushman demo fixture. No invented source photos.
  const realCover = feed.getByRole("button", {
    name: "Bushman Café",
    exact: true,
  });
  await realCover.scrollIntoViewIfNeeded();
  await realCover
    .locator("img")
    .evaluateAll((imgs) =>
      Promise.all(imgs.map((img) => img.decode().catch(() => {})))
    );
  assert(
    await realCover
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.some(
          (img) => img.naturalWidth > 0 && img.src.includes("place-covers")
        )
      )
  );
  await shot("photo-source-bushman");
  await page.getByTestId("home-mode-suggestions").scrollIntoViewIfNeeded();
  // Browser text enlargement is an approximation, not Android/iOS system font-scale proof.
  const matrix = [];
  for (const width of [320, 360, 393, 430])
    for (const scale of [1, 1.3, 1.5]) {
      await page.setViewportSize({ width, height: 852 });
      await page.evaluate((scale) => {
        for (const el of document.querySelectorAll('[dir="auto"]')) {
          if (!el.dataset.qaFont) {
            const css = getComputedStyle(el);
            el.dataset.qaFont = css.fontSize;
            el.dataset.qaLine = css.lineHeight;
          }
          el.style.fontSize = parseFloat(el.dataset.qaFont) * scale + "px";
          if (el.dataset.qaLine !== "normal")
            el.style.lineHeight = parseFloat(el.dataset.qaLine) * scale + "px";
        }
      }, scale);
      const bounds = await page
        .getByRole("radiogroup")
        .getByRole("radio")
        .evaluateAll((nodes) =>
          nodes.map((el) => {
            const r = el.getBoundingClientRect();
            return {
              x: r.x,
              y: r.y,
              w: r.width,
              h: r.height,
              overflow: el.scrollWidth > el.clientWidth + 1,
            };
          })
        );
      assert.equal(bounds.length, 4);
      for (const b of bounds) {
        assert(b.w >= 44 && b.h >= 44);
        assert(!b.overflow);
      }
      assert(bounds.every((b) => Math.abs(b.y - bounds[0].y) < 1));
      const card = await page
        .getByTestId("home-editorial")
        .getByRole("button")
        .first()
        .boundingBox();
      assert(card && card.y < 650);
      matrix.push({
        width,
        textScale: scale,
        selector: bounds,
        firstEditorialTop: card.y,
      });
      await shot(`accueil-${width}-${Math.round(scale * 100)}`);
    }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-qa-font]")) {
      el.style.fontSize = el.dataset.qaFont;
      el.style.lineHeight = el.dataset.qaLine;
    }
  });
  // Explicit community fixtures exercise the real screen, never inserted remotely.
  await page.evaluate(() => {
    const mod = [...__r.getModules().values()].find(
      (m) => m.verboseName === "src/lib/data-source.ts"
    );
    const activity = [
      {
        kind: "review",
        id: "qa-r",
        place_id: "00000000-0000-0000-0000-000000000002",
        place_name: "Bushman Café",
        place_neighborhood: "Cocody Riviera",
        spawter_display_name: "Profil de test",
        note_etoiles: 4,
        texte_avis:
          "Une terrasse agréable pour découvrir une nouvelle adresse.",
        created_at: "2026-10-13T09:00:00Z",
      },
      {
        kind: "coup",
        id: "qa-c",
        place_id: "00000000-0000-0000-0000-000000000004",
        place_name: "Maquis Chez Tantie Rose",
        place_neighborhood: "Abobo Baoulé",
        spawter_display_name: "Autre profil de test",
        created_at: "2026-10-12T18:00:00Z",
      },
    ];
    mod.publicModule.exports.listCommunityPage = async ({ filter }) => ({ items: activity.filter(item => filter === "all" || item.kind === filter), next: null });
  });
  await page.getByRole("tab", { name: "La bande", exact: true }).click();
  await page.getByText("Une terrasse agréable", { exact: false }).waitFor();
  await shot("la-bande-393");
  assert.equal(
    await page.getByTestId("crew-toggle").getAttribute("aria-expanded"),
    "false"
  );
  await page.getByTestId("crew-toggle").click();
  await page.getByTestId("crew-block").waitFor();
  await shot("la-bande-crew-secondaire-393");
  await page.getByTestId("crew-toggle").click();
  const publicActivity = JSON.parse(fs.readFileSync("outputs/bande-v1-2026-10-13/public-activity.json", "utf8"));
  await page.evaluate((activity) => {
    const mod = [...__r.getModules().values()].find(m => m.verboseName === "src/lib/data-source.ts");
    mod.publicModule.exports.listCommunityPage = async ({filter}) => ({items: activity.items.filter(item => filter === "all" || item.kind === filter), next:null});
  }, publicActivity);
  for (const filter of ["coup", "review", "all", "coup", "all"]) {
    await page.getByTestId(`community-filter-${filter}`).click();
    await page.waitForTimeout(100);
    assert.equal(await page.getByTestId(`community-filter-${filter}`).getAttribute("aria-checked"),"true");
  }
  await page.waitForFunction(() => [...document.querySelectorAll('img')].every(img => img.complete), {timeout:20000});
  await shot("la-bande-activite-publique-393");
  await page.getByTestId("community-filter-coup").click();
  await page.getByTestId(/^community-coup-/).first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('img')].every(img => img.complete), {timeout:20000});
  await shot("la-bande-coups-publics-393");
  await page.setViewportSize({width:320,height:852});
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[dir="auto"]')) {
      const style=getComputedStyle(el);el.style.fontSize=parseFloat(style.fontSize)*1.5+"px";
      if(style.lineHeight!=="normal") el.style.lineHeight=parseFloat(style.lineHeight)*1.5+"px";
    }
  });
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=320));
  await page.waitForTimeout(300);
  const filterBounds = await page.getByTestId("community-filters").getByRole("radio").evaluateAll(nodes => nodes.map(el => { const r=el.getBoundingClientRect();return {y:r.y,height:r.height}; }));
  assert(filterBounds.every(b=>Math.abs(b.y-filterBounds[0].y)<1 && b.height>=44));
  await shot("la-bande-320-150");
  await page.setViewportSize({width:393,height:852});
  await page.getByRole("tab", { name: "Accueil", exact: true }).click();
  assert.equal(
    await page
      .getByTestId("home-mode-suggestions")
      .getAttribute("aria-checked"),
    "true"
  );
  assert.equal(await feed.innerText(), originalFeed);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, "browser-proof.json"),
    JSON.stringify(
      {
        source:
          "Expo web, local demo data; community fixtures; no backend writes",
        native: false,
        passed: true,
        shots,
        matrix,
        errors,
      },
      null,
      2
    )
  );
  await browser.close();
  console.log(
    JSON.stringify({
      passed: true,
      screenshots: shots.length,
      matrix: matrix.length,
      errors,
    })
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
