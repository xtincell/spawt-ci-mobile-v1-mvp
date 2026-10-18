// Tests Deno — `payment-checkout` (même pattern que otp-send/index.test.ts :
// handleRequest exporté, envs resetés par test).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/payment-checkout/index.test.ts
//
// Couvre : méthodes HTTP, CORS, validation payload (plan B2C ET B2B,
// return_url), auth manquante, envs manquantes, normalisation E.164, et — sur
// un faux réseau GoTrue/PostgREST/CinetPay — le prix lu dans `plans` (0079) :
// montant envoyé au provider, HT et TTC figés sur l'abonnement, échec fermé
// (plan désactivé/absent, lecture impossible, ligne incohérente). Skip :
// 403 not_b2b + 409 par lieu (couverts en intégration sandbox CinetPay, cf.
// HUMAN_TODO ; le contrat côté portail est couvert par les tests vitest de
// project_spawt_mobile_ci).

import { assertEquals, assertExists } from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest, toE164 } from "./index.ts";

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/payment-checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function resetEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_ANON_KEY");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("CINETPAY_API_KEY");
  Deno.env.delete("CINETPAY_SITE_ID");
  Deno.env.delete("CINETPAY_SECRET_KEY");
  Deno.env.delete("PAYMENT_RETURN_BASE_URL");
}

Deno.test("payment-checkout: OPTIONS preflight → 204 + CORS headers", async () => {
  const req = new Request("http://localhost/payment-checkout", { method: "OPTIONS" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  assertExists(resp.headers.get("access-control-allow-origin"));
});

Deno.test("payment-checkout: non-POST → 405 avec allow header", async () => {
  const req = new Request("http://localhost/payment-checkout", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

Deno.test("payment-checkout: JSON invalide → 400 invalid_json", async () => {
  const resp = await handleRequest(makeRequest("pas-du-json-{"));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_json");
});

Deno.test("payment-checkout: plan inconnu → 400 invalid_plan", async () => {
  const resp = await handleRequest(makeRequest({ plan: "gold_weekly" }));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_plan");
});

Deno.test("payment-checkout: plan absent → 400 invalid_plan", async () => {
  const resp = await handleRequest(makeRequest({}));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_plan");
});

Deno.test("payment-checkout: return_url non-https → 400 invalid_return_url", async () => {
  const resp = await handleRequest(
    makeRequest({ plan: "gold_monthly", return_url: "http://insecure.example/retour" }),
  );
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_return_url");
});

Deno.test("payment-checkout: envs Supabase absentes → 500 edge_misconfigured", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ plan: "gold_monthly" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
});

Deno.test("payment-checkout: Authorization absent → 401 invalid_token", async () => {
  resetEnv();
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  const resp = await handleRequest(makeRequest({ plan: "gold_annual" }));
  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "invalid_token");
  resetEnv();
});

Deno.test("payment-checkout: CORS présent sur toutes les réponses", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ plan: "gold_monthly" }));
  assertExists(resp.headers.get("access-control-allow-origin"));
});

// ── Plans B2B (pro / b2b_gold) — acceptés par la validation de contrat ──────

Deno.test("payment-checkout: plan 'pro' accepté (pas de 400 invalid_plan)", async () => {
  resetEnv();
  // Envs absentes : un plan VALIDE dépasse la validation → 500 edge_misconfigured.
  const resp = await handleRequest(makeRequest({ plan: "pro" }));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
});

Deno.test("payment-checkout: plan 'b2b_gold' accepté puis 401 sans Authorization", async () => {
  resetEnv();
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  const resp = await handleRequest(makeRequest({ plan: "b2b_gold" }));
  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "invalid_token");
  resetEnv();
});

Deno.test("payment-checkout: return_url non-https refusée aussi pour un plan B2B", async () => {
  const resp = await handleRequest(
    makeRequest({ plan: "pro", return_url: "http://insecure.example/pro/retour" }),
  );
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_return_url");
});

// ── Le prix vient de `plans`, et la vente se ferme à la moindre anomalie ────
// Faux réseau complet : GoTrue (/auth/v1/user), PostgREST (/rest/v1/*) et
// CinetPay (/v2/payment). handleRequest crée ses clients APRÈS l'installation
// du faux fetch, qui est donc le seul réseau qu'il voit. Les lignes `plans`
// sont des fixtures : la vraie valeur est celle saisie dans la console.

const FAKE_CALLER = "00000000-0000-4000-8000-0000000000c1";
const FAKE_PLACE = "00000000-0000-4000-8000-0000000000a1";
const FAKE_CUSTOMER = "00000000-0000-4000-8000-0000000000b1";

type PlanRow = Record<string, unknown>;

/** `plans` après 0079 — prix payé, HT et TVA dérivés. */
const PLANS_0079: Record<string, PlanRow> = {
  gold_monthly: { code: "gold_monthly", period: "monthly", price_ttc: 2950, price_ht: 2500, tva_amount: 450, is_active: true },
  gold_annual: { code: "gold_annual", period: "annual", price_ttc: 29500, price_ht: 25000, tva_amount: 4500, is_active: true },
  pro: { code: "pro", period: "monthly", price_ttc: 17700, price_ht: 15000, tva_amount: 2700, is_active: true },
  b2b_gold: { code: "b2b_gold", period: "monthly", price_ttc: 60000, price_ht: 50847, tva_amount: 9153, is_active: true },
};

interface CheckoutCapture {
  subscription: Record<string, unknown> | null;
  provider: Record<string, unknown> | null;
  /** Toute écriture PostgREST (POST/PATCH/DELETE), dans l'ordre. */
  writes: string[];
  /** Filtres reçus par la lecture de `plans`. */
  plansQuery: string | null;
}

interface FakeOptions {
  plans?: Record<string, PlanRow>;
  plansError?: boolean;
}

function installFakeCheckoutBackend(
  options: FakeOptions = {},
): { capture: CheckoutCapture; restore: () => void } {
  const plans = options.plans ?? PLANS_0079;
  const capture: CheckoutCapture = { subscription: null, provider: null, writes: [], plansQuery: null };
  const realFetch = globalThis.fetch;
  // supabase-js démarre, hors navigateur, des minuteries d'auto-rafraîchissement
  // de session par client créé, qui survivent à une réponse rapide (échec
  // fermé). On les trace pour les arrêter en fin de test : le contrôle de
  // fuites de Deno reste actif pour tout le reste.
  const realSetInterval = globalThis.setInterval;
  const realSetTimeout = globalThis.setTimeout;
  const timers: number[] = [];
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = realSetInterval(...args);
    timers.push(id);
    return id;
  }) as typeof setInterval;
  globalThis.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
    const id = realSetTimeout(...args);
    timers.push(id);
    return id;
  }) as typeof setTimeout;
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const accept = new Headers(init?.headers).get("accept") ?? "";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    // `.single()` attend un objet, le reste de PostgREST un tableau.
    const rows = (list: unknown[]) => reply(accept.includes("vnd.pgrst.object") ? list[0] : list);

    if (url.host === "cinetpay.test" && url.pathname === "/v2/payment") {
      capture.provider = body;
      return reply({ code: "201", data: { payment_url: "https://checkout.cinetpay.test/p" } });
    }
    if (url.pathname === "/auth/v1/user") {
      return reply({ id: FAKE_CALLER, aud: "authenticated", phone: "2250700000101" });
    }
    const table = url.pathname.replace("/rest/v1/", "");
    if (method !== "GET") capture.writes.push(`${method} ${table}`);
    if (table === "plans" && method === "GET") {
      capture.plansQuery = url.search;
      if (options.plansError) return reply({ message: "lecture impossible" }, 500);
      const code = (url.searchParams.get("code") ?? "").replace(/^eq\./, "");
      const activeOnly = url.searchParams.get("is_active") === "eq.true";
      const row = plans[code];
      return rows(row && (!activeOnly || row.is_active === true) ? [row] : []);
    }
    if (method === "POST" && table === "subscriptions") {
      capture.subscription = body;
      return rows([{ id: "00000000-0000-4000-8000-0000000000d1" }]);
    }
    if (method === "GET") {
      if (table === "spawters") {
        return rows([{ id: FAKE_CALLER, display_name: "Awa", phone_e164: "+2250700000101" }]);
      }
      if (table === "customers") return rows([{ id: FAKE_CUSTOMER }]);
      if (table === "b2b_accounts") {
        return rows([{
          id: "00000000-0000-4000-8000-0000000000e1",
          auth_user_id: FAKE_CALLER,
          place_id: FAKE_PLACE,
          role: "pro",
          contact_name: "Awa",
          contact_phone: "+2250700000101",
          is_active: true,
        }]);
      }
      if (table === "places") return rows([{ name: "Chez Awa" }]);
      if (table === "subscriptions") return rows([]); // aucun droit vivant
    }
    return reply({ message: `route non simulée : ${method} ${url.pathname}` }, 500);
  }) as typeof fetch;
  return {
    capture,
    restore: () => {
      globalThis.fetch = realFetch;
      globalThis.setInterval = realSetInterval;
      globalThis.setTimeout = realSetTimeout;
      timers.forEach((id) => clearTimeout(id));
    },
  };
}

async function checkoutWithFakeBackend(
  plan: string,
  options: FakeOptions = {},
): Promise<{ status: number; body: Record<string, unknown>; capture: CheckoutCapture }> {
  resetEnv();
  Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-test");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-test");
  Deno.env.set("CINETPAY_API_KEY", "apikey-test");
  Deno.env.set("CINETPAY_SITE_ID", "5867973");
  Deno.env.set("CINETPAY_SECRET_KEY", "secret-test-spawt");
  Deno.env.set("CINETPAY_BASE_URL", "https://cinetpay.test");
  const backend = installFakeCheckoutBackend(options);
  try {
    const resp = await handleRequest(makeRequest({ plan }, {
      headers: { "content-type": "application/json", authorization: "Bearer jwt-test" },
    }));
    return { status: resp.status, body: await resp.json(), capture: backend.capture };
  } finally {
    backend.restore();
    resetEnv();
    Deno.env.delete("CINETPAY_BASE_URL");
  }
}

Deno.test("payment-checkout: lit `plans` (actif seulement) — Gold lieu : 60 000 envoyés, HT et TTC figés", async () => {
  const { status, body, capture } = await checkoutWithFakeBackend("b2b_gold");
  assertEquals(status, 200, JSON.stringify(body));
  assertEquals(body.payment_url, "https://checkout.cinetpay.test/p");
  assertEquals(new URLSearchParams(capture.plansQuery ?? "").get("code"), "eq.b2b_gold");
  assertEquals(new URLSearchParams(capture.plansQuery ?? "").get("is_active"), "eq.true");
  assertEquals(capture.provider?.amount, 60000);
  assertEquals(capture.provider?.currency, "XOF");
  assertEquals(capture.subscription?.plan, "b2b_gold");
  assertEquals(capture.subscription?.customer_type, "b2b");
  assertEquals(capture.subscription?.price_ht, 50847);
  assertEquals(capture.subscription?.price_ttc, 60000);
  assertEquals(capture.subscription?.tva_rate, 18);
});

Deno.test("payment-checkout: un prix changé dans la console part tel quel — aucun montant dans le code", async () => {
  const plans = {
    ...PLANS_0079,
    b2b_gold: { ...PLANS_0079.b2b_gold, price_ttc: 55000, price_ht: 46610, tva_amount: 8390 },
    gold_monthly: { ...PLANS_0079.gold_monthly, price_ttc: 3000, price_ht: 2542, tva_amount: 458 },
  };
  const lieu = await checkoutWithFakeBackend("b2b_gold", { plans });
  assertEquals(lieu.capture.provider?.amount, 55000);
  assertEquals(lieu.capture.subscription?.price_ht, 46610);
  assertEquals(lieu.capture.subscription?.price_ttc, 55000);
  const spawter = await checkoutWithFakeBackend("gold_monthly", { plans });
  assertEquals(spawter.capture.provider?.amount, 3000);
  assertEquals(spawter.capture.subscription?.customer_type, "b2c");
  assertEquals(spawter.capture.subscription?.price_ttc, 3000);
});

Deno.test("payment-checkout: pro et gold_monthly gardent le montant d'avant 0079 (17 700, 2 950)", async () => {
  const pro = await checkoutWithFakeBackend("pro");
  assertEquals(pro.capture.provider?.amount, 17700);
  assertEquals(pro.capture.subscription?.price_ht, 15000);
  const gold = await checkoutWithFakeBackend("gold_monthly");
  assertEquals(gold.capture.provider?.amount, 2950);
  assertEquals(gold.capture.subscription?.price_ht, 2500);
});

Deno.test("payment-checkout: plan désactivé ou absent → 409 plan_unavailable, rien écrit ni envoyé", async () => {
  const catalogues: Record<string, PlanRow>[] = [
    { ...PLANS_0079, b2b_gold: { ...PLANS_0079.b2b_gold, is_active: false } },
    { gold_monthly: PLANS_0079.gold_monthly },
  ];
  for (const plans of catalogues) {
    const { status, body, capture } = await checkoutWithFakeBackend("b2b_gold", { plans });
    assertEquals(status, 409);
    assertEquals(body.error, "plan_unavailable");
    assertEquals(capture.writes, []);
    assertEquals(capture.provider, null);
  }
});

Deno.test("payment-checkout: lecture de `plans` impossible → 500 db_error, rien écrit ni envoyé", async () => {
  const { status, body, capture } = await checkoutWithFakeBackend("gold_monthly", { plansError: true });
  assertEquals(status, 500);
  assertEquals(body.error, "db_error");
  assertEquals(capture.writes, []);
  assertEquals(capture.provider, null);
});

Deno.test("payment-checkout: ligne incohérente (HT + TVA ≠ TTC) → 500 plan_misconfigured, rien écrit", async () => {
  const plans = { ...PLANS_0079, pro: { ...PLANS_0079.pro, tva_amount: 2699 } };
  const { status, body, capture } = await checkoutWithFakeBackend("pro", { plans });
  assertEquals(status, 500);
  assertEquals(body.error, "plan_misconfigured");
  assertEquals(capture.writes, []);
  assertEquals(capture.provider, null);
});

// ── toE164 : normalisation téléphone GoTrue / contact B2B ───────────────────

Deno.test("toE164: GoTrue sans '+', contact avec espaces, vide", () => {
  assertEquals(toE164("2250701020304"), "+2250701020304");
  assertEquals(toE164("+225 07 01 02 03 04"), "+2250701020304");
  assertEquals(toE164("07-01-02-03-04"), "+0701020304");
  assertEquals(toE164(""), "");
  assertEquals(toE164(null), "");
  assertEquals(toE164(undefined), "");
});
