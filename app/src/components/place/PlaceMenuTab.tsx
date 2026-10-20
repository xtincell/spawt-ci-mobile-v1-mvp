// Refonte fiche lieu (R17 + R19) — onglet Menu.
//
// Grille 2 colonnes des photos du menu (`places.menu_urls`, migration 0030).
// Aucune URL → état vide élégant « Le menu arrive bientôt » (EmptyState).

import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import { EmptyState } from "../EmptyState";
import { Ico } from "../primitives/Ico";
import { resolveMenuUrls } from "../../lib/place-contributions";

interface Props {
  urls: readonly string[];
}

export function PlaceMenuTab({ urls }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const signature = JSON.stringify(urls);
  const [resolved, setResolved] = useState<string[]>([]);
  const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const hasStored = urls.some(u => u.startsWith("storage://"));
  useEffect(() => {
    if (!hasStored) return;
    let active = true; setResolved([]); setFailed(false);
    void resolveMenuUrls(JSON.parse(signature)).then(value => { if (active) setResolved(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [signature, hasStored, attempt]);
  const valid = hasStored ? resolved : urls.filter(u => /^https?:\/\//i.test(u));
  if (hasStored && !valid.length) return <View style={{ padding: theme.spacing.base }}><Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary }}>{t(failed ? "contribution.menu_failed" : "contribution.menu_loading")}</Text>{failed ? <Pressable accessibilityRole="button" onPress={() => setAttempt(a => a + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...theme.typography.preset.body, color: theme.colors.brand.accent }}>{t("common.retry")}</Text></Pressable> : null}</View>;

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
        <Pressable key={`menu-${idx}`} accessibilityRole="button" accessibilityLabel={t("contribution.menu_open")} onPress={() => setExpanded(url)} style={{ width: "48%" }}><MenuTile url={url} /></Pressable>
      ))}
      {expanded ? <Modal visible onRequestClose={() => setExpanded(null)} animationType="fade"><View style={{ flex: 1, backgroundColor: theme.colors.surface.base, paddingTop: theme.spacing["2xl"] }}><Pressable accessibilityRole="button" onPress={() => setExpanded(null)} style={{ padding: theme.spacing.lg, minHeight: 48 }}><Text style={{ ...theme.typography.preset.body, color: theme.colors.brand.accent }}>{t("contribution.menu_close")}</Text></Pressable><ScrollView maximumZoomScale={5} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1 }}><Image source={{ uri: expanded }} resizeMode="contain" style={{ width: "100%", height: 750 }} /></ScrollView></View></Modal> : null}
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
          width: "100%",
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
        width: "100%",
        aspectRatio: 3 / 4,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surface.subtle,
      }}
    />
  );
}
