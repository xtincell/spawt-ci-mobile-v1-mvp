import { useCallback, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useSpawterStore } from "../store/spawter-store";
import { useFeatureFlagsStore } from "../store/feature-flags";
import { readGuetChoice, type GuetChoice } from "../lib/guet/guet-disclosure";
import { setAndroidGuetChoice } from "../lib/guet/guet-orchestrator";

export function AndroidGuetDisclosure({ placement }: { placement: "home" | "settings" }) {
  if (Platform.OS !== "android") return null;
  return <AndroidGuetControls placement={placement} />;
}

function AndroidGuetControls({ placement }: { placement: "home" | "settings" }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const profile = useSpawterStore(state => state.spawter);
  const userId = profile?.id;
  const enabled = useFeatureFlagsStore(
    state => state.spawterId === userId && Boolean(state.flags["guet-proximity-v2"]),
  );
  const [choice, setChoice] = useState<{ id: string; value: GuetChoice | null }>();
  const [dialogOwner, setDialogOwner] = useState<string>();
  const pending = useRef(false);
  // Prevent a transition between accounts from inheriting an old choice/dialog.
  const currentChoice = choice?.id === userId ? choice?.value : undefined;

  useFocusEffect(useCallback(() => {
    let current = true;
    setDialogOwner(undefined);
    if (userId) void readGuetChoice(userId).then(value => {
      if (current) setChoice({ id: userId, value });
    });
    return () => { current = false; };
  }, [userId]));

  const choose = async (activate: boolean) => {
    if (!userId || pending.current || (activate && dialogOwner !== userId)) return;
    pending.current = true;
    setDialogOwner(undefined);
    try {
      await setAndroidGuetChoice(userId, activate);
    } catch {
      if (useSpawterStore.getState().spawter?.id === userId) Alert.alert(t("guet_disclosure.save_failed"));
    } finally {
      const value = await readGuetChoice(userId);
      if (useSpawterStore.getState().spawter?.id === userId) setChoice({ id: userId, value });
      pending.current = false;
    }
  };

  const canActivate = enabled && Boolean(profile?.geoloc_consent_at);
  if (!userId || currentChoice === undefined) return null;
  if (placement === "home" && (!canActivate || currentChoice !== null)) return null;
  if (placement === "settings" && !canActivate && currentChoice !== "accepted") return null;

  const bodyStyle = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  const hintStyle = { ...theme.typography.preset.small, color: theme.colors.text.secondary };
  const actionStyle = { paddingVertical: theme.spacing.base, minHeight: 48, justifyContent: "center" as const };
  const home = placement === "home";
  const enabledChoice = currentChoice === "accepted";
  return (
    <View style={{ paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.surface.base }}>
      <Text style={{ ...bodyStyle, fontWeight: "700" }}>{t("guet_disclosure.title")}</Text>
      <Text style={hintStyle}>{t(home ? "guet_disclosure.intro" : "guet_disclosure.settings_hint")}</Text>
      {canActivate ? (
        <Pressable accessibilityRole="button" testID="guet-open-disclosure" style={actionStyle} onPress={() => setDialogOwner(userId)}>
          <Text style={{ ...bodyStyle, fontWeight: "700" }}>
            {t(enabledChoice ? "guet_disclosure.permissions" : "guet_disclosure.learn")}
          </Text>
        </Pressable>
      ) : null}
      {home || enabledChoice ? (
        <Pressable accessibilityRole="button" testID="guet-dismiss-or-disable" style={actionStyle} onPress={() => void choose(false)}>
          <Text style={hintStyle}>{t(home ? "guet_disclosure.later" : "guet_disclosure.disable")}</Text>
        </Pressable>
      ) : null}
      <Modal
        visible={canActivate && dialogOwner === userId}
        animationType="none"
        transparent
        onRequestClose={() => setDialogOwner(undefined)}
      >
        <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "center", padding: theme.spacing.lg, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ maxHeight: "88%", borderRadius: theme.radius.md, backgroundColor: theme.colors.surface.base }}>
            <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
              <Text accessibilityRole="header" style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{t("guet_disclosure.title")}</Text>
              <Text style={{ ...bodyStyle, marginVertical: theme.spacing.base }}>{t("guet_disclosure.android_body")}</Text>
              <Text style={hintStyle}>{t("guet_disclosure.optional")}</Text>
              <Pressable accessibilityRole="button" testID="guet-confirm-disclosure" style={actionStyle} onPress={() => void choose(true)}>
                <Text style={{ ...bodyStyle, fontWeight: "700" }}>{t("guet_disclosure.continue")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" testID="guet-cancel-disclosure" style={actionStyle} onPress={() => enabledChoice ? setDialogOwner(undefined) : void choose(false)}>
                <Text style={bodyStyle}>{t("guet_disclosure.later")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
