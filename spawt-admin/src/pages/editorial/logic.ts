export const EDITORIAL_FIELDS = [
  ["identity", "Identité du lieu"], ["specialties", "Spécialités et plats repères"],
  ["occasions", "Occasions et ambiance"], ["budget_context", "Ce que comprend le budget"],
  ["service_context", "Service : observations contextualisées"], ["access_context", "Accès et informations pratiques"],
  ["verification_source", "Source de vérification (interne)"],
] as const;
export type EditorialDocument = Record<string, unknown> & { sections?: { title: string; body: string }[] };
export function missingProfileFields(place: Record<string, unknown>, doc: EditorialDocument): string[] {
  const missing: string[] = [];
  if (!String(doc.identity ?? "").trim()) missing.push("Identité éditoriale");
  if (!doc.verified_on || !doc.verification_source) missing.push("Vérification datée et source");
  if (doc.operating_status !== "open") missing.push("Ouverture confirmée");
  if (doc.photo_rights !== "confirmed") missing.push("Droits des photos confirmés");
  if (!place.cover_photo_url) missing.push("Photo de couverture");
  if (!Array.isArray(place.cuisine) || !place.cuisine.length) missing.push("Cuisine");
  if (place.avg_ticket_xof === null || place.avg_ticket_xof === undefined) missing.push("Budget documenté");
  if (!place.hours || !Object.keys(place.hours).length) missing.push("Horaires");
  if (!place.descriptive_address || !place.neighborhood) missing.push("Adresse et quartier");
  return missing;
}
export function editorialError(error: unknown): string {
  const e = error as { message?: string; code?: string };
  if (e.code === "40001" || e.message?.includes("revision_conflict")) return "Une autre personne a modifié ce contenu. Copie ton texte puis recharge avant de reprendre.";
  if (e.code === "PGRST202" || e.code === "42P01") return "L’espace éditorial n’est pas encore installé sur ce backend (migration 0075).";
  if (e.code === "42501") return "Cette action nécessite les droits de l’équipe ; la publication est réservée aux admins.";
  return e.message ?? "L’enregistrement a échoué. Tes modifications restent dans le formulaire.";
}
export function parseResearchJsonl(text: string): Record<string, unknown>[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).filter(line => line.trim()).map((line, i) => {
    let r: Record<string, unknown>;
    try { r = JSON.parse(line); } catch { throw new Error(`Ligne ${i + 1} : JSON illisible.`); }
    if (!r || typeof r !== "object" || ["record_id", "source_id", "source_native_id", "record_type"].some(k => !String(r[k] ?? "").trim())) throw new Error(`Ligne ${i + 1} : identité de source incomplète.`);
    const key = [r.source_id, r.record_type, r.source_native_id].join("|");
    if (seen.has(key)) throw new Error(`Ligne ${i + 1} : doublon de source dans le fichier.`);
    seen.add(key);
    const keys = ["record_id", "source_id", "source_native_id", "record_type", "source_url", "collected_at", "published_at", "place_name", "latitude", "longitude", "address_raw", "district_raw", "city_raw", "category", "cuisine_raw", "menu_urls", "source_modified_at", "price_range_raw", "source_rating", "source_review_count", "rating", "has_review_prose", "food_related", "target_dining_venue_candidate", "abidjan_district_spatial_match", "operating_status", "operating_status_verified", "place_source_native_id", "sampling_parameters", "business_phone_raw", "business_website", "opening_hours_raw", "last_public_activity_at", "date_semantics", "source_permanently_closed", "source_temporarily_closed", "operating_status_origin", "geographic_relevance", "place_identity_verified", "rights_product_use", "reuse_scope", "parent_place_native_id", "website_url", "linked_page_url"];
    const safe: Record<string, unknown> = Object.fromEntries(keys.filter(k => k in r).map(k => [k, r[k]]));
    const analysis = r.analysis as { aspects?: { aspect: string }[] } | undefined;
    if (Array.isArray(analysis?.aspects)) safe.analysis = { aspects: analysis.aspects.map(a => ({ aspect: a.aspect })) };
    return safe;
  });
}
