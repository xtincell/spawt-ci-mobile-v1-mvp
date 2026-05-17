// Écran de consentement ARTCI bloquant — Story 2.2 (FR-040)
// Conformité Loi 2013-450 (PRD §20.7 + DR-ARTCI-02/03/04 + DR-CGV-01).
//
// Pattern « bloquant non-punitif » :
//   - 2 checkboxes non pré-cochées (CGU/CGV + données + géoloc).
//   - Bouton « Continuer » désactivé tant que les deux ne sont pas cochées.
//   - Pas de « plus tard », pas de « decline » individuel.
//   - CatBubble intro en ton Touriste — « explique sans gronder ».
//
// Aucun appel à expo-location.requestForegroundPermissionsAsync ici —
// le consentement applicatif précède la demande système iOS (Story 4.1).

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ChatBubble } from "../../src/components/ChatBubble";
import { Ico } from "../../src/components/primitives/Ico";
import { track } from "../../src/lib/analytics";
import { useOnboardingDraft } from "../../src/store/onboarding-draft";
import { useSpawterStore } from "../../src/store/spawter-store";

export default function ConsentScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [cgv, setCgv] = useState(false);
  const [geoloc, setGeoloc] = useState(false);

  useEffect(() => {
    track({ name: "consent_screen_viewed", properties: {} });
  }, []);

  const canContinue = cgv && geoloc;

  const onContinue = async () => {
    const now = new Date().toISOString();
    track({ name: "consent_recorded", properties: { kind: "cgv", decision: "accepted" } });
    track({ name: "consent_recorded", properties: { kind: "geoloc", decision: "accepted" } });
    track({
      name: "onboarding_step_completed",
      properties: { step: "consent", step_index: 1 },
    });

    useOnboardingDraft.getState().setConsent("cgv", now);
    useOnboardingDraft.getState().setConsent("geoloc", now);

    const hasSpawter = useSpawterStore.getState().spawter !== null;
    if (hasSpawter) {
      await useSpawterStore.getState().recordConsent("cgv", true);
      await useSpawterStore.getState().recordConsent("geoloc", true);
    }

    router.push("/(onboarding)/phone");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text
        style={{
          ...theme.typography.preset.h1,
          color: theme.colors.text.primary,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("consent.title")}
      </Text>

      <View style={{ marginBottom: theme.spacing.lg }}>
        <ChatBubble stade="touriste" moment="geoloc_consent_request" />
      </View>

      <ConsentCheckbox
        checked={cgv}
        onToggle={() => setCgv((v) => !v)}
        label={t("consent.cgv_label")}
        body={t("consent.cgv_body")}
        testID="consent-cgv"
      />

      <View style={{ height: theme.spacing.base }} />

      <ConsentCheckbox
        checked={geoloc}
        onToggle={() => setGeoloc((v) => !v)}
        label={t("consent.geoloc_label")}
        body={t("consent.geoloc_body")}
        testID="consent-geoloc"
      />

      <View
        style={{
          flexDirection: "row",
          marginTop: theme.spacing.xl,
          gap: theme.spacing.base,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          onPress={() => Linking.openURL("https://spawt.ci/privacy")}
          accessibilityRole="link"
        >
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.brand.accent,
              textDecorationLine: "underline",
            }}
          >
            {t("consent.policy_link")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL("https://spawt.ci/terms")}
          accessibilityRole="link"
        >
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.brand.accent,
              textDecorationLine: "underline",
            }}
          >
            {t("consent.terms_link")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canContinue }}
        disabled={!canContinue}
        onPress={() => void onContinue()}
        testID="consent-continue"
        style={({ pressed }) => ({
          marginTop: theme.spacing.xl,
          backgroundColor: canContinue
            ? theme.colors.brand.accent
            : theme.colors.border.subtle,
          paddingVertical: theme.spacing.base,
          borderRadius: theme.radius.lg,
          opacity: canContinue && pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: canContinue ? theme.colors.text.inverse : theme.colors.text.tertiary,
            fontSize: theme.typography.size.lg,
            fontWeight: theme.typography.weight.semibold,
            textAlign: "center",
          }}
        >
          {t("common.continue")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function ConsentCheckbox({
  checked,
  onToggle,
  label,
  body,
  testID,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  body: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      accessibilityHint={body}
      onPress={onToggle}
      hitSlop={8}
      testID={testID}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: theme.spacing.base,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surface.raised,
          borderWidth: 1,
          borderColor: theme.colors.border.subtle,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {checked ? <Ico name="check" size={18} color={theme.colors.brand.accent} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.caption,
            color: theme.colors.text.secondary,
            marginTop: theme.spacing.xs,
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          {body}
        </Text>
      </View>
    </Pressable>
  );
}
