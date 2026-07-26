// Réservation 1-tap (migration 0042) — « Mes résas » : liste simple des
// demandes envoyées (lieu, groupe, créneau, statut). V1 lecture seule : la
// confirmation se joue hors app (WhatsApp), le statut évolue côté lieu/staff.
// Flag `reservation-1tap` OFF par défaut → redirect feed (pattern rapide).

import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../src/theme/ThemeProvider";
import { Ico } from "../src/components/primitives/Ico";
import { EmptyState } from "../src/components/EmptyState";
import { listMyReservations } from "../src/lib/data-source";
import type { ReservationRow } from "../src/lib/reservations";
import { useSpawterStore } from "../src/store/spawter-store";
import { useFlag } from "../src/store/feature-flags";

export default function ReservationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Hooks AVANT tout early return (leçon R22 — rules of hooks).
  const enabled = useFlag("reservation-1tap");
  const spawter = useSpawterStore((s) => s.spawter);
  const [rows, setRows] = useState<ReservationRow[]>([]);

  const spawterId = spawter?.id ?? null;
  useEffect(() => {
    if (!enabled || !spawterId) return;
    let cancelled = false;
    void listMyReservations(spawterId).then((list) => {
      if (!cancelled) setRows(list);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, spawterId]);

  if (!enabled || !spawter) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: theme.spacing.base,
          paddingVertical: theme.spacing.sm,
          gap: theme.spacing.base,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <Ico name="arrow-left" size={22} />
        </Pressable>
        <Text
          style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}
        >
          {t("resa.mine_title")}
        </Text>
      </View>

      {rows.length === 0 ? (
        <EmptyState
          icon="clock"
          title={t("resa.mine_empty_title")}
          body={t("resa.mine_empty_body")}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing["2xl"],
          }}
          renderItem={({ item }) => <ReservationLine row={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function ReservationLine({ row }: { row: ReservationRow }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const statusColor =
    row.status === "confirmed"
      ? theme.colors.state.success
      : row.status === "cancelled"
        ? theme.colors.state.danger
        : theme.colors.text.tertiary;

  const slotLabel = row.slot_at ? formatSlotFr(row.slot_at) : t("resa.slot_unset");

  return (
    <View
      testID={`resa-row-${row.id}`}
      style={{
        paddingVertical: theme.spacing.base,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.subtle,
        gap: theme.spacing.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: theme.spacing.base,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.preset.h3,
            color: theme.colors.text.primary,
            flex: 1,
          }}
        >
          {row.place_name.length > 0 ? row.place_name : t("resa.place_unknown")}
        </Text>
        <Text style={{ ...theme.typography.preset.caption, color: statusColor }}>
          {t(`resa.status_${row.status}`)}
        </Text>
      </View>
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
        {t("resa.line_party", { count: row.party_size })} · {slotLabel}
      </Text>
    </View>
  );
}

/** Créneau court fr — tolérant aux strings invalides (fixtures/DB). */
function formatSlotFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
