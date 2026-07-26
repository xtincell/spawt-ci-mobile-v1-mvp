// Mode Explore — fixtures démo des collections éditoriales (miroir 0045).
//
// Même contrat que les tables `explore_collections` / `explore_items` :
//   - title_key / subtitle_key = clés i18n (`explore.<slug>.title`) — la
//     curation admin (chantier séparé) suivra la même convention ;
//   - editorial_text = le mot du Chat sur CE lieu dans CETTE collection,
//     français direct, <= 280 caractères (CHECK DB) — PAS une clé i18n ;
//   - is_published = false → invisible côté app (parité RLS).
// Les place_id pointent sur SEED_PLACES (places.ts) — un id inconnu est
// droppé silencieusement par l'adaptateur (fixture désalignée ≠ crash).

export interface SeedExploreItem {
  place_id: string;
  /** Le mot du Chat — français direct, <= 280 caractères (CHECK 0045). */
  editorial_text: string | null;
  sort_order: number;
}

export interface SeedExploreCollection {
  id: string;
  slug: string;
  title_key: string;
  subtitle_key: string | null;
  cover_url: string | null;
  sort_order: number;
  is_published: boolean;
  city_code: string;
  items: SeedExploreItem[];
}

export const SEED_EXPLORE_COLLECTIONS: SeedExploreCollection[] = [
  {
    id: "00000000-0000-0000-0001-000000000001",
    slug: "maquis-braise",
    title_key: "explore.maquis-braise.title",
    subtitle_key: "explore.maquis-braise.subtitle",
    cover_url: null,
    sort_order: 1,
    is_published: true,
    city_code: "abidjan",
    items: [
      {
        place_id: "00000000-0000-0000-0000-000000000004", // Maquis Chez Tantie Rose
        editorial_text:
          "Le poulet braisé arrive encore en train de chanter. Tantie Rose ne sourit pas beaucoup, mais son alloco parle pour elle. Viens avec les doigts, repars avec des souvenirs.",
        sort_order: 1,
      },
      {
        place_id: "00000000-0000-0000-0000-000000000005", // Chez Ambroise
        editorial_text:
          "Plastique, braise et zéro chichi. Ici on commande fort, on mange mieux, et l'addition te laisse de quoi remettre une tournée.",
        sort_order: 2,
      },
      {
        place_id: "00000000-0000-0000-0000-000000000006", // Garba Palace
        editorial_text:
          "Un palace sans dorures : du garba net, servi vite, à un prix qui défie la ville. Le midi ça déborde — c'est bon signe.",
        sort_order: 3,
      },
      {
        place_id: "00000000-0000-0000-0000-000000000010", // Attieke Paradise
        editorial_text:
          "L'attiéké comme au bord de l'eau : frais, moelleux, le poisson qui sort de la braise. Le paradis porte bien son nom.",
        sort_order: 4,
      },
    ],
  },
  {
    id: "00000000-0000-0000-0001-000000000002",
    slug: "sucre-cocody",
    title_key: "explore.sucre-cocody.title",
    subtitle_key: "explore.sucre-cocody.subtitle",
    cover_url: null,
    sort_order: 2,
    is_published: true,
    city_code: "abidjan",
    items: [
      {
        place_id: "00000000-0000-0000-0000-000000000011", // Café des Arts
        editorial_text:
          "Un café qui sent la peinture fraîche et le gâteau du jour. Tu viens pour une heure, tu restes l'après-midi.",
        sort_order: 1,
      },
      {
        place_id: "00000000-0000-0000-0000-000000000002", // Bushman Café
        editorial_text:
          "La fusion qui ne se force pas : les desserts jouent entre ici et ailleurs, la terrasse fait le reste.",
        sort_order: 2,
      },
      {
        place_id: "00000000-0000-0000-0000-000000000007", // Norias
        editorial_text:
          "Les douceurs libanaises qui closent un déjeuner comme il faut. Baklava d'abord, décisions ensuite.",
        sort_order: 3,
      },
    ],
  },
  // Brouillon staff (parité workflow draft/publish 0045) — JAMAIS visible
  // côté app : sert aussi de fixture au test de filtrage is_published.
  {
    id: "00000000-0000-0000-0001-000000000003",
    slug: "brouillon-nuit",
    title_key: "explore.brouillon-nuit.title",
    subtitle_key: null,
    cover_url: null,
    sort_order: 3,
    is_published: false,
    city_code: "abidjan",
    items: [
      {
        place_id: "00000000-0000-0000-0000-000000000012", // Assinie Beach Club
        editorial_text: null,
        sort_order: 1,
      },
    ],
  },
];
