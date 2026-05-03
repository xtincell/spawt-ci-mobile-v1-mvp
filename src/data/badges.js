// ═══════════════════════════════════════════
// SPAWT — Badges B2C
// 3 catégories: Exploration, Expertise, Influence
// ═══════════════════════════════════════════

const BADGES = [
  // Exploration
  { id: "traversee", name: "Traversée", icon: "🗺", category: "exploration", condition: "Spawts dans 5 quartiers différents", minSpawts: 5 },
  { id: "noctambule", name: "Noctambule", icon: "🌙", category: "exploration", condition: "5 spawts après 21h", minSpawts: 5 },
  { id: "levetot", name: "Lève-Tôt", icon: "☀️", category: "exploration", condition: "5 spawts avant 9h", minSpawts: 5 },
  { id: "marathon", name: "Marathon Maquis", icon: "🏃", category: "exploration", condition: "5 maquis différents", minSpawts: 5 },
  { id: "cartographe", name: "Cartographe", icon: "📍", category: "exploration", condition: "Spawts dans 10 quartiers", minSpawts: 10 },

  // Expertise
  { id: "palais-diversifie", name: "Palais Diversifié", icon: "🎯", category: "expertise", condition: "4+ types de cuisine spawtés", minSpawts: 8 },
  { id: "chasseur", name: "Chasseur de Pépites", icon: "💎", category: "expertise", condition: "5 lieux avec peu d'avis", minSpawts: 5 },
  { id: "calibre", name: "Calibré", icon: "🎯", category: "expertise", condition: "Avis précis et fiables", minSpawts: 10 },

  // Influence
  { id: "eclaireur", name: "Éclaireur", icon: "🐾", category: "influence", condition: "Avis aidant d'autres spawters", minSpawts: 3 },
  { id: "meneur", name: "Meneur de Crew", icon: "👥", category: "influence", condition: "Créer un crew actif", minSpawts: 5 },
  { id: "premiere-trace", name: "Première Trace", icon: "👣", category: "influence", condition: "Ton premier spawt!", minSpawts: 1 },
  { id: "cinq-pattes", name: "5 Pattes", icon: "🐾", category: "exploration", condition: "5 spawts réalisés", minSpawts: 5 },
  { id: "dix-pattes", name: "10 Pattes", icon: "🔥", category: "exploration", condition: "10 spawts réalisés", minSpawts: 10 },
  { id: "quinze-pattes", name: "Passage Chat", icon: "🐈", category: "exploration", condition: "15 spawts — passage au stade Chat!", minSpawts: 15 },
];

export default BADGES;

// Check which badges a user has earned
export function checkBadges(user) {
  const earned = [];
  for (const badge of BADGES) {
    if (user.spotsCount >= badge.minSpawts) {
      // Check if not already earned
      if (!user.badges.find(b => b.id === badge.id)) {
        earned.push(badge);
      }
    }
  }
  return earned;
}
