// ============================================================================
// Import d'inventaire — parsing et validation, sans React ni réseau
// ============================================================================
// Le seul chemin d'import en masse était `scripts/seed-inventory.ts` : un
// script Node exigeant un terminal, cinq variables d'environnement et un
// `SEED_SPAWTER_ID` trouvé à la main. Autrement dit, réservé à quelqu'un qui
// sait ouvrir un shell — alors que charger l'inventaire est précisément le
// travail de l'équipe terrain.
//
// Ce module fait le travail ingrat : lire ce que l'opérateur dépose, dire
// ligne par ligne ce qui ne va pas, et ne laisser passer que du propre. Il est
// séparé de l'écran pour être testable sans navigateur (convention du dépôt).
//
// Format accepté : .xlsx, .xls et .csv — la première feuille, première ligne
// = en-têtes. Les en-têtes sont tolérants (accents, majuscules et espaces
// ignorés) : un fichier tapé à la main ne doit pas être rejeté pour un accent.

/** Une ligne validée, prête à être insérée dans `places`. */
export interface LieuImporte {
  name: string;
  cuisine: string[];
  lat: number;
  lng: number;
  descriptive_address: string;
  neighborhood: string;
  city: string;
  price_tier: 1 | 2 | 3;
  avg_ticket_xof: number | null;
  phone: string | null;
  whatsapp: string | null;
  is_published: boolean;
}

export interface LigneEnErreur {
  /** Numéro de ligne tel que l'opérateur le voit dans son tableur (en-tête = 1). */
  ligne: number;
  nom: string;
  erreurs: string[];
}

export interface ResultatAnalyse {
  valides: LieuImporte[];
  erreurs: LigneEnErreur[];
  /** Colonnes présentes dans le fichier mais qu'on ne sait pas lire. */
  colonnesIgnorees: string[];
}

/** Colonnes attendues, dans l'ordre du gabarit. */
export const COLONNES = [
  "nom",
  "cuisine",
  "lat",
  "lng",
  "adresse",
  "quartier",
  "ville",
  "gamme",
  "ticket_moyen",
  "telephone",
  "whatsapp",
  "publie",
] as const;

/**
 * Normalise un en-tête : minuscules, sans accent, sans espace ni ponctuation.
 * « Ticket moyen (F CFA) » et « ticket_moyen » désignent la même colonne.
 */
export function normaliserEntete(brut: string): string {
  return String(brut ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const ALIAS: Record<string, (typeof COLONNES)[number]> = {
  nom: "nom",
  name: "nom",
  lieu: "nom",
  cuisine: "cuisine",
  cuisines: "cuisine",
  typedecuisine: "cuisine",
  lat: "lat",
  latitude: "lat",
  lng: "lng",
  lon: "lng",
  long: "lng",
  longitude: "lng",
  adresse: "adresse",
  adressedescriptive: "adresse",
  repere: "adresse",
  quartier: "quartier",
  neighborhood: "quartier",
  ville: "ville",
  city: "ville",
  gamme: "gamme",
  gammedeprix: "gamme",
  tier: "gamme",
  pricetier: "gamme",
  ticketmoyen: "ticket_moyen",
  ticketmoyenfcfa: "ticket_moyen",
  paniermoyen: "ticket_moyen",
  telephone: "telephone",
  tel: "telephone",
  phone: "telephone",
  whatsapp: "whatsapp",
  publie: "publie",
  publier: "publie",
  published: "publie",
};

/** Cuisines acceptées — miroir du CHECK SQL sur `places.cuisine`. */
export const CUISINES = [
  "ivoirienne",
  "ouest_africaine",
  "francaise",
  "libanaise",
  "asiatique",
  "italienne",
  "burger_pizza",
  "grillades",
  "fusion",
  "cafe",
  "patisserie",
] as const;

const VRAI = new Set(["1", "true", "vrai", "oui", "o", "yes", "y", "x"]);
const FAUX = new Set(["0", "false", "faux", "non", "n", "no", ""]);

/**
 * Téléphone ivoirien vers E.164. Accepte « 07 07 70 10 10 », « +225... »,
 * « 0022507... ». Renvoie null si on ne sait pas conclure — mieux vaut un
 * champ vide qu'un numéro inventé sur lequel un Spawter appellera.
 */
export function normaliserTelephone(brut: unknown): string | null {
  const s = String(brut ?? "").replace(/[^\d+]/g, "");
  if (s.length === 0) return null;
  const chiffres = s.replace(/^\+?(00)?225/, "").replace(/^\+/, "");
  if (!/^\d{8,10}$/.test(chiffres)) return null;
  return `+225${chiffres}`;
}

function nombre(brut: unknown): number | null {
  if (brut === null || brut === undefined || brut === "") return null;
  // Les tableurs francophones écrivent « 5,3689 » et « 12 500 ».
  const s = String(brut).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Analyse les lignes brutes d'un tableur (tableau d'objets en-tête → valeur).
 * Ne jette jamais : toute anomalie ressort dans `erreurs`, ligne par ligne.
 */
export function analyser(lignesBrutes: Record<string, unknown>[]): ResultatAnalyse {
  const valides: LieuImporte[] = [];
  const erreurs: LigneEnErreur[] = [];
  const colonnesIgnorees = new Set<string>();
  const nomsVus = new Map<string, number>();

  lignesBrutes.forEach((brute, index) => {
    const ligne = index + 2; // +1 pour l'en-tête, +1 pour partir de 1
    const c: Partial<Record<(typeof COLONNES)[number], unknown>> = {};
    for (const [k, v] of Object.entries(brute)) {
      const cible = ALIAS[normaliserEntete(k)];
      if (cible) c[cible] = v;
      else if (String(v ?? "").trim() !== "") colonnesIgnorees.add(k);
    }

    const e: string[] = [];
    const nom = String(c.nom ?? "").trim();
    if (nom.length === 0) e.push("le nom est vide");

    // Doublon DANS le fichier — le doublon vis-à-vis de la base est détecté
    // au moment de l'insertion (contrainte UNIQUE nom+quartier, 0023).
    const cle = `${nom.toLowerCase()}|${String(c.quartier ?? "").trim().toLowerCase()}`;
    if (nom && nomsVus.has(cle)) {
      e.push(`doublon de la ligne ${nomsVus.get(cle)} (même nom et même quartier)`);
    } else if (nom) {
      nomsVus.set(cle, ligne);
    }

    const cuisines = String(c.cuisine ?? "")
      .split(/[,;|]/)
      .map((x) => normaliserEntete(x))
      .filter((x) => x.length > 0)
      .map((x) => (CUISINES as readonly string[]).find((v) => normaliserEntete(v) === x) ?? x);
    if (cuisines.length === 0) e.push("aucune cuisine renseignée");
    const inconnues = cuisines.filter((x) => !(CUISINES as readonly string[]).includes(x));
    if (inconnues.length > 0) {
      e.push(`cuisine inconnue : ${inconnues.join(", ")} (attendu : ${CUISINES.join(", ")})`);
    }

    const lat = nombre(c.lat);
    const lng = nombre(c.lng);
    // Bornes volontairement larges (toute la Côte d'Ivoire et au-delà) : les
    // bornes serrées d'Abidjan de la Edge Function `seed-inventory` rejetaient
    // Assinie, pourtant dans la cible. On refuse l'absurde, pas l'excentré.
    if (lat === null) e.push("latitude absente ou illisible");
    else if (lat < -90 || lat > 90) e.push(`latitude hors bornes : ${lat}`);
    if (lng === null) e.push("longitude absente ou illisible");
    else if (lng < -180 || lng > 180) e.push(`longitude hors bornes : ${lng}`);

    const quartier = String(c.quartier ?? "").trim();
    if (quartier.length === 0) e.push("le quartier est vide");

    const gammeN = nombre(c.gamme);
    if (gammeN === null || ![1, 2, 3].includes(gammeN)) {
      e.push("gamme attendue : 1, 2 ou 3");
    }

    const ticket = nombre(c.ticket_moyen);
    if (c.ticket_moyen !== undefined && String(c.ticket_moyen).trim() !== "" && ticket === null) {
      e.push("ticket moyen illisible");
    }

    const publieBrut = normaliserEntete(String(c.publie ?? ""));
    let publie = false;
    if (VRAI.has(publieBrut)) publie = true;
    else if (FAUX.has(publieBrut)) publie = false;
    else e.push(`colonne « publie » incomprise : ${String(c.publie)} (oui/non)`);

    if (e.length > 0) {
      erreurs.push({ ligne, nom: nom || "(sans nom)", erreurs: e });
      return;
    }

    valides.push({
      name: nom,
      cuisine: cuisines,
      lat: lat as number,
      lng: lng as number,
      descriptive_address: String(c.adresse ?? "").trim() || quartier,
      neighborhood: quartier,
      city: String(c.ville ?? "").trim() || "Abidjan",
      price_tier: gammeN as 1 | 2 | 3,
      avg_ticket_xof: ticket,
      phone: normaliserTelephone(c.telephone),
      whatsapp: normaliserTelephone(c.whatsapp),
      is_published: publie,
    });
  });

  return { valides, erreurs, colonnesIgnorees: [...colonnesIgnorees] };
}

/** Gabarit CSV téléchargeable — sert aussi de documentation du format. */
export function gabaritCsv(): string {
  const exemple = [
    "Kaiten",
    "asiatique",
    "5.2962",
    "-3.9948",
    "Rue du Docteur Blanchard",
    "Zone 4",
    "Abidjan",
    "3",
    "16750",
    "27 21 25 44 61",
    "07 08 31 70 60",
    "oui",
  ];
  const exemple2 = [
    "La Grande République",
    "ivoirienne",
    "5.3731",
    "-3.9558",
    "O'porco & O'sogo",
    "Riviera Bonoumin",
    "Abidjan",
    "1",
    "9000",
    "",
    "",
    "oui",
  ];
  const echapper = (v: string) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [COLONNES.join(","), exemple.map(echapper).join(","), exemple2.map(echapper).join(",")].join(
    "\n",
  );
}
