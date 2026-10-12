import i18next from "i18next";
import fr from "../../src/i18n/fr.json";
import { buildCrewInviteUrl } from "../../src/lib/share-links";

function values(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(values);
  return [];
}

describe("French navigation and community vocabulary", () => {
  it("uses the same community name in navigation, headings and return actions", () => {
    expect(fr.nav.feed).toBe("Accueil");
    expect(fr.nav.meute).toBe("La bande");
    expect(fr.meute.title).toBe(fr.nav.meute);
    expect(fr.crew.cta_back_meute).toBe("Retour à la bande");
    expect(fr.rapide.deck_end_cta).toBe("Retour à l’accueil");
    expect(fr.rapide.empty_cta).toBe("Retour à l’accueil");
  });

  it("has no retired community or home labels in displayed French values", () => {
    expect(values(fr).filter((value) => /\b(?:meute|feed|gboneat)\b/i.test(value))).toEqual([]);
  });

  it("keeps the invite-only Crew distinct from the community", () => {
    expect(fr.crew.block_title).toBe("Ton Crew");
    expect(fr.crew.block_pitch).toContain("sur invitation");
    expect(fr.crew.invite_pending_body).toContain("Un autre crew");
    expect(fr.crew.share_invite).toContain("La bande → Ton Crew → Rejoindre");
    expect(buildCrewInviteUrl("abc23")).toBe("spawt://meute?crewCode=ABC23");
  });

  it("preserves placeholders and plural forms with French fallback", async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: "en",
      fallbackLng: "fr",
      resources: { fr: { translation: fr } },
      interpolation: { escapeValue: false },
    });
    expect(i18n.t("nav.feed")).toBe("Accueil");
    expect(i18n.t("badge_condition.parrainages", { count: 1 })).toBe("Fais entrer 1 spawter dans la bande");
    expect(i18n.t("badge_condition.parrainages", { count: 3 })).toBe("Fais entrer 3 spawters dans la bande");
    const invite = i18n.t("crew.share_invite", { code: "ABC23", url: buildCrewInviteUrl("ABC23") });
    expect(invite).toContain("Code : ABC23");
    expect(invite).toContain("spawt://meute?crewCode=ABC23");
    expect(invite).not.toContain("{{");
    expect(i18n.t("palais_reveal.heritage_mention", { n: 12, archetype: "Pisteur" })).toBe("Pionnier n°12 de la bande — ton flair de Pisteur te suit.");
  });
});
