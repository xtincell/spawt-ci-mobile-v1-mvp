// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPAWT — FLAIR DESIGN SYSTEM v3.2
// "Écaille de Tortue" — Accessible Edition
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WCAG AA compliant: 4.5:1 body text, 3:1 large text/UI

// ── Raw Palette ──────────────────────────────────────
export const C = {
  creme:   { 100:"#FFFDF7", 90:"#FBF8F0", 80:"#F5F0E4", 70:"#EDE6D4", 60:"#E2D9C4" },
  encre:   { 100:"#1A1610", 90:"#221E17", 80:"#2C2720", 70:"#3A342B", 60:"#4A4238", 50:"#6B6155", 40:"#978D80", 30:"#ADA395" },
  or:      { 100:"#C8A44E", 90:"#D4B366", 80:"#E0C27E", warm:"#B8923C", deep:"#8A7135", ui:"#A88941" },
  regard:  { 100:"#2D7A50", 80:"#5BA878" },
  paprika: { 100:"#D4603A", deep:"#B45131" },
  auberg:  { 100:"#7B4FA0", light:"#9875B4" },
};

// ── Semantic Tokens: Sur Crème ───────────────────────
export const onCreme = {
  primary:   C.encre[100],   // 17.70:1 AAA
  secondary: C.encre[60],    //  9.70:1 AAA
  tertiary:  C.encre[50],    //  5.96:1 AA
  or:        C.or.deep,      //  4.59:1 AA — NEVER raw or.100
  orUI:      C.or.ui,        //  3.27:1 — UI elements only
  vert:      C.regard[100],  //  5.15:1 AA
  paprika:   C.paprika.deep, //  4.96:1 AA
  auberg:    C.auberg[100],  //  5.95:1 AA
};

// ── Semantic Tokens: Sur Encre ───────────────────────
export const onEncre = {
  primary:   C.creme[100],   // 17.70:1 AAA
  secondary: C.encre[30],    //  7.25:1 AAA
  tertiary:  C.encre[40],    //  5.52:1 AA
  or:        C.or[100],      //  7.61:1 AAA
  orSoft:    C.or[80],       // 10.45:1 AAA
  vert:      C.regard[80],   //  6.27:1 AA
  paprika:   C.paprika[100], //  4.75:1 AA
  auberg:    C.auberg.light, //  4.75:1 AA
};

// ── Font Stacks ──────────────────────────────────────
export const fonts = {
  brand: "'Nunito', sans-serif",
  voice: "'DM Serif Text', serif",
  body:  "'Manrope', sans-serif",
  data:  "'JetBrains Mono', monospace",
};

// ── Backwards-Compatible Flat Aliases ────────────────
// Allows `import { COLORS as C } from '../theme'`
// with same property names as existing component code.
export const COLORS = {
  black:     C.encre[100],
  white:     C.creme[100],
  gold:      C.or[100],
  goldGlow:  "rgba(200,164,78,0.15)",
  green:     C.regard[100],
  greenGlow: "rgba(45,122,80,0.12)",
  grey50:    C.creme[90],
  grey100:   C.creme[80],
  grey200:   C.creme[70],
  grey300:   C.encre[30],
  grey400:   C.encre[40],
  grey500:   C.encre[50],
  grey600:   C.encre[70],
  warmBlack: C.encre[90],
};
