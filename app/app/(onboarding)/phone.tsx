// Étape Phone — Story 2.3 (FR-001) + Story 2.3a (Google/Apple Sign-In)
// Envoie un OTP via Edge Function `otp-send` puis navigue vers /otp.
// Mode démo : pas d'appel réseau, navigation directe avec params.demo="1".
//
// Méthodes secondaires Google + Apple : rendues sous le bouton OTP primaire
// (Story 2.3a AC #1+#2). Apple iOS only via `isAvailableAsync()`.

import { useCallback, useEffect, useRef, useState } from "react";
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
import { GoogleButton } from "../../src/components/auth/GoogleButton";
import { AppleButton } from "../../src/components/auth/AppleButton";
import Constants from "expo-constants";

// P7 — CIV mobile numbers (post-2022 renumbering, ARTCI). Tous les opérateurs :
//   Orange : 07, 08, 09 ; MTN : 04, 05, 06 ; Moov : 01, 02, 03 — prefix `0[1-9]`.
//   `2X` : landlines Abidjan / autres zones (reste valide).
const CIV_MOBILE_RE = /^\+225(0[1-9]\d{8}|2\d{8})$/;
const FALLBACK_RE = /^\+\d{10,15}$/;
// P-20 — 30s avant de relâcher le CTA si le réseau ne répond pas.
const OTP_SEND_TIMEOUT_MS = 30_000;

// P-16 round 3 — Phone trop court → REDACTED plutôt que clear en analytics.
function maskPhone(p: string): string {
  if (p.length < 6) return "REDACTED";
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
  const [oauthError, setOauthError] = useState<string | null>(null);

  // P-21 — flag d'unmount + AbortController pour éviter setState après navigation.
  // P-17 round 3 — tracker aussi le timeoutId pour pouvoir le clear si l'user
  // tape rapidement 2× : sans ça, l'ancien setTimeout pouvait firer plus tard et
  // abort le nouveau fetch arbitrairement.
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const onOauthError = useCallback((key: string) => setOauthError(t(key)), [t]);

  const valid = CIV_MOBILE_RE.test(phone) || FALLBACK_RE.test(phone);

  const onSubmit = async () => {
    if (!valid || sending) return;
    setError(null);
    // P-18 — reset oauthError pour ne pas garder une erreur Google/Apple
    // périmée affichée pendant le flow OTP.
    setOauthError(null);
    setDraftField("phone_e164", phone);

    if (!isSupabaseConfigured) {
      // P-18 round 3 — gate via `sending` pour éviter le double-tap qui pousse
      // 2× vers /otp dans la même milliseconde.
      setSending(true);
      track({
        name: "auth_otp_sent",
        properties: { phone_masked: maskPhone(phone), demo: true },
      });
      router.push({
        pathname: "/(onboarding)/otp",
        params: { phone, demo: "1" },
      });
      // `setSending(false)` non nécessaire — composant unmount à la nav.
      return;
    }

    setSending(true);
    // P-20 + P-21 — abort previous + timeout 30s + mountedRef guards.
    abortRef.current?.abort();
    // P-17 round 3 — clear l'ancien timeout AVANT de créer le nouveau pour ne
    // pas laisser un timer orphelin qui aborterait le nouveau fetch.
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    const abort = new AbortController();
    abortRef.current = abort;
    const timeoutId = setTimeout(() => abort.abort(), OTP_SEND_TIMEOUT_MS);
    timeoutRef.current = timeoutId;
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
        signal: abort.signal,
      });
      if (!mountedRef.current) return;
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
      // Le serveur signale lui-même qu'aucun SMS n'est réellement parti : en
      // mode mock, `otp-send` renvoie un `request_id` préfixé « mock- ».
      // Sans ce relais, l'app promet un SMS qu'elle ne peut pas délivrer et
      // laisse attendre un code qui n'arrivera jamais — c'est exactement ce
      // qui s'est produit sur l'APK de recette.
      let mock = false;
      try {
        const corps = (await resp.clone().json()) as { request_id?: string };
        mock = String(corps?.request_id ?? "").startsWith("mock-");
      } catch {
        // Réponse sans corps exploitable : on n'affirme rien.
      }
      router.push({
        pathname: "/(onboarding)/otp",
        params: mock ? { phone, mock: "1" } : { phone },
      });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        // Soit unmount (silence), soit timeout (network).
        if (mountedRef.current) setError(t("auth.error_network"));
        return;
      }
      if (mountedRef.current) setError(t("auth.error_network"));
    } finally {
      clearTimeout(timeoutId);
      if (timeoutRef.current === timeoutId) timeoutRef.current = null;
      if (abortRef.current === abort) abortRef.current = null;
      if (mountedRef.current) setSending(false);
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

        {/* Story 2.3a AC #1+#2 — séparateur "Or" + méthodes secondaires.
            Google : tous OS via expo-auth-session (Expo Go compat).
            Apple  : iOS only, masqué sur Android par AppleButton interne. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: theme.spacing.xl,
            gap: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border.subtle }} />
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.size.sm,
            }}
          >
            {t("auth.or_separator")}
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border.subtle }} />
        </View>

        <GoogleButton onError={onOauthError} />
        <AppleButton onError={onOauthError} />

        {oauthError ? (
          <Text
            testID="phone-oauth-error"
            style={{
              marginTop: theme.spacing.sm,
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
              textAlign: "center",
            }}
          >
            {oauthError}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
