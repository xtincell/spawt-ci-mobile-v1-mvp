// Phase 2 — Coup de Cœur actionnable (PRD Feature 12 + §7.3).
// Monnaie sociale rare : quota mensuel par stade, servi par le RPC
// give_coup_de_coeur (migration 0028). Visible uniquement en mode Supabase
// (pas de quota traçable en démo). Le compteur du mois s'affiche dès qu'il
// est > 0, le bouton bascule en "donné" après succès.

import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import {
  isSupabaseConfigured,
  giveCoupDeCoeur,
  countCoupsDeCoeurThisMonth,
} from "../lib/data-source";
import { track } from "../lib/analytics";

interface Props {
  place_id: string;
}

export function CoupDeCoeurButton({ place_id }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(0);
  const [given, setGiven] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void countCoupsDeCoeurThisMonth(place_id).then((n) => {
      if (!cancelled && n !== null) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [place_id]);

  if (!isSupabaseConfigured) return null;

  const onPress = async () => {
    if (busy || given) return;
    setBusy(true);
    track({ name: "coup_de_coeur_attempted", properties: { place_id } });
    const res = await giveCoupDeCoeur(place_id);
    setBusy(false);
    if (res === null) {
      setFeedback(t("cdc.error"));
      return;
    }
    if (res.ok) {
      setGiven(true);
      setCount((c) => c + 1);
      setFeedback(
        res.remaining && res.remaining > 0
          ? t("cdc.given_remaining", { count: res.remaining })
          : t("cdc.given_last"),
      );
      track({ name: "coup_de_coeur_posted", properties: { place_id } });
    } else if (res.code === "already_given") {
      setGiven(true);
      setFeedback(t("cdc.already_given"));
    } else if (res.code === "quota_exhausted") {
      setFeedback(t("cdc.quota_exhausted", { quota: res.quota ?? 1 }));
      track({
        name: "coup_de_coeur_quota_exhausted",
        properties: { place_id, quota: res.quota ?? 1 },
      });
    } else {
      setFeedback(t("cdc.error"));
    }
  };

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        }}
      >
        <Pressable
          testID="cdc-button"
          accessibilityRole="button"
          accessibilityLabel={t("cdc.button")}
          disabled={busy || given}
          onPress={() => void onPress()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.xs,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.base,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: given
              ? theme.colors.brand.primary
              : theme.colors.border.strong,
            backgroundColor: given
              ? theme.colors.brand.primary
              : theme.colors.surface.base,
            opacity: pressed || busy ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: given ? theme.colors.text.onBrand : theme.colors.text.primary,
              fontWeight: "600",
            }}
          >
            {given ? t("cdc.button_given") : t("cdc.button")}
          </Text>
        </Pressable>
        {count > 0 ? (
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.secondary,
            }}
            testID="cdc-count"
          >
            {t("cdc.month_count", { count })}
          </Text>
        ) : null}
      </View>
      {feedback ? (
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            marginTop: theme.spacing.xs,
          }}
          testID="cdc-feedback"
        >
          {feedback}
        </Text>
      ) : null}
    </View>
  );
}
