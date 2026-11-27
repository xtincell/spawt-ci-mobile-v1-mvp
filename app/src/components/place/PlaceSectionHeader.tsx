import type { ReactNode } from "react";
import { useState } from "react";
import { Image, Text, View, type ImageSourcePropType } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { Ico, type IconName } from "../primitives/Ico";

interface Props {
  icon: IconName;
  title: string;
  eyebrow?: string;
  meta?: string;
  image?: ImageSourcePropType;
  action?: ReactNode;
}

/** Section cover shared by the five place views. */
export function PlaceSectionHeader({ icon, title, eyebrow, meta, image, action }: Props) {
  const { colors, spacing, radius, typography: { preset } } = useTheme();
  const [failed, setFailed] = useState<string>();
  const sourceKey = image ? JSON.stringify(image) : undefined;
  return <View style={{ backgroundColor: colors.chat.djidji, borderRadius: radius.lg, overflow: "hidden", flexDirection: "row", minHeight: 106 }}>
    <View style={{ flex: 1, minWidth: 0, padding: spacing.base, gap: spacing.xs, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <Ico name={icon} size={17} color={colors.surface.recommendation} />
        {eyebrow ? <Text numberOfLines={2} style={{ ...preset.overline, flexShrink: 1, color: colors.surface.recommendation }}>{eyebrow}</Text> : null}
      </View>
      <Text accessibilityRole="header" style={{ ...preset.h1, color: colors.text.inverse }}>{title}<Text accessible={false} style={{ color: colors.brand.primary }}>.</Text></Text>
      {meta ? <Text style={{ ...preset.small, color: colors.text.inverse }}>{meta}</Text> : null}
      {action}
    </View>
    {image && failed !== sourceKey ? <Image accessible={false} source={image} resizeMode="cover" onError={() => setFailed(sourceKey)} style={{ width: "27%", alignSelf: "stretch", height: "100%" }} /> : null}
  </View>;
}
