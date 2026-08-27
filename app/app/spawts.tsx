// Écran « Mes spawts » — l'historique des passages du spawter.
//
// Ce lien existait sur le profil et n'ouvrait rien : il déclenchait une alerte
// « Cet écran arrive au prochain sprint. » Le compteur affichait pourtant un
// nombre, et les données existaient déjà en local (`spawter-store.spawts`,
// hydraté au démarrage) comme en base (`spawt_checkin`). Il ne manquait que
// l'écran — donc un chiffre qu'on ne pouvait pas ouvrir, ce qui est pire que
// pas de chiffre du tout.
//
// Le nom du lieu ne vit pas dans le check-in : on croise avec l'inventaire des
// lieux. Un lieu dépublié depuis le passage n'a plus de nom — on affiche alors
// un libellé neutre plutôt que de masquer la ligne : le passage a bien eu lieu.

import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { listPlaces, type PlaceWithAdn } from "../src/lib/data-source";
import { EmptyState } from "../src/components/EmptyState";
import { Ico } from "../src/components/primitives/Ico";

/** Date lisible en français, sans dépendance : `28 août 2026`. */
function dateLisible(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default function SpawtsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const spawts = useSpawterStore((s) => s.spawts);
  const [places, setPlaces] = useState<PlaceWithAdn[]>([]);

  useEffect(() => {
    let annule = false;
    void (async () => {
      const all = await listPlaces();
      if (!annule) setPlaces(all);
    })();
    return () => {
      annule = true;
    };
  }, []);

  const nomsParId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of places) m.set(p.id, p.name);
    return m;
  }, [places]);

  // Du plus récent au plus ancien. `checked_in_at` peut être nul (passage
  // détecté mais jamais confirmé) : on retombe sur l'arrivée.
  const ordonnes = useMemo(
    () =>
      [...spawts].sort((a, b) => {
        const da = a.checked_in_at ?? a.arrived_at ?? "";
        const db = b.checked_in_at ?? b.arrived_at ?? "";
        return db.localeCompare(da);
      }),
    [spawts],
  );

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
          {t("mes_spawts.title")}
        </Text>
      </View>

      {ordonnes.length === 0 ? (
        <EmptyState
          icon="clock"
          title={t("mes_spawts.empty_title")}
          body={t("mes_spawts.empty_body")}
        />
      ) : (
        <FlatList
          data={ordonnes}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.base,
            paddingBottom: theme.spacing["2xl"],
            gap: theme.spacing.sm,
          }}
          renderItem={({ item }) => {
            const nom = nomsParId.get(item.place_id) ?? t("mes_spawts.place_unknown");
            const quand = dateLisible(item.checked_in_at ?? item.arrived_at);
            return (
              <Pressable
                testID={`spawt-row-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={nom}
                onPress={() =>
                  router.push({
                    pathname: "/place/[id]",
                    params: { id: item.place_id, ref: "direct" },
                  })
                }
                style={({ pressed }) => ({
                  padding: theme.spacing.base,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.colors.border.subtle,
                  backgroundColor: theme.colors.surface.raised,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: theme.spacing.sm,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      ...theme.typography.preset.body,
                      color: theme.colors.text.primary,
                      flex: 1,
                    }}
                  >
                    {nom}
                  </Text>
                  {/* Le passage vérifié (géofence) est le seul qui compte pour
                      la confiance : on le montre, sans en faire un jugement. */}
                  {item.is_verified ? (
                    <Text
                      style={{
                        ...theme.typography.preset.caption,
                        color: theme.colors.brand.primary,
                      }}
                    >
                      {t("mes_spawts.verified")}
                    </Text>
                  ) : null}
                </View>
                {quand ? (
                  <Text
                    style={{
                      ...theme.typography.preset.small,
                      color: theme.colors.text.tertiary,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    {quand}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
