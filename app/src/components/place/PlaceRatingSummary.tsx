import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { getPlaceReviewStats, type PlaceReviewStats } from "../../lib/place-practical";
import { useContentRevision } from "../../lib/content-sync";
import { subscribeReviewChanges } from "../../lib/review-events";
import { DataLoadNotice } from "../DataLoadNotice";
import { Ico } from "../primitives/Ico";

export function PlaceRatingSummary({ placeId }: { placeId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const contentRevision = useContentRevision();
  const [row, setRow] = useState<PlaceReviewStats | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => subscribeReviewChanges(id => { if (id === placeId) setRevision(n => n + 1); }), [placeId]);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setExpanded(false);
    void getPlaceReviewStats(placeId).then(value => { if (active) setRow(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [placeId, revision, contentRevision]);
  if (failed) return <DataLoadNotice loading={false} failed onRetry={() => setRevision(n => n + 1)} />;
  if (!row || row.place_id !== placeId || !row.review_count) return null;
  const body = {...theme.typography.preset.body, color: theme.colors.text.primary};
  const caption = {...theme.typography.preset.small, color: theme.colors.text.secondary};
  return <View style={{gap: theme.spacing.sm, paddingVertical: theme.spacing.sm}}>
    <Text style={body}>{t("place.bande_review_count", {count: row.review_count})}</Text>
    <View style={{flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm}}>
      {(["cuisine_avg", "cadre_avg", "service_avg"] as const).map(key => row[key] == null ? null :
        <View key={key} style={{ padding: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface.subtle }}>
          <Text style={caption}>{t("place." + key)}</Text><Text style={body}>{row[key].toLocaleString("fr-FR", {maximumFractionDigits: 1})}/5</Text>
        </View>)}
    </View>
    <Pressable onPress={() => setExpanded(v => !v)} accessibilityRole="button" accessibilityState={{expanded}}
      style={{ minHeight: 44, alignItems: "center", flexDirection: "row", gap: theme.spacing.sm }}>
      <Text style={caption}>{t("place.distribution")}</Text><Ico name={expanded ? "arrow-up" : "chevron-down"} size={14}/>
    </Pressable>
    {expanded && [...row.histogram].reverse().map((count, index) =>
      <View key={index} accessible accessibilityLabel={t("place.rating_bucket", {stars: 5-index, n: count})}
        style={{flexDirection: "row", alignItems: "center", gap: theme.spacing.sm}}>
        <Text style={caption}>{5-index} ★</Text>
        <View style={{flex: 1, height: 5, backgroundColor: theme.colors.surface.subtle, borderRadius: 3}}>
          <View style={{height: 5, width: `${Math.min(100, count / row.review_count * 100)}%`, borderRadius: 3, backgroundColor: theme.colors.brand.accent}}/>
        </View><Text style={caption}>{count}</Text>
      </View>)}
  </View>;
}
