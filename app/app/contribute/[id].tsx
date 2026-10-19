import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useSpawterStore } from "../../src/store/spawter-store";
import { useProgressionStore } from "../../src/store/progression-store";
import { compressPhoto } from "../../src/lib/storage-photos";
import { contributionRewards, listContributions, persistContributionPhoto, preciseRecentLocation, submitContribution, uploadContributionPhoto,
  type ContributionKind, type LocationProof, type PlaceContribution } from "../../src/lib/place-contributions";

interface Draft { id: string; kind: ContributionKind; photos: string[]; price: string; tier: string; location: LocationProof | null; comment: string }
const newDraft = (): Draft => ({ id: Crypto.randomUUID(), kind: "menu", photos: [], price: "", tier: "", location: null, comment: "" });
export default function ContributeScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const owner = useSpawterStore(s => s.spawter?.id); const router = useRouter(); const theme = useTheme(); const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(newDraft); const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [receipt, setReceipt] = useState("");
  const [rows, setRows] = useState<PlaceContribution[]>([]); const [historyError, setHistoryError] = useState(false);
  const [rewards, setRewards] = useState<Record<ContributionKind, number> | null>(null);
  const key = `spawt:contribution-draft:${owner ?? "anonymous"}:${id}`;
  useEffect(() => {
    let active = true; setReady(false); setDraft(newDraft()); setRows([]); setReceipt("");
    void AsyncStorage.getItem(key).then(raw => {
      if (!active || !raw) return;
      const value = JSON.parse(raw);
      if (typeof value.id === "string" && ["menu", "location"].includes(value.kind) && Array.isArray(value.photos)
        && value.photos.every((p: unknown) => typeof p === "string") && typeof value.price === "string" && typeof value.tier === "string" && typeof value.comment === "string") setDraft(value);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [key]);
  useEffect(() => { if (ready) void AsyncStorage.setItem(key, JSON.stringify(draft)).catch(() => {}); }, [key, ready, draft]);
  const refresh = useCallback(async () => {
    if (!owner || !id) return;
    try {
      const [history, rules] = await Promise.all([listContributions(owner, id), contributionRewards()]);
      setRows(history); setRewards(rules); setHistoryError(false);
      void useProgressionStore.getState().hydrate(owner);
    } catch { setHistoryError(true); }
  }, [owner, id]);
  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => void refresh(), 30_000); return () => clearInterval(timer); }, [refresh]));
  const change = (patch: Partial<Draft>) => { setReceipt(""); setError(""); setDraft(d => ({ ...d, ...patch, id: Crypto.randomUUID() })); };
  const photo = async (camera: boolean) => {
    if (busy || draft.photos.length >= 3) return;
    setBusy(true); setError("");
    try {
      const picker = await import("expo-image-picker");
      const permission = camera ? await picker.requestCameraPermissionsAsync() : await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError("photo_permission"); return; }
      const result = camera ? await picker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled && result.assets[0]) {
        const uri = await persistContributionPhoto(await compressPhoto(result.assets[0].uri), Crypto.randomUUID());
        change({ photos: [...draft.photos, uri] });
      }
    } catch { setError("photo_failed"); } finally { setBusy(false); }
  };
  const locate = async () => {
    setBusy(true); setError("");
    try {
      const location = await import("expo-location");
      if (!(await location.requestForegroundPermissionsAsync()).granted) { setError("gps_permission"); return; }
      const point = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.High });
      const proof = { lat: point.coords.latitude, lng: point.coords.longitude, accuracy_meters: point.coords.accuracy ?? Infinity, observed_at: new Date(point.timestamp).toISOString() };
      if (!preciseRecentLocation(proof)) { setError("gps_precise"); return; }
      change({ location: proof });
    } catch { setError("gps_failed"); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!owner || !id || busy) return;
    if (draft.kind === "menu" && (!draft.photos.length || (draft.price && (!/^\d+$/.test(draft.price) || Number(draft.price) < 1 || Number(draft.price) > 1_000_000)))) { setError("menu_required"); return; }
    if (draft.kind === "location" && !preciseRecentLocation(draft.location)) { setError("gps_precise"); return; }
    setBusy(true); setError(""); setReceipt("");
    try {
      let proposal: PlaceContribution["proposal"];
      if (draft.kind === "menu") {
        const paths = [];
        for (let index = 0; index < draft.photos.length; index++) paths.push(await uploadContributionPhoto(draft.photos[index]!, owner, draft.id, index));
        proposal = { photo_paths: paths, ...(draft.price ? { avg_ticket_xof: Number(draft.price) } : {}), ...(draft.tier ? { price_tier: Number(draft.tier) } : {}) };
      } else proposal = draft.location!;
      const received = await submitContribution(draft.id, id, draft.kind, proposal, draft.comment);
      setReceipt(received.slice(0, 8)); setDraft(newDraft()); await refresh();
    } catch (e) {
      const message = e && typeof e === "object" && "message" in e ? String(e.message) : "";
      setError(message.includes("contribution_rate_limit") ? "limit" : "send_failed");
    } finally { setBusy(false); }
  };
  const body = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  const button = (label: string, action: () => void, testID: string, disabled = false) => <Pressable testID={testID} accessibilityRole="button" onPress={action} disabled={disabled} style={{ minHeight: 44, justifyContent: "center", opacity: disabled ? 0.45 : 1 }}><Text style={{ ...body, color: theme.colors.brand.accent }}>{label}</Text></Pressable>;
  const inputStyle = { ...body, borderWidth: 1, borderColor: theme.colors.text.tertiary, borderRadius: theme.radius.md, padding: theme.spacing.base };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
    {button(t("common.back"), () => router.back(), "contribution-back")}
    <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("contribution.title")}</Text>
    {name ? <Text style={body}>{name}</Text> : null}
    <Text style={body}>{t("contribution.intro")}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.base }}>{(["menu", "location"] as const).map(kind => <Pressable key={kind} testID={`contribution-kind-${kind}`} accessibilityRole="radio" accessibilityState={{ checked: draft.kind === kind }} disabled={busy} onPress={() => change({ kind })} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...body, textDecorationLine: draft.kind === kind ? "underline" : "none" }}>{t(`contribution.kind.${kind}`)}</Text></Pressable>)}</View>
    {rewards ? <Text style={body}>{t("contribution.reward", { count: rewards[draft.kind] })}</Text> : null}
    {draft.kind === "menu" ? <>
      <Text style={body}>{t("contribution.menu_help")}</Text>
      {button(t("contribution.camera"), () => void photo(true), "contribution-camera", busy || draft.photos.length >= 3)}
      {button(t("contribution.gallery"), () => void photo(false), "contribution-gallery", busy || draft.photos.length >= 3)}
      {draft.photos.map((uri, index) => <View key={uri}><Image source={{ uri }} resizeMode="contain" style={{ width: "100%", height: 200 }} />{button(t("contribution.remove_photo", { number: index + 1 }), () => change({ photos: draft.photos.filter((_, i) => i !== index) }), `contribution-remove-${index}`, busy)}</View>)}
      <Text style={body}>{t("contribution.price")}</Text><TextInput testID="contribution-price" accessibilityLabel={t("contribution.price")} keyboardType="number-pad" maxLength={7} value={draft.price} onChangeText={price => change({ price })} editable={ready && !busy} style={inputStyle} />
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("contribution.price_help")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.base }}>{["", "1", "2", "3"].map(tier => <Pressable key={tier} accessibilityRole="radio" accessibilityState={{ checked: draft.tier === tier }} disabled={busy} onPress={() => change({ tier })} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...body, textDecorationLine: draft.tier === tier ? "underline" : "none" }}>{t(`contribution.tier.${tier || "unknown"}`)}</Text></Pressable>)}</View>
    </> : <>
      <Text style={body}>{t("contribution.gps_help")}</Text>
      {button(t("contribution.locate"), () => void locate(), "contribution-locate", busy)}
      {draft.location ? <Text testID="contribution-position" style={body}>{t("contribution.position", { lat: draft.location.lat.toFixed(6), lng: draft.location.lng.toFixed(6), accuracy: Math.round(draft.location.accuracy_meters) })}</Text> : null}
    </>}
    <TextInput testID="contribution-comment" accessibilityLabel={t("contribution.comment")} placeholder={t("contribution.comment")} placeholderTextColor={theme.colors.text.secondary} multiline maxLength={1000} value={draft.comment} editable={ready && !busy} onChangeText={comment => change({ comment })} style={{ ...inputStyle, minHeight: 85 }} />
    <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("contribution.privacy")}</Text>
    {!owner ? <Text style={body}>{t("support.signin")}</Text> : null}
    {button(t(busy ? "support.sending" : "contribution.send"), () => void send(), "contribution-send", busy || !ready || !owner)}
    {busy ? <ActivityIndicator accessibilityLabel={t("common.loading")} /> : null}
    {error ? <Text accessibilityRole="alert" testID="contribution-error" style={body}>{t(`contribution.errors.${error}`)}</Text> : null}
    {receipt ? <Text accessibilityRole="alert" testID="contribution-receipt" style={body}>{t("contribution.receipt", { id: receipt })}</Text> : null}
    <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("contribution.history")}</Text>
    {button(t("support.refresh"), () => void refresh(), "contribution-refresh")}
    {historyError ? <Text style={body}>{t("support.history_failed")}</Text> : null}
    {rows.map(row => <View key={row.id} style={{ padding: theme.spacing.base, gap: theme.spacing.sm, backgroundColor: theme.colors.surface.subtle, borderRadius: theme.radius.card }}><Text style={body}>{t(`contribution.kind.${row.kind}`)} · {t(`contribution.status.${row.status}`)} · {row.id.slice(0, 8)}</Text><Text style={body}>{row.comment}</Text>{row.status === "approved" ? <Text testID="contribution-reward" style={body}>{t("contribution.earned", { count: row.reward_paws })}</Text> : null}{row.review_note ? <Text testID="contribution-team-reply" style={body}>{t("support.reply", { reply: row.review_note })}</Text> : null}</View>)}
  </ScrollView></SafeAreaView>;
}
