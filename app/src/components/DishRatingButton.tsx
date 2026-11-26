import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useTheme } from "../theme/ThemeProvider";
import { readMenuItemRating, writeMenuItemRating } from "../lib/menu-item-ratings";
import { Ico } from "./primitives/Ico";

interface Props { owner?: string | undefined; dishId: string; name: string; published: boolean }
export function DishRatingButton({ owner, dishId, name, published }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"loading" | "ready" | "readingError" | "saving" | "writingError">("loading");
  const [saved, setSaved] = useState<number | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const request = useRef(0);
  const writing = useRef(false);
  function close() {
    if (writing.current) return;
    request.current += 1;
    setVisible(false);
  }
  async function open() {
    if (!owner) { router.push("/consent"); return; }
    const key = ++request.current;
    setVisible(true); setPhase("loading"); setSaved(null); setDraft(null);
    try {
      const current = await readMenuItemRating(owner, dishId);
      if (key !== request.current) return;
      setSaved(current); setDraft(current); setPhase("ready");
    } catch { if (key === request.current) setPhase("readingError"); }
  }
  async function save(value: number | null) {
    if (!owner || writing.current) return;
    writing.current = true; setPhase("saving");
    try {
      await writeMenuItemRating(owner, dishId, value);
      setSaved(value); setDraft(value); setVisible(false);
    } catch { setPhase("writingError"); }
    finally { writing.current = false; }
  }
  const active = phase === "ready" || phase === "writingError";
  const button = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: spacing.sm };
  return <>
    <Pressable testID={"dish-rating-" + dishId} accessibilityRole="button" onPress={() => void open()}
      accessibilityLabel={t("dish_rating.open_named", {name})}
      style={{ ...button, flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <Ico name="star" size={16} color={colors.brand.accent} />
      <Text style={{ ...preset.small, color: colors.brand.accent }}>{t("dish_rating.open")}</Text>
    </Pressable>
    {visible && <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay.modal }}>
        <SafeAreaView edges={["bottom"]} style={{ maxHeight: "92%", backgroundColor: colors.surface.raised,
          borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
          <ScrollView accessibilityViewIsModal contentContainerStyle={{ padding: spacing.lg, gap: spacing.base }}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...preset.overline, color: colors.brand.accent }}>{t("dish_rating.optional")}</Text>
                <Text accessibilityRole="header" style={{ ...preset.h2, color: colors.text.primary }}>{name}</Text>
              </View>
              <Pressable accessibilityLabel={t("common.close")} accessibilityRole="button" disabled={writing.current}
                onPress={close} style={{ ...button, minWidth: 44, alignItems: "center" }}><Ico name="close" /></Pressable>
            </View>
            {phase === "loading" ? <ActivityIndicator accessibilityLabel={t("common.loading")} color={colors.brand.accent} /> :
             phase === "readingError" ? <View><Text accessibilityRole="alert" style={{ ...preset.body, color: colors.text.primary }}>{t("dish_rating.read_error")}</Text>
             <Pressable accessibilityRole="button" onPress={() => void open()} style={button}><Text style={{...preset.body,color:colors.brand.accent}}>{t("common.retry")}</Text></Pressable></View> :
             <>
               {published && <View style={{flexDirection:"row", flexWrap:"wrap",gap:spacing.sm}}>
                 {[1,2,3,4,5].map(score => <Pressable key={score} testID={"dish-score-"+score} accessibilityRole="radio"
                   accessibilityState={{checked:draft===score,disabled:!active}} disabled={!active}
                   accessibilityLabel={t("dish_rating.score",{score})} onPress={() => setDraft(score)}
                   style={{ ...button, minWidth:44, alignItems:"center", borderWidth:1, borderColor: draft===score ? colors.brand.accent : colors.border.strong,
                     borderRadius:radius.md, backgroundColor:draft===score ? colors.brand.accent : colors.surface.raised }}>
                   <Text style={{...preset.body,color:draft===score?colors.text.inverse:colors.text.primary}}>{score}</Text>
                 </Pressable>)}
               </View>}
               {phase === "writingError" && <Text accessibilityRole="alert" style={{...preset.small,color:colors.state.danger}}>{t("dish_rating.write_error")}</Text>}
               <View style={{ flexDirection:"row", flexWrap:"wrap", gap:spacing.sm }}>
                 {published && <Pressable testID="dish-rating-save" accessibilityRole="button" disabled={!active || draft===null || draft===saved}
                   onPress={() => void save(draft)} style={{...button, borderRadius:radius.md, backgroundColor:colors.brand.accent, opacity:!active || draft===null || draft===saved ? .55 : 1}}>
                   <Text style={{...preset.body,color:colors.text.inverse}}>{t("dish_rating.save")}</Text>
                 </Pressable>}
                 {saved !== null && <Pressable testID="dish-rating-clear" accessibilityRole="button" disabled={!active} onPress={() => void save(null)} style={button}>
                   <Text style={{...preset.small,color:colors.text.secondary}}>{t("dish_rating.clear")}</Text>
                 </Pressable>}
                 {!published && saved===null && <Text style={{...preset.body,color:colors.text.secondary}}>{t("dish_rating.none")}</Text>}
               </View>
             </>}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>}
  </>;
}
