// Schémas Zod pour Place / PlaceAdn — Story 3.3a.
// Validation runtime à la frontière `data-source.supabase.ts`.
// Cohérent architecture §Data Architecture : Zod parse à l'entrée, type sûr à l'intérieur.

import { z } from "zod";

const ADN_AXIS = z.number().min(-1).max(1);

export const PlaceLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  descriptive_address: z.string(),
  neighborhood: z.string(),
  city: z.string(),
});

export const PriceRangeSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  avg_ticket_xof: z.number().int().nullable().optional(),
});

// Regex stricte HH:mm (00-23 / 00-59). L'ancien pattern `[0-2]\d` acceptait
// 25:59 et 29:00 — bug invisible jusqu'à ce qu'une row admin malformée passe.
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const OpeningSlotSchema = z.object({
  open: z.string().regex(HHMM),
  close: z.string().regex(HHMM),
});

export const HoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(OpeningSlotSchema),
);

export const PlaceSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  name: z.string().min(1),
  cuisine: z.array(z.string()),
  location: PlaceLocationSchema,
  price: PriceRangeSchema,
  hours: HoursSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  // `cover_photo_url` peut arriver `null` ou `""` (DB ne distingue pas
  // toujours). On normalise `""` → null à la parse pour que les consumers
  // (`Image source={{ uri: cover ?? undefined }}`) ne tentent pas de charger
  // une URI vide, ce qui déclencherait un onError loop sur certains Android.
  cover_photo_url: z
    .string()
    .nullable()
    .transform((v) => (v === null || v.length === 0 ? null : v)),
  gallery_urls: z.array(z.string()),
  signals: z.array(z.string()),
  is_published: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PlaceAdnSchema = z.object({
  place_id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  axe_local_international: ADN_AXIS,
  axe_informel_etabli: ADN_AXIS,
  axe_budget_premium: ADN_AXIS,
  axe_populaire_prive: ADN_AXIS,
  axe_decontracte_habille: ADN_AXIS,
  confidence_score: z.number().min(0).max(1),
  total_reviews: z.number().int().min(0),
  weighted_rating: z.number().min(0).max(5),
  updated_at: z.string(),
});

export const PlaceWithAdnSchema = PlaceSchema.extend({
  adn: PlaceAdnSchema,
  rating_display: z.number(),
  total_spawts: z.number().int().min(0),
});

export type PlaceParsed = z.infer<typeof PlaceSchema>;
export type PlaceAdnParsed = z.infer<typeof PlaceAdnSchema>;
export type PlaceWithAdnParsed = z.infer<typeof PlaceWithAdnSchema>;
