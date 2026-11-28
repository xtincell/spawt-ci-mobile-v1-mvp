import Constants from "expo-constants";
import { Platform } from "react-native";

export function isGuetAvailableForBuild(): boolean {
  return Platform.OS !== "android" || Constants.expoConfig?.extra?.androidBackgroundGuetEnabled !== false;
}
