// Chantier 13 archétypes — carte d'identité d'archétype (PRD final §5.5).
// Utilisée par la révélation post-calibration (palais-reveal) ET le profil.
//
// DÉCISION R8 (note MAJ 07/2026) : le radar du Palais reste INTERNE — la
// révélation de l'identité passe par cette carte VISUELLE (visuel + nom +
// code SPWT + rareté), pas par un graphe.
//
// Visuel : webp embarqué (data/archetype-assets). Si l'image échoue au
// chargement (asset corrompu, mémoire), fallback typographique élégant —
// 100 % tokens du thème, aucun hex en dur (règle non négociable).

import { useState } from "react";
import { Image, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { gradient } from "../../theme/tokens";
import { ARCHETYPES } from "../../data/archetypes";
import { ARCHETYPE_ASSETS } from "../../data/archetype-assets";
import type { ArchetypeKey } from "../../lib/archetype-engine";

interface Props {
  archetypeKey: ArchetypeKey;
  /** Badge « Pionnier n°X » (héritage quiz « La Meute ») — null/undefined = pas de badge. */
  pionnierSeq?: number | null;
}

/**
 * Part de la HAUTEUR d'écran que le visuel peut occuper.
 *
 * Le visuel était un carré en pleine largeur (`aspectRatio: 1`). Sur un
 * téléphone étroit et haut, ce carré fait déjà la largeur de l'écran : la carte
 * dépassait, et le bloc d'identité — code SPWT, nom, épithète, devise — se
 * retrouvait hors champ. Autrement dit, la carte d'IDENTITÉ n'affichait plus
 * l'identité, seulement l'image.
 *
 * Un ratio fixe ne peut pas marcher : il ne connaît qu'une dimension. On borne
 * donc par les deux — jamais plus large que le conteneur, jamais plus haut
 * qu'un tiers de l'écran. Le texte tient alors dans tous les cas, et la
 * proportion reste correcte en rotation comme sur tablette.
 */
const PART_HAUTEUR_VISUEL = 0.32;
/** Plancher : en dessous, le visuel ne raconte plus rien. */
const HAUTEUR_VISUEL_MIN = 140;

export function ArchetypeCard({ archetypeKey, pionnierSeq }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  // Réactif : suit la rotation et le redimensionnement, contrairement à
  // `Dimensions.get()` lu une fois au montage.
  const { width, height } = useWindowDimensions();
  const hauteurVisuel = Math.max(
    HAUTEUR_VISUEL_MIN,
    Math.min(width, height * PART_HAUTEUR_VISUEL),
  );

  const descriptor = ARCHETYPES[archetypeKey];
  const name = t(descriptor.nameKey);

  return (
    <View
      accessibilityLabel={t("profile.archetype_card_aria", { name })}
      style={{
        borderRadius: theme.radius.card,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.colors.brand.primary,
      }}
    >
      <LinearGradient colors={gradient.night} style={{ paddingBottom: theme.spacing.lg }}>
        {/* Visuel de l'archétype — cover carré ; fallback typographique si KO. */}
        {imageFailed ? (
          <View
            style={{
              height: hauteurVisuel,
              alignItems: "center",
              justifyContent: "center",
              padding: theme.spacing.xl,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.display,
                color: theme.colors.brand.primary,
                textAlign: "center",
              }}
            >
              {name}
            </Text>
          </View>
        ) : (
          <Image
            source={ARCHETYPE_ASSETS[archetypeKey]}
            resizeMode="cover"
            accessible={false}
            onError={() => setImageFailed(true)}
            style={{ width: "100%", height: hauteurVisuel }}
            testID={`archetype-visual-${archetypeKey}`}
          />
        )}

        {/* Badge Pionnier (héritage quiz) — pastille or, texte noir (onBrand). */}
        {typeof pionnierSeq === "number" && pionnierSeq > 0 ? (
          <View
            style={{
              position: "absolute",
              top: theme.spacing.sm,
              right: theme.spacing.sm,
              backgroundColor: theme.colors.brand.primary,
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.caption,
                color: theme.colors.text.onBrand,
              }}
            >
              {t("profile.pionnier_badge", { n: pionnierSeq })}
            </Text>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.base }}>
          {/* Code SPWT (donnée produit, non traduite) + rareté (i18n). */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.text.inverseSecondary,
              }}
            >
              {descriptor.code}
            </Text>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.brand.primary,
              }}
            >
              {t(`archetype.rarity.${descriptor.rarity}`)}
            </Text>
          </View>

          <Text
            // Deux lignes au plus : un nom long ne doit pas repousser l'épithète
            // et la devise hors de la carte — c'est ce qu'on vient de réparer.
            numberOfLines={2}
            adjustsFontSizeToFit
            style={{
              ...theme.typography.preset.h1,
              color: theme.colors.text.inverse,
              marginTop: theme.spacing.sm,
            }}
          >
            {name}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.brand.primary,
              marginTop: theme.spacing.xs,
            }}
          >
            {t(descriptor.epithetKey)}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.inverseSecondary,
              fontStyle: "italic",
              marginTop: theme.spacing.sm,
            }}
          >
            {t(descriptor.mottoKey)}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}
