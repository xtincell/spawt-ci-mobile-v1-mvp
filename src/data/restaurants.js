// ═══════════════════════════════════════════
// SPAWT — 20 restaurants seedés (Abidjan)
// 6 catégories Mission 1
// Chaque lieu a un ADN Terroir (5 axes, -50 à +50)
// ═══════════════════════════════════════════

const restaurants = [
  // ─── DATE NIGHT / PREMIUM (5) ────────────────
  {
    id: 1,
    name: "Bô Zinc",
    type: "Restaurant gastronomique",
    quartier: "Zone 4",
    categorie: "date-night",
    coords: { lat: 5.328, lng: -4.009 },
    adn: {
      racinesHorizons: 30,
      taniereNomade: -10,
      exigeantEnthousiaste: -35,
      fouleSecret: -15,
      gargoteTable: 45,
    },
    specialites: ["Côte de bœuf", "Risotto truffe", "Tartare de thon"],
    horaires: "12h - 23h",
    budget: 4,
    emoji: "🥂",
    noteCommunautaire: 4.6,
    nbSpawts: 87,
    avis: [
      { auteur: "Brice M.", texte: "Service impeccable. Le tartare est un chef-d'œuvre. Réserver absolument.", fiabilite: "Très fiable", date: "Fév. 2026" },
      { auteur: "Awa K.", texte: "Pour un date night, c'est le move. Mais prépare le portefeuille.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },
  {
    id: 2,
    name: "Bushman Café",
    type: "Afro-fusion",
    quartier: "Cocody Riviera",
    categorie: "date-night",
    coords: { lat: 5.358, lng: -3.970 },
    adn: {
      racinesHorizons: 15,
      taniereNomade: 10,
      exigeantEnthousiaste: -20,
      fouleSecret: 20,
      gargoteTable: 30,
    },
    specialites: ["Poulet braisé revisité", "Cocktails signature", "Tiramisu coco"],
    horaires: "11h - 00h",
    budget: 3,
    emoji: "🌿",
    noteCommunautaire: 4.4,
    nbSpawts: 64,
    avis: [
      { auteur: "Kofi T.", texte: "L'ambiance est folle. Le décor, la musique, les cocktails. Tout est pensé.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 3,
    name: "Le Petit Paris",
    type: "Bistrot français",
    quartier: "Zone 4",
    categorie: "date-night",
    coords: { lat: 5.325, lng: -4.011 },
    adn: {
      racinesHorizons: 40,
      taniereNomade: -20,
      exigeantEnthousiaste: -30,
      fouleSecret: -10,
      gargoteTable: 40,
    },
    specialites: ["Entrecôte", "Tarte tatin", "Crème brûlée"],
    horaires: "12h - 22h30",
    budget: 4,
    emoji: "🗼",
    noteCommunautaire: 4.3,
    nbSpawts: 52,
    avis: [
      { auteur: "Betsy O.", texte: "On se croirait à Paris. Le serveur parle même français de France.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },
  {
    id: 4,
    name: "Chez Julien",
    type: "Gastronomie méditerranéenne",
    quartier: "Plateau",
    categorie: "date-night",
    coords: { lat: 5.320, lng: -4.020 },
    adn: {
      racinesHorizons: 35,
      taniereNomade: -15,
      exigeantEnthousiaste: -40,
      fouleSecret: -25,
      gargoteTable: 50,
    },
    specialites: ["Carpaccio", "Poulpe grillé", "Tiramisu classique"],
    horaires: "12h - 22h",
    budget: 5,
    emoji: "🍷",
    noteCommunautaire: 4.7,
    nbSpawts: 41,
    avis: [
      { auteur: "Moussa D.", texte: "Le seul resto à Abidjan où je ferme les yeux et je suis en Italie.", fiabilite: "Très fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 5,
    name: "Rooftop Assinie",
    type: "Lounge & restaurant",
    quartier: "Assinie-Mafia",
    categorie: "date-night",
    coords: { lat: 5.156, lng: -3.518 },
    adn: {
      racinesHorizons: 25,
      taniereNomade: 20,
      exigeantEnthousiaste: 10,
      fouleSecret: 30,
      gargoteTable: 35,
    },
    specialites: ["Poisson grillé", "Cocktails sunset", "Ceviche"],
    horaires: "16h - 02h",
    budget: 4,
    emoji: "🌅",
    noteCommunautaire: 4.5,
    nbSpawts: 38,
    avis: [
      { auteur: "Awa K.", texte: "Vue sur la mer au coucher de soleil. Le ceviche est frais du jour.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },

  // ─── DABALI / RACINES (5) ────────────────────
  {
    id: 6,
    name: "Chez Tantie Rose",
    type: "Maquis légendaire",
    quartier: "Yopougon Niangon",
    categorie: "dabali",
    coords: { lat: 5.360, lng: -4.075 },
    adn: {
      racinesHorizons: -45,
      taniereNomade: -30,
      exigeantEnthousiaste: 20,
      fouleSecret: 25,
      gargoteTable: -40,
    },
    specialites: ["Garba", "Attiéké poisson", "Kédjénou"],
    horaires: "7h - 22h",
    budget: 1,
    emoji: "🍲",
    noteCommunautaire: 4.8,
    nbSpawts: 234,
    avis: [
      { auteur: "Kouadio A.", texte: "Le poisson braisé qui a mis Yopougon Niangon sur la carte. Arrivez tôt.", fiabilite: "Très fiable", date: "Fév. 2026" },
      { auteur: "Moussa D.", texte: "Mon endroit depuis 10 ans. Tantie Rose connaît ma commande par cœur.", fiabilite: "Très fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 7,
    name: "Maquis du Port",
    type: "Maquis fruits de mer",
    quartier: "Treichville",
    categorie: "dabali",
    coords: { lat: 5.305, lng: -4.000 },
    adn: {
      racinesHorizons: -40,
      taniereNomade: -20,
      exigeantEnthousiaste: 15,
      fouleSecret: 35,
      gargoteTable: -35,
    },
    specialites: ["Poisson braisé", "Crevettes sautées", "Foutou banane"],
    horaires: "10h - 22h",
    budget: 2,
    emoji: "🐟",
    noteCommunautaire: 4.5,
    nbSpawts: 156,
    avis: [
      { auteur: "Betsy O.", texte: "Le poisson est frais du port. Tu le choisis vivant. C'est ça l'expérience.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },
  {
    id: 8,
    name: "Garba King",
    type: "Garba spécialisé",
    quartier: "Adjamé",
    categorie: "dabali",
    coords: { lat: 5.345, lng: -4.025 },
    adn: {
      racinesHorizons: -50,
      taniereNomade: 10,
      exigeantEnthousiaste: 30,
      fouleSecret: 40,
      gargoteTable: -45,
    },
    specialites: ["Garba simple", "Garba spécial", "Garba œuf"],
    horaires: "6h - 20h",
    budget: 1,
    emoji: "🐟",
    noteCommunautaire: 4.6,
    nbSpawts: 312,
    avis: [
      { auteur: "Dominic F.", texte: "Le meilleur garba d'Adjamé. Le thon fond. L'attiéké croustille. 500F le bonheur.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 9,
    name: "Alloco d'Or",
    type: "Garbadrome",
    quartier: "Marcory",
    categorie: "dabali",
    coords: { lat: 5.310, lng: -3.990 },
    adn: {
      racinesHorizons: -45,
      taniereNomade: 5,
      exigeantEnthousiaste: 35,
      fouleSecret: 30,
      gargoteTable: -40,
    },
    specialites: ["Alloco poisson", "Alloco poulet", "Attiéké"],
    horaires: "8h - 21h",
    budget: 1,
    emoji: "🍌",
    noteCommunautaire: 4.4,
    nbSpawts: 189,
    avis: [
      { auteur: "Kofi T.", texte: "L'alloco est croustillant dehors, fondant dedans. Le piment est maison.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },
  {
    id: 10,
    name: "Attiéké Palace",
    type: "Maquis attiéké",
    quartier: "Abobo",
    categorie: "dabali",
    coords: { lat: 5.415, lng: -4.020 },
    adn: {
      racinesHorizons: -50,
      taniereNomade: -25,
      exigeantEnthousiaste: 25,
      fouleSecret: 20,
      gargoteTable: -45,
    },
    specialites: ["Attiéké frais", "Poisson braisé", "Sauce graine"],
    horaires: "7h - 21h",
    budget: 1,
    emoji: "🥘",
    noteCommunautaire: 4.3,
    nbSpawts: 145,
    avis: [
      { auteur: "Awa K.", texte: "L'attiéké est fait sur place. Tu le vois sécher au soleil en arrivant.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },

  // ─── BOYS / BARBECUE (3) ─────────────────────
  {
    id: 11,
    name: "Braise & Fire",
    type: "Grill & Barbecue",
    quartier: "Angré Star 10",
    categorie: "boys",
    coords: { lat: 5.370, lng: -3.960 },
    adn: {
      racinesHorizons: -15,
      taniereNomade: 15,
      exigeantEnthousiaste: 25,
      fouleSecret: 35,
      gargoteTable: -20,
    },
    specialites: ["Wings fumées", "Choukouya", "Ribs BBQ"],
    horaires: "17h - 01h",
    budget: 2,
    emoji: "🔥",
    noteCommunautaire: 4.5,
    nbSpawts: 98,
    avis: [
      { auteur: "Dominic F.", texte: "Le spot boys du moment. Le charbon, la fumée, les potes. C'est tout.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 12,
    name: "Le Ranch",
    type: "Grill américain",
    quartier: "Cocody Riviera",
    categorie: "boys",
    coords: { lat: 5.355, lng: -3.965 },
    adn: {
      racinesHorizons: 10,
      taniereNomade: 10,
      exigeantEnthousiaste: 20,
      fouleSecret: 30,
      gargoteTable: -10,
    },
    specialites: ["Burger smash", "T-bone steak", "Nachos"],
    horaires: "12h - 00h",
    budget: 3,
    emoji: "🤠",
    noteCommunautaire: 4.2,
    nbSpawts: 67,
    avis: [
      { auteur: "Brice M.", texte: "Le smash burger est le meilleur d'Abidjan. Fight me.", fiabilite: "Fiable", date: "Jan. 2026" },
    ],
  },
  {
    id: 13,
    name: "Grillades du Plateau",
    type: "Braisé traditionnel",
    quartier: "Plateau",
    categorie: "boys",
    coords: { lat: 5.322, lng: -4.018 },
    adn: {
      racinesHorizons: -30,
      taniereNomade: -5,
      exigeantEnthousiaste: 30,
      fouleSecret: 40,
      gargoteTable: -30,
    },
    specialites: ["Poulet braisé", "Choukouya bœuf", "Brochettes"],
    horaires: "11h - 23h",
    budget: 2,
    emoji: "🍗",
    noteCommunautaire: 4.4,
    nbSpawts: 112,
    avis: [
      { auteur: "Moussa D.", texte: "Le poulet braisé le midi au Plateau. Un classique. Tout le monde s'y retrouve.", fiabilite: "Très fiable", date: "Fév. 2026" },
    ],
  },

  // ─── NOUVEAUX RESTOS (3) ─────────────────────
  {
    id: 14,
    name: "Street Kitchen",
    type: "Street food fusion",
    quartier: "Marcory",
    categorie: "nouveau",
    coords: { lat: 5.312, lng: -3.995 },
    adn: {
      racinesHorizons: 15,
      taniereNomade: 25,
      exigeantEnthousiaste: 30,
      fouleSecret: 35,
      gargoteTable: -25,
    },
    specialites: ["Choukouya", "Alloco revisité", "Jus bissap"],
    horaires: "11h - 22h",
    budget: 1,
    emoji: "🛒",
    noteCommunautaire: 4.3,
    nbSpawts: 28,
    avis: [
      { auteur: "Betsy O.", texte: "Nouveau et déjà addict. Le choukouya fumé sur place change tout.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 15,
    name: "Wok & Roll",
    type: "Asiatique fusion",
    quartier: "Riviera Palmeraie",
    categorie: "nouveau",
    coords: { lat: 5.362, lng: -3.955 },
    adn: {
      racinesHorizons: 40,
      taniereNomade: 20,
      exigeantEnthousiaste: 10,
      fouleSecret: 15,
      gargoteTable: 5,
    },
    specialites: ["Ramen tonkotsu", "Gyoza", "Bao buns"],
    horaires: "12h - 22h30",
    budget: 3,
    emoji: "🍜",
    noteCommunautaire: 4.1,
    nbSpawts: 15,
    avis: [
      { auteur: "Kofi T.", texte: "Le ramen est honnête pour Abidjan. Pas transcendant mais solide. Je reviens.", fiabilite: "En construction", date: "Fév. 2026" },
    ],
  },
  {
    id: 16,
    name: "La Petite Cour",
    type: "Brunch & café",
    quartier: "Cocody II Plateaux",
    categorie: "nouveau",
    coords: { lat: 5.348, lng: -3.978 },
    adn: {
      racinesHorizons: 20,
      taniereNomade: 5,
      exigeantEnthousiaste: -10,
      fouleSecret: -20,
      gargoteTable: 20,
    },
    specialites: ["Pancakes", "Eggs Benedict", "Smoothie bowl"],
    horaires: "8h - 17h",
    budget: 2,
    emoji: "☕",
    noteCommunautaire: 4.4,
    nbSpawts: 22,
    avis: [
      { auteur: "Awa K.", texte: "Dimanche matin parfait. Les pancakes sont moelleux, le café est bon.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },

  // ─── HYPE / INSTAGRAM (2) ────────────────────
  {
    id: 17,
    name: "Bloom Café",
    type: "Café instagrammable",
    quartier: "Cocody Riviera",
    categorie: "hype",
    coords: { lat: 5.356, lng: -3.968 },
    adn: {
      racinesHorizons: 30,
      taniereNomade: 15,
      exigeantEnthousiaste: 5,
      fouleSecret: -30,
      gargoteTable: 15,
    },
    specialites: ["Matcha latte", "Açai bowl", "Avocado toast"],
    horaires: "9h - 20h",
    budget: 3,
    emoji: "🌸",
    noteCommunautaire: 4.0,
    nbSpawts: 56,
    avis: [
      { auteur: "Vanessa L.", texte: "Le décor est incroyable pour les photos. La nourriture est correcte sans plus.", fiabilite: "En construction", date: "Jan. 2026" },
    ],
  },
  {
    id: 18,
    name: "Smoothie Factory",
    type: "Bar à jus healthy",
    quartier: "Plateau",
    categorie: "hype",
    coords: { lat: 5.318, lng: -4.015 },
    adn: {
      racinesHorizons: 25,
      taniereNomade: 20,
      exigeantEnthousiaste: 15,
      fouleSecret: -20,
      gargoteTable: 0,
    },
    specialites: ["Smoothie détox", "Bowl protéiné", "Jus pressé"],
    horaires: "8h - 19h",
    budget: 2,
    emoji: "🥤",
    noteCommunautaire: 4.1,
    nbSpawts: 43,
    avis: [
      { auteur: "Betsy O.", texte: "Le smoothie détox me fait croire que je suis saine. C'est tout ce que je demande.", fiabilite: "Fiable", date: "Fév. 2026" },
    ],
  },

  // ─── SCEPTIQUES (2) ──────────────────────────
  {
    id: 19,
    name: "Chez Maman Adjoua",
    type: "Maquis familial",
    quartier: "Koumassi",
    categorie: "sceptique",
    coords: { lat: 5.295, lng: -3.960 },
    adn: {
      racinesHorizons: -50,
      taniereNomade: -40,
      exigeantEnthousiaste: 30,
      fouleSecret: 45,
      gargoteTable: -50,
    },
    specialites: ["Sauce graine", "Foutou igname", "Soupe claire"],
    horaires: "7h - 20h",
    budget: 1,
    emoji: "👵",
    noteCommunautaire: 4.7,
    nbSpawts: 34,
    avis: [
      { auteur: "Kouadio A.", texte: "Maman Adjoua cuisine comme ma grand-mère. Si tu la connais pas, tu connais pas Abidjan.", fiabilite: "Très fiable", date: "Fév. 2026" },
    ],
  },
  {
    id: 20,
    name: "Le Vieux Baobab",
    type: "Restaurant traditionnel",
    quartier: "Treichville",
    categorie: "sceptique",
    coords: { lat: 5.302, lng: -3.998 },
    adn: {
      racinesHorizons: -45,
      taniereNomade: -35,
      exigeantEnthousiaste: 20,
      fouleSecret: 40,
      gargoteTable: -35,
    },
    specialites: ["Attiéké complet", "Placali", "Sauce arachide"],
    horaires: "8h - 21h",
    budget: 1,
    emoji: "🌳",
    noteCommunautaire: 4.5,
    nbSpawts: 27,
    avis: [
      { auteur: "Moussa D.", texte: "30 ans sans changer la recette. C'est pour ça qu'on revient.", fiabilite: "Très fiable", date: "Jan. 2026" },
    ],
  },
];

// Add photos (Unsplash free images)
const PHOTOS = {
  1: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=600&fit=crop&auto=format&q=80",
  2: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop&auto=format&q=80",
  3: "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&h=600&fit=crop&auto=format&q=80",
  4: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop&auto=format&q=80",
  5: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop&auto=format&q=80",
  6: "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=800&h=600&fit=crop&auto=format&q=80",
  7: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800&h=600&fit=crop&auto=format&q=80",
  8: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop&auto=format&q=80",
  9: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=800&h=600&fit=crop&auto=format&q=80",
  10: "https://images.unsplash.com/photo-1512058564366-18510be2db87?w=800&h=600&fit=crop&auto=format&q=80",
  11: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=800&h=600&fit=crop&auto=format&q=80",
  12: "https://images.unsplash.com/photo-1568901346602-db76093f7e2c?w=800&h=600&fit=crop&auto=format&q=80",
  13: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&h=600&fit=crop&auto=format&q=80",
  14: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&h=600&fit=crop&auto=format&q=80",
  15: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop&auto=format&q=80",
  16: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop&auto=format&q=80",
  17: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop&auto=format&q=80",
  18: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=800&h=600&fit=crop&auto=format&q=80",
  19: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&h=600&fit=crop&auto=format&q=80",
  20: "https://images.unsplash.com/photo-1567364816519-cbc9e0a32f72?w=800&h=600&fit=crop&auto=format&q=80",
};
restaurants.forEach(r => { r.image = PHOTOS[r.id]; });

// Enrichir les spécialités : string[] → { id, nom }[]
let _platId = 1;
restaurants.forEach(r => {
  r.specialites = r.specialites.map(nom => ({
    id: _platId++,
    nom: typeof nom === "string" ? nom : nom.nom,
  }));
});

export default restaurants;

// Helper: calculate match score between a user palais and a restaurant ADN
export function calcMatchScore(palais, adn) {
  const axes = ["racinesHorizons", "taniereNomade", "exigeantEnthousiaste", "fouleSecret", "gargoteTable"];
  let totalDiff = 0;
  for (const axe of axes) {
    totalDiff += Math.abs((palais[axe] || 0) - (adn[axe] || 0));
  }
  // Max possible diff = 5 * 100 = 500
  const score = Math.round(100 - (totalDiff / 500) * 100);
  return Math.max(20, Math.min(99, score));
}

// Helper: Haversine distance between two points (km)
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Helper: find nearby spots (within radiusKm)
export function findNearbySpots(lat, lng, radiusKm = 0.5) {
  return restaurants
    .map(r => ({
      spot: r,
      distance: haversineDistance(lat, lng, r.coords.lat, r.coords.lng),
    }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}
