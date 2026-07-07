// PRD §6 — ADN du Lieu (5 axes) + §13.2 — table place_adn

export const ADN_AXES = [
  "local_international",
  "informel_etabli",
  "budget_premium",
  "populaire_prive",
  "decontracte_habille",
] as const;

export type AdnAxis = (typeof ADN_AXES)[number];

export interface AdnAxisLabels {
  axis: AdnAxis;
  negativePole: string;
  positivePole: string;
  measures: string;
}

export const ADN_AXIS_LABELS: Record<AdnAxis, AdnAxisLabels> = {
  local_international: {
    axis: "local_international",
    negativePole: "Local",
    positivePole: "International",
    measures: "Cuisine d'ici vs cuisine du monde",
  },
  informel_etabli: {
    axis: "informel_etabli",
    negativePole: "Informel",
    positivePole: "Établi",
    measures: "Maquis de rue vs établissement structuré",
  },
  budget_premium: {
    axis: "budget_premium",
    negativePole: "Budget",
    positivePole: "Premium",
    measures: "Accessibilité financière",
  },
  populaire_prive: {
    axis: "populaire_prive",
    negativePole: "Populaire",
    positivePole: "Privé",
    measures: "Notoriété large vs adresse cachée",
  },
  decontracte_habille: {
    axis: "decontracte_habille",
    negativePole: "Décontracté",
    positivePole: "Habillé",
    measures: "Ambiance relax vs setting soigné",
  },
};

export type CuisineCategory =
  | "ivoirienne"
  | "ouest_africaine"
  | "francaise"
  | "italienne"
  | "asiatique"
  | "libanaise"
  | "fusion"
  | "burger_pizza"
  | "patisserie"
  | "cafe"
  | "autre";

export type PlaceSignal =
  | "coup_de_coeur"
  | "pepite_verifiee"
  | "institution"
  | "fidelite"
  | "decouverte"
  | "table_diverse"
  | "noctambule_verifie";

export interface PlaceLocation {
  lat: number;
  lng: number;
  /** Description ouest-africaine ("en face de la pharmacie X") — PRD §14.2 */
  descriptive_address: string;
  neighborhood: string;
  city: string;
}

export interface PriceRange {
  /** Tranche déclarée — PRD §3.1 Feature 10 */
  tier: 1 | 2 | 3; // 1=économique, 2=moyen, 3=premium
  /** Optionnel : panier moyen indicatif en FCFA */
  avg_ticket_xof?: number;
}

export interface Place {
  id: string;
  name: string;
  cuisine: CuisineCategory[];
  location: PlaceLocation;
  price: PriceRange;
  /** Heures d'ouverture — format simple tableau de slots par jour */
  hours: Record<DayOfWeek, OpeningSlot[]>;
  phone: string | null;
  whatsapp: string | null;
  cover_photo_url: string | null;
  gallery_urls: string[];
  /** Photos du menu (onglet Menu de la fiche — R17/R19, migration 0030) */
  menu_urls: string[];
  /** Signaux spéciaux affichés sur la fiche (PRD §6.3) */
  signals: PlaceSignal[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface OpeningSlot {
  open: string; // "HH:mm"
  close: string;
}

/** ADN du lieu (PRD §13.2) */
export interface PlaceAdn {
  place_id: string;
  axe_local_international: number; // [-1, 1]
  axe_informel_etabli: number;
  axe_budget_premium: number;
  axe_populaire_prive: number;
  axe_decontracte_habille: number;
  /** [0, 1] — fiabilité. <0.3 → afficher "ADN en construction" */
  confidence_score: number;
  total_reviews: number;
  /** Note communautaire pondérée par stade (PRD §3.1 Feature 6) */
  weighted_rating: number;
  updated_at: string;
}
