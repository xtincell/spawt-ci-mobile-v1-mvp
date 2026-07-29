// Deno tests pour `push-send` Edge Function — Feature 13 (push serveur).
//
// Run :
//   deno test --allow-env --allow-net supabase/functions/push-send/index.test.ts
//
// Couvre :
//   1. Méthodes HTTP (OPTIONS, non-POST) + CORS fail-closed (pattern otp-send)
//   2. Env manquante → 500 edge_misconfigured
//   3. Auth refusée (pas de bearer / bearer invalide) → 401
//   4. Validation payload (title requis, cible requise)
//   5. Chunking Expo (100 max/requête) via fetch mocké
//   6. Purge DeviceNotRegistered → DELETE push_tokens + compteur purged
//
// Tout le réseau (PostgREST, GoTrue, exp.host) est mocké via globalThis.fetch —
// aucun projet Supabase réel requis.

import {
  assertEquals,
  assert,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import { handleRequest, chunk, EXPO_PUSH_CHUNK_SIZE } from "./index.ts";

const SUPABASE_URL = "http://supabase.test";
const SERVICE_ROLE = "service-role-secret";
const ANON_KEY = "anon-key";

function setEnv() {
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_ANON_KEY", ANON_KEY);
}

function resetEnv() {
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_URL");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_ANON_KEY");
}

function makeRequest(body: unknown, bearer: string | null = SERVICE_ROLE): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (bearer) headers["authorization"] = `Bearer ${bearer}`;
  return new Request("http://localhost/push-send", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface RecordedCall {
  url: string;
  method: string;
  body: string | null;
}

/**
 * Remplace globalThis.fetch par un routeur de test. Retourne les calls
 * enregistrés + une fonction restore (à appeler en finally).
 */
function installFetchMock(
  route: (url: string, method: string, body: string | null) => Response,
): { calls: RecordedCall[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let body: string | null = null;
    if (typeof init?.body === "string") body = init.body;
    else if (input instanceof Request) body = await input.clone().text().catch(() => null);
    calls.push({ url, method, body });
    return route(url, method, body);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Routeur par défaut : push_tokens → `tokens`, exp.host → tickets "ok". */
function defaultRoute(tokens: string[]) {
  return (url: string, method: string, body: string | null): Response => {
    if (url.includes("/rest/v1/push_tokens") && method === "GET") {
      return jsonResponse(tokens.map((t) => ({ token: t })));
    }
    if (url.includes("/rest/v1/push_tokens") && method === "DELETE") {
      return jsonResponse([]);
    }
    if (url.startsWith("https://exp.host/")) {
      const messages = JSON.parse(body ?? "[]") as unknown[];
      return jsonResponse({ data: messages.map(() => ({ status: "ok" })) });
    }
    if (url.includes("/auth/v1/user")) {
      return jsonResponse({ message: "invalid token" }, 401);
    }
    return jsonResponse([], 200);
  };
}

// ── Helpers purs ────────────────────────────────────────────────────────────

Deno.test("chunk: découpe en paquets de taille fixe", () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunk([], 10), []);
  assertEquals(EXPO_PUSH_CHUNK_SIZE, 100);
});

// ── HTTP / CORS ─────────────────────────────────────────────────────────────

Deno.test("push-send: OPTIONS preflight → 204 + CORS fail-closed (origin inconnue = null)", async () => {
  const req = new Request("http://localhost/push-send", {
    method: "OPTIONS",
    headers: { origin: "https://mallory.example" },
  });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  // Fail-closed : origin non whitelistée jamais reflétée.
  assertEquals(resp.headers.get("access-control-allow-origin"), "null");
  assertExists(resp.headers.get("access-control-allow-methods"));
});

Deno.test("push-send: non-POST → 405 avec allow header", async () => {
  const req = new Request("http://localhost/push-send", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

Deno.test("push-send: env manquante → 500 edge_misconfigured", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({ title: "t", body: "b" }));
  assertEquals(resp.status, 500);
  const body = await resp.json();
  assertEquals(body.error, "edge_misconfigured");
});

// ── Auth ────────────────────────────────────────────────────────────────────

Deno.test("push-send: sans Authorization → 401", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest({ title: "t", body: "b" }, null));
  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "unauthenticated");
});

Deno.test("push-send: bearer invalide (ni service_role ni staff) → 401", async () => {
  setEnv();
  const mock = installFetchMock(defaultRoute([]));
  try {
    const resp = await handleRequest(
      makeRequest({ spawter_ids: ["s1"], title: "t", body: "b" }, "not-a-valid-token"),
    );
    assertEquals(resp.status, 401);
    const body = await resp.json();
    assertEquals(body.error, "unauthenticated");
  } finally {
    mock.restore();
  }
});

// ── Validation ──────────────────────────────────────────────────────────────

Deno.test("push-send: title manquant → 400 invalid_payload", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest({ spawter_ids: ["s1"], body: "b" }));
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_payload");
});

Deno.test("push-send: JSON invalide → 400 invalid_json", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest("not-json-{}"));
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "invalid_json");
});

Deno.test("push-send: aucune cible (ni ids ni filtre) → 400 missing_targets", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest({ title: "t", body: "b" }));
  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "missing_targets");
});

// ── Envoi / chunking ────────────────────────────────────────────────────────

Deno.test("push-send: 250 tokens → 3 chunks Expo (100/100/50), sent=250", async () => {
  setEnv();
  const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
  const mock = installFetchMock(defaultRoute(tokens));
  try {
    const resp = await handleRequest(
      makeRequest({ spawter_ids: ["s1"], title: "Titre", body: "Corps" }),
    );
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body, { sent: 250, failed: 0, purged: 0 });

    const expoCalls = mock.calls.filter((c) => c.url.startsWith("https://exp.host/"));
    assertEquals(expoCalls.length, 3);
    const sizes = expoCalls.map((c) => (JSON.parse(c.body ?? "[]") as unknown[]).length);
    assertEquals(sizes, [100, 100, 50]);
    // Chaque message porte title/body + channelId Android "spawt".
    const first = (JSON.parse(expoCalls[0].body ?? "[]") as Record<string, unknown>[])[0];
    assertEquals(first.title, "Titre");
    assertEquals(first.body, "Corps");
    assertEquals(first.channelId, "spawt");
  } finally {
    mock.restore();
  }
});

Deno.test("push-send: DeviceNotRegistered → token purgé (DELETE) + compteur purged", async () => {
  setEnv();
  const tokens = ["ExponentPushToken[a]", "ExponentPushToken[dead]", "ExponentPushToken[c]"];
  const route = (url: string, method: string, body: string | null): Response => {
    if (url.startsWith("https://exp.host/")) {
      const messages = JSON.parse(body ?? "[]") as { to: string }[];
      return jsonResponse({
        data: messages.map((m) =>
          m.to === "ExponentPushToken[dead]"
            ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
            : { status: "ok" },
        ),
      });
    }
    return defaultRoute(tokens)(url, method, body);
  };
  const mock = installFetchMock(route);
  try {
    const resp = await handleRequest(
      makeRequest({
        spawter_ids: ["s1", "s2"],
        title: "t",
        body: "b",
        data: { type: "gold_renewal", deep_link: "/settings" },
      }),
    );
    assertEquals(resp.status, 200);
    const respBody = await resp.json();
    assertEquals(respBody, { sent: 2, failed: 0, purged: 1 });

    const deleteCalls = mock.calls.filter(
      (c) => c.url.includes("/rest/v1/push_tokens") && c.method === "DELETE",
    );
    assertEquals(deleteCalls.length, 1);
    // Le DELETE cible le token mort (clause in.() PostgREST, URL-encodée).
    assert(decodeURIComponent(deleteCalls[0].url).includes("ExponentPushToken[dead]"));
  } finally {
    mock.restore();
  }
});

Deno.test("push-send: échec HTTP Expo sur un chunk → comptés failed, pas de throw", async () => {
  setEnv();
  const tokens = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
  const route = (url: string, method: string, body: string | null): Response => {
    if (url.startsWith("https://exp.host/")) {
      return jsonResponse({ errors: [{ code: "INTERNAL" }] }, 500);
    }
    return defaultRoute(tokens)(url, method, body);
  };
  const mock = installFetchMock(route);
  try {
    const resp = await handleRequest(
      makeRequest({ spawter_ids: ["s1"], title: "t", body: "b" }),
    );
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body, { sent: 0, failed: 2, purged: 0 });
  } finally {
    mock.restore();
  }
});

Deno.test("push-send: cibles résolues mais zéro token → {0,0,0} sans appel Expo", async () => {
  setEnv();
  const mock = installFetchMock(defaultRoute([]));
  try {
    const resp = await handleRequest(
      makeRequest({ spawter_ids: ["s1"], title: "t", body: "b" }),
    );
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body, { sent: 0, failed: 0, purged: 0 });
    assertEquals(mock.calls.filter((c) => c.url.startsWith("https://exp.host/")).length, 0);
  } finally {
    mock.restore();
  }
});
