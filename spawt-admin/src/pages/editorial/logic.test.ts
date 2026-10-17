import { describe, expect, it } from "vitest";
import { parseResearchJsonl, missingProfileFields, editorialError } from "./logic";
import { validateCollectionForm } from "../explore/logic";
const record = { record_id: "r1", source_id: "google", source_native_id: "n1", record_type: "review", rating: 2, body: "Do not retain", author: "Private", photo: "unlicensed", date_semantics: "publication_not_visit", analysis: { aspects: [{ aspect: "service", verbatim: "Do not retain" }] } };
describe("research privacy and import", () => {
  it("retains provenance and codes without source prose or authors", () => {
    const [r] = parseResearchJsonl(JSON.stringify(record));
    expect(r).not.toHaveProperty("body"); expect(r).not.toHaveProperty("author"); expect(r).not.toHaveProperty("photo");
    expect(r.analysis).toEqual({ aspects: [{ aspect: "service" }] });
    expect(r.date_semantics).toBe("publication_not_visit");
  });
  it("rejects a malformed batch before writes", () => {
    expect(() => parseResearchJsonl(JSON.stringify(record) + "\n{bad}")).toThrow(/Ligne 2/);
    expect(() => parseResearchJsonl(JSON.stringify(record) + "\n" + JSON.stringify(record))).toThrow(/doublon/);
    expect(() => parseResearchJsonl('{"record_id":"x"}')).toThrow(/identité/);
  });
  it("reports conflicts with recovery guidance", () => expect(editorialError({ code: "40001" })).toContain("Copie ton texte"));
});
describe("editorial publication readiness", () => {
  it("does not infer a complete identity from a name and external rating", () => {
    expect(missingProfileFields({ name: "Lieu", source_rating: 5 }, {})).toContain("Identité éditoriale");
    expect(missingProfileFields({}, {})).toContain("Droits des photos confirmés");
  });
  it("accepts explicit practical facts and editorial verification", () => {
    expect(missingProfileFields({ cuisine: ["ivoirienne"], avg_ticket_xof: 5000, hours: { mon: [] }, cover_photo_url: "https://example.test/photo", descriptive_address: "Adresse", neighborhood: "Quartier" }, { identity: "Texte vérifié", verified_on: "2026-10-17", verification_source: "Visite", operating_status: "open", photo_rights: "confirmed" })).toEqual([]);
  });
  it("persists explicit duo curation, without classifying places by price", () => {
    const r = validateCollectionForm({ slug: "duo", title: "À deux", subtitle: "", cover_url: "", audience: "duo" });
    expect(r.ok && r.row.audience).toBe("duo");
  });
});
