import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { listEditorialReviews, type EditorialReview } from "../../lib/data-source";
import type { Place } from "../../types/place";
import { DataLoadNotice } from "../DataLoadNotice";

/** Only the public server projection is rendered. Private notes never reach this reader. */
export function PlaceEditorial({ place }: { place: Pick<Place, "id" | "editorial_profile"> }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<EditorialReview[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setReviews([]); setFailed(false);
    void listEditorialReviews(place.id).then(rows => {
      if (!cancelled) setReviews(rows);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [place.id, retry]);
  const doc = place.editorial_profile;
  if (!doc && !reviews.length && !failed) return null;
  const textStyle = { ...theme.typography.preset.body, color: theme.colors.text.primary };
  const titleStyle = { ...theme.typography.preset.h2, color: theme.colors.text.primary };
  return <View testID="place-editorial" style={{ padding: theme.spacing.base, gap: theme.spacing.base }}>
    {doc ? <>
      <Text accessibilityRole="header" style={titleStyle}>{t("editorial.title")}</Text>
      <Text style={textStyle}>{doc.identity}</Text>
      {(["specialties", "occasions", "budget_context", "service_context", "access_context"] as const).map(key => doc[key] ? <View key={key}>
        <Text accessibilityRole="header" style={titleStyle}>{t(`editorial.${key}`)}</Text>
        <Text style={textStyle}>{doc[key]}</Text>
      </View> : null)}
      {doc.sections.map((section, index) => <View key={index}>
        <Text accessibilityRole="header" style={titleStyle}>{section.title}</Text>
        <Text style={textStyle}>{section.body}</Text>
      </View>)}
      <Text style={textStyle}>{t("editorial.verified", { date: doc.verified_on })}</Text>
    </> : null}
    {reviews.length ? <Text accessibilityRole="header" style={titleStyle}>{t("editorial.reviews")}</Text> : null}
    {reviews.map(review => <View key={review.id}>
      <Text style={textStyle}>{t("editorial.visit", { name: review.display_name, date: review.visited_on })}</Text>
      <Text style={textStyle}>{review.body}</Text>
    </View>)}
    <DataLoadNotice loading={false} failed={failed} onRetry={() => setRetry(n => n + 1)} />
  </View>;
}
