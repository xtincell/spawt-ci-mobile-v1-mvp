import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Crypto from "expo-crypto";
import { usePlaces } from "../src/lib/use-places";
import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { useOutings, useOutingsStore } from "../src/store/outings-store";
import { useCrewStore } from "../src/store/crew-store";
import { useMenuItems } from "../src/lib/use-menu-items";
import { listShareUrl, discardRejectedOutings, type Occasion } from "../src/lib/outings";
import { DataLoadNotice } from "../src/components/DataLoadNotice";
import { MenuItemCard } from "../src/components/MenuItemCard";
import { OutingActions } from "../src/components/OutingActions";
import { PlaceCover } from "../src/components/PlaceCover";

const occasions: Occasion[] = ["date", "anniversaire", "vendredi", "brunch", "autre"];
export default function SavedScreen() {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const params = useLocalSearchParams<{ addPlace?: string; addDish?: string }>();
  const owner = useSpawterStore(s => s.spawter);
  const savedUnavailable = useSpawterStore(s => s.savedUnavailable);
  const refreshSaved = useSpawterStore(s => s.refreshSaved);
  const savedIds = useSpawterStore(s => s.savedPlaceIds);
  const { places, loading, failed, reload } = usePlaces();
  const menu = useMenuItems(); const outings = useOutings();
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [occasion, setOccasion] = useState<Occasion>("autre");
  const [busy, setBusy] = useState(false);
  const activeList = outings.snapshot.lists.find(l => l.id === selected);
  const listItems = outings.snapshot.items.filter(i => i.list_id === selected);
  const saved = places.filter(p => selected ? listItems.some(i => i.place_id === p.id) : (outings.pendingPlaces[p.id] ?? (savedIds.has(p.id) || outings.snapshot.items.some(i => i.place_id === p.id))));
  const dishes = outings.snapshot.dishes.filter(d => !selected || listItems.some(i => i.menu_item_id === d.id));
  const adding = Boolean(params.addPlace || params.addDish);
  const button = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs };
  const ink = { ...theme.typography.preset.body, color: theme.colors.brand.accent };
  async function run(fn: () => Promise<void>) {
    if (busy) return; setBusy(true);
    try { await fn(); } catch { Alert.alert(t("outings.failed")); } finally { setBusy(false); }
  }
  async function selectList(id: string | null) {
    setSelected(id); if (!adding || !id) return;
    const dish = menu.items.find(d => d.id === params.addDish) ?? outings.snapshot.dishes.find(d => d.id === params.addDish);
    if (params.addDish && !dish) throw new Error("dish_unavailable");
    await outings.perform("list_add", { list_id: id, ...(params.addDish ? { menu_item_id: params.addDish } : { place_id: params.addPlace }) }, dish);
    router.setParams({ addPlace: undefined, addDish: undefined });
  }
  async function shareList() {
    if (!activeList) return;
    if (!activeList.share_token) await outings.perform("list_share", { list_id: activeList.id, enabled: true });
    if (useOutingsStore.getState().owner !== owner?.id || useSpawterStore.getState().spawter?.id !== owner?.id) return;
    const token = useOutingsStore.getState().snapshot.lists.find(l => l.id === activeList.id)?.share_token;
    if (!token) { Alert.alert(t("outings.pending")); return; }
    await Share.share({ message: `${activeList.title}\n${listShareUrl(token)}` });
  }
  async function sendToCrew() {
    if (!owner) return;
    const ids = new Set([...saved.map(p => p.id), ...dishes.map(d => d.place_id)]);
    if (!ids.size) return;
    const self = { id: owner.id, display_name: owner.display_name ?? "", avatar_url: owner.avatar_url ?? null };
    const crew = useCrewStore.getState();
    const ref = crew.session && crew.self?.id === owner.id && ["open", "voting"].includes(crew.session.status) && Date.parse(crew.session.expires_at) > Date.now()
      ? { session_id: crew.session.id } : await crew.start(self);
    if (!ref || useSpawterStore.getState().spawter?.id !== owner.id) throw new Error("crew_unavailable");
    for (const id of ids) {
      if (useSpawterStore.getState().spawter?.id !== owner.id) throw new Error("session_changed");
      const p = places.find(p => p.id === id); if (!p) continue;
      if (await useCrewStore.getState().propose({ id, name: p.name, neighborhood: p.location.neighborhood }) === "error") throw new Error("crew_proposal_failed");
    }
    router.push(`/crew/${ref.session_id}` as never);
  }
  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.base, paddingBottom: theme.spacing["2xl"] }}>
      <Pressable accessibilityRole="button" style={button} onPress={() => router.canGoBack() ? router.back() : router.replace("/")}><Text style={ink}>{t("common.back")}</Text></Pressable>
      <View style={{ gap: theme.spacing.xs }}><Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("outings.title")}</Text><Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>{t("outings.subtitle")}</Text></View>
      <DataLoadNotice loading={loading || outings.loading} failed={failed || outings.failed} onRetry={() => { void reload(); void outings.refresh(); }} />
      {savedUnavailable ? <View><Text style={ink}>{t("saved.unavailable")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("saved.retry")} style={button} onPress={() => void refreshSaved().catch(() => undefined)}><Text style={ink}>{t("saved.retry")}</Text></Pressable></View> : null}
      {outings.pending > 0 ? <Text accessibilityLiveRegion="polite" style={ink}>{t("outings.pending")}</Text> : null}
      {outings.rejected > 0 ? <View><Text style={ink}>{t("outings.rejected")}</Text><Pressable accessibilityRole="button" style={button} onPress={() => void run(async () => { if (owner) await discardRejectedOutings(owner.id); await outings.refresh(); })}><Text style={ink}>{t("outings.dismiss_rejected")}</Text></Pressable></View> : null}
      {adding ? <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}>{t("outings.pick_list")}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
        {[{ id: null, title: t("outings.all") }, ...outings.snapshot.lists].map(l => <Pressable key={l.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: selected === l.id, disabled: busy }} disabled={busy} onPress={() => void run(() => selectList(l.id))} style={{ ...button, borderRadius: theme.radius.md, backgroundColor: selected === l.id ? theme.colors.brand.primary : theme.colors.surface.subtle }}><Text style={{ ...theme.typography.preset.small, color: selected === l.id ? theme.colors.surface.base : theme.colors.text.primary }}>{l.title}</Text></Pressable>)}
        <Pressable accessibilityRole="button" style={button} onPress={() => { setEditing(null); setTitle(""); setOccasion("autre"); setEditor(true); }}><Text style={ink}>{t("outings.new_list")}</Text></Pressable>
      </View>
      {activeList ? <View style={{ backgroundColor: theme.colors.surface.subtle, borderRadius: theme.radius.lg, padding: theme.spacing.base }}>
        <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{activeList.title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Pressable accessibilityRole="button" disabled={busy} style={button} onPress={() => void run(shareList)}><Text style={ink}>{t("outings.share")}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} style={button} onPress={() => void run(sendToCrew)}><Text style={ink}>{t("outings.crew")}</Text></Pressable>
          <Pressable accessibilityRole="button" style={button} onPress={() => { setEditing(activeList.id); setTitle(activeList.title); setOccasion(activeList.occasion ?? "autre"); setEditor(true); }}><Text style={ink}>{t("outings.edit_list")}</Text></Pressable>
          {activeList.share_token ? <Pressable accessibilityRole="button" disabled={busy} style={button} onPress={() => void run(() => outings.perform("list_share", { list_id: activeList.id, enabled: false }))}><Text style={ink}>{t("outings.revoke")}</Text></Pressable> : null}
        </View>
      </View> : null}
      {!saved.length && !dishes.length && !loading && !outings.loading && !failed && !outings.failed && !savedUnavailable ? <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>{t("outings.empty")}</Text> : null}
      {saved.map(p => <View key={p.id} style={{ gap: theme.spacing.sm }}>
        <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${p.id}` as never)}>
          <PlaceCover uri={p.cover_photo_url} style={{ height: 170, borderRadius: theme.radius.lg }} />
          <Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{p.name}</Text>
          <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{p.location.neighborhood}</Text>
        </Pressable><OutingActions placeId={p.id} full />
        {selected ? <Pressable accessibilityRole="button" style={button} onPress={() => void run(() => outings.perform("list_remove", { list_id: selected, place_id: p.id }))}><Text style={ink}>{t("outings.remove_from_list")}</Text></Pressable> : null}
      </View>)}
      {dishes.map(d => <View key={d.id}><MenuItemCard item={d} />{!d.is_published ? <Pressable accessibilityRole="button" style={button} onPress={() => void run(() => outings.perform("unsave", { menu_item_id: d.id }))}><Text style={ink}>{t("outings.remove_saved")}</Text></Pressable> : null}{selected ? <Pressable accessibilityRole="button" style={button} onPress={() => void run(() => outings.perform("list_remove", { list_id: selected, menu_item_id: d.id }))}><Text style={ink}>{t("outings.remove_from_list")}</Text></Pressable> : null}</View>)}
      <Pressable accessibilityRole="button" style={button} onPress={() => router.push({ pathname: "/support", params: { context: activeList ? `liste:${activeList.id}` : "envies" } } as never)}><Text style={ink}>{t("outings.feedback")}</Text></Pressable>
    </ScrollView>
    <Modal visible={editor} animationType="slide" onRequestClose={() => setEditor(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}><ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.base }}>
        <Text style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t(editing ? "outings.edit_list" : "outings.new_list")}</Text>
        <TextInput accessibilityLabel={t("outings.list_name")} placeholder={t("outings.list_name")} placeholderTextColor={theme.colors.text.secondary} value={title} onChangeText={setTitle} maxLength={80} style={{ ...theme.typography.preset.body, color: theme.colors.text.primary, borderBottomWidth: 1, borderColor: theme.colors.text.tertiary, minHeight: 48 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{occasions.map(o => <Pressable key={o} accessibilityRole="button" accessibilityState={{ selected: occasion === o }} style={{ ...button, backgroundColor: occasion === o ? theme.colors.surface.subtle : theme.colors.surface.base }} onPress={() => { setOccasion(o); if (!title.trim()) setTitle(t(`outings.occasions.${o}`)); }}><Text style={ink}>{t(`outings.occasions.${o}`)}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" style={button} disabled={busy || !title.trim()} onPress={() => void run(async () => { const id = editing ?? Crypto.randomUUID(); await outings.perform(editing ? "list_rename" : "list_create", { list_id: id, title: title.trim(), occasion }); setEditor(false); await selectList(id); })}><Text style={ink}>{t("outings.confirm")}</Text></Pressable>
        {editing ? <Pressable accessibilityRole="button" style={button} disabled={busy} onPress={() => Alert.alert(t("outings.delete_list"), t("outings.delete_keeps_saves"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("outings.delete_list"), style: "destructive", onPress: () => void run(async () => { await outings.perform("list_delete", { list_id: editing }); setSelected(null); setEditor(false); }) }])}><Text style={ink}>{t("outings.delete_list")}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" style={button} onPress={() => setEditor(false)}><Text style={ink}>{t("common.cancel")}</Text></Pressable>
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
