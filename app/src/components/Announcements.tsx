import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useContentRevision } from "../lib/content-sync";
import { listAnnouncements, type Announcement } from "../lib/announcements";
import { DataLoadNotice } from "./DataLoadNotice";

export function Announcements({ compact = false, id }: { compact?: boolean; id?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const revision = useContentRevision();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void listAnnouncements(id).then(data => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [revision, retry, id]);
  const bodyStyle = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  return <View testID="announcements" style={{ padding: theme.spacing.lg, gap: theme.spacing.base }}>
    <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("announcements.title")}</Text>
    <DataLoadNotice loading={loading} failed={failed} onRetry={() => setRetry(n => n + 1)} />
    {!loading && !failed && rows.length === 0 ? <Text style={bodyStyle}>{t("announcements.empty")}</Text> : null}
    {(compact ? rows.slice(0, 3) : rows).map(row => <View key={row.id} style={{ padding: theme.spacing.base, gap: theme.spacing.sm, backgroundColor: theme.colors.surface.raised, borderRadius: theme.radius.card }}>
      <Text style={{ ...theme.typography.preset.overline, color: theme.colors.text.secondary }}>{t(`announcements.${row.kind}`)}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/actualites/${row.id}` as Href)}>
        <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.primary }}>{row.title}</Text>
      </Pressable>
      <Text style={bodyStyle} numberOfLines={compact ? 3 : undefined}>{row.body}</Text>
      {row.deep_link ? <Pressable accessibilityRole="button" onPress={() => router.push(row.deep_link as Href)} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ ...bodyStyle, color: theme.colors.brand.accent }}>{t("announcements.open")}</Text>
      </Pressable> : null}
    </View>)}
    {compact ? <Pressable accessibilityRole="button" onPress={() => router.push("/actualites" as Href)} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ ...bodyStyle, color: theme.colors.brand.accent }}>{t("announcements.all")}</Text>
    </Pressable> : null}
  </View>;
}
