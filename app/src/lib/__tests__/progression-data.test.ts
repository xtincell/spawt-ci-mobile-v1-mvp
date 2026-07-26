// Progression — cohérence des fixtures démo (data/seed/progression.ts) avec
// les seeds SQL (0036 badges, 0037 cartes) et le fr.json. Le catalogue démo
// est un MIROIR STRICT du seed DB : toute divergence = drift à corriger.

import * as fs from "node:fs";
import * as path from "node:path";

import {
  SEED_ACTIVE_CHALLENGE,
  SEED_BADGE_CATALOGUE,
  SEED_CARD_CATALOGUE,
  SEED_OWNED_CARDS,
  SEED_PAWS_BALANCE,
  SEED_PAWS_LEDGER,
  SEED_UNLOCKED_BADGES,
} from "../../data/seed/progression";
import fr from "../../i18n/fr.json";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");

/** Extrait les codes du seed d'une migration : lignes `('code', ...)`. */
function extractSeedCodes(file: string, section: string): string[] {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
  const start = sql.indexOf(section);
  const chunk = start >= 0 ? sql.slice(start) : sql;
  const end = chunk.indexOf("ON CONFLICT");
  const values = end >= 0 ? chunk.slice(0, end) : chunk;
  const codes: string[] = [];
  for (const m of values.matchAll(/^\s*\('([a-z0-9_]+)'/gm)) {
    codes.push(m[1]!);
  }
  return codes;
}

describe("fixtures badges — miroir du seed SQL 0036", () => {
  const sqlCodes = extractSeedCodes(
    "0036_create_badges.sql",
    "INSERT INTO public.badge_catalogue",
  );

  it("32 badges, codes uniques", () => {
    expect(SEED_BADGE_CATALOGUE).toHaveLength(32);
    expect(new Set(SEED_BADGE_CATALOGUE.map((b) => b.code)).size).toBe(32);
  });

  it("codes du catalogue démo = codes du seed SQL (miroir strict)", () => {
    expect([...SEED_BADGE_CATALOGUE.map((b) => b.code)].sort()).toEqual(
      [...sqlCodes].sort(),
    );
  });

  it("title_key/description_key suivent la convention badge.<code>.*", () => {
    for (const b of SEED_BADGE_CATALOGUE) {
      expect(b.title_key).toBe(`badge.${b.code}.title`);
      expect(b.description_key).toBe(`badge.${b.code}.description`);
    }
  });

  it("chaque badge a son titre ET sa description dans fr.json (ton du Chat)", () => {
    const badgeSection = fr.badge as Record<
      string,
      string | { title?: string; description?: string }
    >;
    for (const b of SEED_BADGE_CATALOGUE) {
      const node = badgeSection[b.code];
      expect(typeof node).toBe("object");
      const { title, description } = node as { title?: string; description?: string };
      expect(typeof title).toBe("string");
      expect((title ?? "").length).toBeGreaterThan(0);
      expect(typeof description).toBe("string");
      expect((description ?? "").length).toBeGreaterThan(0);
    }
  });

  it("chaque condition_type non-custom a sa clé badge_condition dans fr.json", () => {
    const conditions = fr.badge_condition as Record<string, string>;
    for (const b of SEED_BADGE_CATALOGUE) {
      expect(typeof conditions[`${b.condition_type}_other`]).toBe("string");
    }
  });

  it("badges custom → threshold null ; les autres → seuil > 0", () => {
    for (const b of SEED_BADGE_CATALOGUE) {
      if (b.condition_type === "custom") expect(b.threshold).toBeNull();
      else expect(b.threshold ?? 0).toBeGreaterThan(0);
    }
  });

  it("badges débloqués démo : 7 dont exactement 3 affichés (invariant max-3)", () => {
    expect(SEED_UNLOCKED_BADGES).toHaveLength(7);
    expect(SEED_UNLOCKED_BADGES.filter((b) => b.is_displayed)).toHaveLength(3);
    const catalogue = new Set(SEED_BADGE_CATALOGUE.map((b) => b.code));
    for (const u of SEED_UNLOCKED_BADGES) {
      expect(catalogue.has(u.badge_code)).toBe(true);
    }
  });
});

describe("fixtures cartes — miroir du seed SQL 0037", () => {
  const sqlCodes = extractSeedCodes(
    "0037_create_collectibles.sql",
    "INSERT INTO public.collectible_cards",
  );

  it("13 cartes archétype, codes = seed SQL", () => {
    expect(SEED_CARD_CATALOGUE).toHaveLength(13);
    expect([...SEED_CARD_CATALOGUE.map((c) => c.code)].sort()).toEqual(
      [...sqlCodes].sort(),
    );
  });

  it("cartes possédées démo ⊂ catalogue, raretés et sources variées", () => {
    const catalogue = new Set(SEED_CARD_CATALOGUE.map((c) => c.code));
    for (const owned of SEED_OWNED_CARDS) {
      expect(catalogue.has(owned.code)).toBe(true);
    }
    expect(new Set(SEED_OWNED_CARDS.map((c) => c.rarity)).size).toBeGreaterThan(1);
    expect(new Set(SEED_OWNED_CARDS.map((c) => c.source)).size).toBeGreaterThan(1);
  });
});

describe("fixtures paws + défi — cohérence interne", () => {
  it("le solde démo = somme exacte du ledger (modèle append-only respecté)", () => {
    const sum = SEED_PAWS_LEDGER.reduce((acc, e) => acc + e.delta, 0);
    expect(SEED_PAWS_BALANCE).toBe(sum);
    expect(SEED_PAWS_BALANCE).toBe(120);
  });

  it("le défi démo a ses clés i18n et une progression cohérente", () => {
    const defis = fr.defi as Record<string, { title: string; description: string }>;
    const node = defis[SEED_ACTIVE_CHALLENGE.code];
    expect(node?.title.length).toBeGreaterThan(0);
    expect(node?.description.length).toBeGreaterThan(0);
    expect(SEED_ACTIVE_CHALLENGE.current_value).toBeLessThanOrEqual(
      SEED_ACTIVE_CHALLENGE.goal_target,
    );
  });
});
