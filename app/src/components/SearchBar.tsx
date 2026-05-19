// Story 3.5 — SearchBar canonique (UX spec §1329).
// Input arrondi r=24, fond surface.subtle, hauteur 44px, icon search à gauche
// + bouton clear à droite quand value non vide.

import { Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { Ico } from "./primitives/Ico";

interface Props {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  autoFocus,
  placeholder,
}: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface.subtle,
        borderRadius: 24,
        paddingHorizontal: theme.spacing.base,
        height: 44,
      }}
    >
      <Ico name="search" size={18} color={theme.colors.text.tertiary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={{
          flex: 1,
          marginLeft: theme.spacing.sm,
          fontFamily: theme.typography.family.body,
          fontSize: 14,
          color: theme.colors.text.primary,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange("")}
          accessibilityRole="button"
          accessibilityLabel={t("common.clear")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ico name="close" size={18} color={theme.colors.text.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}
