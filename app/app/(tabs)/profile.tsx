// Story 5.3 — Profil spawter (refactor complet).
// PRD §3.1 FR-008 + §20.1 — identité avant utilité. SpawterCard flip 3D au centre.

import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { useTheme } from "../../src/theme/ThemeProvider";
import { SpawterCard } from "../../src/components/SpawterCard";
import { BuildBadge } from "../../src/components/primitives/BuildBadge";
import { ChatBubble } from "../../src/components/ChatBubble";
import { ArchetypeCard } from "../../src/components/profile/ArchetypeCard";
import { CollectionTitlesSection } from "../../src/components/profile/CollectionTitlesSection";
import { OfflineQueueInspector } from "../../src/components/OfflineQueueInspector";
import { useSpawterStore } from "../../src/store/spawter-store";
import { STADE_DESCRIPTORS } from "../../src/types/stade";
import { resetAll } from "../../src/lib/storage";
import { inspect } from "../../src/lib/offline-queue";
import { isEntitlementCurrentlyActive, portalAccountUrl } from "../../src/lib/spawter-gold";
import { compressAvatar, uploadAvatar } from "../../src/lib/storage-avatars";
import { isSupabaseConfigured } from "../../src/lib/data-source";
import { defaultTitleKeyForStade } from "../../src/lib/titres-catalogue";
import { isArchetypeKey } from "../../src/lib/archetype-engine";
import { ARCHETYPES } from "../../src/data/archetypes";
import { chatKey, isChatSilent } from "../../src/lib/chat-voice";
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
  // Chantier 13 archétypes — constat de mue en attente (neutre, PRD §5.5).
  const pendingMue = useSpawterStore((s) => s.pendingMue);
  const consumePendingMue = useSpawterStore((s) => s.consumePendingMue);
  // Sprint 2 — entitlement Gold réactif (revalidé par le store : hydratation,
  // foreground, paywall). Hook AVANT le early-return (rules of hooks).
  const goldEntitlement = useSpawterStore((s) => s.gold);

  // Le Chat au stade Guide se tait (isChatSilent) : le constat ne sera jamais
  // affichable — on l'acquitte silencieusement pour ne pas le laisser traîner.
  const stade = spawter?.stade ?? "touriste";
  const mueSilent = pendingMue !== null && isChatSilent(stade, "archetype_mue");
  useEffect(() => {
    if (mueSilent) void consumePendingMue();
  }, [mueSilent, consumePendingMue]);

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

  const isGold = isEntitlementCurrentlyActive(goldEntitlement);

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

        {/* Chantier 13 archétypes — constat de mue NEUTRE (PRD §5.5) : une
            bulle de Chat sobre + acquittement. Pas d'overlay, pas de fête. */}
        {pendingMue && !mueSilent
          ? (() => {
              const mueKey = chatKey("archetype_mue", spawter.stade);
              const text = t(mueKey, {
                archetype: t(ARCHETYPES[pendingMue.to].nameKey),
              });
              if (!text || text === mueKey) return null;
              return (
                <View style={{ gap: theme.spacing.sm }}>
                  <ChatBubble
                    stade={spawter.stade}
                    moment="archetype_mue"
                    overrideText={text}
                  />
                  <Pressable
                    onPress={() => void consumePendingMue()}
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.mue_ack")}
                    style={({ pressed }) => ({
                      alignSelf: "flex-end",
                      paddingVertical: theme.spacing.xs,
                      paddingHorizontal: theme.spacing.sm,
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <Text
                      style={{
                        ...theme.typography.preset.caption,
                        color: theme.colors.text.tertiary,
                      }}
                    >
                      {t("profile.mue_ack")}
                    </Text>
                  </Pressable>
                </View>
              );
            })()
          : null}

        <SpawterCard
          spawter={spawter}
          palais={palais}
          displayedTitleKey={displayedTitleKey}
          isGold={isGold}
          spawtsCount={spawter.total_spawts}
          savedCount={savedPlaceIds.size}
          onAvatarPress={onAvatarPress}
        />

        {/* Chantier 13 archétypes — carte d'identité (visuel + nom + code
            SPWT + rareté) + badge Pionnier n°X si héritage quiz. R8 : le
            radar reste interne, l'identité passe par cette carte. */}
        {isArchetypeKey(spawter.quiz_archetype) ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                ...theme.typography.preset.caption,
                color: theme.colors.text.tertiary,
              }}
            >
              {t("profile.archetype_section_title")}
            </Text>
            <ArchetypeCard
              archetypeKey={spawter.quiz_archetype}
              pionnierSeq={spawter.pionnier_seq}
            />
          </View>
        ) : null}

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

        {/* Sprint 2 — indicateur Gold discret (tokens or uniquement) + lien de
            gestion vers le portail /compte. Apple 3.1.3 : aucun achat in-app,
            aucun prix — l'abonnement se gère sur spawt.online. */}
        {isGold ? (
          <View
            testID="profile-gold-indicator"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.base,
              borderRadius: theme.radius.lg,
              borderWidth: 1,
              borderColor: theme.colors.brand.primary,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}
            >
              <View
                style={{
                  width: theme.spacing.sm,
                  height: theme.spacing.sm,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.brand.primary,
                }}
              />
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.brand.primary,
                }}
              >
                {t("profile.gold_indicator")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("profile.gold_manage")}
              onPress={() => {
                void Linking.openURL(portalAccountUrl());
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text
                style={{
                  ...theme.typography.preset.small,
                  color: theme.colors.text.secondary,
                }}
              >
                {t("profile.gold_manage")}
              </Text>
            </Pressable>
          </View>
        ) : null}

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
