import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { appDiagnostic, checkAppContent, listAppFeedback, sendAppFeedback, type AppDiagnostic, type AppFeedback, type FeedbackKind } from "../src/lib/app-support";

export default function SupportScreen() {
  const theme = useTheme(); const { t } = useTranslation(); const router = useRouter();
  const { context } = useLocalSearchParams<{ context?: string }>();
  const spawterId = useSpawterStore(s => s.spawter?.id);
  const [diagnostic, setDiagnostic] = useState<AppDiagnostic>(appDiagnostic);
  const [checking, setChecking] = useState(false); const [checkFailed, setCheckFailed] = useState(false);
  const [includeChecks, setIncludeChecks] = useState(true);
  const [draft, setDraft] = useState({ id: Crypto.randomUUID(), kind: "bug" as FeedbackKind, message: "" });
  const [ready, setReady] = useState(false); const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false); const [receipt, setReceipt] = useState("");
  const [rows, setRows] = useState<AppFeedback[]>([]); const [historyFailed, setHistoryFailed] = useState(false);
  const draftKey = `spawt:feedback-draft:${spawterId ?? "anonymous"}`;
  useEffect(() => {
    let cancelled = false; setReady(false);
    void AsyncStorage.getItem(draftKey).then(value => {
      if (!value || cancelled) return;
      const saved = JSON.parse(value);
      if (typeof saved.id === "string" && typeof saved.message === "string" && ["bug", "idea", "content"].includes(saved.kind)) setDraft(saved);
    }).catch(() => {}).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [draftKey]);
  useEffect(() => { if (ready) void AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {}); }, [draft, draftKey, ready]);
  const history = useCallback(async () => {
    if (!spawterId) return;
    try { setRows(await listAppFeedback(spawterId)); setHistoryFailed(false); }
    catch { setHistoryFailed(true); }
  }, [spawterId]);
  useFocusEffect(useCallback(() => { void history(); }, [history]));
  const check = async () => {
    setChecking(true); setCheckFailed(false);
    try { setDiagnostic(await checkAppContent()); } catch { setCheckFailed(true); }
    finally { setChecking(false); }
  };
  const send = async () => {
    if (sending || !spawterId || draft.message.trim().length < 10) return;
    setSending(true); setSendFailed(false); setReceipt("");
    try {
      const id = await sendAppFeedback(draft.id, draft.kind, draft.message, context === "data_load" ? "data_load" : "app", includeChecks ? diagnostic : appDiagnostic());
      setReceipt(id.slice(0, 8)); setDraft({ id: Crypto.randomUUID(), kind: "bug", message: "" });
      await history();
    } catch { setSendFailed(true); } finally { setSending(false); }
  };
  const body = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  const button = (label: string, onPress: () => void, id: string, disabled = false) => <Pressable testID={id} accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", opacity: disabled ? 0.5 : 1 }}><Text style={{ ...body, color: theme.colors.brand.accent }}>{label}</Text></Pressable>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
      {button(t("common.back"), () => router.back(), "support-back")}
      <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("support.title")}</Text>
      <Text style={body}>{t("support.version", { version: diagnostic.version, build: diagnostic.build })}</Text>
      <Text style={body}>{t("support.check_intro")}</Text>
      {button(t("support.check"), () => void check(), "support-check", checking)}
      {checking ? <ActivityIndicator accessibilityLabel={t("common.loading")} /> : null}
      {checkFailed ? <Text accessibilityRole="alert" style={body}>{t("support.check_failed")}</Text> : null}
      {diagnostic.checks?.map(result => <Text key={result.key} testID={`support-check-${result.key}`} style={body}>{t(`support.checks.${result.key}`)} : {result.ok ? (result.count === undefined ? t("support.ok") : t("support.read_count", { count: result.count })) : t("support.unavailable")}</Text>)}
      {diagnostic.checkedAt ? <>
        <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("support.checked_at", { date: new Date(diagnostic.checkedAt).toLocaleString("fr-FR") })}</Text>
        {button(t("support.share"), () => { void Share.share({ message: JSON.stringify(diagnostic, null, 2) }).catch(() => {}); }, "support-share")}
      </> : null}
      <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary, marginTop: theme.spacing.base }}>{t("support.send_title")}</Text>
      <Text style={body}>{t("support.private")}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.base }}>
        {(["bug", "content", "idea"] as const).map(kind => <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ checked: draft.kind === kind }} disabled={sending} onPress={() => setDraft(d => ({ ...d, id: Crypto.randomUUID(), kind }))} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...body, textDecorationLine: draft.kind === kind ? "underline" : "none" }}>{t(`support.kinds.${kind}`)}</Text></Pressable>)}
      </View>
      <TextInput testID="support-message" accessibilityLabel={t("support.message")} placeholder={t("support.message")} placeholderTextColor={theme.colors.text.secondary} multiline maxLength={4000} editable={ready && !sending} value={draft.message} onChangeText={message => { setReceipt(""); setDraft(d => ({ ...d, id: Crypto.randomUUID(), message })); }} style={{ ...body, minHeight: 120, textAlignVertical: "top", borderWidth: 1, borderColor: theme.colors.text.tertiary, borderRadius: theme.radius.md, padding: theme.spacing.base }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}><Switch accessibilityLabel={t("support.attach")} value={includeChecks} onValueChange={setIncludeChecks} /><Text style={{ ...body, flex: 1 }}>{t("support.attach")}</Text></View>
      <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{t("support.privacy")}</Text>
      {!spawterId ? <Text style={body}>{t("support.signin")}</Text> : null}
      {button(t(sending ? "support.sending" : "support.send"), () => void send(), "support-send", !ready || sending || !spawterId || draft.message.trim().length < 10)}
      {sendFailed ? <Text testID="support-send-error" accessibilityRole="alert" style={body}>{t("support.send_failed")}</Text> : null}
      {receipt ? <Text testID="support-receipt" accessibilityRole="alert" style={body}>{t("support.receipt", { id: receipt })}</Text> : null}
      <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("support.history")}</Text>
      {button(t("support.refresh"), () => void history(), "support-refresh")}
      {historyFailed ? <Text accessibilityRole="alert" style={body}>{t("support.history_failed")}</Text> : null}
      {rows.map(row => <View key={row.id} testID={`support-ticket-${row.id}`} style={{ padding: theme.spacing.base, gap: theme.spacing.sm, backgroundColor: theme.colors.surface.subtle, borderRadius: theme.radius.card }}>
        <Text style={body}>{t(`support.status.${row.status}`)} · {row.id.slice(0, 8)}</Text><Text style={body}>{row.message}</Text>
        {row.staff_reply ? <Text testID="support-team-reply" style={body}>{t("support.reply", { reply: row.staff_reply })}</Text> : null}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
