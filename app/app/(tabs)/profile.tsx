// Profil spawter — PRD §3.1 Feature 7
// Affiche : nom, stade, total spawts, radar Palais (5 axes en démo).

import { ScrollView, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ChatBubble } from "../../src/components/ChatBubble";
import { AxisRadar } from "../../src/components/AxisRadar";
import { useSpawterStore } from "../../src/store/spawter-store";
import { STADE_DESCRIPTORS } from "../../src/types/stade";
import { resetAll } from "../../src/lib/storage";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const spawter = useSpawterStore((s) => s.spawter);
  const palais = useSpawterStore((s) => s.palais);
  const reset = useSpawterStore((s) => s.reset);

  if (!spawter || !palais) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.text.secondary }}>Onboarding pas terminé.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stadeDesc = STADE_DESCRIPTORS[spawter.stade];
  const adnReady = palais.confidence_score >= 0.3;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size["2xl"],
            fontWeight: theme.typography.weight.bold,
          }}
        >
          {spawter.display_name}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.sm,
            marginTop: 2,
            marginBottom: theme.spacing.lg,
          }}
        >
          {spawter.neighborhood} · {t(`stade.${spawter.stade}`)} · {spawter.total_spawts} spawt
          {spawter.total_spawts !== 1 ? "s" : ""}
        </Text>

        <ChatBubble stade={spawter.stade} moment="post_calibration" />

        <View
          style={{
            marginTop: theme.spacing.xl,
            padding: theme.spacing.lg,
            backgroundColor: theme.colors.surface.raised,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border.subtle,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              marginBottom: theme.spacing.sm,
            }}
          >
            Ton Palais
          </Text>
          <Text
            style={{
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.size.xs,
              marginBottom: theme.spacing.base,
              fontStyle: adnReady ? "normal" : "italic",
            }}
          >
            {adnReady
              ? `Confidence ${Math.round(palais.confidence_score * 100)}%`
              : "En construction · spawt davantage pour le préciser"}
          </Text>
          <AxisRadar
            axes={[
              {
                value: palais.axe_racines_horizons,
                negLabel: t("axis.racines"),
                posLabel: t("axis.horizons"),
              },
              {
                value: palais.axe_taniere_nomade,
                negLabel: t("axis.taniere"),
                posLabel: t("axis.nomade"),
              },
              {
                value: palais.axe_exigeant_enthousiaste,
                negLabel: t("axis.exigeant"),
                posLabel: t("axis.enthousiaste"),
              },
              {
                value: palais.axe_foule_secret,
                negLabel: t("axis.foule"),
                posLabel: t("axis.secret"),
              },
              {
                value: palais.axe_maquis_table,
                negLabel: t("axis.maquis"),
                posLabel: t("axis.table"),
              },
            ]}
            underConstruction={!adnReady}
          />
        </View>

        <View
          style={{
            marginTop: theme.spacing.xl,
            padding: theme.spacing.base,
            backgroundColor: theme.colors.surface.subtle,
            borderRadius: theme.radius.lg,
          }}
        >
          <Text
            style={{
              color: theme.colors.text.secondary,
              fontSize: theme.typography.size.xs,
            }}
          >
            Stade actuel : <Text style={{ fontWeight: "700" }}>{stadeDesc.label}</Text>
            {"\n"}
            {stadeDesc.behavior}
          </Text>
        </View>

        <Pressable
          onPress={async () => {
            await resetAll();
            reset();
          }}
          style={({ pressed }) => ({
            marginTop: theme.spacing["2xl"],
            paddingVertical: theme.spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.state.danger,
              fontSize: theme.typography.size.sm,
              textAlign: "center",
            }}
          >
            Réinitialiser le compte (mode démo)
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
