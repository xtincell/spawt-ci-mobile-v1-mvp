// Étape OTP — Story 2.3 (FR-001)
// 6 cases auto-advance + auto-submit au 6e chiffre.
// Mode démo : code universel `123456`. Mode live : appel Edge `otp-verify`.

import { useEffect, useMemo, useRef, useState } from "react";
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

const CELL_COUNT = 6;
const RESEND_COOLDOWN_S = 30;
const DEMO_CODE = "123456";

export default function OtpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; demo?: string }>();
  const phone = typeof params.phone === "string" ? params.phone : "";
  const demoMode = params.demo === "1" || !isSupabaseConfigured;
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

  useEffect(() => {
    if (ready && !submitting && !friction) void onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const onChangeCell = (index: number, value: string) => {
    const ch = value.replace(/\D/g, "").slice(-1);
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

  const onSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (demoMode) {
        if (code !== DEMO_CODE) {
          setAttempts((a) => a + 1);
          setError(t("auth.error_invalid_otp"));
          track({
            name: "auth_otp_validated",
            properties: { method: "phone", success: false, attempts: attempts + 1, demo: true },
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
      });

      if (resp.status === 401 || resp.status === 400) {
        setAttempts((a) => a + 1);
        setError(t("auth.error_invalid_otp"));
        track({
          name: "auth_otp_validated",
          properties: { method: "phone", success: false, attempts: attempts + 1 },
        });
        reset();
        return;
      }
      if (!resp.ok) {
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
    } catch (_err) {
      setError(t("auth.error_network"));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = () => {
    if (cooldown > 0) return;
    setCooldown(RESEND_COOLDOWN_S);
    setAttempts(0);
    reset();
    track({
      name: "auth_otp_sent",
      properties: { phone_masked: phone, resend: true, demo: demoMode || undefined },
    });
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

        <View style={{ flexDirection: "row", gap: theme.spacing.sm, justifyContent: "center" }}>
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
              style={{
                width: 44,
                height: 56,
                borderWidth: 1,
                borderColor: theme.colors.border.subtle,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface.raised,
                color: theme.colors.text.primary,
                fontSize: theme.typography.size["2xl"],
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

        {friction ? (
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
          </View>
        ) : null}

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
                color: cooldown > 0 ? theme.colors.text.tertiary : theme.colors.brand.accent,
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
      </View>
    </KeyboardAvoidingView>
  );
}
