// Fiche lieu — PRD §3.1 Feature 4
// Affiche : nom, quartier, cuisine, ADN radar (si ≥5 avis), score, signaux,
// horaires, CTA "Spawter ici" (stub en mode démo).

import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import { AxisRadar } from "../../src/components/AxisRadar";
import { getPlace, type PlaceWithAdn } from "../../src/lib/data-source";
import { useSpawterStore } from "../../src/store/spawter-store";
import { ANTIFRAUD_RULES } from "../../src/types/spawt";

const SIGNAL_LABELS: Record<string, string> = {
  coup_de_coeur: "❤️ Coup de Cœur",
  pepite_verifiee: "💎 Pépite vérifiée",
  institution: "👑 Institution",
  fidelite: "🔁 Fidélité",
  decouverte: "🌱 Découverte",
  table_diverse: "🌍 Table diverse",
  noctambule_verifie: "🌙 Noctambule vérifié",
};

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();
  const [place, setPlace] = useState<PlaceWithAdn | null>(null);
  const [loading, setLoading] = useState(true);
  const registerSpawt = useSpawterStore((s) => s.registerSpawt);
  const spawter = useSpawterStore((s) => s.spawter);

  useEffect(() => {
    if (!id) return;
    void getPlace(id).then((p) => {
      setPlace(p);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (!place) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ color: theme.colors.text.secondary }}>Lieu introuvable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const adnReady = place.adn.confidence_score >= 0.3;

  const handleSpawt = async () => {
    if (!spawter) return;
    const now = new Date().toISOString();
    await registerSpawt({
      id: `spawt_${Date.now()}`,
      spawter_id: spawter.id,
      place_id: place.id,
      arrived_at: now,
      notified_at: now,
      snoozed_at: null,
      snooze_count: 0,
      checked_in_at: now,
      left_at: null,
      check_in_type: "manual", // mode démo : check-in manuel pour valider la mécanique
      session_duration_minutes: null,
      geolocation_lat: place.location.lat,
      geolocation_lng: place.location.lng,
      accuracy_meters: 0,
      geolocation_source: "manual",
      distance_to_lieu_meters: 0,
      is_verified: true,
      flag_reason: null,
      note_etoiles: null,
      texte_avis: null,
      tags: [],
      photos: [],
      is_cancelled: false,
      is_seed: false,
      created_at: now,
      updated_at: now,
    });
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: theme.spacing["3xl"] }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.colors.brand.accent, fontSize: theme.typography.size.base, marginBottom: theme.spacing.base }}>
            ← {t("common.back")}
          </Text>
        </Pressable>

        <Text
          style={{
            color: theme.colors.text.primary,
            fontSize: theme.typography.size["3xl"],
            fontWeight: theme.typography.weight.bold,
          }}
        >
          {place.name}
        </Text>
        <Text
          style={{
            color: theme.colors.text.secondary,
            fontSize: theme.typography.size.base,
            marginTop: 4,
            marginBottom: theme.spacing.lg,
          }}
        >
          {place.location.neighborhood} · {place.cuisine.join(" · ")}
        </Text>

        <View style={{ flexDirection: "row", gap: theme.spacing.sm, flexWrap: "wrap" }}>
          {place.signals.map((s) => (
            <Text
              key={s}
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.size.sm,
                backgroundColor: theme.colors.surface.subtle,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 4,
                borderRadius: theme.radius.full,
              }}
            >
              {SIGNAL_LABELS[s] ?? s}
            </Text>
          ))}
        </View>

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
              marginBottom: theme.spacing.xs,
            }}
          >
            ADN du lieu
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
              ? `${place.adn.total_reviews} avis · ★ ${place.adn.weighted_rating.toFixed(1)}`
              : "ADN en construction (peu d'avis)"}
          </Text>
          <AxisRadar
            axes={[
              { value: place.adn.axe_local_international, negLabel: "Local", posLabel: "International" },
              { value: place.adn.axe_informel_etabli, negLabel: "Informel", posLabel: "Établi" },
              { value: place.adn.axe_budget_premium, negLabel: "Budget", posLabel: "Premium" },
              { value: place.adn.axe_populaire_prive, negLabel: "Populaire", posLabel: "Privé" },
              { value: place.adn.axe_decontracte_habille, negLabel: "Décontracté", posLabel: "Habillé" },
            ]}
            underConstruction={!adnReady}
            underConstructionLabel={t("palais.underConstruction")}
          />
        </View>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <InfoLine label="Adresse" value={place.location.descriptive_address} theme={theme} />
          <InfoLine label="Horaires" value={`${place.hours.mon[0]?.open ?? "–"} – ${place.hours.mon[0]?.close ?? "–"}`} theme={theme} />
          {place.phone && <InfoLine label="Téléphone" value={place.phone} theme={theme} onPress={() => Linking.openURL(`tel:${place.phone}`)} />}
          {place.whatsapp && (
            <InfoLine
              label="WhatsApp"
              value={place.whatsapp}
              theme={theme}
              onPress={() => Linking.openURL(`https://wa.me/${place.whatsapp?.replace(/\D/g, "")}`)}
            />
          )}
        </View>

        <Pressable
          onPress={handleSpawt}
          style={({ pressed }) => ({
            marginTop: theme.spacing["2xl"],
            backgroundColor: theme.colors.brand.accent,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.lg,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.text.inverse,
              fontSize: theme.typography.size.lg,
              fontWeight: theme.typography.weight.semibold,
              textAlign: "center",
            }}
          >
            Je spawt ici (mode démo)
          </Text>
        </Pressable>
        <Text
          style={{
            color: theme.colors.text.tertiary,
            fontSize: theme.typography.size.xs,
            textAlign: "center",
            marginTop: theme.spacing.sm,
          }}
        >
          En live, Le Guet détecterait automatiquement ta présence
          (périmètre {ANTIFRAUD_RULES.GEOFENCE_RADIUS_METERS}m,
          attente {ANTIFRAUD_RULES.PRESENCE_THRESHOLD_MINUTES}min).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({
  label,
  value,
  theme,
  onPress,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  onPress?: () => void;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: theme.spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
      }}
    >
      <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.size.sm }}>{label}</Text>
      <Text
        style={{
          color: onPress ? theme.colors.brand.accent : theme.colors.text.primary,
          fontSize: theme.typography.size.sm,
          fontWeight: "500",
          flex: 1,
          textAlign: "right",
          marginLeft: 12,
        }}
      >
        {value}
      </Text>
    </Wrapper>
  );
}
