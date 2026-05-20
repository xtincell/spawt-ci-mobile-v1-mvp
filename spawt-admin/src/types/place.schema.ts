// Port autonome — pas d'import croisé app/ ↔ spawt-admin/.
// Synchronisé manuellement avec app/src/types/place.schema.ts (revue PR).

import { z } from "zod";

const ADN_AXIS = z.number().min(-1).max(1);

export const PlaceLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  descriptive_address: z.string().min(1, "Adresse descriptive requise"),
  neighborhood: z.string().min(1, "Quartier requis"),
  city: z.string().min(1).default("Abidjan"),
});

export const PriceRangeSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  avg_ticket_xof: z.number().int().nonnegative().nullable().optional(),
});

export const OpeningSlotSchema = z.object({
  open: z.string().regex(/^[0-2]\d:[0-5]\d$/, "Format HH:MM requis"),
  close: z.string().regex(/^[0-2]\d:[0-5]\d$/, "Format HH:MM requis"),
});

export const HoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(OpeningSlotSchema),
);

export const PlaceFormSchema = z.object({
  name: z.string().min(1, "Nom du lieu requis").max(120),
  cuisine: z.array(z.string().min(1)).min(1, "Au moins une cuisine"),
  location: PlaceLocationSchema,
  price: PriceRangeSchema,
  hours: HoursSchema,
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  whatsapp: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  cover_photo_url: z.string().url().nullable().optional(),
  gallery_urls: z.array(z.string().url()).default([]),
  signals: z
    .array(
      z.enum([
        "institution",
        "coup_de_coeur",
        "pepite_verifiee",
        "hype",
        "nouveau",
        "sceptique",
      ]),
    )
    .default([]),
  is_published: z.boolean().default(false),
});

export const PlaceAdnFormSchema = z.object({
  axe_local_international: ADN_AXIS,
  axe_informel_etabli: ADN_AXIS,
  axe_budget_premium: ADN_AXIS,
  axe_populaire_prive: ADN_AXIS,
  axe_decontracte_habille: ADN_AXIS,
});

export type PlaceForm = z.infer<typeof PlaceFormSchema>;
export type PlaceAdnForm = z.infer<typeof PlaceAdnFormSchema>;
