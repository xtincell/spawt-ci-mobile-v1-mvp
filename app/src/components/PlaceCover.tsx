import { useEffect, useState } from "react";
import {
  Image,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

/** Real cover first; an explicitly labelled, bundled illustration works offline too. */
export function PlaceCover({
  uri,
  compact = false,
  style,
}: {
  uri?: string | null | undefined;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const hasPhoto = Boolean(uri?.trim()) && !failed;
  return (
    <View
      style={[
        { overflow: "hidden", backgroundColor: theme.colors.surface.subtle },
        style,
      ]}
    >
      {hasPhoto ? (
        <Image
          source={{ uri: uri! }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <View
          accessible
          accessibilityLabel={t("place.photo_pending")}
          style={{ flex: 1 }}
        >
          <Image
            source={require("../../assets/placeholders/place-pending.jpg")}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              left: compact ? 0 : undefined,
              backgroundColor: theme.colors.surface.subtle,
              paddingHorizontal: 4,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                ...theme.typography.preset.small,
                textAlign: "center",
                color: theme.colors.text.secondary,
              }}
            >
              {t("place.photo_illustration")}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
