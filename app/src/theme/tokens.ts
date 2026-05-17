// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPAWT — Theme tokens (SOURCE UNIQUE côté code)
// Canonique : documentation/ux/spawt-tokens.css (brandbook v1.0).
// Réaligné le 2026-05-14 — voir _bmad-output/planning-artifacts/
//   ux-design-specification.md § « Canonical Sources & Reconciliation ».
// Polices Klinsman + Gotham chargées via expo-font (cf. ./useAppFonts.ts) —
// référencées par leur nom PostScript EMBARQUÉ (Klinsman embarque
// `KlinsmanTypeface{Light,Regular,Bold}`, Gotham embarque `Gotham-{Book,Medium,Bold}`).
// Aucune couleur ne doit jamais apparaître en dur ailleurs.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { TextStyle } from "react-native";

// ── Palette canonique (spawt-tokens.css) ──────────────
export const palette = {
  // Primary
  black: "#0A0A0A",
  gold: "#C8A44E",
  goldLight: "#E8D5A0",
  // Secondary
  greenChat: "#2D6B4F",
  greenChatDeep: "#1F4D39",
  blancCasse: "#FAFAF8",
  // Accents
  amberWarm: "#E89A39",
  cremeSable: "#EFE8DC",
  // Neutrals
  pureWhite: "#FFFFFF",
  graphite: "#333333",
  grisMoyen: "#8A8A8A",
} as const;

// ── Lignes / bordures (rgba canoniques) ───────────────
const line = "rgba(10, 10, 10, 0.10)"; // --line
const lineStrong = "rgba(10, 10, 10, 0.18)"; // --line-strong

// ── Tokens sémantiques (par usage, pas par couleur) ───
// Toujours référencer ces tokens dans le code, jamais
// les couleurs brutes de `palette` ci-dessus.
export const tokens = {
  brand: {
    primary: palette.gold, // Or SPAWT #C8A44E
    accent: palette.greenChat, // Vert Chat #2D6B4F — CTAs / success
  },
  surface: {
    base: palette.blancCasse, // --bg : fond principal de l'app
    inverse: palette.black, // moments gr-night (luxe / identité)
    raised: palette.pureWhite, // --bg-card : cartes, surfaces élevées
    subtle: palette.cremeSable, // --bg-warm : encarts, cartes douces
  },
  text: {
    primary: palette.black, // --ink
    secondary: palette.graphite, // --ink-soft
    tertiary: palette.grisMoyen, // --ink-mute
    inverse: palette.blancCasse, // texte sur fond sombre
    inverseSecondary: palette.goldLight, // texte secondaire sur gr-night
    onBrand: palette.black, // texte sur brand.primary (Or) UNIQUEMENT — sur brand.accent (Vert Chat) utiliser text.inverse (AA ≈6,3:1)
  },
  border: {
    subtle: line, // --line
    strong: lineStrong, // --line-strong
  },
  state: {
    success: palette.greenChat,
    // alert-red — absent du brandbook v1.0 ; les mid-fi screens y réfèrent
    // (états erreur, badge trending). Valeur tranchée Alexandre 2026-05-15 :
    // rouge chaud distinct de --amber-warm, contraste AA ≈5.2:1 sur --bg.
    danger: "#C0392B",
    warning: palette.amberWarm, // --amber-warm
  },
  // Voix du Chat — surface par stade (PRD §9.3).
  // NB : le kit canonique rend la CatBubble en noir uniforme ; cette
  // gradation par stade est un raffinement côté code, à confirmer en revue.
  chat: {
    touriste: palette.goldLight,
    explorateur: palette.gold,
    detective: palette.greenChat,
    djidji: palette.greenChatDeep,
    guide: palette.black,
  },
} as const;

// ── Gradients signature (spawt-tokens.css) ────────────
// À consommer via `expo-linear-gradient` (installé Story 2.2 — `~55.0.14`).
export const gradient = {
  night: ["#0A0A0A", "#1A1A2E"] as const, // --gr-night (180deg)
  gold: ["#C8A44E", "#E8D5A0", "#C8A44E"] as const, // --gr-gold (135deg)
  sand: ["#EFE8DC", "#FAFAF8"] as const, // --gr-sand (135deg)
} as const;

// ── Typographie ────────────────────────────────────────
// Canonique : Klinsman (display + voix du Chat) + Gotham (corps + data).
// Polices physiques : ./fonts/, chargées via ./useAppFonts.ts.
// `family.*` et `preset.*.fontFamily` = nom PostScript EMBARQUÉ dans le fichier
// (Klinsman embarque `KlinsmanTypeface{Light,Regular,Bold}`, Gotham embarque
// `Gotham-{Book,Medium,Bold}` — vérifié via lecture de la table `name` OpenType).
// iOS résout fontFamily par ce nom-là ; aligner les clés sur le PS name
// court-circuite la couche d'alias expo-font et garantit la résolution iOS.
// `preset.*` = échelle typo sémantique de spawt-tokens.css § Typography
// (valeurs lineHeight et letterSpacing pré-calculées em → px).
// `satisfies` (TS 4.9+) valide la shape contre TextStyle sans widen vers TextStyle :
// la narrowing contextuelle de TS résout `fontVariant: ["tabular-nums"]` en
// `FontVariant[]` et préserve les types littéraux pour les consumers downstream.
type PresetKey =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "small"
  | "caption"
  | "data"
  | "overline";

const _preset = {
  display: { fontFamily: "KlinsmanTypefaceBold", fontSize: 34, lineHeight: 35.7, letterSpacing: -0.34 },
  h1: { fontFamily: "KlinsmanTypefaceBold", fontSize: 26, lineHeight: 28.6 },
  h2: { fontFamily: "KlinsmanTypefaceBold", fontSize: 20, lineHeight: 23 },
  h3: {
    fontFamily: "KlinsmanTypefaceBold",
    fontSize: 16,
    lineHeight: 19.2,
    letterSpacing: 0.32,
    textTransform: "uppercase",
  },
  body: { fontFamily: "Gotham-Book", fontSize: 14, lineHeight: 21 },
  small: { fontFamily: "Gotham-Book", fontSize: 12, lineHeight: 16.8 },
  caption: {
    fontFamily: "Gotham-Medium",
    fontSize: 11,
    lineHeight: 15.4,
    letterSpacing: 0.44,
    textTransform: "uppercase",
  },
  data: {
    fontFamily: "Gotham-Medium",
    fontSize: 12,
    lineHeight: 16.8,
    letterSpacing: 0.24,
    fontVariant: ["tabular-nums"],
  },
  overline: {
    fontFamily: "Gotham-Bold",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
} satisfies Record<PresetKey, TextStyle>;

export const typography = {
  family: {
    // Noms PostScript chargés par useAppFonts — iOS ne synthétise pas la graisse.
    brand: "KlinsmanTypefaceBold", // titres, noms de lieux, voix du Chat, wordmark, chiffres héro
    body: "Gotham-Book", // corps, labels, UI
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
    // Gotham : Book 400 / Medium 500 / Bold 700. `semibold` mappé 600
    // (RN choisit la graisse la plus proche disponible).
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
  preset: _preset,
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

// ── Radius (spawt-tokens.css : r-s/r-m/r-l/r-card) ────
export const radius = {
  sm: 4, // --r-s
  md: 8, // --r-m
  base: 12,
  lg: 16, // --r-l
  card: 20, // --r-card : cartes principales (Une, fiche, carte spawter)
  xl: 24,
  full: 9999,
} as const;

// ── Ombres / élévations (spawt-tokens.css) ────────────
export const elevation = {
  none: { shadowColor: "transparent", shadowOpacity: 0, elevation: 0 },
  sm: {
    shadowColor: palette.black,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  }, // --sh-s
  md: {
    shadowColor: palette.black,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  }, // --sh-m
  lg: {
    shadowColor: palette.black,
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  }, // --sh-l
  glow: {
    shadowColor: palette.gold,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  }, // --sh-glow : halo or sur les CTA dorés
} as const;

export type Tokens = typeof tokens;
export type Typography = typeof typography;
export type TypographyPreset = typeof typography.preset;
export type Gradient = typeof gradient;
