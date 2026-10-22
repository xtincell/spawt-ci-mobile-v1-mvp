// Phase 2 — Coup de Cœur actionnable (PRD Feature 12 + §7.3).
// Monnaie sociale rare : quota mensuel par stade, servi par les RPC
// give_coup_de_coeur / remove_coup_de_coeur (migrations 0028 + 0068). Visible
// uniquement en mode Supabase (pas de quota traçable en démo).
//
// Deux défauts signalés depuis un téléphone, réparés ici :
//
// 1. « Le coup de cœur ne peut pas être retiré. » Il n'existait aucune voie de
//    retour : le bouton passait `disabled` à vie après un don. Un tap de
//    travers coûtait une unité de quota du mois, définitivement. La rareté est
//    un choix produit ; l'irréversibilité d'une fausse manœuvre n'en est pas
//    un. Le bouton est désormais un va-et-vient, et le quota est rendu.
//
// 2. L'état « déjà donné » ne vivait que dans un `useState`, perdu au
//    démontage. Après un simple retour en arrière, l'écran reproposait de
//    donner et le serveur répondait `already_given` : le produit savait,
//    l'écran non. L'état est maintenant lu au montage (`my_coup_de_coeur_state`),
//    en un seul aller-retour qui rapporte aussi le quota restant.

import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import {
  isSupabaseConfigured,
  giveCoupDeCoeur,
  getCoupDeCoeurState,
  removeCoupDeCoeur,
} from "../lib/data-source";
// La décision « que devient l'écran après cette réponse ? » est extraite et
// couverte par des tests (`coup-de-coeur-state`). Elle ne doit exister qu'à un
// seul endroit : c'est en la laissant en ligne ici qu'elle était fausse.
import { appliquerReponseCoupDeCoeur } from "../lib/coup-de-coeur-state";
import { track } from "../lib/analytics";

interface Props {
  place_id: string;
  /** Prévenir le parent qu'il faut recharger sa liste (page de profil). */
  onChange?: () => void;
}

export function CoupDeCoeurButton({ place_id, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(0);
  const [given, setGiven] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  // `null` tant que l'état réel n'est pas revenu du serveur : afficher
  // « donner » avant de savoir, c'est reproduire le défaut qu'on répare.
  const [connu, setConnu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Verrou SYNCHRONE. `busy` est un état : il n'est visible qu'au rendu
  // suivant, donc deux taps du même tour le liraient tous les deux à faux et
  // partiraient — l'un donnant, l'autre retirant.
  const enVolRef = useRef(false);
  const monteRef = useRef(true);
  useEffect(() => {
    monteRef.current = true;
    return () => {
      monteRef.current = false;
    };
  }, []);

  const appliquer = useCallback(
    (etat: { given: boolean; place_count: number; remaining: number }) => {
      setGiven(etat.given);
      setCount(etat.place_count);
      setRemaining(etat.remaining);
      setConnu(true);
    },
    [],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let annule = false;
    void getCoupDeCoeurState(place_id).then((etat) => {
      if (annule || !etat) return;
      appliquer(etat);
    });
    return () => {
      annule = true;
    };
  }, [place_id, appliquer]);

  if (!isSupabaseConfigured) return null;

  const onPress = async () => {
    if (enVolRef.current) return;
    enVolRef.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const res = given
        ? await removeCoupDeCoeur(place_id)
        : await giveCoupDeCoeur(place_id);
      if (!monteRef.current) return;

      const issue = appliquerReponseCoupDeCoeur({ given, count, remaining }, res);
      setGiven(issue.etat.given);
      setCount(issue.etat.count);
      setRemaining(issue.etat.remaining);
      setFeedback(
        issue.messageKey
          ? t(`cdc.${issue.messageKey}`, {
              count: issue.etat.remaining ?? 0,
              quota: res?.quota ?? 1,
            })
          : null,
      );
      if (issue.evenement) {
        track({ name: issue.evenement, properties: { place_id } });
      }
      if (issue.rechargerListe) onChange?.();
    } finally {
      enVolRef.current = false;
      if (monteRef.current) setBusy(false);
    }
  };

  const libelle = !connu
    ? t("cdc.button_loading")
    : given
      ? t("cdc.button_given")
      : t("cdc.button");

  return (
    <View style={{ marginBottom: theme.spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: theme.spacing.sm,
        }}
      >
        <Pressable
          testID="cdc-button"
          accessibilityRole="button"
          accessibilityState={{ selected: given, busy }}
          // L'intitulé accessible doit dire ce que le tap VA faire, pas l'état.
          accessibilityLabel={given ? t("cdc.remove_aria") : t("cdc.button")}
          disabled={busy || !connu}
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
            opacity: pressed || busy || !connu ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: given ? theme.colors.text.onBrand : theme.colors.text.primary,
              fontWeight: "600",
            }}
          >
            {libelle}
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

      {/* Le quota restant se dit AVANT le tap, pas après. Sans ça, on découvre
          qu'on vient de dépenser son dernier cœur du mois une fois dépensé. */}
      {connu && !given && remaining !== null ? (
        <Text
          testID="cdc-remaining"
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            marginTop: theme.spacing.xs,
          }}
        >
          {t("cdc.remaining_hint", { count: remaining })}
        </Text>
      ) : null}

      {given ? (
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.tertiary,
            marginTop: theme.spacing.xs,
          }}
          testID="cdc-remove-hint"
        >
          {t("cdc.remove_hint")}
        </Text>
      ) : null}

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
