import { useRef, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSpawterStore } from "../store/spawter-store";
import { startManualReview } from "./manual-review";
import type { SpawterPosition } from "./use-spawter-position";

export function usePlaceReviewAction(placeId: string, placeName: string, position: SpawterPosition, signals?: readonly string[]) {
  const router = useRouter();
  const { t } = useTranslation();
  const lock = useRef(false);
  const [startingReview, setStarting] = useState(false);
  const handleSpawt = async () => {
    if (lock.current) return;
    const { spawter, spawts, registerSpawt } = useSpawterStore.getState();
    if (!spawter) {
      Alert.alert(t("place.spawter_required_title"), t("place.spawter_required_body"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("place.spawter_required_cta"), onPress: () => router.replace("/") },
      ]);
      return;
    }
    lock.current = true;
    setStarting(true);
    try {
      const row = await startManualReview({
        spawterId: spawter.id, placeId, ...(signals && { placeSignals: signals }),
        lat: position.source === "gps" ? position.lat : null,
        lng: position.source === "gps" ? position.lng : null,
        spawts, register: registerSpawt,
      });
      router.push({ pathname: "/review/[spawt_id]", params: { spawt_id: row.id, entry: "place_detail", place_name: placeName } });
    } catch (error) {
      if (__DEV__) console.warn("[place] start review failed", error);
      Alert.alert(t("review.error_title"), t("review.start_failed"));
    } finally {
      lock.current = false;
      setStarting(false);
    }
  };
  return { startingReview, handleSpawt };
}
