// Radar à 5 axes BIPOLAIRE — composite domain qui mappe les 5 dimensions de
// goût (valeurs ∈ [-1, 1] + neg/pos labels) vers la primitive canonique
// PalaisRadar (valeurs ∈ [0, 1] + label dominant).
//
// Mapping :
//   values[i]  = Math.abs(axis.value)         // |value| = distance vertex/centre
//   labels[i]  = value >= 0 ? posLabel : negLabel  // pôle dominant
//
// Cela corrige un drift visuel de l'ancien rendu : il faisait un lerp
// ((value + 1) / 2) * radius, ce qui montrait un vertex près du centre pour
// value = -0.8 (strongly negative) tout en affichant negLabel — contradictoire.
// Le nouveau mapping est cohérent : |value| = distance, label = pôle.

import { PalaisRadar } from "./primitives/PalaisRadar";

interface AxisData {
  /** Score normalisé [-1, 1] */
  value: number;
  /** Label pôle négatif (à gauche) */
  negLabel: string;
  /** Label pôle positif (à droite) */
  posLabel: string;
}

interface Props {
  axes: [AxisData, AxisData, AxisData, AxisData, AxisData];
  size?: number;
  /** Couleur du polygone rempli */
  color?: string;
  /** Si true, affiche un radar "en construction" (PRD §8.2 — confidence < 0.3) */
  underConstruction?: boolean;
  /** Label affiché au centre quand underConstruction (i18n côté caller) */
  underConstructionLabel?: string;
}

export function AxisRadar({
  axes,
  size = 240,
  color,
  underConstruction = false,
  underConstructionLabel,
}: Props) {
  // Garde-fou : `axis.value` peut arriver NaN (calcul amont sur 0 avis).
  // `Math.abs(NaN) = NaN` se propage à `PalaisRadar.values` puis aux points
  // SVG (`"NaN,NaN ..."`) qui crashent le driver Android. PalaisRadar clampe
  // aussi côté primitive — double garde, intentionnelle.
  const safe = (v: number): number => (Number.isFinite(v) ? Math.abs(v) : 0);
  const values: readonly [number, number, number, number, number] = [
    safe(axes[0].value),
    safe(axes[1].value),
    safe(axes[2].value),
    safe(axes[3].value),
    safe(axes[4].value),
  ];
  const labels: readonly [string, string, string, string, string] = [
    axes[0].value >= 0 ? axes[0].posLabel : axes[0].negLabel,
    axes[1].value >= 0 ? axes[1].posLabel : axes[1].negLabel,
    axes[2].value >= 0 ? axes[2].posLabel : axes[2].negLabel,
    axes[3].value >= 0 ? axes[3].posLabel : axes[3].negLabel,
    axes[4].value >= 0 ? axes[4].posLabel : axes[4].negLabel,
  ];

  // exactOptionalPropertyTypes : omettre les optional props undefined plutôt
  // que de les passer explicitement undefined.
  return (
    <PalaisRadar
      values={values}
      labels={labels}
      size={size}
      underConstruction={underConstruction}
      {...(color !== undefined ? { fill: color } : {})}
      {...(underConstructionLabel !== undefined ? { underConstructionLabel } : {})}
    />
  );
}
