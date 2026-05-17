// Étape Phone — Story 2.3 (FR-001)
// Envoie un OTP via Edge Function `otp-send` puis navigue vers /otp.
// Mode démo : pas d'appel réseau, navigation directe avec params.demo="1".
//
// Boutons Google + Apple : décrits AC #3-#4 mais REPORTÉS — les deps natives
// (`expo-apple-authentication`, `expo-auth-session`) ne sont pas encore
// installées. Le scaffold est prévu côté UI (placeholder) mais le câblage
// reviendra dans une story follow-up (voir deferred-work.md « Story 2.3 —
// Google/Apple Sign-In »).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { track } from "../../src/lib/analytics";
import { isSupabaseConfigured } from "../../src/lib/data-source";
import Constants from "expo-constants";

const CIV_MOBILE_RE = /^\+225(0[157]\d{8}|2\d{8})$/;
const FALLBACK_RE = /^\+\d{10,15}$/;

function maskPhone(p: string): string {
  if (p.length < 6) return p;
  const head = p.slice(0, 4);
  const tail = p.slice(-2);
  return `${head} ${"X".repeat(p.length - 6)} ${tail}`;
}

export default function PhoneScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const setDraftField = useOnboardingDraft((s) => s.setField);
  const initial = useOnboardingDraft((s) => s.draft.phone_e164);
  const [phone, setPhone] = useState<string>(initial && initial.length > 0 ? initial : "+225");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = CIV_MOBILE_RE.test(phone) || FALLBACK_RE.test(phone);

  const onSubmit = async () => {
    if (!valid || sending) return;
    setError(null);
    setDraftField("phone_e164", phone);

    if (!isSupabaseConfigured) {
      track({
        name: "auth_otp_sent",
        properties: { phone_masked: maskPhone(phone), demo: true },
      });
      router.push({
        pathname: "/(onboarding)/otp",
        params: { phone, demo: "1" },
      });
      return;
    }

    setSending(true);
    try {
      const url =
        Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey =
        Constants.expoConfig?.extra?.supabaseAnonKey ??
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const resp = await fetch(`${url}/functions/v1/otp-send`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey ?? "",
          authorization: `Bearer ${anonKey ?? ""}`,
        },
        body: JSON.stringify({ phone_e164: phone }),
      });
      if (resp.status === 429) {
        setError(t("auth.error_rate_limited"));
        return;
      }
      if (!resp.ok) {
        setError(t("auth.error_network"));
        return;
      }
      track({
        name: "auth_otp_sent",
        properties: { phone_masked: maskPhone(phone) },
      });
      router.push({
        pathname: "/(onboarding)/otp",
        params: { phone },
      });
    } catch (_err) {
      setError(t("auth.error_network"));
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text
          style={{
            ...theme.typography.preset.h1,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("auth.phone_title")}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("auth.phone_body")}
        </Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoFocus
          placeholder={t("auth.phone_placeholder")}
          placeholderTextColor={theme.colors.text.tertiary}
          testID="phone-input"
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            borderRadius: theme.radius.lg,
            padding: theme.spacing.base,
            color: theme.colors.text.primary,
            fontSize: theme.typography.size.lg,
            backgroundColor: theme.colors.surface.raised,
          }}
        />

        {error ? (
          <Text
            style={{
              marginTop: theme.spacing.sm,
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
            }}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          disabled={!valid || sending}
          onPress={() => void onSubmit()}
          testID="phone-send"
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid || sending }}
          style={({ pressed }) => ({
            marginTop: theme.spacing.xl,
            backgroundColor:
              valid && !sending ? theme.colors.brand.accent : theme.colors.border.subtle,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: valid && !sending && pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color:
                valid && !sending ? theme.colors.text.inverse : theme.colors.text.tertiary,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            {t("auth.send_otp")}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
