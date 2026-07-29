// Mode Crew — picker de lieu pour proposer un spot au vote.
//
// Réutilise le moteur de recherche client-side (search.ts) sur listPlaces()
// + met les favoris du spawter en tête (proposer un favori = geste naturel).
// Modal autonome : charge son inventaire à l'ouverture, zéro dépendance à
// l'écran appelant au-delà du callback onSelect.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { Ico } from "../primitives/Ico";
import { listPlaces, type PlaceWithAdn } from "../../lib/data-source";
import { searchPlaces, EMPTY_FILTERS } from "../../lib/search";
import { DEMO_LAT, DEMO_LNG } from "../../lib/demo-constants";
import { useSpawterStore } from "../../store/spawter-store";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (place: { id: string; name: string; neighborhood: string }) => void;
  /** place_ids déjà en lice — grisés (UNIQUE session+place côté DB). */
  alreadyProposedIds: ReadonlySet<string>;
}

export function CrewPlacePicker({ visible, onClose, onSelect, alreadyProposedIds }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);

  const [query, setQuery] = useState("");
  const [inventory, setInventory] = useState<PlaceWithAdn[] | null>(null);

  useEffect(() => {
    if (!visible || inventory !== null) return;
    let cancelled = false;
    void listPlaces()
      .then((places) => {
        if (!cancelled) setInventory(places);
      })
      .catch(() => {
        if (!cancelled) setInventory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, inventory]);

  const results = useMemo(() => {
    if (!inventory) return [];
    const ctx = { spawter_lat: DEMO_LAT, spawter_lng: DEMO_LNG };
    const matched =
      query.trim().length > 0
        ? searchPlaces(inventory, query, EMPTY_FILTERS, ctx)
        : inventory;
    // Favoris en tête (tri stable — l'ordre de pertinence est préservé au sein
    // de chaque groupe).
    const favs = matched.filter((p) => savedPlaceIds.has(p.id));
    const rest = matched.filter((p) => !savedPlaceIds.has(p.id));
    return [...favs, ...rest];
  }, [inventory, query, savedPlaceIds]);

  const renderRow = (place: PlaceWithAdn) => {
    const proposed = alreadyProposedIds.has(place.id);
    const isFav = savedPlaceIds.has(place.id);
    return (
      <Pressable
        accessibilityRole="button"
        disabled={proposed}
        onPress={() =>
          onSelect({
            id: place.id,
            name: place.name,
            neighborhood: place.location.neighborhood,
          })
        }
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.subtle,
          opacity: proposed ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        {isFav ? (
          <Ico name="heart" size={16} color={theme.colors.brand.primary} />
        ) : (
          <Ico name="pin" size={16} color={theme.colors.text.tertiary} />
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
            }}
          >
            {place.name}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.secondary,
            }}
          >
            {place.location.neighborhood}
            {proposed ? ` · ${t("crew.already_proposed")}` : ""}
          </Text>
        </View>
        <Ico name="chevron-right" size={16} color={theme.colors.text.tertiary} />
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: theme.colors.overlay.modal,
        }}
      >
        <View
          style={{
            maxHeight: "85%",
            backgroundColor: theme.colors.surface.base,
            borderTopLeftRadius: theme.radius.card,
            borderTopRightRadius: theme.radius.card,
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.h2,
                color: theme.colors.text.primary,
              }}
            >
              {t("crew.picker_title")}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("crew.picker_close")}
              onPress={onClose}
              hitSlop={12}
            >
              <Ico name="close" size={20} color={theme.colors.text.primary} />
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("crew.picker_search_placeholder")}
            placeholderTextColor={theme.colors.text.tertiary}
            autoCorrect={false}
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.primary,
              borderWidth: 1,
              borderColor: theme.colors.border.strong,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.surface.raised,
            }}
          />

          {inventory === null ? (
            <ActivityIndicator color={theme.colors.brand.primary} />
          ) : results.length === 0 ? (
            <Text
              style={{
                ...theme.typography.preset.small,
                color: theme.colors.text.secondary,
                paddingVertical: theme.spacing.lg,
              }}
            >
              {t("crew.picker_empty")}
            </Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(p) => p.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => renderRow(item)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
