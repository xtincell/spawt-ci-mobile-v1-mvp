import { View } from "react-native";
import { useFeatureFlagsStore } from "../store/feature-flags";
import { useTheme } from "../theme/ThemeProvider";
import { DataLoadNotice } from "./DataLoadNotice";

/** An unresolved remote flag is not a disabled feature. Keep the deep link
 * while loading, with a retry after an outage instead of discarding the route. */
export function FeatureLoading() {
  const theme = useTheme();
  const loading = useFeatureFlagsStore(s => s.loading);
  return <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "center", backgroundColor: theme.colors.surface.base }}>
    <DataLoadNotice loading={loading} failed={!loading} onRetry={() => {
      const store = useFeatureFlagsStore.getState();
      void store.hydrate(store.spawterId);
    }} />
  </View>;
}
