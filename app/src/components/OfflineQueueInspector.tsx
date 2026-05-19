// Story 4.3 — Modal d'inspection de la queue offline.
// Accessible depuis (tabs)/profile.tsx → "Synchronisation des spawts".

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { flush, inspect, purge, type QueueEntry } from "../lib/offline-queue";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function OfflineQueueInspector({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [entries, setEntries] = useState<readonly QueueEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const list = await inspect();
    setEntries(list);
  }, []);

  useEffect(() => {
    if (visible) void reload();
  }, [visible, reload]);

  const handleSyncNow = async () => {
    setBusy(true);
    try {
      await flush();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handlePurge = () => {
    Alert.alert(
      t("offline_queue.purge"),
      t("offline_queue.purge_confirm", {
        count: entries.length,
        defaultValue: `Tu vas effacer ${entries.length} spawts non synchronisés, ils ne seront jamais envoyés.`,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("offline_queue.purge"),
          style: "destructive",
          onPress: async () => {
            await purge();
            await reload();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, backgroundColor: theme.colors.surface.base }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: theme.spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.subtle,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.primary,
              flex: 1,
            }}
          >
            {t("offline_queue.title")}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.brand.accent,
              }}
            >
              {t("common.cancel")}
            </Text>
          </Pressable>
        </View>

        {entries.length === 0 ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: theme.spacing.lg,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.secondary,
                textAlign: "center",
              }}
            >
              {t("offline_queue.empty")}
            </Text>
          </View>
        ) : (
          <FlatList
            data={entries as QueueEntry[]}
            keyExtractor={(e, i) => `${e.kind}-${i}-${e.enqueued_at}`}
            renderItem={({ item }) => (
              <View
                style={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.base,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border.subtle,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.preset.body,
                    color: theme.colors.text.primary,
                  }}
                >
                  {item.kind === "spawt_insert"
                    ? t("offline_queue.row_insert", {
                        place_id: item.row.place_id,
                        defaultValue: `Spawt ${item.row.place_id}`,
                      })
                    : t("offline_queue.row_update", {
                        row_id: item.row_id,
                        defaultValue: `Mise à jour ${item.row_id}`,
                      })}
                </Text>
                <Text
                  style={{
                    ...theme.typography.preset.small,
                    color: theme.colors.text.tertiary,
                  }}
                >
                  {item.enqueued_at} · attempts {item.attempts}
                </Text>
              </View>
            )}
          />
        )}

        <View
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.subtle,
          }}
        >
          <Pressable
            onPress={() => {
              void handleSyncNow();
            }}
            disabled={busy || entries.length === 0}
            style={({ pressed }) => ({
              backgroundColor: theme.colors.brand.accent,
              paddingVertical: theme.spacing.base,
              borderRadius: theme.radius.lg,
              opacity: busy || entries.length === 0 ? 0.4 : pressed ? 0.85 : 1,
              alignItems: "center",
            })}
          >
            <Text
              style={{
                ...theme.typography.preset.h3,
                color: theme.colors.text.inverse,
              }}
            >
              {t("offline_queue.sync_now")}
            </Text>
          </Pressable>
          {entries.length > 0 ? (
            <Pressable
              onPress={handlePurge}
              style={({ pressed }) => ({
                paddingVertical: theme.spacing.sm,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.state.danger,
                  textAlign: "center",
                }}
              >
                {t("offline_queue.purge")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
