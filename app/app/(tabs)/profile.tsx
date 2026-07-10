// Story 5.3 — Profil spawter (refactor complet).
// PRD §3.1 FR-008 + §20.1 — identité avant utilité. SpawterCard flip 3D au centre.

import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { useTheme } from "../../src/theme/ThemeProvider";
import { SpawterCard } from "../../src/components/SpawterCard";
import { BuildBadge } from "../../src/components/primitives/BuildBadge";
import { CollectionTitlesSection } from "../../src/components/profile/CollectionTitlesSection";
import { OfflineQueueInspector } from "../../src/components/OfflineQueueInspector";
import { useSpawterStore } from "../../src/store/spawter-store";
import { STADE_DESCRIPTORS } from "../../src/types/stade";
import { resetAll } from "../../src/lib/storage";
import { inspect } from "../../src/lib/offline-queue";
import { isGoldSpawter } from "../../src/lib/spawter-gold";
import { compressAvatar, uploadAvatar } from "../../src/lib/storage-avatars";
import { isSupabaseConfigured } from "../../src/lib/data-source";
import { defaultTitleKeyForStade } from "../../src/lib/titres-catalogue";
import { track } from "../../src/lib/analytics";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const spawter = useSpawterStore((s) => s.spawter);
  const palais = useSpawterStore((s) => s.palais);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const collectionTitres = useSpawterStore((s) => s.collectionTitres);
  const setDisplayedTitle = useSpawterStore((s) => s.setDisplayedTitle);
  const clearDisplayedTitle = useSpawterStore((s) => s.clearDisplayedTitle);
  const updateAvatar = useSpawterStore((s) => s.updateAvatar);
  const reset = useSpawterStore((s) => s.reset);

  const [queueSize, setQueueSize] = useState(0);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const refreshQueueSize = useCallback(async () => {
    const list = await inspect();
    setQueueSize(list.length);
  }, []);
  useEffect(() => {
    void refreshQueueSize();
    const id = setInterval(() => {
      void refreshQueueSize();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshQueueSize]);

  useEffect(() => {
    track({ name: "profile_opened", properties: {} });
  }, []);

  if (!spawter || !palais) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: theme.spacing.lg,
          }}
        >
          <Text style={{ color: theme.colors.text.secondary }}>
            {t("profile.onboarding_pending")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGold = isGoldSpawter(spawter);

  // R27 — changement de photo de profil : galerie OU caméra (expo-image-picker),
  // crop carré natif (allowsEditing 1:1, affichage circulaire côté UI),
  // compression 512px, upload bucket Storage `avatars` (migration 0031),
  // update `spawters.avatar_url` local-first. Mode démo (pas de Supabase) :
  // l'URI locale compressée sert d'avatar.
  const pickAvatarFrom = async (source: "gallery" | "camera") => {
    try {
      const mod = await import("expo-image-picker");
      const ImagePicker = mod.default ?? mod;
      const perm =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("profile.avatar_permission_title"),
          t("profile.avatar_permission_body"),
        );
        return;
      }
      const pickerOptions = {
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 1,
      };
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result.canceled || !result.assets?.[0]) return;
      const compressed = await compressAvatar(result.assets[0].uri);
      const url = isSupabaseConfigured
        ? await uploadAvatar(compressed, spawter.id)
        : compressed;
      if (!url) {
        Alert.alert(t("profile.avatar_upload_failed"));
        return;
      }
      await updateAvatar(url);
      track({ name: "avatar_updated", properties: { source } });
    } catch (err) {
      if (__DEV__) console.warn("[profile] avatar change failed", err);
      Alert.alert(t("profile.avatar_upload_failed"));
    }
  };

  const onAvatarPress = () => {
    Alert.alert(t("profile.avatar_change_title"), undefined, [
      {
        text: t("profile.avatar_change_camera"),
        onPress: () => {
          void pickAvatarFrom("camera");
        },
      },
      {
        text: t("profile.avatar_change_gallery"),
        onPress: () => {
          void pickAvatarFrom("gallery");
        },
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };
  const displayedRow = collectionTitres.find((r) => r.is_displayed);
  const displayedTitleKey = displayedRow?.title_key ?? defaultTitleKeyForStade(spawter.stade);

  const stadeDesc = STADE_DESCRIPTORS[spawter.stade];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Text
          style={{
            ...theme.typography.preset.overline,
            color: theme.colors.text.tertiary,
          }}
        >
          {spawter.neighborhood ?? t("profile.neighborhood_unknown")}
        </Text>

        <SpawterCard
          spawter={spawter}
          palais={palais}
          displayedTitleKey={displayedTitleKey}
          isGold={isGold}
          spawtsCount={spawter.total_spawts}
          savedCount={savedPlaceIds.size}
          onAvatarPress={onAvatarPress}
        />

        <View
          style={{
            padding: theme.spacing.base,
            backgroundColor: theme.colors.surface.subtle,
            borderRadius: theme.radius.lg,
          }}
        >
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.tertiary,
            }}
          >
            {t("profile.stade_section_title")}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
              marginTop: theme.spacing.xs,
            }}
          >
            {stadeDesc.behavior}
          </Text>
        </View>

        <CollectionTitlesSection
          collectionTitres={collectionTitres}
          displayedTitleKey={displayedTitleKey}
          currentStade={spawter.stade}
          onSetDisplayed={(key) => {
            void setDisplayedTitle(key);
          }}
          onClearDisplayed={() => {
            void clearDisplayedTitle();
          }}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <QuickLink
            label={t("profile.link_saved")}
            count={savedPlaceIds.size}
            onPress={() => router.push("/saved" as never)}
          />
          <QuickLink
            label={t("profile.link_spawts")}
            count={spawter.total_spawts}
            onPress={() => Alert.alert(t("profile.link_spawts_stub"))}
          />
          <QuickLink
            label={t("profile.link_settings")}
            onPress={() => router.push("/settings" as never)}
          />
        </View>

        {queueSize > 0 ? (
          <Pressable
            onPress={() => setInspectorVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t("offline_queue.open_button")}
            style={({ pressed }) => ({
              padding: theme.spacing.base,
              backgroundColor: theme.colors.surface.subtle,
              borderRadius: theme.radius.lg,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                ...theme.typography.preset.body,
                color: theme.colors.text.primary,
              }}
            >
              {t("offline_queue.open_button")} · {queueSize}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={async () => {
            await resetAll();
            reset();
          }}
          style={({ pressed }) => ({
            paddingVertical: theme.spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: theme.colors.state.danger,
              ...theme.typography.preset.small,
              textAlign: "center",
            }}
          >
            {t("profile.reset_demo")}
          </Text>
        </Pressable>

        {/* Story 7.1 — surface in-app du build (À propos) pour bug reports. */}
        <BuildBadge />
      </ScrollView>
      <OfflineQueueInspector
        visible={inspectorVisible}
        onClose={() => {
          setInspectorVisible(false);
          void refreshQueueSize();
        }}
      />
    </SafeAreaView>
  );
}

function QuickLink({
  label,
  count,
  onPress,
}: {
  label: string;
  count?: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: theme.spacing.base,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>
        {label}
      </Text>
      {typeof count === "number" ? (
        <Text style={{ ...theme.typography.preset.data, color: theme.colors.brand.primary }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
