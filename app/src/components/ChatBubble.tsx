// Voix du Chat — composite domain qui résout (Stade × ChatMoment) → string i18n
// puis délègue le rendu visuel à la primitive canonique CatBubble (fond noir,
// coin 16/16/16/4, CatIcon or). Cf. PRD §9.3 + ux-design-spec § "CatBubble".
//
// Wrapper-pattern : signature publique stable, callers (8 fichiers) inchangés.
//
// Typo V1 : `preset.body` partout (Gotham-Book 14). L'AC #1 de Story 1.4
// mentionnait initialement une modulation `preset.h3` selon `moment` mais la
// décision review 2026-05-16 (Alexandre) a tranché pour `preset.body` uniforme
// jusqu'à l'introduction d'un mapping `(stade × moment) → typo` ultérieur
// (Epic 5 — célébrations de stade). AC #1 reformulé en conséquence.

import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { CatBubble } from "./primitives/CatBubble";
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
    <CatBubble stage={stade}>
      <Text
        style={{
          ...theme.typography.preset.body,
          color: theme.colors.text.inverse,
        }}
      >
        {text}
      </Text>
    </CatBubble>
  );
}
