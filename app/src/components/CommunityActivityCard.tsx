import { useState } from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { PlaceCover } from "./PlaceCover";
import { SpawterAvatar } from "./SpawterAvatar";
import { ReviewCard } from "./ReviewCard";
import { Ico } from "./primitives/Ico";
import { buildPlaceShareUrl } from "../lib/share-links";
import type { MeuteActivityItem } from "../lib/data-source";

export function CommunityActivityCard({ item }: { item: MeuteActivityItem }) {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const open = () => router.push(`/place/${item.place_id}`);
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const url = buildPlaceShareUrl(item.place_id);
      await Share.share({
        title: item.place_name,
        message: t("meute.share_message", { place: item.place_name, url }),
      });
    } catch {
      Alert.alert(t("meute.share_failed"));
    } finally {
      setSharing(false);
    }
  };
  const date = new Date(item.created_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return (
    <View
      testID={`community-${item.kind}-${item.id}`}
      style={{
        marginBottom: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border.subtle,
        borderRadius: theme.radius.card,
        padding: theme.spacing.base,
        backgroundColor:
          item.kind === "coup"
            ? theme.colors.surface.recommendation
            : theme.colors.surface.subtle,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: theme.spacing.xs,
          marginBottom: theme.spacing.sm,
        }}
      >
        <Ico
          name={item.kind === "coup" ? "heart" : "star"}
          size={16}
          color={theme.colors.brand.primary}
        />
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            flexShrink: 1,
          }}
        >
          {t(`meute.kind_${item.kind}`)}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.caption,
            color: theme.colors.text.secondary,
          }}
        >
          {date}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("meute.open_place", { place: item.place_name })}
        onPress={open}
        testID={`community-place-${item.id}`}
      >
        <PlaceCover
          uri={item.place_cover_photo_url}
          style={{ height: 136, borderRadius: theme.radius.md }}
        />
        <Text
          style={{
            ...theme.typography.preset.h2,
            color: theme.colors.text.primary,
            marginTop: theme.spacing.sm,
          }}
        >
          {item.place_name}
        </Text>
        <Text
          style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.secondary,
            marginVertical: theme.spacing.xs,
          }}
        >
          {item.place_neighborhood}
        </Text>
      </Pressable>
      {item.kind === "review" ? (
        <ReviewCard
          expandable
          theme={theme}
          review={{
            id: item.id,
            spawter_id: item.spawter_id ?? "",
            spawter_display_name: item.spawter_display_name,
            spawter_avatar_url: item.spawter_avatar_url,
            created_at: item.created_at,
            is_seed: false,
            note_etoiles: item.note_etoiles ?? 0,
            ...(item.note_globale !== undefined
              ? { note_globale: item.note_globale }
              : {}),
            note_cuisine: item.note_cuisine ?? null,
            note_cadre: item.note_cadre ?? null,
            note_service: item.note_service ?? null,
            texte_avis: item.texte_avis ?? null,
            photos: item.photos ?? [],
          }}
        />
      ) : (
        <View
          style={{
            flexDirection: "row",
            gap: theme.spacing.sm,
            alignItems: "center",
            paddingVertical: theme.spacing.sm,
          }}
        >
          <SpawterAvatar url={item.spawter_avatar_url} />
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
              flex: 1,
            }}
          >
            {t("meute.coup_author", { spawter: item.spawter_display_name })}
          </Text>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.spacing.base,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={open}
          style={{ minHeight: 44, justifyContent: "center", flexGrow: 1 }}
        >
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.primary,
            }}
          >
            {t("meute.see_place")}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={share}
          disabled={sharing}
          accessibilityState={{ disabled: sharing }}
          testID={`community-share-${item.id}`}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: theme.spacing.xs,
          }}
        >
          <Ico name="share" size={18} />
          <Text
            style={{
              ...theme.typography.preset.small,
              color: theme.colors.text.primary,
            }}
          >
            {t("meute.share")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
