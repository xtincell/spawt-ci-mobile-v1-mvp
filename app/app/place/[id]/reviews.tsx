import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { Ico } from "../../../src/components/primitives/Ico";
import { subscribeReviewChanges } from "../../../src/lib/review-events";
import { LeChaReviewLink } from "../../../src/components/LeChaReviewLink";
import editorialReview from "../../../src/data/le-cha-review.json";
import { ReviewCard } from "../../../src/components/ReviewCard";
import { listReviewsForPlace, type PlaceReview, type ReviewPageOptions } from "../../../src/lib/data-source";

const PAGE_SIZE = 24;

export default function PlaceReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<ReviewPageOptions["order"]>("recent");
  const [rows, setRows] = useState<PlaceReview[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const queryKey = JSON.stringify([id, order, search, revision]);
  const lastQuery = useRef("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(timer);
  }, [input]);
  useEffect(() => subscribeReviewChanges(changed => { if (changed === id) setRevision(n => n + 1); }), [id]);
  useEffect(() => {
    let current = true;
    const changed = lastQuery.current !== queryKey;
    if (changed) {
      lastQuery.current = queryKey;
      setRows([]);
      setMore(false);
      if (offset !== 0) { setOffset(0); return; }
    }
    setLoading(true);
    setFailed(false);
    void listReviewsForPlace(id, PAGE_SIZE + 1, {offset, order, search}).then(result => {
      if (!current) return;
      const page = result.slice(0, PAGE_SIZE);
      setRows(previous => offset ? [...new Map([...previous, ...page].map(r => [r.id, r])).values()] : page);
      setMore(result.length > PAGE_SIZE);
    }).catch(() => { if (current) setFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, offset, order, search, queryKey, retry]);
  const actionText = { ...theme.typography.preset.body, color: theme.colors.brand.accent };
  const caption = { ...theme.typography.preset.small, color: theme.colors.text.secondary };
  return <SafeAreaView edges={["top","bottom"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
    <View style={{flexDirection: "row", gap: theme.spacing.sm, alignItems: "center", paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm}}>
      <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace({pathname:"/place/[id]",params:{id}})}
        accessibilityRole="button" accessibilityLabel={t("place.back")} style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}><Ico name="arrow-left"/></Pressable>
      <Text accessibilityRole="header" style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{t("place.reviews_all_title")}</Text>
    </View>
    <FlatList data={rows} keyExtractor={r => r.id} renderItem={({item}) => <ReviewCard review={item} theme={theme}/>}
      keyboardShouldPersistTaps="handled" contentContainerStyle={{padding: theme.spacing.lg, gap: theme.spacing.base}}
      ListHeaderComponent={<View style={{gap: theme.spacing.sm}}>
        {id === editorialReview.placeId && !search ? <LeChaReviewLink placeId={id}/> : null}
        <View style={{flexDirection: "row", alignItems: "center", paddingHorizontal: theme.spacing.sm, gap: theme.spacing.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface.raised, borderWidth: 1, borderColor: theme.colors.border.subtle}}>
          <Ico name="search" size={18}/><TextInput value={input} onChangeText={setInput} returnKeyType="search" maxLength={120}
            accessibilityLabel={t("place.reviews_search")} placeholder={t("place.reviews_search")} placeholderTextColor={theme.colors.text.secondary}
            style={{...theme.typography.preset.body, color: theme.colors.text.primary, flex: 1, minHeight: 48}}/>
        </View>
        <View style={{flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm}}>
          {(["recent","best"] as const).map(key => <Pressable key={key} accessibilityRole="button" accessibilityState={{selected: order === key}}
            onPress={() => setOrder(key)} style={{justifyContent: "center", minHeight: 44, paddingHorizontal: theme.spacing.base, borderRadius: theme.radius.lg,
              backgroundColor: order === key ? theme.colors.surface.subtle : theme.colors.surface.base}}>
            <Text style={order === key ? actionText : caption}>{t(key === "recent" ? "place.reviews_recent" : "place.reviews_best")}</Text>
          </Pressable>)}
        </View>
      </View>}
      ListFooterComponent={loading ? <ActivityIndicator accessibilityLabel={t("common.loading")} color={theme.colors.brand.primary}/> :
        failed ? <View><Text style={caption}>{t("place.reviews_error")}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)}
          style={{ minHeight: 44, justifyContent:"center" }}><Text style={actionText}>{t("common.retry")}</Text></Pressable></View> :
        more ? <Pressable accessibilityRole="button" onPress={() => setOffset(offset + PAGE_SIZE)} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={actionText}>{t("place.reviews_more")}</Text></Pressable> :
        !rows.length && (search || id !== editorialReview.placeId) ? <Text style={caption}>{t(search ? "place.reviews_no_match" : "place.reviews_empty")}</Text> : null}/>
  </SafeAreaView>;
}
