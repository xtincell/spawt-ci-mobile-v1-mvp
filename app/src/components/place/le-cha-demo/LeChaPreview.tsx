import { useTheme } from "../../../theme/ThemeProvider";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { BackHandler, Platform, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";
import { useSpawterStore } from "../../../store/spawter-store";
import { useSpawterPosition } from "../../../lib/use-spawter-position";
import { buildPlaceShareUrl } from "../../../lib/share-links";
import { track } from "../../../lib/analytics";
import { usePlaceReviewAction } from "../../../lib/use-place-review-action";
import { usePlaceCoupDeCoeur } from "../../CoupDeCoeurButton";
import leCha from "../../../data/le-cha-review.json";
import { frameDocument, parsePreviewAction } from "./bridge";
import type { FrameHandle } from "./types";
import { PreviewFrame } from "./PreviewFrame";
import { leChaDocument } from "./document";

const id = leCha.placeId;
export default function LeChaPreview({ tab }: {tab?: string | undefined}) {
  const {colors} = useTheme();
  const html = useMemo(() => frameDocument(leChaDocument, tab), [tab]);
  const frame = useRef<FrameHandle>(null);
  const ready = useRef(false);
  const saving = useRef(false);
  const locateBusy = useRef(false);
  const { t } = useTranslation();
  const router = useRouter();
  const member = useSpawterStore(s => s.spawter?.id);
  const saved = useSpawterStore(s => s.savedPlaceIds.has(id));
  const toggleSaved = useSpawterStore(s => s.toggleSaved);
  const position = useSpawterPosition();
  const { handleSpawt } = usePlaceReviewAction(id, leCha.name, position);
  const heart = usePlaceCoupDeCoeur(id, undefined, Boolean(member));
  const state = useMemo(() => ({
    saved, member:Boolean(member), heart:Boolean(member && heart.connu && heart.given),
    remaining:member && heart.connu ? heart.remaining : null,
  }), [saved, member, heart.connu, heart.given, heart.remaining]);
  useEffect(() => { if (ready.current) frame.current?.send({type:"state", state}); }, [state]);
  useEffect(() => {
    if (heart.feedback && ready.current) frame.current?.send({type:"notice", title:"Coup de cœur", body:heart.feedback});
  }, [heart.feedback]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!ready.current) return false;
      frame.current?.send({type:"back"}); return true;
    });
    return () => sub.remove();
  }, []));
  const notice = (title: string, body: string) => frame.current?.send({type:"notice", title, body});
  async function locate() {
    if (locateBusy.current) return;
    locateBusy.current = true;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { frame.current?.send({type:"position", coords:null, denied:true}); return; }
      const {coords} = await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
      frame.current?.send({type:"position", coords:{latitude:coords.latitude, longitude:coords.longitude, accuracy:coords.accuracy ?? 0}, denied:false});
    } catch { frame.current?.send({type:"position", coords:null, denied:false}); }
    finally { locateBusy.current = false; }
  }
  async function share() {
    const url = buildPlaceShareUrl(id);
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({title:"Le Cha · SPAWT", url});
        else { await navigator.clipboard.writeText(url); notice("Partager Le Cha", "Le lien de la fiche a été copié."); }
      } else await Share.share({title:"Le Cha · SPAWT", message:"Le Cha · SPAWT\n" + url, url});
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") notice("Partager Le Cha", url);
    }
  }
  const action = (raw: unknown) => {
    const msg = parsePreviewAction(raw);
    if (!msg) return;
    switch (msg.action) {
      case "ready":
        ready.current = true; frame.current?.send({type:"state", state}); break;
      case "exit":
        if (router.canGoBack()) router.back(); else router.replace("/"); break;
      case "direct":
        router.replace({pathname:"/place/[id]", params:{id, vue:"direct"}}); break;
      case "reviews":
        router.push({pathname:"/place/[id]/reviews", params:{id}}); break;
      case "open-place":
        if (msg.place) router.push({pathname:"/place/[id]", params:{id:msg.place,ref:"direct"}}); break;
      case "locate": void locate(); break;
      case "share": void share(); break;
      case "spawt":
        if (member) void handleSpawt();
        else if (Platform.OS !== "web") void handleSpawt();
        else notice(t("place.spawter_required_title"), t("place.spawter_required_body"));
        break;
      case "save":
        if (!member) { notice("Enregistrer le lieu", "Connecte-toi à SPAWT pour retrouver Le Cha dans tes envies."); break; }
        if (saving.current) break;
        saving.current = true;
        void toggleSaved(id).then(added => track({name:added ? "place_saved" : "place_unsaved",properties:{place_id:id}}))
          .catch(() => notice("Enregistrer le lieu", t("saved.save_failed"))).finally(() => {saving.current = false;});
        break;
      case "heart":
        if (!member) notice("Coup de cœur", "Connecte-toi à SPAWT pour attribuer ton coup de cœur du mois.");
        else if (!heart.connu) notice("Coup de cœur", "Ton quota du mois est indisponible pour le moment.");
        else if (!heart.busy) void heart.onPress().catch(() => notice("Coup de cœur", t("cdc.error")));
        break;
    }
  };
  return <SafeAreaView edges={["top","bottom"]} style={{flex:1,backgroundColor:colors.surface.editorial}}>
    <PreviewFrame ref={frame} html={html} onAction={action}/>
  </SafeAreaView>;
}
