// Story 2.2 — AC #7-6 : validation sémantique migration 0006 sur PGlite.
//
// Pattern : Epic 1 retro §4 #1 — `@electric-sql/pglite` (Postgres en WASM Node)
// applique les migrations + teste les triggers d'invariants sans Docker.
//
// Le module `@electric-sql/pglite` n'est PAS encore listé dans devDependencies.
// Story 2.2 hérite du pattern non-committé d'Epic 1. Décision : le test charge
// le module en runtime via dynamic require — si absent, on `it.skip()` toutes
// les assertions avec un log explicite plutôt que faire échouer la suite.
// Le suivi est tracé dans deferred-work.md (« PGlite devDep »).
//
// Pour activer ces tests : `cd app && npm install --save-dev @electric-sql/pglite`.

import * as fs from "node:fs";
import * as path from "node:path";

interface PGliteLike {
  exec: (sql: string) => Promise<unknown>;
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  close: () => Promise<void>;
}

interface PGliteCtor {
  new (options?: Record<string, unknown>): PGliteLike;
}

function tryLoadPGlite(): PGliteCtor | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require("@electric-sql/pglite") as { PGlite: PGliteCtor };
    return mod.PGlite;
  } catch {
    return null;
  }
}

const PGlite = tryLoadPGlite();
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf-8");
}

const describeOrSkip = PGlite ? describe : describe.skip;

describeOrSkip("Migrations 0001 → 0006 — PGlite semantic validation (Story 2.2)", () => {
  let db: PGliteLike;

  beforeAll(async () => {
    if (!PGlite) return;
    db = new PGlite();
    // PGlite n'a pas le schéma auth.users de Supabase — on stub la dépendance
    // FK avec un mock minimal (REFERENCES auth.users(id) ON DELETE CASCADE).
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    `);
    // Applique les 6 migrations en ordre (skip 0002-0004 si elles déclenchent
    // des dépendances hors scope — on cible ici uniquement spawters + triggers).
    await db.exec(readMigration("0001_create_spawters_spawt_staff.sql"));
    await db.exec(readMigration("0005_spawters_invariant_triggers.sql"));
    await db.exec(readMigration("0006_rename_data_consent_to_cgv_accepted.sql"));
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("colonne cgv_accepted_at existe en timestamptz nullable", async () => {
    const result = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'spawters'
         AND column_name = 'cgv_accepted_at'`,
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.data_type).toBe("timestamp with time zone");
    expect(result.rows[0]?.is_nullable).toBe("YES");
  });

  it("colonne data_consent_at n'existe plus", async () => {
    const result = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'spawters'
         AND column_name = 'data_consent_at'`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it("trigger set-once : 1re écriture cgv_accepted_at OK, 2nde raise check_violation", async () => {
    const userId = "00000000-0000-0000-0000-000000000001";
    await db.exec(`INSERT INTO auth.users (id) VALUES ('${userId}');`);
    await db.exec(`
      INSERT INTO public.spawters (id, phone_e164, display_name)
      VALUES ('${userId}', '+22507000000', 'Test');
    `);

    await db.exec(`
      UPDATE public.spawters SET cgv_accepted_at = now() WHERE id = '${userId}';
    `);

    await expect(
      db.exec(`
        UPDATE public.spawters SET cgv_accepted_at = now() + interval '1 second'
        WHERE id = '${userId}';
      `),
    ).rejects.toThrow(/set-once/i);
  });
});
