// Story 3.3c — ModeStories : radiogroup horizontal de chips circulaires
// « Je sors pour… » (UX spec §1294).
// R6 (MAJ consolidée 07/2026) — 4 modes affichés, libellés définitifs :
// Manger · Découvrir · En groupe · En duo (icônes fork/compass/users/heart).
// `vite` reste dans ModeKey (filtre conservé) mais n'est plus proposé en chip.
//
// Sprint 2 — hub des modes plein écran : la prop additive `entries` expose
// les entrées de navigation (Rapide, Explore — le Crew, chantier parallèle,
// s'ajoutera par le même canal) AVANT les chips d'humeur. `entries` vide ou
// absent → rendu strictement identique à l'existant (critère de
// non-régression : flags off = rien ne change visuellement).

import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico, type IconName } from "./primitives/Ico";

export type ModeKey = "traine" | "decouvre" | "tribu" | "chic" | "vite";

interface ModeSpec {
  key: ModeKey;
  icon: IconName;
}

const MODES: readonly ModeSpec[] = [
  { key: "traine", icon: "fork" },
  { key: "decouvre", icon: "compass" },
  { key: "tribu", icon: "users" },
  { key: "chic", icon: "heart" },
];

/** Entrée de navigation vers un mode plein écran (Rapide, Explore, Crew…). */
export interface ModeEntry {
  key: string;
  icon: IconName;
  /** Clé i18n du label (ex. `modes.entry_rapide.label`). */
  labelKey: string;
  onPress: () => void;
}

interface Props {
  selectedMode: ModeKey | null;
  onModePress: (mode: ModeKey | null) => void;
  /** Entrées de modes plein écran, gated par flags côté caller. Défaut : aucune. */
  entries?: readonly ModeEntry[];
}

export function ModeStories({ selectedMode, onModePress, entries = [] }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup">
      <Text
        style={{
          ...theme.typography.preset.overline,
          color: theme.colors.text.tertiary,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("home.modes_title")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.base,
        }}
      >
        {entries.map((entry) => {
          const label = t(entry.labelKey);
          return (
            <Pressable
              key={entry.key}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ alignItems: "center", minWidth: 60 }}
            >
              {/* Cercle liseré Or : distingue une NAVIGATION (mode plein
                  écran) d'un FILTRE d'humeur (chips ci-dessous). */}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.surface.subtle,
                  borderWidth: 1.5,
                  borderColor: theme.colors.brand.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ico name={entry.icon} size={22} color={theme.colors.brand.primary} />
              </View>
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: theme.colors.text.tertiary,
                  marginTop: 4,
                  textAlign: "center",
                  maxWidth: 96,
                }}
                numberOfLines={2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
        {MODES.map((m) => {
          const isSelected = selectedMode === m.key;
          const label = t(`modes.${m.key}.label`);
          return (
            <Pressable
              key={m.key}
              onPress={() => onModePress(isSelected ? null : m.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={label}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ alignItems: "center", minWidth: 60 }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.colors.surface.subtle,
                  borderWidth: isSelected ? 2.5 : 0,
                  borderColor: theme.colors.surface.inverse,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ico
                  name={m.icon}
                  size={22}
                  color={
                    isSelected
                      ? theme.colors.text.primary
                      : theme.colors.text.secondary
                  }
                />
              </View>
              <Text
                style={{
                  ...theme.typography.preset.overline,
                  color: isSelected
                    ? theme.colors.text.primary
                    : theme.colors.text.tertiary,
                  marginTop: 4,
                  textAlign: "center",
                  maxWidth: 96,
                }}
                numberOfLines={2}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
