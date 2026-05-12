// Voix du Chat — bulle qui parle dans l'app (PRD §9.3)
// Le ton change avec le stade : Touriste enjoué, Guide silencieux.

import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import type { Stade } from "../types/stade";
import { chatKey, isChatSilent, type ChatMoment } from "../lib/chat-voice";

interface Props {
  stade: Stade;
  moment: ChatMoment;
  /** Override : si fourni, remplace la string i18n */
  overrideText?: string;
}

export function ChatBubble({ stade, moment, overrideText }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const text = overrideText ?? t(chatKey(moment, stade));

  if (!overrideText && (isChatSilent(stade, moment) || !text || text === chatKey(moment, stade))) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface.subtle,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.base,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.brand.primary,
      }}
    >
      <Text
        style={{
          color: theme.colors.text.primary,
          fontSize: theme.typography.size.base,
          lineHeight: theme.typography.size.base * theme.typography.lineHeight.relaxed,
          fontStyle: "italic",
        }}
      >
        {text}
      </Text>
    </View>
  );
}
