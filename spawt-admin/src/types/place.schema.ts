// Port autonome — pas d'import croisé app/ ↔ spawt-admin/.
// Published records keep the mobile contract; staff drafts may be incomplete.

import { z } from "zod";

const ADN_AXIS = z.number().min(-1).max(1);

// CR Chunk B m13 — borner lat/lng à la zone Abidjan élargie pour éviter
// la saisie accidentelle d'un lieu à Hanoi (PRD V1 = Abidjan only).
// Bbox approximative grand Abidjan + Bingerville : 5.20-5.60 lat, -4.20 -3.70 lng.
export const PlaceLocationSchema = z.object({
  lat: z.number().min(5.20, "Hors zone Abidjan (lat trop basse)").max(5.60, "Hors zone Abidjan (lat trop haute)").nullable(),
  lng: z.number().min(-4.30, "Hors zone Abidjan (lng trop à l'ouest)").max(-3.70, "Hors zone Abidjan (lng trop à l'est)").nullable(),
  descriptive_address: z.string(),
  neighborhood: z.string(),
  city: z.string().default("Abidjan"),
});

export const PriceRangeSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  avg_ticket_xof: z.number().int().nonnegative().nullable().optional(),
});

// CR Chunk B m13 — regex strict 24h. L'ancien `[0-2]\d` acceptait `29:59`.
export const OpeningSlotSchema = z.object({
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM 24h requis"),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format HH:MM 24h requis"),
});

export const HoursSchema = z.record(
  z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
  z.array(OpeningSlotSchema),
);

export const PlaceFormSchema = z.object({
  name: z.string().trim().min(1, "Nom du lieu requis").max(120),
  cuisine: z.array(z.string().min(1)),
  location: PlaceLocationSchema,
  price: PriceRangeSchema,
  hours: HoursSchema,
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  whatsapp: z.string().regex(/^\+[1-9]\d{1,14}$/).nullable().optional(),
  cover_photo_url: z.string().url().nullable().optional(),
  gallery_urls: z.array(z.string().url()).default([]),
  // Photos du menu — colonne places.menu_urls TEXT[] NOT NULL DEFAULT '{}'
  // (même sémantique que gallery_urls).
  menu_urls: z.array(z.string().url()).default([]),
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
}).superRefine((value, ctx) => {
  if ((value.location.lat === null) !== (value.location.lng === null)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["location", "lat"], message: "Renseigner les deux coordonnées ou laisser les deux inconnues." });
  if (!value.is_published) return;
  const required: [boolean, (string | number)[], string][] = [
    [!!value.location.city.trim(), ["location", "city"], "Ville requise"],
  ];
  for (const [valid, path, message] of required) {
    if (!valid) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${message} pour publier ; le brouillon peut rester incomplet.` });
  }
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
