// Console admin 07/2026 — tests logique pure page Comptes B2B (0043 + 0049).

import { describe, it, expect } from "vitest";
import {
  EMPTY_B2B_FORM,
  b2bInsertErrorMessage,
  normalizePhoneE164,
  validateB2bLink,
} from "./logic";

describe("normalizePhoneE164", () => {
  it("canonise les formats usuels vers +225XXXXXXXXXX", () => {
    expect(normalizePhoneE164("+225 07 00 00 00 01")).toBe("+2250700000001");
    expect(normalizePhoneE164("00225 0700000001")).toBe("+2250700000001");
    expect(normalizePhoneE164("2250700000001")).toBe("+2250700000001");
    // Local CI 10 chiffres (plan 2021) → préfixe +225.
    expect(normalizePhoneE164("07-00-00-00-01")).toBe("+2250700000001");
  });

  it("rejette l'inexploitable", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("abc")).toBeNull();
    expect(normalizePhoneE164("12345")).toBeNull();
  });
});

describe("validateB2bLink", () => {
  const valid = {
    ...EMPTY_B2B_FORM,
    phone: "+2250700000001",
    place_id: "p1",
    contact_name: " Tantie Affoué ",
  };

  it("construit la row avec auth_user_id résolu + téléphone canonisé", () => {
    const res = validateB2bLink(valid, "auth-1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.auth_user_id).toBe("auth-1");
      expect(res.row.contact_phone).toBe("+2250700000001");
      expect(res.row.contact_name).toBe("Tantie Affoué");
      expect(res.row.role).toBe("pro");
    }
  });

  it("refuse sans compte résolu (le contact doit s'être connecté à l'app)", () => {
    const res = validateB2bLink(valid, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors[0]).toMatch(/Aucun compte/);
  });

  it("refuse téléphone invalide et lieu manquant", () => {
    const res = validateB2bLink({ ...valid, phone: "abc", place_id: "" }, "auth-1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toHaveLength(2);
  });
});

describe("b2bInsertErrorMessage", () => {
  it("23505 (auth_user_id UNIQUE) → message actionnable", () => {
    expect(b2bInsertErrorMessage({ code: "23505", message: "duplicate key" })).toMatch(/déjà lié/);
  });

  it("refus RLS → « Réservé aux admins »", () => {
    expect(b2bInsertErrorMessage({ code: "42501", message: "x" })).toBe("Réservé aux admins");
    expect(
      b2bInsertErrorMessage({ code: null, message: "new row violates row-level security" }),
    ).toBe("Réservé aux admins");
  });

  it("null = succès, autre erreur = message brut", () => {
    expect(b2bInsertErrorMessage(null)).toBeNull();
    expect(b2bInsertErrorMessage({ code: "XX", message: "boom" })).toBe("boom");
  });
});
