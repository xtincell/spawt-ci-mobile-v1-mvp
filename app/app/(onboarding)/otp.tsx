// Étape OTP — Story 2.3 (FR-001) + #V07 (MAJ consolidée 07/2026)
// 8 cases auto-advance + auto-submit au 8e chiffre.
// Phase mock : code universel `12345678` (aligné MOCK_OTP_CODE côté Edge
// otp-verify) — en démo locale ET en mock serveur. À la bascule SMS réel
// (Termii, pin 6 chiffres), repasser CELL_COUNT à 6 et retirer ce code.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Constants from "expo-constants";

import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { track } from "../../src/lib/analytics";
import { isSupabaseConfigured } from "../../src/lib/data-source";
import { supabase } from "../../src/lib/supabase";

const CELL_COUNT = 8;
const RESEND_COOLDOWN_S = 30;
const DEMO_CODE = "12345678";

// P11 — mask phone for analytics (`+225 XXXXXX 12` style) — pareil que phone.tsx.
// P-16 round 3 — Si le phone est trop court (deep-link malformé, troncation),
// on retourne `"REDACTED"` plutôt que le numéro en clair pour ne pas le leak
// dans les events analytics.
function maskPhone(p: string): string {
  if (p.length < 6) return "REDACTED";
  const head = p.slice(0, 4);
  const tail = p.slice(-2);
  return `${head} ${"X".repeat(Math.max(0, p.length - 6))} ${tail}`;
}

export default function OtpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; demo?: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  // D5 — gate strict : `?demo=1` n'est honoré QUE si le backend Supabase n'est
  // pas configuré. Empêche un deep-link prod de bypasser la session live.
  const demoMode = params.demo === "1" && !isSupabaseConfigured;
  const setDraftField = useOnboardingDraft((s) => s.setField);

  const refs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(CELL_COUNT).fill(""));
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const code = useMemo(() => digits.join(""), [digits]);
  const ready = code.length === CELL_COUNT;
  const friction = attempts >= 3;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // P-14 round 3 — Auto-submit doit lire les valeurs courantes de `friction` et
  // `submitting` ; sans deps, on lit la valeur stale au moment où `ready` passe
  // à true → l'auto-submit peut fire malgré friction=true si attempts atteint 3
  // entre setDigits et l'effet. `onSubmit` lui-même gate sur `submitting` au
  // début, mais le `friction` check doit être au runtime.
  useEffect(() => {
    if (!ready || submitting || friction) return;
    void onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, friction, submitting]);

  const onChangeCell = (index: number, value: string) => {
    // P-16 — supporte le paste de N digits : si la value contient plusieurs
    // chiffres, on les distribue à partir de cell[0] (pas de l'index courant)
    // pour éviter de clobber les premiers digits quand iOS auto-fill SMS dump
    // arrive dans une cellule au milieu.
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      const digitsPasted = clean.slice(0, CELL_COUNT).split("");
      setDigits((prev) => {
        const next = [...prev];
        for (let i = 0; i < digitsPasted.length && i < CELL_COUNT; i++) {
          const d = digitsPasted[i];
          if (typeof d === "string") next[i] = d;
        }
        return next;
      });
      const lastFilled = Math.min(digitsPasted.length - 1, CELL_COUNT - 1);
      refs.current[lastFilled]?.focus();
      return;
    }
    const ch = clean.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = ch;
      return next;
    });
    if (ch && index < CELL_COUNT - 1) refs.current[index + 1]?.focus();
  };

  const onKeyPress = (
    index: number,
    e: { nativeEvent: { key: string } },
  ) => {
    if (e.nativeEvent.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const reset = () => {
    setDigits(Array(CELL_COUNT).fill(""));
    refs.current[0]?.focus();
  };

  // P-13 — flag d'unmount + AbortControllers stables pour annuler tout fetch
  // en cours quand le composant unmount.
  // P-13 round 3 — Séparer submit vs resend : un tap rapide submit → resend
  // tuait le fetch précédent et confondait l'UX (les 2 set des erreurs
  // différentes). Chaque flow a maintenant son propre controller.
  const mountedRef = useRef(true);
  const submitAbortRef = useRef<AbortController | null>(null);
  const resendAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort();
      submitAbortRef.current = null;
      resendAbortRef.current?.abort();
      resendAbortRef.current = null;
    };
  }, []);

  const onSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // P-13 — abort un éventuel fetch submit précédent encore en vol.
    submitAbortRef.current?.abort();
    const abort = new AbortController();
    submitAbortRef.current = abort;

    try {
      if (demoMode) {
        if (code !== DEMO_CODE) {
          // P-12 round 3 — `submitting` gate empêche le double-tap ; simple
          // read+set suffit, le functional setter alambiqué (P-19 round 2) est
          // remplacé par cette forme directe et lisible.
          const nextAttempts = attempts + 1;
          setAttempts(nextAttempts);
          if (mountedRef.current) setError(t("auth.error_invalid_otp"));
          track({
            name: "auth_otp_validated",
            properties: { method: "phone", success: false, attempts: nextAttempts, demo: true },
          });
          reset();
          return;
        }
        setDraftField("phone_e164", phone);
        track({
          name: "auth_otp_validated",
          properties: { method: "phone", demo: true, success: true },
        });
        track({ name: "auth_signed_in", properties: { method: "phone", demo: true } });
        track({
          name: "onboarding_step_completed",
          properties: { step: "phone", step_index: 2 },
        });
        router.push("/(onboarding)/profile");
        return;
      }

      const url =
        Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
      const anonKey =
        Constants.expoConfig?.extra?.supabaseAnonKey ??
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const resp = await fetch(`${url}/functions/v1/otp-verify`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: anonKey ?? "",
          authorization: `Bearer ${anonKey ?? ""}`,
        },
        body: JSON.stringify({ phone_e164: phone, otp_code: code }),
        signal: abort.signal,
      });

      if (!mountedRef.current) return;

      if (resp.status === 401 || resp.status === 400) {
        // P-12 — distinguer les codes d'erreur côté UX. Le body est typé
        // `{error: "invalid_otp" | "no_pending_otp" | "otp_already_used" | ...}`.
        let serverError: string | null = null;
        try {
          const body = (await resp.clone().json()) as { error?: string };
          serverError = body.error ?? null;
        } catch {
          // ignore — fallback message générique.
        }
        // P-12 round 3 — simple read+set (gate `submitting` suffit).
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        const messageKey =
          serverError === "no_pending_otp"
            ? "auth.error_otp_expired"
            : serverError === "otp_already_used"
              ? "auth.error_otp_already_used"
              : "auth.error_invalid_otp";
        setError(t(messageKey));
        track({
          name: "auth_otp_validated",
          properties: { method: "phone", success: false, attempts: nextAttempts },
        });
        reset();
        return;
      }
      if (resp.status === 429) {
        setError(t("auth.error_rate_limited"));
        return;
      }
      if (!resp.ok) {
        setError(t("auth.error_network"));
        return;
      }

      // Story 2.3a AC #3 — lit les tokens server-issued et ouvre la session
      // Supabase Auth côté SDK. Sans ça, `spawter-store.finalizeOnboarding`
      // throw FINALIZE_NO_AUTH_USER en mode live (review D2).
      const body = (await resp.json()) as {
        access_token?: string;
        refresh_token?: string;
        user_id?: string;
      };
      if (!body.access_token || !body.refresh_token) {
        setError(t("auth.error_network"));
        return;
      }
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (sessionErr) {
        if (__DEV__) console.warn("[otp] setSession failed", sessionErr);
        setError(t("auth.error_network"));
        return;
      }

      setDraftField("phone_e164", phone);
      track({ name: "auth_otp_validated", properties: { method: "phone", success: true } });
      track({ name: "auth_signed_in", properties: { method: "phone" } });
      track({
        name: "onboarding_step_completed",
        properties: { step: "phone", step_index: 2 },
      });
      router.push("/(onboarding)/profile");
    } catch (err) {
      // AbortError suite à unmount → silence.
      if ((err as { name?: string })?.name === "AbortError") return;
      if (mountedRef.current) setError(t("auth.error_network"));
    } finally {
      // Ne pas reset l'abortRef si un autre call l'a déjà remplacé.
      if (submitAbortRef.current === abort) submitAbortRef.current = null;
      if (mountedRef.current) setSubmitting(false);
    }
  }, [attempts, code, demoMode, phone, router, setDraftField, submitting, t]);

  const onResend = useCallback(async () => {
    if (cooldown > 0) return;
    // P-15 round 3 — reset l'erreur précédente avant de relancer un envoi.
    setError(null);
    // P-11 + P-12 — track avec phone_masked + call effectif otp-send en live.
    track({
      name: "auth_otp_sent",
      properties: {
        phone_masked: maskPhone(phone),
        resend: true,
        ...(demoMode ? { demo: true } : {}),
      },
    });
    if (demoMode) {
      // P-14 — en démo, cooldown immédiat (pas de réseau à attendre).
      setCooldown(RESEND_COOLDOWN_S);
      // P-17 — reset attempts pour ne pas garder la friction post-resend.
      setAttempts(0);
      reset();
      return;
    }
    // P-15 — AbortController dédié resend pour ne pas tuer un submit en vol.
    resendAbortRef.current?.abort();
    const abort = new AbortController();
    resendAbortRef.current = abort;
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
      // P-14 — cooldown SEULEMENT après ok ; en cas d'échec, ne pas bloquer.
      if (resp.ok) {
        setCooldown(RESEND_COOLDOWN_S);
        // P-17 — reset attempts pour ne pas garder la friction post-resend.
        setAttempts(0);
        reset();
      } else if (resp.status === 429) {
        setError(t("auth.error_rate_limited"));
      } else {
        setError(t("auth.error_network"));
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (__DEV__) console.warn("[otp] resend fetch failed", err);
      if (mountedRef.current) setError(t("auth.error_network"));
    } finally {
      if (resendAbortRef.current === abort) resendAbortRef.current = null;
    }
  }, [cooldown, demoMode, phone, t]);

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
          {t("auth.otp_title")}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.secondary,
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("auth.otp_body")}
        </Text>

        <View style={{ flexDirection: "row", gap: theme.spacing.xs, justifyContent: "center" }}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChangeText={(v) => onChangeCell(i, v)}
              onKeyPress={(e) => onKeyPress(i, e)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={i === 0}
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === "android" ? "sms-otp" : undefined}
              testID={`otp-cell-${i}`}
              // 8 cases doivent tenir sur un écran 360dp : cases fluides
              // (flex) bornées à 44dp, au lieu d'une largeur fixe.
              // minWidth 0 : sur web, min-width:auto des flex items bloque le
              // rétrécissement des <input> → débordement ; sans effet sur Yoga.
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: 44,
                height: 52,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface.raised,
                color: theme.colors.text.primary,
                fontSize: theme.typography.size.xl,
                textAlign: "center",
              }}
            />
          ))}
        </View>

        {demoMode ? (
          <Text
            style={{
              marginTop: theme.spacing.base,
              textAlign: "center",
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.size.sm,
            }}
          >
            {t("auth.otp_demo_hint")}
          </Text>
        ) : null}

        {error ? (
          <Text
            style={{
              marginTop: theme.spacing.sm,
              textAlign: "center",
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
            }}
          >
            {error}
          </Text>
        ) : null}

        {/* AC #6 (Story 2.3a) — quand friction, Resend + Change phone sont
            rendus DANS le panneau pour matcher la spec Story 2.3 AC #2. */}
        {(() => {
          const actions = (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: theme.spacing.lg,
              }}
            >
              <Pressable
                onPress={onResend}
                disabled={cooldown > 0}
                testID="otp-resend"
                accessibilityRole="button"
                accessibilityState={{ disabled: cooldown > 0 }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color:
                      cooldown > 0 ? theme.colors.text.tertiary : theme.colors.brand.accent,
                    textDecorationLine: "underline",
                  }}
                >
                  {cooldown > 0
                    ? t("auth.otp_resend_cooldown", { seconds: cooldown })
                    : t("auth.otp_resend")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.back()}
                testID="otp-change-phone"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.brand.accent,
                    textDecorationLine: "underline",
                  }}
                >
                  {t("auth.otp_change_phone")}
                </Text>
              </Pressable>
            </View>
          );

          if (friction) {
            return (
              <View
                testID="otp-friction"
                style={{
                  marginTop: theme.spacing.lg,
                  padding: theme.spacing.base,
                  backgroundColor: theme.colors.surface.subtle,
                  borderRadius: theme.radius.lg,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.h3,
                    color: theme.colors.text.primary,
                  }}
                >
                  {t("auth.otp_friction_title")}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.secondary,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  {t("auth.otp_friction_body")}
                </Text>
                {actions}
              </View>
            );
          }

          return actions;
        })()}
      </View>
    </KeyboardAvoidingView>
  );
}
