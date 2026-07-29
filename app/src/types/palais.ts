// PRD §5.1 — 5 axes bipolaires du Palais
// PRD §13.1 — table user_palais
// Échelle : -1.0 (pôle gauche) à +1.0 (pôle droit), normalisée

export const PALAIS_AXES = [
  "racines_horizons", // Racines (-) ↔ Horizons (+)
  "taniere_nomade", // Tanière (-) ↔ Nomade (+)
  "exigeant_enthousiaste", // Exigeant (-) ↔ Enthousiaste (+)
  "foule_secret", // Foule (-) ↔ Secret (+)
  "maquis_table", // Maquis (-) ↔ Table (+)
] as const;

export type PalaisAxis = (typeof PALAIS_AXES)[number];

export interface PalaisAxisLabels {
  axis: PalaisAxis;
  negativePole: string;
  positivePole: string;
  measures: string;
}

export const PALAIS_AXIS_LABELS: Record<PalaisAxis, PalaisAxisLabels> = {
  racines_horizons: {
    axis: "racines_horizons",
    negativePole: "Racines",
    positivePole: "Horizons",
    measures: "Attachement aux saveurs locales vs ouverture internationale",
  },
  taniere_nomade: {
    axis: "taniere_nomade",
    negativePole: "Tanière",
    positivePole: "Nomade",
    measures: "Fidélité à ses spots vs exploration constante",
  },
  exigeant_enthousiaste: {
    axis: "exigeant_enthousiaste",
    negativePole: "Exigeant",
    positivePole: "Enthousiaste",
    measures: "Sélectivité critique vs ouverture bienveillante",
  },
  foule_secret: {
    axis: "foule_secret",
    negativePole: "Foule",
    positivePole: "Secret",
    measures: "Aime les spots populaires vs préfère les adresses cachées",
  },
  maquis_table: {
    axis: "maquis_table",
    negativePole: "Maquis",
    positivePole: "Table",
    measures: "Street food / maquis vs gastronomie / tables dressées",
  },
};

// Profil gustatif d'un spawter — aligné PRD §13.1 (FLOAT [-1, 1] normalisé)
export interface UserPalais {
  spawter_id: string;
  axe_racines_horizons: number; // [-1, 1]
  axe_taniere_nomade: number;
  axe_exigeant_enthousiaste: number;
  axe_foule_secret: number;
  axe_maquis_table: number;
  /** Fiabilité du Palais — [0, 1]. <0.3 = "En construction" */
  confidence_score: number;
  /** Les 2 axes les plus marqués (cf. PRD §5.1) */
  dominant_axes: [PalaisAxis, PalaisAxis] | null;
  archetype_id: string | null;
  stade: import("./stade").Stade;
  total_spawts: number;
  updated_at: string;
}

/** Palais initial à l'onboarding : scores [-0.40, +0.40] (PRD §5.6) */
export type CalibrationDelta = number; // entre -0.4 et 0.4
