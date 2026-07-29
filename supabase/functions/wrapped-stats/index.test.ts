// Deno tests pour `wrapped-stats` Edge Function — SPAWT Wrapped.
//
// Run :
//   deno test --allow-env supabase/functions/wrapped-stats/index.test.ts
//
// Couvre :
//   1. Méthodes HTTP (OPTIONS, POST, autre) + CORS fail-closed
//   2. Validation payload (JSON, year hors bornes)
//   3. Auth : token absent/invalide → 401 (client anon mocké)
//   4. Succès : agrégats calculés depuis fixtures (clients mockés injectés)
//   5. Best-effort : un échec partiel DB → champ null, jamais 500
//   6. aggregateCheckins (fonction pure)

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

import { aggregateCheckins, handleRequest, type WrappedDeps } from "./index.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/wrapped-stats", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-token",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });
}

function setEnv() {
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_URL", "http://localhost:54321");
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  // @ts-expect-error — Deno global
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
}

function resetEnv() {
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_URL");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_ANON_KEY");
  // @ts-expect-error — Deno global
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

/** Builder chainable minimal — résout {data, error} à l'await (then-able). */
// deno-lint-ignore no-explicit-any
function makeBuilder(result: { data: unknown; error: unknown }): any {
  // deno-lint-ignore no-explicit-any
  const b: any = {};
  const chain = () => b;
  for (const m of ["select", "eq", "is", "gte", "lt"]) b[m] = chain;
  b.maybeSingle = () => Promise.resolve(result);
  b.then = (
    resolve: (v: { data: unknown; error: unknown }) => unknown,
    reject?: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return b;
}

interface MockTables {
  [table: string]: { data: unknown; error: unknown };
}

function makeDeps(opts: {
  user?: { id: string } | null;
  tables?: MockTables;
}): WrappedDeps {
  const tables = opts.tables ?? {};
  return {
    createAnonClient: () => ({
      auth: {
        getUser: (_token: string) =>
          Promise.resolve(
            opts.user
              ? { data: { user: opts.user }, error: null }
              : { data: { user: null }, error: { message: "invalid" } },
          ),
      },
    }),
    createServiceClient: () => ({
      from: (table: string) =>
        makeBuilder(tables[table] ?? { data: null, error: { message: `no fixture: ${table}` } }),
    }),
  };
}

const CHECKIN_FIXTURES = [
  // 3 spawts vérifiés chez Ambroise (Cocody, ivoirienne) — lieu fétiche.
  ...[1, 2, 3].map((i) => ({
    place_id: "place-ambroise",
    arrived_at: `2026-08-0${i}T12:00:00Z`,
    is_verified: true,
    note_etoiles: i === 1 ? 5 : null,
    places: { name: "Chez Ambroise", neighborhood: "Cocody", cuisine: ["ivoirienne"] },
  })),
  // 1 spawt vérifié Zone 4 (francaise).
  {
    place_id: "place-bozinc",
    arrived_at: "2026-03-10T20:00:00Z",
    is_verified: true,
    note_etoiles: 4,
    places: { name: "Bô Zinc", neighborhood: "Zone 4", cuisine: ["francaise"] },
  },
  // 1 non-vérifié : compte pour la note, pas pour les compteurs spawts.
  {
    place_id: "place-bozinc",
    arrived_at: "2026-03-12T20:00:00Z",
    is_verified: false,
    note_etoiles: 3,
    places: { name: "Bô Zinc", neighborhood: "Zone 4", cuisine: ["francaise"] },
  },
];

const HAPPY_TABLES: MockTables = {
  spawt_checkin: { data: CHECKIN_FIXTURES, error: null },
  spawters: { data: { quiz_archetype: "gardien", pionnier_seq: 42 }, error: null },
  spawter_progression: { data: { stade: "explorateur" }, error: null },
  spawter_badges: {
    data: [
      { badge_code: "premier_spawt", unlocked_at: "2026-08-01T12:05:00Z" },
      { badge_code: "traversee", unlocked_at: "2026-09-02T12:05:00Z" },
    ],
    error: null,
  },
};

// ─── HTTP / CORS ────────────────────────────────────────────────────────────

Deno.test("wrapped-stats: OPTIONS preflight → 204 + CORS headers", async () => {
  const req = new Request("http://localhost/wrapped-stats", { method: "OPTIONS" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 204);
  assertExists(resp.headers.get("access-control-allow-origin"));
});

Deno.test("wrapped-stats: origin non-whitelistée jamais reflétée (fail-closed)", async () => {
  // @ts-expect-error — Deno global
  Deno.env.delete("ALLOWED_ORIGINS");
  const req = new Request("http://localhost/wrapped-stats", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  });
  const resp = await handleRequest(req);
  assertEquals(resp.headers.get("access-control-allow-origin"), "null");
});

Deno.test("wrapped-stats: non-POST → 405 + allow header", async () => {
  const req = new Request("http://localhost/wrapped-stats", { method: "GET" });
  const resp = await handleRequest(req);
  assertEquals(resp.status, 405);
  assertExists(resp.headers.get("allow"));
});

// ─── Validation payload ─────────────────────────────────────────────────────

Deno.test("wrapped-stats: JSON invalide → 400 invalid_json", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest("not-json-{"));
  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "invalid_json");
});

Deno.test("wrapped-stats: year hors bornes → 400 invalid_year", async () => {
  setEnv();
  for (const year of [1999, 3000, 2026.5, "2026"]) {
    const resp = await handleRequest(makeRequest({ year }));
    assertEquals(resp.status, 400);
    assertEquals((await resp.json()).error, "invalid_year");
  }
});

Deno.test("wrapped-stats: env manquante → 500 edge_misconfigured", async () => {
  resetEnv();
  const resp = await handleRequest(makeRequest({}));
  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "edge_misconfigured");
});

// ─── Auth ───────────────────────────────────────────────────────────────────

Deno.test("wrapped-stats: token absent → 401 invalid_token", async () => {
  setEnv();
  const req = new Request("http://localhost/wrapped-stats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const resp = await handleRequest(req, makeDeps({ user: null }));
  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "invalid_token");
});

Deno.test("wrapped-stats: token rejeté par GoTrue → 401 invalid_token", async () => {
  setEnv();
  const resp = await handleRequest(makeRequest({}), makeDeps({ user: null }));
  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "invalid_token");
});

// ─── Succès (fixtures) ──────────────────────────────────────────────────────

Deno.test("wrapped-stats: succès → agrégats de l'année depuis les fixtures", async () => {
  setEnv();
  const deps = makeDeps({ user: { id: "spawter-1" }, tables: HAPPY_TABLES });
  const resp = await handleRequest(makeRequest({ year: 2026 }), deps);
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.year, 2026);
  const s = body.stats;
  assertEquals(s.total_spawts, 4); // vérifiés uniquement
  assertEquals(s.unique_places, 2);
  assertEquals(s.communes_count, 2);
  assertEquals(s.top_commune, "Cocody");
  assertEquals(s.top_cuisine, "ivoirienne");
  assertEquals(s.top_place, { id: "place-ambroise", name: "Chez Ambroise", count: 3 });
  assertEquals(s.avg_note, 4); // (5 + 4 + 3) / 3
  assertEquals(s.archetype, "gardien");
  assertEquals(s.pionnier_seq, 42);
  assertEquals(s.stade, "explorateur");
  assertEquals(s.badges_unlocked, ["premier_spawt", "traversee"]);
  assertEquals(s.top_month, { month: 8, count: 3 });
});

Deno.test("wrapped-stats: body vide → défaut année courante, 200", async () => {
  setEnv();
  const deps = makeDeps({ user: { id: "spawter-1" }, tables: HAPPY_TABLES });
  const resp = await handleRequest(makeRequest(""), deps);
  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.year, new Date().getUTCFullYear());
});

// ─── Best-effort : échec partiel → null, jamais 500 ─────────────────────────

Deno.test("wrapped-stats: échec spawt_checkin → champs dérivés null, reste servi", async () => {
  setEnv();
  const deps = makeDeps({
    user: { id: "spawter-1" },
    tables: {
      ...HAPPY_TABLES,
      spawt_checkin: { data: null, error: { message: "boom" } },
    },
  });
  const resp = await handleRequest(makeRequest({ year: 2026 }), deps);
  assertEquals(resp.status, 200);
  const s = (await resp.json()).stats;
  assertEquals(s.total_spawts, null);
  assertEquals(s.top_place, null);
  assertEquals(s.top_month, null);
  // Les autres agrégats survivent.
  assertEquals(s.archetype, "gardien");
  assertEquals(s.stade, "explorateur");
});

Deno.test("wrapped-stats: TOUTES les tables en échec → 200 avec stats nulles", async () => {
  setEnv();
  const deps = makeDeps({ user: { id: "spawter-1" }, tables: {} });
  const resp = await handleRequest(makeRequest({ year: 2026 }), deps);
  assertEquals(resp.status, 200);
  const s = (await resp.json()).stats;
  for (const key of Object.keys(s)) {
    assertEquals(s[key], null, `stats.${key} devrait être null`);
  }
});

// ─── aggregateCheckins (pure) ───────────────────────────────────────────────

Deno.test("aggregateCheckins: zéro row → compteurs 0, tops null", () => {
  const agg = aggregateCheckins([]);
  assertEquals(agg.total_spawts, 0);
  assertEquals(agg.unique_places, 0);
  assertEquals(agg.communes_count, 0);
  assertEquals(agg.top_commune, null);
  assertEquals(agg.top_cuisine, null);
  assertEquals(agg.top_place, null);
  assertEquals(agg.avg_note, null);
  assertEquals(agg.top_month, null);
});

Deno.test("aggregateCheckins: place jointe manquante tolérée", () => {
  const agg = aggregateCheckins([
    {
      place_id: "p1",
      arrived_at: "2026-02-01T12:00:00Z",
      is_verified: true,
      note_etoiles: null,
      places: null,
    },
  ]);
  assertEquals(agg.total_spawts, 1);
  assertEquals(agg.unique_places, 1);
  assertEquals(agg.communes_count, 0);
  assertEquals(agg.top_month, { month: 2, count: 1 });
});

Deno.test("aggregateCheckins: avg_note arrondie à 1 décimale", () => {
  const rows = [1, 2, 2].map((n, i) => ({
    place_id: "p1",
    arrived_at: `2026-05-0${i + 1}T12:00:00Z`,
    is_verified: true,
    note_etoiles: n as 1 | 2,
    places: null,
  }));
  const agg = aggregateCheckins(rows);
  assertEquals(agg.avg_note, 1.7); // 5/3 = 1.666… → 1.7
  assert(agg.total_spawts === 3);
});
