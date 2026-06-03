// Story 7.1 — AC #3 : surface in-app du build courant.
//
// Affiche « v1.0.0 — build N (YYYY-MM-DD) » pour que les testeurs citent le
// build exact dans un bug report. Tappable → partage/copie via Share (pas de
// dépendance expo-clipboard ajoutée — Share couvre la copie, cf. Story 3.7).
//
// Sources runtime :
//   - version    : Application.nativeApplicationVersion (fallback "1.0.0")
//   - buildNumber: Application.nativeBuildVersion (versionCode/buildNumber natif)
//   - buildDate  : Constants.expoConfig.extra.buildDate (injecté CI Story 7.1
//                  AC #2) ou EXPO_PUBLIC_BUILD_DATE.
// Valeurs absentes (dev / Expo Go) → fallback « — » plutôt que crash.

import { Pressable, Share, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import * as Application from "expo-application";

import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  /** Injections pour tests — sinon dérivées de expo-application / Constants. */
  version?: string | null;
  buildNumber?: string | null;
  buildDate?: string | null;
  /** Hook test : appelé après le partage (sinon Share natif). */
  onCopied?: () => void;
}

/** Premier candidat non-vide ; sinon le fallback fourni. */
function pick(fallback: string, ...vals: (string | null | undefined)[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.length > 0) return v;
  }
  return fallback;
}

export function BuildBadge({ version, buildNumber, buildDate, onCopied }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const extraDate = Constants.expoConfig?.extra?.buildDate as string | undefined;
  const v = pick("1.0.0", version, Application.nativeApplicationVersion);
  const n = pick("—", buildNumber, Application.nativeBuildVersion);
  const d = pick("—", buildDate, extraDate, process.env.EXPO_PUBLIC_BUILD_DATE);

  const label = t("profile.build_format", { version: v, n, date: d });

  const onCopy = () => {
    void Share.share({ message: label })
      .then(() => onCopied?.())
      .catch((err: unknown) => {
        if (__DEV__) console.warn("[BuildBadge] share failed", err);
      });
  };

  return (
    <Pressable
      onPress={onCopy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t("profile.build_copied")}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          ...theme.typography.preset.overline,
          color: theme.colors.text.tertiary,
        }}
      >
        {t("profile.about_title")}
      </Text>
      <Text
        style={{
          ...theme.typography.preset.small,
          color: theme.colors.text.secondary,
          marginTop: 2,
        }}
        selectable
      >
        {label}
      </Text>
    </Pressable>
  );
}
