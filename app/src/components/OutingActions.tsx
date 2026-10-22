import { useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import { useOutingsStore } from "../store/outings-store";
import type { MenuItem } from "../lib/outings";

export function OutingActions({ placeId, dish, full = false }: { placeId: string; dish?: MenuItem; full?: boolean }) {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const owner = useSpawterStore(s => s.spawter?.id);
  const placeSaved = useSpawterStore(s => s.savedPlaceIds.has(placeId));
  const pendingPlace = useOutingsStore(s => s.owner === owner ? s.pendingPlaces[placeId] : undefined);
  const listed = useOutingsStore(s => s.owner === owner && s.snapshot.items.some(i => i.place_id === placeId));
  const dishSaved = useOutingsStore(s => s.owner === owner && s.snapshot.dishes.some(d => d.id === dish?.id));
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const saved = dish ? dishSaved : (pendingPlace ?? (placeSaved || listed));
  const perform = useOutingsStore(s => s.perform);
  const run = async (fn: () => Promise<unknown>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true);
    try { await fn(); } catch { Alert.alert(t("outings.failed")); } finally { inFlight.current = false; setBusy(false); }
  };
  const button = { minHeight: 44, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm, justifyContent: "center" as const };
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs }}>
    <Pressable testID={`save-intent-${dish?.id ?? placeId}`} accessibilityRole="button" accessibilityState={{ selected: saved, disabled: busy }} disabled={busy}
      onPress={() => void run(() => dish ? perform(saved ? "unsave" : "save", { menu_item_id: dish.id }, dish) : listed || pendingPlace !== undefined ? perform(saved ? "unsave" : "save", { place_id: placeId }) : useSpawterStore.getState().toggleSaved(placeId))}
      style={{ ...button, borderRadius: theme.radius.md, backgroundColor: saved ? theme.colors.surface.subtle : theme.colors.brand.primary }}>
      <Text style={{ ...theme.typography.preset.small, color: saved ? theme.colors.text.primary : theme.colors.surface.base }}>{t(saved ? "outings.saved" : "outings.save")}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" style={button} onPress={() => router.push({ pathname: "/saved", params: dish ? { addDish: dish.id } : { addPlace: placeId } } as never)}>
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.brand.accent }}>{t("outings.classify")}</Text>
    </Pressable>
    {full ? <Pressable accessibilityRole="button" style={button} disabled={busy} onPress={() => void run(async () => {
      await perform("choose", { place_id: placeId });
      const state = useOutingsStore.getState();
      Alert.alert(t(state.pending ? "outings.pending" : state.rejected ? "outings.rejected" : "outings.chosen"));
    })}><Text style={{ ...theme.typography.preset.small, color: theme.colors.brand.accent }}>{t("outings.choose")}</Text></Pressable> : null}
  </View>;
}
