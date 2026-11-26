import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { getPlacePractical, type PlacePractical } from "../../lib/place-practical";
import { useContentRevision } from "../../lib/content-sync";
import { DataLoadNotice } from "../DataLoadNotice";
import { Ico } from "../primitives/Ico";

export function PlacePractical({ placeId }: { placeId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const revision = useContentRevision();
  const [row, setRow] = useState<PlacePractical | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    setRow(null);
    setFailed(false);
    setExpanded(false);
    void getPlacePractical(placeId).then(value => { if (active) setRow(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [placeId, revision, attempt]);
  if (!row || row.place_id !== placeId) return failed
    ? <DataLoadNotice loading={false} failed onRetry={() => setAttempt(n => n + 1)} /> : null;

  const { sources, services, payment_methods: payments } = row;
  const menuSources = sources.filter(s => s.fields.includes("menu_urls"));
  const links = [
    ...(row.website_url ? [{label: t("place.official_site"), url: row.website_url}] : []),
    ...menuSources,
    ...(row.contact_email ? [{label: row.contact_email, url: "mailto:" + row.contact_email}] : []),
    ...row.social_links,
    ...(row.google_maps_url ? [{label: t("place.maps_listing"), url: row.google_maps_url}] : []),
  ];
  if (!row.official_description && !links.length && !sources.length && !services.length && !payments.length) return null;
  const open = (url: string) => { void Linking.openURL(url).catch(() => Alert.alert(t("place.link_failed"))); };
  const body = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  const caption = { ...theme.typography.preset.small, color: theme.colors.text.secondary };
  return <View testID="place-practical" style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
    <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("place.practical_title")}</Text>
    {row.official_description ? <Text style={body}>{row.official_description}</Text> : null}
    {[[t("place.services_title"), services], [t("place.payment_title"), payments]].map(([title, values]) =>
      Array.isArray(values) && values.length ? <View key={String(title)} style={{ gap: 4 }}>
        <Text style={caption}>{title}</Text><Text style={body}>{values.join(" · ")}</Text>
      </View> : null)}
    {links.map(link => <Pressable key={link.url} accessibilityRole="link" onPress={() => open(link.url)}
      style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 44, borderBottomWidth: 1, borderColor: theme.colors.border.subtle }}>
      <Text style={{ ...body, color: theme.colors.brand.accent, flex: 1 }}>{link.label}</Text>
      <Ico name="arrow-right" size={16}/>
    </Pressable>)}
    {sources.length ? <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={() => setExpanded(v => !v)}
      style={{ flexDirection: "row", gap: theme.spacing.xs, alignItems: "center", minHeight: 44 }}>
      <Ico name="check" size={16}/><Text style={caption}>{t("place.data_sources")}</Text>
      <Ico name={expanded ? "arrow-up" : "chevron-down"} size={14}/>
    </Pressable> : null}
    {expanded ? sources.map(s => <Pressable accessibilityRole="link" key={s.url} onPress={() => open(s.url)}
      style={{ paddingVertical: theme.spacing.sm, minHeight: 44 }}>
      <Text style={body}>{s.label}</Text><Text style={caption}>{t("place.source_checked", { date: s.checked_on.split("-").reverse().join("/") })}</Text>
    </Pressable>) : null}
  </View>;
}
