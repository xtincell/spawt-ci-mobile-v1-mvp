// Écran « Mes Coups de Cœur » — migration 0068.
//
// Pourquoi il existe : le profil n'en montrait aucun. On pouvait en donner, on
// ne pouvait ni les revoir ni les reprendre. Le Coup de Cœur est présenté comme
// une monnaie rare — une monnaie dont on ne voit pas le solde n'en est pas une.
//
// Le retrait n'est possible que sur le MOIS COURANT : le quota est mensuel, une
// unité d'un mois clos ne peut pas être rendue, et effacer un signal passé
// réécrirait l'historique public d'un lieu. Les mois révolus s'affichent donc,
// mais grisés — visibles, pas actionnables. L'écran le dit plutôt que de
// proposer un bouton qui échouerait.

import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { EmptyState } from "../src/components/EmptyState";
import { Ico } from "../src/components/primitives/Ico";
import {
  isSupabaseConfigured,
  listMyCoupsDeCoeur,
  removeCoupDeCoeur,
  type MonCoupDeCoeur,
} from "../src/lib/data-source";
import { track } from "../src/lib/analytics";

export default function CoupsDeCoeurScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const [liste, setListe] = useState<MonCoupDeCoeur[] | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const res = await listMyCoupsDeCoeur();
    setListe(res ?? []);
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  const retirer = async (place_id: string) => {
    if (enCours) return;
    setEnCours(place_id);
    try {
      const res = await removeCoupDeCoeur(place_id);
      // `not_given` veut dire que le serveur n'a rien trouvé à retirer : la
      // vue était en retard. On recharge dans les deux cas plutôt que
      // d'afficher un échec — la vérité est côté serveur.
      if (res?.ok) {
        track({ name: "coup_de_coeur_removed", properties: { place_id } });
      }
      await charger();
    } finally {
      setEnCours(null);
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.base,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Ico name="arrow-left" size={22} />
        </Pressable>
        <Text style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>
          {t("cdc.mine_title")}
        </Text>
      </View>

      {!isSupabaseConfigured ? (
        <EmptyState
          icon="heart"
          title={t("cdc.mine_offline_title")}
          body={t("cdc.mine_offline_body")}
        />
      ) : liste === null ? (
        <View style={{ padding: theme.spacing.lg }}>
          <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.tertiary }}>
            {t("common.loading")}
          </Text>
        </View>
      ) : liste.length === 0 ? (
        <EmptyState
          icon="heart"
          title={t("cdc.mine_empty_title")}
          body={t("cdc.mine_empty_body")}
        />
      ) : (
        <FlatList
          data={liste}
          keyExtractor={(c) => `${c.place_id}-${c.month_key}`}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.base,
            paddingBottom: theme.spacing["2xl"],
            gap: theme.spacing.sm,
          }}
          renderItem={({ item }) => (
            <View
              testID={`cdc-row-${item.place_id}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.spacing.base,
                padding: theme.spacing.base,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                backgroundColor: theme.colors.surface.raised,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.place_name}
                onPress={() =>
                  router.push({
                    pathname: "/place/[id]",
                    params: { id: item.place_id, ref: "direct" },
                  })
                }
                style={{ flex: 1 }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.primary,
                  }}
                >
                  {item.place_name}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.tertiary,
                  }}
                >
                  {item.neighborhood ?? t("profile.neighborhood_unknown")} · {item.month_key}
                </Text>
              </Pressable>

              {item.is_current_month ? (
                <Pressable
                  testID={`cdc-remove-${item.place_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t("cdc.remove_aria")}
                  disabled={enCours === item.place_id}
                  onPress={() => void retirer(item.place_id)}
                  style={({ pressed }) => ({
                    paddingVertical: theme.spacing.xs,
                    paddingHorizontal: theme.spacing.base,
                    borderRadius: theme.radius.full,
                    borderWidth: 1,
                    borderColor: theme.colors.border.strong,
                    opacity: pressed || enCours === item.place_id ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      ...theme.typography.preset.small,
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {t("cdc.remove_action")}
                  </Text>
                </Pressable>
              ) : (
                // Mois clos : on explique pourquoi il n'y a pas de bouton,
                // plutôt que de laisser un vide qui ressemble à un oubli.
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.tertiary,
                    maxWidth: 110,
                    textAlign: "right",
                  }}
                >
                  {t("cdc.locked_past_month")}
                </Text>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
