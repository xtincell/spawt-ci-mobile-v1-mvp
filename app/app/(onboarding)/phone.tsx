// Étape 1 onboarding — Numéro de téléphone (PRD §3.1 Feature 1)
// MODE DÉMO : on n'envoie pas de SMS OTP réel (Twilio/Termii pas câblé).
// Le numéro est stocké, le bouton "Continuer" simule la validation OTP.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";

export default function PhoneScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const setDraft = useOnboardingDraft((s) => s.setField);
  const initial = useOnboardingDraft((s) => s.draft.phone_e164);
  const [phone, setPhone] = useState<string>(initial ?? "+225");

  const valid = /^\+\d{8,15}$/.test(phone);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "center" }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size["2xl"],
            fontWeight: theme.typography.weight.bold,
            marginBottom: theme.spacing.sm,
          }}
        >
          {t("onboarding.phone_title")}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.base,
            marginBottom: theme.spacing.xl,
          }}
        >
          {t("onboarding.phone_body")}
        </Text>

        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoFocus
          placeholder={t("onboarding.phone_placeholder")}
          placeholderTextColor={theme.colors.text.tertiary}
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

        <Pressable
          disabled={!valid}
          onPress={() => {
            setDraft("phone_e164", phone);
            router.push("/(onboarding)/profile");
          }}
          style={({ pressed }) => ({
            marginTop: theme.spacing.xl,
            backgroundColor: valid ? theme.colors.brand.accent : theme.colors.border.subtle,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: valid ? theme.colors.text.onBrand : theme.colors.text.tertiary,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            {t("common.continue")}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
