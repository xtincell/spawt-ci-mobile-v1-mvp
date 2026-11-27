import { SpotsMap } from "../../src/components/SpotsMap";

import { useLocalSearchParams } from "expo-router";

export default function CarteScreen() {
  const { lieu } = useLocalSearchParams<{ lieu?: string }>();
  return <SpotsMap key={lieu ?? "all"} focusId={lieu} />;
}
