import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useContentRevision } from "../../src/lib/content-sync";
import { supabase } from "../../src/lib/supabase";
import { withReadTimeout } from "../../src/lib/data-read-error";
import { OutingActions } from "../../src/components/OutingActions";
import { MenuItemCard } from "../../src/components/MenuItemCard";
import { PlaceCover } from "../../src/components/PlaceCover";
import { useOutings } from "../../src/store/outings-store";
import { DataLoadNotice } from "../../src/components/DataLoadNotice";
interface Item { place_id: string; place_name: string; neighborhood: string; photo_url: string | null; menu_item_id: string | null; dish_name: string | null; price_xof: number | null; observed_on: string | null; }
interface List { title: string; items: Item[]; }
export default function SharedListScreen() {
  const { token } = useLocalSearchParams<{ token: string }>(); const router = useRouter();
  const theme = useTheme(); const { t } = useTranslation(); useOutings();
  const revision = useContentRevision(); const [attempt, setAttempt] = useState(0);
  const [list, setList] = useState<List | null>(null); const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false); setList(null);
    void (async () => { try {
      if (!/^[a-f0-9-]{36}$/i.test(token ?? "")) return;
      const { data, error } = await withReadTimeout("shared_list", signal => supabase.rpc("public_outing_list", { p_token: token }).abortSignal(signal));
      if (error) throw error; if (active) setList(data);
    } catch { if (active) setFailed(true); } finally { if (active) setLoading(false); } })();
    return () => { active = false; };
  }, [token, revision, attempt]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}><ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.base }}>
    <Pressable accessibilityRole="button" style={{ minHeight: 44 }} onPress={() => router.canGoBack() ? router.back() : router.replace("/")}><Text style={{ ...theme.typography.preset.body, color: theme.colors.brand.accent }}>{t("common.back")}</Text></Pressable>
    <Text style={{ ...theme.typography.preset.h1, color: theme.colors.text.primary }}>{list?.title ?? t("outings.shared")}</Text>
    <DataLoadNotice loading={loading} failed={failed} onRetry={() => setAttempt(n => n + 1)} />
    {!loading && !failed && !list ? <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>{t("outings.link_unavailable")}</Text> : null}
    {list?.items.map((item, index) => item.menu_item_id ? <MenuItemCard key={`${item.place_id}-${index}`} item={{ id: item.menu_item_id, name: item.dish_name ?? "", place_id: item.place_id, place_name: item.place_name, photo_url: item.photo_url, price_xof: item.price_xof, observed_on: item.observed_on ?? "", is_published: true }} visual /> : <View key={`${item.place_id}-${index}`} style={{ gap: theme.spacing.sm }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${item.place_id}` as never)}><PlaceCover uri={item.photo_url} style={{ height: 180, borderRadius: theme.radius.lg }} /><Text style={{ ...theme.typography.preset.h2, color: theme.colors.text.primary }}>{item.place_name}</Text><Text style={{ ...theme.typography.preset.small, color: theme.colors.text.secondary }}>{item.neighborhood}</Text></Pressable>
      <OutingActions placeId={item.place_id} />
    </View>)}
  </ScrollView></SafeAreaView>;
}
