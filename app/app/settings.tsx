// Phase 2 — Écran Paramètres (exigence Play Store + ARTCI).
// Suppression de compte in-app (obligatoire : app avec comptes + localisation
// background), opt-out du Guet sur l'appareil, accès réglages système,
// déconnexion. Liens légaux affichés dès que les URLs existent (juriste —
// HUMAN_TODO).

import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme, type Theme } from "../src/theme/ThemeProvider";
import { useSpawterStore } from "../src/store/spawter-store";
import { isGuetOptedOut, setGuetOptOut } from "../src/lib/guet";
import { unregisterPushToken } from "../src/lib/push-token";
import { requestAccountDeletion, isSupabaseConfigured } from "../src/lib/data-source";
import { track } from "../src/lib/analytics";

// URLs légales — vides tant que le juriste n'a pas livré (HUMAN_TODO.md).
// Une URL vide masque la ligne ; le code est prêt.
const CGU_URL = "";
const PRIVACY_URL = "";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const spawter = useSpawterStore((s) => s.spawter);
  const reset = useSpawterStore((s) => s.reset);

  const [guetOff, setGuetOff] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void isGuetOptedOut().then(setGuetOff);
  }, []);

  const onToggleGuet = (value: boolean) => {
    setGuetOff(value);
    void setGuetOptOut(value);
  };

  const signOut = async () => {
    // Feature 13 — retire le token push AVANT auth.signOut : la RLS DELETE de
    // push_tokens est owner-only, il faut encore la session. Best-effort (ne
    // throw jamais) — une row orpheline serait purgée par push-send
    // (DeviceNotRegistered). Couvre aussi la suppression de compte (ce même
    // signOut est appelé après requestAccountDeletion).
    await unregisterPushToken();
    if (isSupabaseConfigured) {
      try {
        const { supabase } = await import("../src/lib/supabase");
        await supabase.auth.signOut();
      } catch {
        // signOut réseau KO — le reset local suffit à sortir.
      }
    }
    reset();
    router.replace("/");
  };

  const onLogout = () => {
    track({ name: "auth_signed_out", properties: {} });
    void signOut();
  };

  const onDeleteAccount = () => {
    Alert.alert(
      t("settings.delete_title"),
      t("settings.delete_confirm_body"),
      [
        { text: t("settings.delete_cancel"), style: "cancel" },
        {
          text: t("settings.delete_confirm_cta"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              track({ name: "account_deletion_requested", properties: {} });
              const ok = await requestAccountDeletion();
              setDeleting(false);
              if (!ok) {
                Alert.alert(t("settings.delete_failed"));
                return;
              }
              await signOut();
            })();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.lg,
          }}
        >
          {t("settings.title")}
        </Text>

        {/* Le Guet */}
        <SectionTitle theme={theme} label={t("settings.section_guet")} />
        <Row theme={theme}>
          <View style={{ flex: 1, paddingRight: theme.spacing.base }}>
            <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
              {t("settings.guet_optout_label")}
            </Text>
            <Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>
              {t("settings.guet_optout_hint")}
            </Text>
          </View>
          <Switch
            testID="settings-guet-switch"
            value={guetOff}
            onValueChange={onToggleGuet}
            trackColor={{ true: theme.colors.brand.primary, false: undefined }}
          />
        </Row>
        <LinkRow
          theme={theme}
          label={t("settings.system_settings")}
          onPress={() => void Linking.openSettings()}
        />

        {/* Légal */}
        {CGU_URL || PRIVACY_URL ? (
          <SectionTitle theme={theme} label={t("settings.section_legal")} />
        ) : null}
        {CGU_URL ? (
          <LinkRow
            theme={theme}
            label={t("settings.cgu")}
            onPress={() => void Linking.openURL(CGU_URL)}
          />
        ) : null}
        {PRIVACY_URL ? (
          <LinkRow
            theme={theme}
            label={t("settings.privacy")}
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
        ) : null}

        {/* Compte */}
        <SectionTitle theme={theme} label={t("settings.section_account")} />
        {spawter ? (
          <Row theme={theme}>
            <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
              {spawter.display_name}
            </Text>
          </Row>
        ) : null}
        <LinkRow theme={theme} label={t("settings.logout")} onPress={onLogout} />
        <Pressable
          testID="settings-delete-account"
          accessibilityRole="button"
          disabled={deleting}
          onPress={onDeleteAccount}
          style={{
            paddingVertical: theme.spacing.base,
            marginTop: theme.spacing.lg,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.colors.state.danger,
            opacity: deleting ? 0.5 : 1,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.state.danger,
              textAlign: "center",
              fontWeight: "600",
            }}
          >
            {deleting ? t("settings.delete_in_progress") : t("settings.delete_title")}
          </Text>
        </Pressable>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            marginTop: theme.spacing.sm,
          }}
        >
          {t("settings.delete_legal_note")}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ theme, label }: { theme: Theme; label: string }) {
  return (
    <Text
      style={{
        ...theme.typography.preset.overline,
        color: theme.colors.text.secondary,
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
      }}
    >
      {label}
    </Text>
  );
}

function Row({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: theme.spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
      }}
    >
      {children}
    </View>
  );
}

function LinkRow({
  theme,
  label,
  onPress,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}
