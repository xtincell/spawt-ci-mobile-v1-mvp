// Écran de consentement — Claude amendment 5.2 (cahier des charges Sprint 1)
// Conformité ARTCI / Loi 2013-450 (PRD §20.7) :
// - consentement explicite géoloc avant Feature 5 (check-in)
// - consentement collecte démographique (gender, age_range, origin_country)
// - liens politique de confidentialité + CGU
//
// Aucun appel à expo-location.requestForegroundPermissionsAsync ici —
// le consentement applicatif précède la demande système iOS.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useTheme } from "../../src/theme/ThemeProvider";

type ConsentDecision = "pending" | "accepted" | "declined";

export default function ConsentScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [geoloc, setGeoloc] = useState<ConsentDecision>("pending");
  const [demographics, setDemographics] = useState<ConsentDecision>("pending");

  const canContinue = geoloc !== "pending"; // demographics is optional

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size["2xl"],
          fontWeight: theme.typography.weight.bold,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.sm,
        }}
      >
        {t("consent.title")}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.typography.size.base,
          lineHeight: theme.typography.size.base * theme.typography.lineHeight.relaxed,
          marginBottom: theme.spacing.xl,
        }}
      >
        {t("consent.intro")}
      </Text>

      <ConsentCard
        title={t("consent.geoloc_title")}
        body={t("consent.geoloc_body")}
        acceptLabel={t("consent.geoloc_accept")}
        declineLabel={t("consent.geoloc_decline")}
        decision={geoloc}
        onAccept={() => setGeoloc("accepted")}
        onDecline={() => setGeoloc("declined")}
      />

      <View style={{ height: theme.spacing.lg }} />

      <ConsentCard
        title={t("consent.demographics_title")}
        body={t("consent.demographics_body")}
        acceptLabel={t("consent.demographics_accept")}
        declineLabel={t("consent.demographics_decline")}
        decision={demographics}
        onAccept={() => setDemographics("accepted")}
        onDecline={() => setDemographics("declined")}
      />

      <View style={{ flexDirection: "row", marginTop: theme.spacing.xl, gap: theme.spacing.base }}>
        <Pressable
          onPress={() => Linking.openURL("https://spawt.ci/privacy")}
          accessibilityRole="link"
        >
          <Text style={{ color: theme.colors.brand.accent, textDecorationLine: "underline" }}>
            {t("consent.policy_link")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL("https://spawt.ci/terms")}
          accessibilityRole="link"
        >
          <Text style={{ color: theme.colors.brand.accent, textDecorationLine: "underline" }}>
            {t("consent.terms_link")}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={!canContinue}
        onPress={() => router.push("/(onboarding)/phone")}
        style={({ pressed }) => ({
          marginTop: theme.spacing.xl,
          backgroundColor: canContinue
            ? theme.colors.brand.accent
            : theme.colors.border.subtle,
          paddingVertical: theme.spacing.base,
          borderRadius: theme.radius.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: canContinue ? theme.colors.text.onBrand : theme.colors.text.tertiary,
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

function ConsentCard({
  title,
  body,
  acceptLabel,
  declineLabel,
  decision,
  onAccept,
  onDecline,
}: {
  title: string;
  body: string;
  acceptLabel: string;
  declineLabel: string;
  decision: ConsentDecision;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.raised,
        padding: theme.spacing.base,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size.lg,
          fontWeight: theme.typography.weight.semibold,
          marginBottom: theme.spacing.xs,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: theme.colors.text.secondary,
          fontSize: theme.typography.size.sm,
          lineHeight: theme.typography.size.sm * theme.typography.lineHeight.relaxed,
          marginBottom: theme.spacing.base,
        }}
      >
        {body}
      </Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <ConsentButton
          label={acceptLabel}
          variant={decision === "accepted" ? "primary" : "ghost"}
          onPress={onAccept}
        />
        <ConsentButton
          label={declineLabel}
          variant={decision === "declined" ? "muted" : "ghost"}
          onPress={onDecline}
        />
      </View>
    </View>
  );
}

function ConsentButton({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: "primary" | "muted" | "ghost";
  onPress: () => void;
}) {
  const theme = useTheme();
  const bg =
    variant === "primary"
      ? theme.colors.brand.accent
      : variant === "muted"
        ? theme.colors.surface.subtle
        : "transparent";
  const fg =
    variant === "primary"
      ? theme.colors.text.onBrand
      : variant === "muted"
        ? theme.colors.text.tertiary
        : theme.colors.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.base,
        borderRadius: theme.radius.md,
        borderWidth: variant === "ghost" ? 1 : 0,
        borderColor: theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: fg,
          fontSize: theme.typography.size.sm,
          fontWeight: theme.typography.weight.medium,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
