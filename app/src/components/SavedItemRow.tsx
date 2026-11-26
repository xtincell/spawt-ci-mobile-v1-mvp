import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { PlaceCover } from "./PlaceCover";
import { Ico } from "./primitives/Ico";

interface SavedItemRowProps {
  testID: string;
  kind: "dish" | "place";
  title: string;
  context?: string | null;
  photo?: string | null;
  price?: string;
  note?: string;
  open: () => void;
  children: ReactNode;
}

export function SavedItemRow({ testID, kind, title, context, photo, price, note, open, children }: SavedItemRowProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const thumb = { width: 72, height: 72, borderRadius: radius.md };
  return <View testID={testID} style={{ borderWidth: 1, borderColor: colors.border.subtle,
    backgroundColor: colors.surface.raised, borderRadius: radius.lg, padding: spacing.sm }}>
    <Pressable accessibilityRole="button" accessibilityLabel={[title, context, price, note].filter(Boolean).join(". ")}
      onPress={open} style={({pressed}) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm,
        opacity: pressed ? .72 : 1, padding: spacing.xs })}>
      {photo ? <PlaceCover uri={photo} compact style={thumb} /> :
        <View accessible={false} style={{...thumb, backgroundColor: colors.surface.subtle,
          alignItems: "center", justifyContent: "center"}}><Ico name={kind === "dish" ? "fork" : "pin"} size={32} color={colors.brand.accent} /></View>}
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{...typography.preset.h3, color: colors.text.primary}}>{title}</Text>
        {context ? <Text style={{...typography.preset.small, color: colors.text.secondary}}>{context}</Text> : null}
        {price ? <Text style={{...typography.preset.small, color: colors.brand.accent, fontWeight: "700"}}>{price}</Text> : null}
      </View>
      <Ico name="chevron-right" size={16} color={colors.text.secondary} />
    </Pressable>
    {note ? <Text style={{...typography.preset.caption, color: colors.text.secondary, marginHorizontal: spacing.xs, marginVertical: spacing.xs}}>{note}</Text> : null}
    <View style={{ borderTopWidth: 1, borderColor: colors.border.subtle, marginTop: spacing.xs, paddingTop: spacing.xs }}>{children}</View>
  </View>;
}
