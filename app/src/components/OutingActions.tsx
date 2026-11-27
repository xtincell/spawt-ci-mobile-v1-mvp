import { useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import { useOutingsStore } from "../store/outings-store";
import { DishRatingButton } from "./DishRatingButton";
import { Ico } from "./primitives/Ico";
import type { MenuItem } from "../lib/outings";

export function OutingActions({ placeId, dish, full = false, onHomeCard = false }: { placeId: string; dish?: MenuItem; full?: boolean; onHomeCard?: boolean }) {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const owner = useSpawterStore(s => s.spawter?.id);
  const placeSaved = useSpawterStore(s => s.savedPlaceIds.has(placeId));
  const pendingPlace = useOutingsStore(s => s.owner === owner ? s.pendingPlaces[placeId] : undefined);
  const listed = useOutingsStore(s => s.owner === owner && s.snapshot.items.some(i => i.place_id === placeId));
  const dishSaved = useOutingsStore(s => s.owner === owner && s.snapshot.dishes.some(d => d.id === dish?.id));
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const saved = dish ? dishSaved : (pendingPlace ?? (placeSaved || listed));
  const label = dish ? (saved ? "outings.dish_saved" : "outings.save_dish") : (saved ? "outings.place_saved" : "outings.save_place");
  const visibleLabel = onHomeCard ? (saved ? "outings.saved" : "common.save") : label;
  const removeLabel = dish ? "outings.remove_dish" : "outings.remove_place";
  const perform = useOutingsStore(s => s.perform);
  const run = async (fn: () => Promise<unknown>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true);
    try { await fn(); } catch { Alert.alert(t("outings.failed")); } finally { inFlight.current = false; setBusy(false); }
  };
  const button = { minHeight: 44, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm, justifyContent: "center" as const };
  return <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: theme.spacing.xs,
    ...(onHomeCard && { paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm, borderTopWidth: 1, borderColor: theme.colors.border.subtle }) }}>
    <Pressable testID={`save-intent-${dish?.id ?? placeId}`} accessibilityRole="button" accessibilityLabel={t(saved ? removeLabel : label)} accessibilityState={{ selected: saved, disabled: busy }} disabled={busy}
      onPress={() => void run(() => dish ? perform(saved ? "unsave" : "save", { menu_item_id: dish.id }, dish) : listed || pendingPlace !== undefined ? perform(saved ? "unsave" : "save", { place_id: placeId }) : useSpawterStore.getState().toggleSaved(placeId))}
      style={{ ...button, flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, borderRadius: theme.radius.md,
        ...(onHomeCard && { paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.full }),
        backgroundColor: onHomeCard ? theme.colors.brand.accent : saved ? theme.colors.surface.subtle : theme.colors.brand.primary }}>
      {onHomeCard && <Ico name="bookmark" size={18} filled={saved} color={theme.colors.text.inverse} />}
      <Text style={{ ...theme.typography.preset.small, color: onHomeCard ? theme.colors.text.inverse : theme.colors.text.onBrand }}>{t(visibleLabel)}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" style={button} onPress={() => router.push({ pathname: "/saved", params: dish ? { addDish: dish.id } : { addPlace: placeId } } as never)}>
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.brand.accent }}>{t("outings.classify")}</Text>
    </Pressable>
    {dish && <DishRatingButton key={(owner ?? "") + dish.id} owner={owner} dishId={dish.id} name={dish.name} published={dish.is_published} />}
    {full ? <Pressable accessibilityRole="button" style={button} disabled={busy} onPress={() => void run(async () => {
      await perform("choose", { place_id: placeId });
      const state = useOutingsStore.getState();
      Alert.alert(t(state.pending ? "outings.pending" : state.rejected ? "outings.rejected" : "outings.chosen"));
    })}><Text style={{ ...theme.typography.preset.small, color: theme.colors.brand.accent }}>{t("outings.choose")}</Text></Pressable> : null}
  </View>;
}
