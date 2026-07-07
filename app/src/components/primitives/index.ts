// Barrel re-export pour les primitives canoniques SPAWT.
// Permet `import { Ico, Button, Chip } from "@/components/primitives";`.

export { Ico, type IconName } from "./Ico";
export { Wordmark } from "./Wordmark";
export { Pin } from "./Pin";
// CatIcon (chat vectoriel) retiré — MAJ DS 07/2026 : Moka en PNG uniquement,
// via CatMark/CatMarkBadge (src/components/brand/CatMark.tsx).
export { CatBubble } from "./CatBubble";
export { Stars } from "./Stars";
export { MatchScore } from "./MatchScore";
export { PalaisRadar } from "./PalaisRadar";
export { PatternDots } from "./PatternDots";
export { TabBar } from "./TabBar";
export { Chip, type ChipVariant } from "./Chip";
export { Button, type ButtonVariant } from "./Button";
export { OnbCard } from "./OnbCard";
export { Select, type SelectOption, type SelectProps } from "./Select";
export { BuildBadge } from "./BuildBadge";
