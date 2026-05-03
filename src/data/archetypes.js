// ═══════════════════════════════════════════
// SPAWT — 13 Archétypes + 5 Stades + Noms
// PROFIL (2 axes dominants) × MATURITÉ = NOM
// ═══════════════════════════════════════════

export const STAGES = [
  { id: "chaton", label: "Chaton", min: 0, max: 14, icon: "🐱" },
  { id: "chat", label: "Chat", min: 15, max: 39, icon: "🐈" },
  { id: "matou", label: "Matou", min: 40, max: 79, icon: "🐈‍⬛" },
  { id: "djidji", label: "Djidji", min: 80, max: 149, icon: "✦" },
  { id: "guide", label: "Guide", min: 150, max: Infinity, icon: "◉" },
];

export const ARCHETYPES = [
  {
    id: "pisteur", name: "Pisteur",
    dominant: ["Nomade", "Gargote"],
    spirit: "Le nez au vent, les pieds dans la poussière.",
    stages: ["Petit Pisteur", "Pisteur", "Pisteur de Brousse", "Pisteur Noir", "La Piste"],
    color: "#C8A44E",
  },
  {
    id: "fantome", name: "Fantôme",
    dominant: ["Nomade", "Secret"],
    spirit: "Tu ne le trouves pas. C'est lui qui te trouve un spot.",
    stages: ["Petite Ombre", "Fantôme", "Chat Fantôme", "Spectre", "L'Introuvable"],
    color: "#6B6155",
  },
  {
    id: "bouche-dor", name: "Bouche d'Or",
    dominant: ["Nomade", "Table"],
    spirit: "Le palais n'a pas de frontières mais il a des standards.",
    stages: ["Bec Fin", "Bouche d'Or", "Bouche d'Or Affûtée", "Palais d'Or", "L'Oracle du Goût"],
    color: "#C8A44E",
  },
  {
    id: "gardien", name: "Gardien du Maquis",
    dominant: ["Tanière", "Gargote"],
    spirit: "Pourquoi chercher ailleurs quand tu as trouvé le bon ?",
    stages: ["Habitué", "Gardien du Maquis", "Chat du Comptoir", "Patron d'Ombre", "Le Pilier"],
    color: "#2D7A50",
  },
  {
    id: "memoire", name: "Mémoire",
    dominant: ["Tanière", "Racines"],
    spirit: "Le vrai goût ne se réinvente pas. Il se transmet.",
    stages: ["Nostalgique", "Mémoire", "Mémoire Longue", "Griotte", "La Source"],
    color: "#8A7135",
  },
  {
    id: "braise", name: "Feu de Braise",
    dominant: ["Foule", "Enthousiaste"],
    spirit: "Manger seul c'est se nourrir. Manger ensemble c'est vivre.",
    stages: ["Étincelle", "Feu de Braise", "Brasier", "Foyer", "Le Rassembleur"],
    color: "#D4603A",
  },
  {
    id: "oeil", name: "Œil de Chat",
    dominant: ["Secret", "Exigeant"],
    spirit: "Si c'est moyen, ça n'existe pas.",
    stages: ["Œil Neuf", "Œil de Chat", "Œil Vert", "Regard", "Le Verdict"],
    color: "#2D7A50",
  },
  {
    id: "vent", name: "Vent d'Ailleurs",
    dominant: ["Horizons", "Nomade"],
    spirit: "Chaque assiette est un billet d'avion.",
    stages: ["Brise", "Vent d'Ailleurs", "Chat du Monde", "Courant", "Le Monde"],
    color: "#4A6FA5",
  },
  {
    id: "murmure", name: "Murmure",
    dominant: ["Secret", "Gargote"],
    spirit: "Les meilleurs spots ne sont pas sur Google.",
    stages: ["Chuchoteur", "Murmure", "Chat de Ruelle", "Écho", "Le Secret"],
    color: "#6B6155",
  },
  {
    id: "lame", name: "Lame",
    dominant: ["Table", "Exigeant"],
    spirit: "Le détail sépare le bon du mémorable.",
    stages: ["Tranchant", "Lame", "Lame Fine", "Scalpel", "L'Absolu"],
    color: "#7B4FA0",
  },
  {
    id: "passeport", name: "Passeport Doré",
    dominant: ["Table", "Horizons"],
    spirit: "La grande table n'a pas de nationalité.",
    stages: ["Curieux Doré", "Passeport Doré", "Chat Voyageur", "Ambassadeur", "Le Cosmopolite"],
    color: "#C8A44E",
  },
  {
    id: "ancre", name: "Ancre",
    dominant: ["Tanière", "Table"],
    spirit: "La fidélité est une forme d'expertise.",
    stages: ["Point Fixe", "Ancre", "Chat de Maison", "Institution", "La Permanence"],
    color: "#2D7A50",
  },
  {
    id: "omnivore", name: "Omnivore",
    dominant: ["Équilibré"],
    spirit: "Mange tout. Juge tout. N'appartient à aucune case.",
    stages: ["—", "Omnivore", "Chat Errant", "Caméléon", "L'Inclassable"],
    color: "#3A342B",
    special: true,
  },
];

// Axis labels for matching dominant axes
const AXIS_MAP = {
  racinesHorizons: { neg: "Racines", pos: "Horizons" },
  taniereNomade: { neg: "Tanière", pos: "Nomade" },
  exigeantEnthousiaste: { neg: "Exigeant", pos: "Enthousiaste" },
  fouleSecret: { neg: "Foule", pos: "Secret" },
  gargoteTable: { neg: "Gargote", pos: "Table" },
};

// Get the 2 dominant trait labels from a palais
export function getDominantTraits(palais) {
  const entries = Object.entries(palais).map(([key, val]) => {
    const label = val >= 0 ? AXIS_MAP[key].pos : AXIS_MAP[key].neg;
    return { key, label, absVal: Math.abs(val) };
  });
  entries.sort((a, b) => b.absVal - a.absVal);
  return entries.slice(0, 2).map(e => e.label);
}

// Find archetype from 2 dominant traits
export function findArchetype(palais, spotsCount) {
  const traits = getDominantTraits(palais);

  // Check if profile is flat (omnivore candidate)
  const maxAbs = Math.max(...Object.values(palais).map(Math.abs));
  if (maxAbs < 10 && spotsCount >= 15) {
    return ARCHETYPES.find(a => a.id === "omnivore");
  }

  // Find matching archetype
  for (const arch of ARCHETYPES) {
    if (arch.special) continue;
    const match = arch.dominant.every(d => traits.includes(d));
    if (match) return arch;
  }

  // Fallback: find closest match by first dominant trait
  for (const arch of ARCHETYPES) {
    if (arch.special) continue;
    if (arch.dominant.some(d => traits.includes(d))) return arch;
  }

  return ARCHETYPES[0]; // Default to Pisteur
}

// Get current stage from spawt count
export function getStage(spotsCount) {
  for (const stage of STAGES) {
    if (spotsCount >= stage.min && spotsCount <= stage.max) return stage;
  }
  return STAGES[0];
}

// Get current stage index
export function getStageIndex(spotsCount) {
  return STAGES.findIndex(s => spotsCount >= s.min && spotsCount <= s.max);
}

// Get title for archetype + stage
export function getTitle(archetype, spotsCount) {
  const stageIdx = getStageIndex(spotsCount);
  return archetype.stages[stageIdx] || archetype.stages[0];
}

// Get palais label (top 2-3 dominant traits)
export function getPalaisLabel(palais) {
  const traits = getDominantTraits(palais);
  return traits.join(" · ");
}
