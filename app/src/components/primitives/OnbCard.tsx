// OnbCard — primitive carte visuelle pour l'onboarding multi-select.
// Story 2.5 (UX kit `OnbCard`, midfi-screens-1.jsx §18-42).
// Sélection = bordure 2.5px brand.primary + halo gold subtle.

import { Pressable, Text, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

interface Props {
  label: string;
  sub?: string;
  /** ID stable pour key React — pas utilisé en styling. */
  altKey: string;
  selected: boolean;
  onToggle: () => void;
  testID?: string;
}

export function OnbCard({ label, sub, selected, onToggle, testID }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 80,
        minWidth: 120,
        flex: 1,
        backgroundColor: theme.colors.surface.raised,
        borderRadius: theme.radius.lg,
        borderWidth: selected ? 2.5 : 1,
        borderColor: selected ? theme.colors.brand.primary : theme.colors.border.subtle,
        padding: theme.spacing.base,
        justifyContent: "flex-end",
        ...(selected
          ? {
              shadowColor: theme.colors.brand.primary,
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            }
          : {}),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View>
        <Text
          style={{
            ...theme.typography.preset.body,
            color: theme.colors.text.primary,
            fontWeight: theme.typography.weight.semibold,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text
            style={{
              ...theme.typography.preset.caption,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.xs,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
