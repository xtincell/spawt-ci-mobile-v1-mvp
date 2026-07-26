-- ============================================================================
-- Migration 0041 — Multi-villes : référentiel cities + places.city_code
-- ============================================================================
-- NFR-PORT-01 : SPAWT est né à Abidjan mais la base doit être portable
-- (Dakar en ligne de mire). Ce référentiel remplace le `city TEXT DEFAULT
-- 'Abidjan'` libre de places (0010) par une FK vers un référentiel piloté :
-- une ville inactive n'apparaît nulle part côté app, l'activer = 1 UPDATE.
-- La colonne places.city d'origine reste (compat lecture) ; city_code devient
-- la référence canonique.
--
-- communes (jsonb) : la liste du Select d'onboarding (app/src/i18n/fr.json,
-- clés onboarding.commune.*) — 13 communes du Grand Abidjan + « autre ».
-- Date : 2026-07-26

CREATE TABLE public.cities (
  code        text PRIMARY KEY
                CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name        text NOT NULL,
  country     text NOT NULL
                CHECK (country IN ('CI','NG','SN','CM','TG','BJ','BF','ML','GN','GH')),
  default_lat double precision,
  default_lng double precision,
  communes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active   boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.cities IS
  'Référentiel villes (NFR-PORT-01). is_active=false = ville préparée mais '
  'invisible côté app. communes = liste [{code, name}] du Select onboarding.';

-- ━━━ Seed : Abidjan (active) + Dakar (préparée, inactive) ━━━━━━━━━━━━━━━━━━━
INSERT INTO public.cities (code, name, country, default_lat, default_lng, communes, is_active)
VALUES
  ('abidjan', 'Abidjan', 'CI', 5.3364, -4.0267, '[
    {"code": "abobo",       "name": "Abobo"},
    {"code": "adjame",      "name": "Adjamé"},
    {"code": "anyama",      "name": "Anyama"},
    {"code": "attecoube",   "name": "Attécoubé"},
    {"code": "bingerville", "name": "Bingerville"},
    {"code": "cocody",      "name": "Cocody"},
    {"code": "koumassi",    "name": "Koumassi"},
    {"code": "marcory",     "name": "Marcory"},
    {"code": "plateau",     "name": "Plateau"},
    {"code": "port_bouet",  "name": "Port-Bouët"},
    {"code": "songon",      "name": "Songon"},
    {"code": "treichville", "name": "Treichville"},
    {"code": "yopougon",    "name": "Yopougon"},
    {"code": "autre",       "name": "Autre / hors Abidjan"}
  ]'::jsonb, true),
  ('dakar', 'Dakar', 'SN', 14.6928, -17.4467, '[
    {"code": "plateau",     "name": "Plateau"},
    {"code": "medina",      "name": "Médina"},
    {"code": "almadies",    "name": "Almadies"},
    {"code": "ouakam",      "name": "Ouakam"},
    {"code": "yoff",        "name": "Yoff"},
    {"code": "ngor",        "name": "Ngor"},
    {"code": "parcelles",   "name": "Parcelles Assainies"},
    {"code": "grand_dakar", "name": "Grand Dakar"},
    {"code": "autre",       "name": "Autre / hors Dakar"}
  ]'::jsonb, false)
ON CONFLICT (code) DO NOTHING;

-- ━━━ places.city_code + backfill ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Le DEFAULT remplit les lignes existantes (PG11+) ; le backfill explicite est
-- la ceinture pour d'éventuelles lignes à NULL (imports antérieurs).
ALTER TABLE public.places
  ADD COLUMN city_code text REFERENCES public.cities(code) DEFAULT 'abidjan';

UPDATE public.places SET city_code = 'abidjan' WHERE city_code IS NULL;

CREATE INDEX idx_places_city_code ON public.places (city_code);

COMMENT ON COLUMN public.places.city_code IS
  'Ville de rattachement (FK cities). Remplace la colonne libre city (0010) '
  'comme référence canonique. Tout l''inventaire V1 = abidjan.';

-- ━━━ Row-Level Security ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Référentiel public (même modèle que currencies 0002) : lecture libre, y
-- compris villes inactives (l'app filtre sur is_active — contrôle
-- d'éligibilité applicatif, pas un masque RLS).
CREATE POLICY cities_select_all ON public.cities
  FOR SELECT TO anon, authenticated
  USING (true);

-- Écriture : service_role only (activer une ville = décision produit).
