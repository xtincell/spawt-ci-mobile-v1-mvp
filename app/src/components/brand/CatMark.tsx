// CatMark — la mascotte Moka en PNG (design system canonique, MAJ 07/2026).
// Porte le motif « CatMark / CatBubble » du DS : le chat vectoriel (ex-CatIcon)
// est DÉPRÉCIÉ — règle stricte : plus aucun chat vectoriel, PNG uniquement.
// Poses sources : spawt-design-system CANON (+ 3 poses EXECUTION MOBILE),
// stagées dans app/assets/mascots/. Une pose par scénario.
//
// - <CatMark pose size />       : la pose pleine, sans cadre (héros, empty states).
// - <CatMarkBadge pose size />  : la pose cadrée dans un cercle or (avatar de
//   bulle — scaling 118 %, léger offset, fidèle au CatBubble.jsx du DS).

import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

export type MokaPose =
  | "ambiance"
  | "bof"
  | "carte"
  | "celebration"
  | "cherche"
  | "confiance"
  | "coupdecoeur"
  | "createur"
  | "curieux"
  | "decouvre"
  | "dodo"
  | "erreur"
  | "explore"
  | "gold"
  | "menu"
  | "merci"
  | "meteo"
  | "notification"
  | "offre"
  | "partage"
  | "promo"
  | "recommande"
  | "regale"
  | "reservation"
  | "salut"
  | "vadrouille";

// Maps statiques : le bundler Metro exige des require() littéraux.
const POSES: Record<MokaPose, number> = {
  ambiance: require("../../../assets/mascots/moka-ambiance.png"),
  bof: require("../../../assets/mascots/moka-bof.png"),
  carte: require("../../../assets/mascots/moka-carte.png"),
  celebration: require("../../../assets/mascots/moka-celebration.png"),
  cherche: require("../../../assets/mascots/moka-cherche.png"),
  confiance: require("../../../assets/mascots/moka-confiance.png"),
  coupdecoeur: require("../../../assets/mascots/moka-coupdecoeur.png"),
  createur: require("../../../assets/mascots/moka-createur.png"),
  curieux: require("../../../assets/mascots/moka-curieux.png"),
  decouvre: require("../../../assets/mascots/moka-decouvre.png"),
  dodo: require("../../../assets/mascots/moka-dodo.png"),
  erreur: require("../../../assets/mascots/moka-erreur.png"),
  explore: require("../../../assets/mascots/moka-explore.png"),
  gold: require("../../../assets/mascots/moka-gold.png"),
  menu: require("../../../assets/mascots/moka-menu.png"),
  merci: require("../../../assets/mascots/moka-merci.png"),
  meteo: require("../../../assets/mascots/moka-meteo.png"),
  notification: require("../../../assets/mascots/moka-notification.png"),
  offre: require("../../../assets/mascots/moka-offre.png"),
  partage: require("../../../assets/mascots/moka-partage.png"),
  promo: require("../../../assets/mascots/moka-promo.png"),
  recommande: require("../../../assets/mascots/moka-recommande.png"),
  regale: require("../../../assets/mascots/moka-regale.png"),
  reservation: require("../../../assets/mascots/moka-reservation.png"),
  salut: require("../../../assets/mascots/moka-salut.png"),
  vadrouille: require("../../../assets/mascots/moka-vadrouille.png"),
};

interface CatMarkProps {
  pose?: MokaPose;
  /** Côté du carré rendu, en px. */
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** La pose Moka pleine, proportions préservées. Décorative par défaut. */
export function CatMark({ pose = "salut", size = 24, style, testID }: CatMarkProps) {
  return (
    <Image
      source={POSES[pose]}
      style={[{ width: size, height: size }, style as never]}
      resizeMode="contain"
      accessible={false}
      importantForAccessibility="no"
      testID={testID ?? `catmark-${pose}`}
    />
  );
}

// R24 (build 8) — ratio de la pose DANS le cercle : fit CONTAIN + padding.
// L'ancien cadrage (zoom 118 % + resizeMode cover + offsets) débordait ou
// coupait mal selon la pose (chaque PNG cadre Moka différemment). Ici la pose
// entière tient dans le cercle avec une marge respirante, centrée — cadrage
// correct pour TOUTES les poses sans réglage au cas par cas.
const BADGE_INNER_RATIO = 0.84;

/**
 * Avatar « Moka dans un cercle or » — pose entière en fit contain, centrée,
 * avec padding (~8 % par côté). R24 : plus de zoom/offset qui coupait la tête.
 */
export function CatMarkBadge({ pose = "salut", size = 28, style, testID }: CatMarkProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.brand.primary,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID ?? `catmarkbadge-${pose}`}
    >
      <Image
        source={POSES[pose]}
        style={{
          width: size * BADGE_INNER_RATIO,
          height: size * BADGE_INNER_RATIO,
        }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}
