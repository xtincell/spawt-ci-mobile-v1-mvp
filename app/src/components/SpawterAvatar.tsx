import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

const MOKA = require("../../assets/mascots/moka-salut.png");

/** Un seul fallback Moka, quel que soit l'écran ou la taille de l'avatar. */
export function SpawterAvatar({ url, size = 32, testID, label, photoTestID }: {
  url: string | null | undefined; size?: number; testID?: string; label?: string; photoTestID?: string;
}) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <View testID={testID} accessibilityLabel={label} accessible={Boolean(label)}
    style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden",
      backgroundColor: theme.colors.surface.subtle }}>
    {url?.trim() && !failed ? <Image source={{ uri: url }} onError={() => setFailed(true)}
      testID={photoTestID ?? (testID ? `${testID}-photo` : undefined)} accessible={false}
      style={{ width: size, height: size }} resizeMode="cover" />
      : <Image source={MOKA} accessible={false} testID={testID ? `${testID}-moka` : undefined}
        resizeMode="contain" style={{ position: "absolute", width: size * 1.45, height: size * 1.98,
          left: -size * 0.225, top: -size * 0.03 }} />}
  </View>;
}
