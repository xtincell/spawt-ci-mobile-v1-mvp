// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPAWT — Theme tokens (SOURCE UNIQUE)
// PRD §15.1 (palette canonique) + §15.2 (système étendu)
// Aucune couleur ne doit jamais apparaître en dur ailleurs.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Palette canonique (PRD §15.1) ─────────────────────
export const palette = {
  black: "#0A0A0A",
  goldSpawt: "#D4AF37",
  greenChat: "#50C878",
  cream: "#F8F6F0",
} as const;

// ── Palette étendue (nuances WCAG-compliant héritées du prototype) ──
// Ces nuances sont des dérivés calibrés AA. Toute nouvelle nuance
// passe par revue Alexandre (brand) + Stéphanie (contraste).
export const tone = {
  encre: {
    100: "#0A0A0A", // canon — base
    90: "#161616",
    80: "#222222",
    70: "#2E2E2E",
    60: "#3A3A3A",
    50: "#525252",
    40: "#7A7A7A",
    30: "#9C9C9C",
  },
  cream: {
    100: "#F8F6F0", // canon — fond clair
    90: "#F2EFE6",
    80: "#EAE5D7",
    70: "#DCD5C2",
  },
  gold: {
    100: "#D4AF37", // canon — primary brand
    90: "#C49E2A",
    80: "#B48E1F",
    soft: "#E5C75D",
  },
  green: {
    100: "#50C878", // canon — CTA
    90: "#3FB967",
    80: "#2FA557",
  },
} as const;

// ── Tokens sémantiques (par usage, pas par couleur) ───
// Toujours référencer ces tokens dans le code, jamais
// les couleurs brutes ci-dessus.
export const tokens = {
  brand: {
    primary: palette.goldSpawt, // Or SPAWT
    accent: palette.greenChat, // Vert Chat — CTAs
  },
  surface: {
    base: palette.cream, // fond principal clair
    inverse: palette.black, // fond sombre / luxe
    raised: tone.cream[90],
    subtle: tone.cream[80],
  },
  text: {
    primary: palette.black,
    secondary: tone.encre[60],
    tertiary: tone.encre[50],
    inverse: palette.cream,
    inverseSecondary: tone.cream[80],
    onBrand: palette.black,
  },
  border: {
    subtle: tone.cream[70],
    strong: tone.encre[80],
  },
  state: {
    success: palette.greenChat,
    danger: "#D4603A", // paprika — pour erreurs uniquement
    warning: tone.gold[80],
  },
  // Voix du Chat — surface par stade (PRD §9.3)
  chat: {
    touriste: tone.gold.soft,
    explorateur: tone.gold[100],
    detective: tone.gold[80],
    djidji: palette.greenChat,
    guide: palette.cream,
  },
} as const;

// ── Typographie ────────────────────────────────────────
export const typography = {
  family: {
    brand: "Nunito", // titres marque
    voice: "DM Serif Text", // voix du Chat
    body: "Manrope", // corps
    mono: "JetBrains Mono", // chiffres / data
  },
  size: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    "2xl": 28,
    "3xl": 36,
    "4xl": 48,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// ── Espacement ─────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// ── Radius ─────────────────────────────────────────────
export const radius = {
  sm: 4,
  md: 8,
  base: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ── Ombres / élévations ───────────────────────────────
export const elevation = {
  none: { shadowColor: "transparent", shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: palette.black,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: palette.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  lg: {
    shadowColor: palette.black,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

export type Tokens = typeof tokens;
export type Typography = typeof typography;
