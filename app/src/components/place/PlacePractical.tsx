import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeProvider";
import { getPlacePractical, type PlacePractical as Facts } from "../../lib/place-practical";
import { useContentRevision } from "../../lib/content-sync";

export function usePlacePractical(placeId?: string) {
  const revision = useContentRevision();
  const [facts,setFacts] = useState<Facts | null>(null);
  const [failed,setFailed] = useState(false);
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    if (placeId) void getPlacePractical(placeId).then(row => {if(current)setFacts(row);}).catch(() => {if(current)setFailed(true);});
    return () => { current=false; };
  },[placeId,revision,attempt]);
  return {facts:facts?.place_id === placeId ? facts : null, failed, retry:() => setAttempt(n=>n+1)};
}

export function PlacePractical({facts}: {facts:Facts|null}) {
  const {t} = useTranslation();
  const {spacing,colors,typography:{preset}} = useTheme();
  if (!facts) return null;
  return <View style={{gap:spacing.sm}}>
    {[[t("place.services_title"), facts.services], [t("place.payment_title"), facts.payment_methods]].map(([title, values]) =>
      Array.isArray(values) && values.length ? <View key={String(title)} style={{gap:spacing.xs}}>
        <Text accessibilityRole="header" style={{...preset.h3,color:colors.text.primary}}>{title}</Text>
        <Text style={{...preset.body,color:colors.text.secondary}}>{values.join(" · ")}</Text>
      </View> : null)}
    {facts.sources.length ? <View style={{gap:spacing.xs}}>
      <Text style={{...preset.overline,color:colors.text.secondary}}>{t("place.data_sources")}</Text>
      {facts.sources.map(source => <Text key={source.url + source.label} style={{...preset.caption,color:colors.text.secondary}}>{source.label} · {t("place.source_checked",{date:source.checked_on.split("-").reverse().join("/")})}</Text>)}
    </View> : null}
  </View>;
}
