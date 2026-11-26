// Compile both admin versions with the same fixture configuration before running:
// VITE_SUPABASE_URL=https://auth.spawt-ux.test VITE_SUPABASE_ANON_KEY=fixture \
//   VITE_STAFF_RECOVERY_ENABLED=true npm run build
// node scripts/ux-staff-recovery.mjs <before-dist> <after-dist> <evidence-dir>
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const [beforeDist, afterDist, evidenceDir] = process.argv.slice(2).map((path) => resolve(path));
assert(beforeDist && afterDist && evidenceDir, "Pass both dist directories and a destination.");

const app = "https://panel.spawt-ux.test";
const auth = "https://auth.spawt-ux.test";
const routes = new Set(["/", "/login", "/mot-de-passe-oublie", "/reinitialiser", "/lieux"]);
const fixtures = {
  known: "equipe@example.test",
  unknown: "inconnue@example.test",
  password: "Recette-locale-2026",
  hash: "a".repeat(56),
};
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: fixtures.known,
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-11-26T08:00:00Z",
};
const staff = { id: user.id, role: "operator", display_name: "Équipe de test" };

function mockSession() {
  const claim = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = [claim({ alg: "HS256" }), claim({ sub: user.id, exp: expiresAt }), "fixture"].join(".");
  return {
    access_token: token,
    refresh_token: "fixture-only",
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: "bearer",
    user,
  };
}

async function installFixtures(context, dist) {
  const record = [];
  const blocked = [];
  const state = { recoveryMode: "normal", resetMode: "expired", recoveryBarrier: null, resetBarrier: null };
  const cors = {
    "access-control-allow-origin": app,
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS,HEAD",
  };

  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === app) {
      if (routes.has(url.pathname)) return route.fulfill({ path: join(dist, "index.html") });
      if (/^\/assets\/[\w.-]+$/.test(url.pathname)) {
        return route.fulfill({ path: join(dist, url.pathname.slice(1)) });
      }
      if (url.pathname === "/favicon.ico") return route.fulfill({ status: 204 });
    }

    if (url.origin === auth) {
      const method = request.method();
      const path = url.pathname;
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const body = request.postDataJSON();
      record.push({ method, path, scope: url.searchParams.get("scope") });
      const reply = (json, status = 200) => route.fulfill({ status, json, headers: cors });
      const reject = (error_code, status = 400) => reply({ error_code, msg: error_code }, status);

      if (path === "/auth/v1/token" && method === "POST") {
        return body?.email === fixtures.known && body?.password === fixtures.password
          ? reply(mockSession())
          : reject("invalid_credentials");
      }
      if (path === "/auth/v1/recover" && method === "POST") {
        const { recoveryMode, recoveryBarrier } = state;
        if (recoveryBarrier) await recoveryBarrier;
        if (recoveryMode === "transport") return route.abort("failed");
        if (recoveryMode === "rate-limit") return reject("over_email_send_rate_limit", 429);
        if (recoveryMode === "server-error") return reject("unexpected_failure", 500);
        return body?.email === fixtures.known ? reply({}) : reject("user_not_found");
      }
      if (path === "/auth/v1/verify" && method === "POST") {
        if (state.resetBarrier) await state.resetBarrier;
        return state.resetMode === "active" && body?.type === "recovery" && body?.token_hash === fixtures.hash
          ? reply(mockSession())
          : reject("otp_expired", 403);
      }
      if (path === "/auth/v1/user" && method === "GET") return reply(user);
      if (path === "/auth/v1/user" && method === "PUT") {
        return body?.password === fixtures.password ? reply(user) : reject("weak_password");
      }
      if (path === "/auth/v1/logout" && method === "POST") {
        return route.fulfill({ status: 204, headers: cors });
      }
      if (path === "/rest/v1/rpc/current_staff") return reply([staff]);
      if (path === "/rest/v1/admin_audit_log" && method === "POST") {
        return route.fulfill({ status: 201, headers: cors });
      }
      if (path.startsWith("/rest/v1/") && method === "GET") {
        return route.fulfill({ json: [], headers: { ...cors, "content-range": "*/0" } });
      }
    }

    blocked.push(url.origin + url.pathname);
    return route.abort("blockedbyclient");
  });

  return { record, blocked, state };
}

async function waitFor(check, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error(message);
}

async function geometry(page) {
  return page.evaluate(() => {
    const visible = (node) => node.getClientRects().length && node.getBoundingClientRect().height > 0;
    const describe = (node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return {
        name: node.labels?.[0]?.textContent.trim() || node.textContent.trim(),
        type: node.matches("input") ? node.type : node.tagName.toLowerCase(),
        height: Math.round(height * 10) / 10,
        bounds: { x, y, width, height },
        labelBounds: node.labels?.[0]?.getBoundingClientRect().toJSON() ?? null,
      };
    };
    const fields = [...document.querySelectorAll("input")].filter(visible);
    const controls = [...document.querySelectorAll("input, button, a[href]")].filter(visible);
    const field = fields[0];
    const styles = field ? getComputedStyle(field) : null;
    const bg = field ? getComputedStyle(field.closest("form")).backgroundColor : null;
    const card = document.querySelector(".staff-access__card");
    const surface = document.querySelector("main, #root > div");
    const cardBackground = card ? getComputedStyle(card).backgroundColor : null;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      controls: controls.map(describe),
      field: styles ? {
        color: styles.borderTopColor,
        background: styles.backgroundColor,
        adjacent: cardBackground || bg || getComputedStyle(document.body).backgroundColor,
        width: styles.borderTopWidth,
        fontSize: styles.fontSize,
      } : null,
      surface: surface?.getBoundingClientRect().toJSON() ?? null,
    };
  });
}

function channel(color) {
  assert.match(color || "", /^rgba?\(/);
  return color.match(/[\d.]+/g).map(Number);
}

function composite(color, parent = [255, 255, 255]) {
  const [r, g, b, opacity = 1] = channel(color);
  return [r, g, b].map((value, index) => value * opacity + parent[index] * (1 - opacity));
}

function contrast(a, b) {
  const luminance = (color) => color.reduce((sum, value, index) => {
    const sRgb = value / 255;
    const linear = sRgb <= 0.04045 ? sRgb / 12.92 : ((sRgb + 0.055) / 1.055) ** 2.4;
    return sum + [0.2126, 0.7152, 0.0722][index] * linear;
  }, 0);
  const one = luminance(a), two = luminance(b);
  return Number(((Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05)).toFixed(2));
}

function boundary(field) {
  if (!field) return null;
  const adjacent = composite(field.adjacent);
  const fill = composite(field.background, adjacent);
  const border = composite(field.color, fill);
  return { inside: contrast(border, fill), outside: contrast(border, adjacent) };
}

async function focused(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    const style = getComputedStyle(node);
    return {
      element: node.tagName.toLowerCase(),
      name: (node.labels?.[0]?.textContent || node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 180),
      type: node.matches("input") ? node.type : null,
      role: node.getAttribute("role"),
      outline: node.matches(":focus-visible") ? {
        color: style.outlineColor,
        style: style.outlineStyle,
        width: style.outlineWidth,
        offset: style.outlineOffset,
        adjacent: getComputedStyle(document.querySelector(".staff-access__card") || document.body).backgroundColor,
      } : null,
    };
  });
}

async function screenshot(page, file) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode()));
  });
  await page.screenshot({ path: join(evidenceDir, file + ".png"), animations: "disabled" });
}

async function runView(browser, variant, dist, viewport, device) {
  const candidate = variant === "after";
  const context = await browser.newContext({
    viewport,
    isMobile: device === "mobile",
    hasTouch: device === "mobile",
    serviceWorkers: "block",
    locale: "fr-FR",
  });
  const { state, record, blocked } = await installFixtures(context, dist);
  const page = await context.newPage();
  const shot = (stateName) => screenshot(page, [variant, device, stateName].join("-"));
  const go = async (path) => {
    await page.goto(app + path);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
  };
  const metrics = { viewport, screens: {} };
  async function observe(name) {
    const screen = await geometry(page);
    metrics.screens[name] = { ...screen, boundary: boundary(screen.field) };
    if (candidate) {
      assert(screen.documentWidth <= screen.viewportWidth, name + ": horizontal overflow");
      for (const control of screen.controls) {
        assert(control.height >= 44, name + ": small target " + control.name);
      }
      if (screen.field) assert(screen.field.fontSize === "16px" && boundary(screen.field).outside >= 3);
    }
    await shot(name);
  }

  try {
    await go("/login");
    await page.getByRole("link", { name: /Mot de passe oublié/ }).waitFor();
    assert.equal(await page.getByLabel("Mot de passe", { exact: true }).count(), 1);
    await observe("login");
    metrics.keyboard = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      const target = await focused(page);
      if (target.outline) {
        target.outline.contrast = contrast(composite(target.outline.color), composite(target.outline.adjacent));
      }
      metrics.keyboard.push(target);
      if (i === 0) await shot("login-focus");
    }
    if (candidate) {
      assert.deepEqual(metrics.keyboard.map((target) => target.type || target.element), ["email", "password", "button", "a"]);
      assert(metrics.keyboard.every((target) => target.outline?.contrast >= 3 && target.outline?.width === "3px"));
    }
    await page.keyboard.press("Enter");
    await page.waitForURL(app + "/mot-de-passe-oublie");
    if (candidate) await waitFor(async () => (await focused(page)).element === "h1", "Recovery heading unfocused");
    metrics.recoveryEntryFocus = await focused(page);

    await go("/login");
    const secret = page.getByLabel("Mot de passe", { exact: true });
    await page.locator("input[type=email]").fill(fixtures.known);
    await secret.fill("fixture-refus");
    const refusal = page.waitForResponse((response) => response.url().startsWith(auth + "/auth/v1/token") && response.status() === 400);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await refusal;
    await waitFor(async () => await page.getByRole("button", { name: "Se connecter" }).count() === 1, "Login did not finish");
    const loginAlert = page.getByRole("alert").filter({ hasText: /Impossible de se connecter/ });
    if (candidate) await loginAlert.waitFor();
    metrics.loginRefusal = { alert: await loginAlert.count(), retryAvailable: await secret.isEditable() };
    await shot("login-refused");
    assert.equal(metrics.loginRefusal.alert, Number(candidate));
    await secret.fill(fixtures.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await page.waitForURL(app + "/lieux");
    metrics.loginRefusal.retryReachedLieux = true;
    assert(record.some((call) => call.path === "/rest/v1/admin_audit_log" && call.method === "POST"));

    let release;
    async function recover(address, name, waitInProgress = false) {
      if (waitInProgress) state.recoveryBarrier = new Promise((done) => { release = done; });
      await go("/mot-de-passe-oublie");
      const initialFocus = await focused(page);
      if (waitInProgress) await observe("request");
      await page.locator("input[type=email]").fill(address);
      const submit = page.getByRole("button", { name: /Envoyer/ });
      const count = record.length;
      await submit.press("Enter");
      await waitFor(() => record.slice(count).some((entry) => entry.path === "/auth/v1/recover"), "No fixture recovery request");
      if (waitInProgress) {
        try {
          const button = page.locator("form button[type=submit]");
          metrics.requestPending = { label: await button.innerText(), disabled: await button.isDisabled() };
          assert.equal(metrics.requestPending.disabled, true);
          if (candidate) assert.match(metrics.requestPending.label, /en cours/i);
          await shot("request-pending");
        } finally {
          release();
          state.recoveryBarrier = null;
        }
      }
      const confirmation = page.getByRole("status").filter({ hasText: /Si cette adresse/ });
      await confirmation.waitFor();
      if (candidate) await waitFor(async () => (await focused(page)).role === "status", "Confirmation unfocused");
      if (name) await observe(name);
      return { text: await confirmation.innerText(), initialFocus, focus: await focused(page) };
    }
    const known = await recover(fixtures.known, "request-confirmed", true);
    const unknown = await recover(fixtures.unknown);
    assert.equal(known.text, unknown.text);
    if (candidate) {
      assert.equal(known.initialFocus.element, "h1");
      assert.notEqual(known.focus.element, "body");
    }
    metrics.requestConfirmation = {
      identicalAcrossResponses: true,
      simulatedHttpStatuses: [200, 400],
      text: known.text,
      initialFocus: known.initialFocus,
      focus: known.focus,
    };
    if (candidate) {
      for (const [mode, status] of [["rate-limit", 429], ["server-error", 500]]) {
        state.recoveryMode = mode;
        assert.equal((await recover(fixtures.known)).text, known.text);
        metrics.requestConfirmation.simulatedHttpStatuses.push(status);
      }
      await page.getByRole("button", { name: "Faire une nouvelle demande" }).press("Enter");
      await waitFor(async () => (await focused(page)).type === "email", "New request field unfocused");
      assert.equal(await page.locator("input[type=email]").inputValue(), "");
      metrics.requestConfirmation.newRequestFocus = await focused(page);
    }

    state.recoveryMode = candidate ? "transport" : "rate-limit";
    await go("/mot-de-passe-oublie");
    const emailField = page.locator("input[type=email]");
    await emailField.fill(fixtures.known);
    await page.locator("form button[type=submit]").click();
    const unavailable = page.getByRole("alert");
    await unavailable.waitFor();
    metrics.requestRetry = {
      simulatedFailure: candidate ? "transport" : "HTTP 429",
      message: await unavailable.innerText(),
      retainedEmail: (await emailField.inputValue()) === fixtures.known,
    };
    assert(metrics.requestRetry.retainedEmail);
    await shot("request-retry");
    state.recoveryMode = "normal";
    await page.locator("form button[type=submit]").click();
    await page.getByRole("status").filter({ hasText: /Si cette adresse/ }).waitFor();
    metrics.requestRetry.confirmed = true;

    const resetUrl = "/reinitialiser#token_hash=" + fixtures.hash;
    const verifyCount = () => record.filter((call) => call.path === "/auth/v1/verify" && call.method === "POST").length;
    const updateCalls = () => record.filter((call) => call.path === "/auth/v1/user" && call.method === "PUT").length;
    const fillReset = async (confirmation = fixtures.password) => {
      const inputs = page.locator("input[type=password]");
      await inputs.nth(0).fill(fixtures.password);
      await inputs.nth(1).fill(confirmation);
      await page.locator("form button[type=submit]").press("Enter");
    };
    const verifyBefore = verifyCount();
    const updateBefore = updateCalls();
    await go(resetUrl);
    await observe("reset");
    assert.equal(new URL(page.url()).hash, "");
    assert.equal(verifyCount(), verifyBefore);
    await fillReset();
    const expired = page.getByRole("alert").filter({ hasText: /expiré|invalide/i });
    await expired.waitFor();
    if (candidate) await waitFor(async () => (await focused(page)).role === "alert", "Expiration alert unfocused");
    assert.equal(verifyCount(), verifyBefore + 1);
    assert.equal(updateCalls(), updateBefore);
    metrics.expiration = { focus: await focused(page), message: await expired.innerText() };
    if (candidate) assert.notEqual(metrics.expiration.focus.element, "body");
    await observe("expired");
    await page.getByRole("link", { name: /nouveau lien/i }).click();
    await page.waitForURL(app + "/mot-de-passe-oublie");
    if (candidate) await waitFor(async () => (await focused(page)).element === "h1", "New link route heading unfocused");
    metrics.expiration.newLinkFocused = await focused(page);

    state.resetMode = "active";
    await go(resetUrl);
    const verifyAfterExpiry = verifyCount();
    await fillReset("Confirmation-incorrecte");
    const mismatch = page.getByRole("alert").filter({ hasText: /identiques|correspond/i });
    await mismatch.waitFor();
    assert.equal(verifyCount(), verifyAfterExpiry);
    metrics.passwordMismatch = { focus: await focused(page), message: await mismatch.innerText() };
    if (candidate) assert.equal(metrics.passwordMismatch.focus.type, "password");
    await shot("reset-mismatch");
    await page.locator("input[type=password]").nth(1).fill(fixtures.password);
    let completeReset;
    state.resetBarrier = new Promise((done) => { completeReset = done; });
    try {
      const submit = page.locator("form button[type=submit]");
      await submit.press("Enter");
      await waitFor(() => verifyCount() === verifyAfterExpiry + 1, "No fixture verification request");
      metrics.resetPending = { label: await submit.innerText(), disabled: await submit.isDisabled() };
      assert(metrics.resetPending.disabled);
      if (candidate) assert.match(metrics.resetPending.label, /en cours/i);
      assert.equal(updateCalls(), updateBefore);
      await shot("reset-pending");
    } finally {
      completeReset();
      state.resetBarrier = null;
    }
    const success = page.getByRole("status").filter({ hasText: /Mot de passe modifié/ });
    await success.waitFor();
    if (candidate) await waitFor(async () => (await focused(page)).role === "status", "Reset confirmation unfocused");
    assert.equal(updateCalls(), updateBefore + 1);
    await waitFor(() => record.some((call) => call.path === "/auth/v1/logout" && call.scope === "global"), "Global logout request missing");
    metrics.passwordChanged = { focus: await focused(page), globalLogoutRequest: true, updateRequests: 1 };
    if (candidate) assert.notEqual(metrics.passwordChanged.focus.element, "body");
    await shot("reset-complete");
    await page.getByRole("link", { name: /Retour à la connexion/ }).click();
    await page.waitForURL(app + "/login");
    if (candidate) await waitFor(async () => (await focused(page)).element === "h1", "Return login heading unfocused");
    metrics.passwordChanged.returnFocus = await focused(page);
    const telemetry = "https://telemetry.refine.dev/telemetry";
    assert.deepEqual(blocked.filter((destination) => destination !== telemetry), [], "Unexpected destinations blocked");
    metrics.refineTelemetryRequestsBlocked = blocked.length;
    return metrics;
  } finally {
    await context.close();
  }
}

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
});
try {
  const results = {
    evidence: "Chromium running built SPAWT pages. Auth responses intercepted with fictitious accounts.",
    browser: browser.version(),
    before: {},
    after: {},
  };
  const variants = [["before", beforeDist], ["after", afterDist]];
  const viewports = [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]];
  for (const [variant, dist] of variants) {
    for (const [device, viewport] of viewports) {
      results[variant][device] = await runView(browser, variant, dist, viewport, device);
      console.log(variant, device, "OK");
    }
  }
  await writeFile(join(evidenceDir, "metrics.json"), JSON.stringify(results, null, 2) + "\n");
} finally {
  await browser.close();
}
