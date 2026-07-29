// Refonte fiche lieu (R17 + R19) — onglet Menu.
//
// Grille 2 colonnes des photos du menu (`places.menu_urls`, migration 0030).
// Aucune URL → état vide élégant « Le menu arrive bientôt » (EmptyState).

import { useState } from "react";
import { Image, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { EmptyState } from "../EmptyState";
import { Ico } from "../primitives/Ico";

interface Props {
  urls: readonly string[];
}

export function PlaceMenuTab({ urls }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const valid = urls.filter((u) => typeof u === "string" && u.length > 0);

  if (valid.length === 0) {
    return (
      <View style={{ paddingVertical: theme.spacing.base }}>
        <EmptyState
          icon="camera"
          title={t("place.menu_empty_title")}
          body={t("place.menu_empty_body")}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: theme.spacing.lg,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
      }}
    >
      {valid.map((url, idx) => (
        <MenuTile key={`menu-${idx}`} url={url} />
      ))}
    </View>
  );
}

// Ratio portrait 3:4 — une page de menu photographiée est verticale.
// width 48% + gap sm ⇒ 2 colonnes sans calcul de layout manuel.
function MenuTile({ url }: { url: string }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View
        testID="menu-tile-placeholder"
        style={{
          width: "48%",
          aspectRatio: 3 / 4,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surface.subtle,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ico name="camera" size={28} color={theme.colors.text.tertiary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      style={{
        width: "48%",
        aspectRatio: 3 / 4,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
      }}
    />
  );
}
