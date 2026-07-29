// Voix du Chat — composite domain qui résout (Stade × ChatMoment) → string i18n
// puis délègue le rendu visuel à la primitive canonique CatBubble (fond noir,
// coin 16/16/16/4 par défaut, CatIcon or). Cf. PRD §9.3 + ux-design-spec § "CatBubble".
//
// Wrapper-pattern : signature publique stable, callers (8 fichiers) inchangés.
// La prop `variant` (Story 2.1) est additive non-breaking — défaut `bubble`.
//
// Typo V1 : `preset.body` partout (Gotham-Book 14). L'AC #1 de Story 1.4
// mentionnait initialement une modulation `preset.h3` selon `moment` mais la
// décision review 2026-05-16 (Alexandre) a tranché pour `preset.body` uniforme
// jusqu'à l'introduction d'un mapping `(stade × moment) → typo` ultérieur
// (Epic 5 — célébrations de stade). AC #1 reformulé en conséquence.

import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { CatBubble, type CatBubbleVariant } from "./primitives/CatBubble";
import type { MokaPose } from "./brand/CatMark";
import { useTheme } from "../theme/ThemeProvider";
import type { Stade } from "../types/stade";
import { chatKey, isChatSilent, type ChatMoment } from "../lib/chat-voice";

// MAJ DS 07/2026 — une pose Moka (PNG) par scénario de la voix du Chat.
const MOMENT_POSE: Record<ChatMoment, MokaPose> = {
  welcome_first_open: "salut",
  welcome_back: "salut",
  post_calibration: "celebration",
  first_spawt_invite: "curieux",
  post_first_spawt: "merci",
  stade_up_explorateur: "celebration",
  stade_up_detective: "celebration",
  stade_up_djidji: "celebration",
  stade_up_guide: "gold",
  geoloc_consent_request: "carte",
  demographics_consent_request: "confiance",
  home_edito: "recommande",
  search_suggestions: "cherche",
  guet_prompt: "notification",
  // Chantier 13 archétypes — la mue est un constat neutre : pose "curieux",
  // surtout PAS "celebration" (exigence produit PRD §5.5).
  archetype_mue: "curieux",
};

interface Props {
  stade: Stade;
  moment: ChatMoment;
  /** Override : si fourni, remplace la string i18n */
  overrideText?: string;
  /** Forme visuelle déléguée à la primitive — défaut `bubble`. */
  variant?: CatBubbleVariant;
}

export function ChatBubble({ stade, moment, overrideText, variant = "bubble" }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const text = overrideText ?? t(chatKey(moment, stade));

  if (!overrideText && (isChatSilent(stade, moment) || !text || text === chatKey(moment, stade))) {
    return null;
  }

  // En lockscreen, on simule la notif système : max 2 lignes, ellipsize tail.
  const textProps =
    variant === "lockscreen"
      ? { numberOfLines: 2, ellipsizeMode: "tail" as const }
      : {};

  return (
    <CatBubble stage={stade} variant={variant} pose={MOMENT_POSE[moment]}>
      <Text
        {...textProps}
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
