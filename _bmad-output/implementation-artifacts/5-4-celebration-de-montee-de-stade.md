# Story 5.4: Célébration de montée de stade

Status: ready-for-dev

<!-- Story de clôture Epic 5 — moment quasi-rituel anti-Duolingo (Experience
Principle #5, PRD §9.3, project-context anti-patterns). Consomme Story 5.1
(event `stade_unlocked` + transition `spawter.stade`). Le ton du Chat évolue
dans les 24h (PRD §3.1 Feature 3) — V1 = `chat-voice.ts` mappe déjà via
`getCurrentTone(stade)` indirect (via `chatKey(moment, stade)` qui produit la
clé i18n du stade — la voix change instantanément à la transition `stade`).
Anti-replay : flag par stade dans AsyncStorage. Pattern Story 4.2 `pendingBadge`
réutilisé en `pendingCelebration`. -->

## Story

As a spawter,
I want vivre un moment marquant quand je monte de stade,
so that je ressens mon appartenance grandir dans la Meute — sans confettis, sans son ding, juste un instant de présence où le Chat me reconnaît différemment.

## ⚠️ Brownfield context — read first

État courant Story 5.4 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Detection franchissement seuil + event `stade_unlocked` | Story 5.1 dans `registerSpawt` | ✅ Story 5.1 livre la détection client + event analytics | **Consommer** — ajouter un transient state `pendingCelebration` set au même moment (pattern Story 4.2) |
| State `pendingBadge` (Premier Spawt) | [app/src/store/spawter-store.ts:50](../../app/src/store/spawter-store.ts#L50) | ✅ Pattern existant | **Réutiliser le pattern** — créer `pendingCelebration: PendingCelebration \| null` |
| Composant `BadgePremierSpawt` | [app/src/components/BadgePremierSpawt.tsx](../../app/src/components/BadgePremierSpawt.tsx) | ✅ Pattern Modal full-screen Reanimated fade | **S'inspirer** — `StadeCelebration` est cousin (même rituel, design plus poussé) |
| Voix Chat clés `chat.{stade}.stade_up_*` | [app/src/i18n/fr.json:285-352](../../app/src/i18n/fr.json#L285-L352) | ✅ 5 clés extraites (1 vraie + 4 vides par stade) — la source est le stade **source** de la montée | **Consommer** — `chatKey("stade_up_explorateur", from_stade)` ; les clés vides côté autres stades sont volontairement silencieuses |
| `chat-voice.ts` `CHAT_MOMENTS` | [app/src/lib/chat-voice.ts:26-44](../../app/src/lib/chat-voice.ts#L26-L44) | ✅ Inclut `stade_up_explorateur`, `stade_up_detective`, `stade_up_djidji`, `stade_up_guide` | **Consommer** — pas de modif |
| `isChatSilent(stade, moment)` | [app/src/lib/chat-voice.ts:55-57](../../app/src/lib/chat-voice.ts#L55-L57) | ✅ Guide reste silent SAUF `stade_up_*` | **Vérifier** — la montée VERS Guide doit déclencher la célébration (le `from_stade` est Djidji, donc `isChatSilent("djidji", "stade_up_guide") = false`, OK) |
| `pattern-dots-gold` (motif fond) | Theme/tokens | ❌ Pas exposé V1 — `tokens.ts` n'a pas de pattern | **Stub V1** — réutiliser `gradient.night` + halo doré via `elevation.glow` + cercles concentriques SVG ou simple. Pas critique brand-wise (le pattern formel canonique vient des UX specs) |
| `CatIcon` mascotte | recherche → pas trouvé | ❌ Pas de composant `CatIcon.tsx` V1 | **Stub V1** — glyphe `✦` doré (pattern `BadgePremierSpawt`) OU initiale du nouveau stade (« E » Explorateur). Decision : glyphe `✦` cohérent brand or |
| Écran `StadeCelebration` modal full-screen | (aucun) | ❌ | **Créer** — `app/src/components/StadeCelebration.tsx` Modal animé |
| Mount root layout | [app/app/_layout.tsx](../../app/app/_layout.tsx) | ✅ Pattern `<BadgePremierSpawt visible={pendingBadge !== null} />` | **Étendre** — ajouter `<StadeCelebration visible={pendingCelebration !== null} />` |
| `getStadeDescriptor(stade)` | [app/src/types/stade.ts:102-104](../../app/src/types/stade.ts#L102-L104) | ✅ Existe — label, behavior, etc. | **Consommer** — affichage ancien stade barré → nouveau en or |
| Barre de progression jusqu'au prochain seuil | (aucun) | ❌ | **Créer** sub-component — `next_threshold = STADE_DESCRIPTORS[next_stade].min`, progression = `(unique_spots - current.min) / (next.min - current.min)` |
| Anti-replay AsyncStorage | (aucun pour stade up) | ❌ | **Créer** — clé `spawt:stade:last_celebrated` stocke le dernier stade célébré ; comparer au `to_stade` du candidat avant de set `pendingCelebration` |
| Test Tantie Rose | Sign-off Alexandre | ✅ Pattern documenté project-context | **Inclure** en AC explicite |

**Décisions héritées non-revisitables** :

- **Anti-Duolingo** (Experience Principle #5, PRD §9.3, project-context anti-pattern produit) : **pas de confettis, pas de son ding, pas d'animation gamifiée kid-friendly**. Ton solennel quasi-rituel. Une couleur, un mot du Chat, une transition douce.
- **Voix du Chat** (PRD §9.3) : le ton mappé évolue à la transition de stade — `chat-voice.ts` lit `spawter.stade` qui est updated **avant** que `pendingCelebration` ne soit set (l'ordre dans `registerSpawt` est : `set({ spawter: updated })` → puis Story 5.4 ajoute set `pendingCelebration`). Le HomeD au prochain mount lira le nouveau ton.
- **4 seuils** : 11 (Touriste→Explorateur), 21 (Explorateur→Détective), 31 (Détective→Djidji), 51 (Djidji→Guide). 4 célébrations max par spawter sur sa vie SPAWT.
- **Pas de re-déclenchement** : flag AsyncStorage set-once **par seuil** — un spawter qui régresse `unique_spots` (anti-fraude flag) puis remonte ne re-célèbre pas (le stade ne recule jamais Story 5.1 ; le flag empêche replay).
- **Mount root layout** (pattern `BadgePremierSpawt`) — pas de monter dans un écran spécifique : la célébration peut survenir n'importe où dans l'app (typique : sur la fiche lieu après un spawt verified).
- **Latence cible** : `< 500ms` entre le `set({ spawter: updated })` post-`registerSpawt` et le render de `StadeCelebration` (local-first, pas d'I/O).
- **Persistance flag côté serveur** : V1 = local AsyncStorage uniquement (cohérent avec `is_premier_spawt_celebrated` Story 4.2). Sprint 2 = colonne `last_celebrated_stade` côté `spawter_progression` (defer D-505 documenté Story 5.1).
- **Test Tantie Rose en AC explicite** avant sign-off Alexandre. La célébration de stade est un moment de marque — alpha-bloquant si raté.

## Acceptance Criteria

**AC #1 — State store `pendingCelebration` + détection dans `registerSpawt`**

**Given** le store `spawter-store`
**When** Story 5.4 est livrée
**Then** un state transient est ajouté :

```ts
// app/src/store/spawter-store.ts (extension)

interface PendingCelebration {
  from_stade: import("../types/stade").Stade;
  to_stade: import("../types/stade").Stade;
  unique_spots: number;
}

interface SpawterStore {
  // ... existing
  pendingCelebration: PendingCelebration | null;
  /**
   * Story 5.4 — Acquitte l'affichage de la célébration (set flag AsyncStorage
   * set-once par stade + clear le state). Idempotent.
   */
  consumePendingCelebration: () => Promise<void>;
}
```

**And** dans `registerSpawt`, après le bloc Story 5.1 (`stadeChanged` + track `stade_unlocked` + `void upsertProgression`), un nouveau bloc :

```ts
// app/src/store/spawter-store.ts — extension dans registerSpawt
// (positionnée APRÈS Story 5.1 detection + AVANT le set({ ... })).

let pendingCelebration: PendingCelebration | null = null;
if (stadeChanged) {
  const alreadyCelebrated = await isStadeCelebrated(updated.stade);
  if (!alreadyCelebrated) {
    pendingCelebration = {
      from_stade: spawter.stade,
      to_stade: updated.stade,
      unique_spots: uniqueSpots,
    };
  }
}

set({
  spawter: updated,
  spawts: list,
  ...(pendingBadge ? { pendingBadge } : {}),
  ...(pendingCelebration ? { pendingCelebration } : {}),
});
```

**And** un helper privé :

```ts
// app/src/store/spawter-store.ts (extension privée en bas du fichier)

const STADE_CELEBRATED_PREFIX = "spawt:stade:celebrated:";

/** Story 5.4 — Anti-replay : un stade donné est célébré une seule fois. */
async function isStadeCelebrated(stade: Stade): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(`${STADE_CELEBRATED_PREFIX}${stade}`);
    return Boolean(v && v.length > 0);
  } catch {
    return false;
  }
}
```

**And** `consumePendingCelebration` set le flag `${STADE_CELEBRATED_PREFIX}${to_stade}` à `new Date().toISOString()` puis `set({ pendingCelebration: null })`.

**And** `reset` (déjà existant) étend pour clear `pendingCelebration: null`. Note : on **ne** purge **pas** les flags AsyncStorage `spawt:stade:celebrated:*` au reset démo, cohérent avec `BADGE_CELEBRATED_KEY` Story 4.2 (un user qui ouvre un compte propre re-célèbre — c'est OK pour mode démo, alpha n'a qu'un compte par device).

---

**AC #2 — Composant `StadeCelebration` (Modal full-screen)**

**Given** le dossier `app/src/components/`
**When** Story 5.4 est livrée
**Then** [app/src/components/StadeCelebration.tsx](../../app/src/components/StadeCelebration.tsx) existe :

```tsx
// app/src/components/StadeCelebration.tsx (nouveau)
// PRD §3.1 FR-010 + §9.3 + project-context anti-Duolingo.
// Modal plein écran gr-night + halo or, pas de confettis, pas de son ding.
// Ton solennel quasi-rituel — Experience Principle #5.

import { useEffect } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { gradient } from "../theme/tokens";
import { chatKey } from "../lib/chat-voice";
import { STADE_DESCRIPTORS } from "../types/stade";
import type { Stade } from "../types/stade";
import { getNextStadeProgress } from "../lib/stade-progress";

interface Props {
  visible: boolean;
  from_stade?: Stade | undefined;
  to_stade?: Stade | undefined;
  unique_spots?: number | undefined;
  onDismiss: () => void;
}

const FADE_IN_MS = 400;
const HALO_PULSE_MS = 1200;

export function StadeCelebration({
  visible, from_stade, to_stade, unique_spots, onDismiss,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const opacity = useSharedValue(0);
  const haloScale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.ease) });
      // Halo pulse doux — pas un confetti, juste une respiration.
      haloScale.value = withSequence(
        withTiming(1, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) }),
        withDelay(200, withTiming(0.95, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) })),
        withTiming(1, { duration: HALO_PULSE_MS, easing: Easing.inOut(Easing.cubic) }),
      );
    } else {
      opacity.value = 0;
      haloScale.value = 0.8;
    }
  }, [visible, opacity, haloScale]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: haloScale.value }] }));

  if (!visible || !to_stade || !from_stade) return null;

  const fromDesc = STADE_DESCRIPTORS[from_stade];
  const toDesc = STADE_DESCRIPTORS[to_stade];

  // PRD §9.3 — voix Chat : la montée est annoncée AU stade source (ancien stade).
  // Ex: la transition Touriste → Explorateur utilise chat.touriste.stade_up_explorateur.
  const chatMoment = `stade_up_${to_stade}` as const;
  const chatI18nKey = chatKey(chatMoment, from_stade);
  const chatText = t(chatI18nKey);
  // i18next renvoie la clé brute si non extractible — on traite ça comme silence.
  const chatIsSilent = chatText === chatI18nKey || chatText.trim().length === 0;

  // Barre progression jusqu'au prochain seuil.
  const progress = getNextStadeProgress(to_stade, unique_spots ?? 0);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <Animated.View
        style={[
          { flex: 1, alignItems: "center", justifyContent: "center" },
          fadeStyle,
        ]}
      >
        <LinearGradient
          colors={gradient.night}
          style={{ position: "absolute", inset: 0 }}
        />

        {/* Halo doré pulse — pas un confetti, une respiration. */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: 320, height: 320, borderRadius: 160,
              backgroundColor: theme.colors.brand.primary,
              opacity: 0.12,
              shadowColor: theme.colors.brand.primary,
              shadowOpacity: 0.4,
              shadowRadius: 60,
              elevation: 12,
            },
            haloStyle,
          ]}
        />

        {/* Glyphe doré (placeholder CatIcon — V1 = ✦ cohérent BadgePremierSpawt). */}
        <View
          style={{
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: theme.colors.brand.primary,
            alignItems: "center", justifyContent: "center",
            marginBottom: theme.spacing.xl,
          }}
        >
          <Text style={{ ...theme.typography.preset.display, color: theme.colors.text.onBrand }}>
            ✦
          </Text>
        </View>

        {/* Ancien stade barré → nouveau en or */}
        <View style={{ alignItems: "center", marginBottom: theme.spacing.lg }}>
          <Text
            style={{
              ...theme.typography.preset.h2,
              color: theme.colors.text.tertiary,
              textDecorationLine: "line-through",
              marginBottom: theme.spacing.xs,
            }}
            accessibilityLabel={t("celebration.from_stade_aria", { stade: fromDesc.label })}
          >
            {fromDesc.label}
          </Text>
          <Text
            style={{
              ...theme.typography.preset.display,
              color: theme.colors.brand.primary,
            }}
            accessibilityLabel={t("celebration.to_stade_aria", { stade: toDesc.label })}
          >
            {toDesc.label}
          </Text>
        </View>

        {/* Mot du Chat (i18n via chat-voice mapping) */}
        {!chatIsSilent ? (
          <Text
            style={{
              ...theme.typography.preset.body,
              color: theme.colors.text.inverse,
              textAlign: "center",
              paddingHorizontal: theme.spacing.xl,
              marginBottom: theme.spacing.xl,
              fontStyle: "italic",
            }}
          >
            « {chatText} »
          </Text>
        ) : null}

        {/* Barre progression vers le prochain seuil */}
        {progress.next_stade ? (
          <View style={{ width: "70%", marginBottom: theme.spacing.xl }}>
            <View
              style={{
                height: 4,
                backgroundColor: theme.colors.text.tertiary,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.round(progress.percent * 100)}%`,
                  height: "100%",
                  backgroundColor: theme.colors.brand.primary,
                }}
              />
            </View>
            <Text
              style={{
                ...theme.typography.preset.overline,
                color: theme.colors.text.inverseSecondary,
                textAlign: "center",
                marginTop: theme.spacing.sm,
              }}
            >
              {t("celebration.progress_label", {
                current: progress.current_count,
                next_threshold: progress.next_threshold,
                next_stade: t(`stade.${progress.next_stade}`),
              })}
            </Text>
          </View>
        ) : null}

        {/* CTA Continuer */}
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t("celebration.cta_aria")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.brand.primary,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.base,
            borderRadius: theme.radius.full,
            opacity: pressed ? 0.85 : 1,
            minHeight: 48,
            alignItems: "center", justifyContent: "center",
          })}
        >
          <Text style={{ ...theme.typography.preset.h3, color: theme.colors.text.onBrand }}>
            {t("celebration.cta")}
          </Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
```

**And** **aucun** import de `react-native-sound`, `react-native-confetti`, ou équivalent. Audit lint-vocab + audit manuel.

---

**AC #3 — Helper `getNextStadeProgress`**

**Given** le dossier `app/src/lib/`
**When** Story 5.4 est livrée
**Then** [app/src/lib/stade-progress.ts](../../app/src/lib/stade-progress.ts) existe :

```ts
// app/src/lib/stade-progress.ts (nouveau)
// PRD §3.1 FR-010 + §5.2 — barre de progression jusqu'au prochain seuil.
// Pure helper, sans I/O. Cible #1 des tests unit.

import { STADES, STADE_DESCRIPTORS, type Stade } from "../types/stade";

export interface StadeProgress {
  /** Stade courant (passé en arg). */
  current_stade: Stade;
  /** Nombre de spots uniques courants. */
  current_count: number;
  /** Stade suivant (`null` si déjà Guide — pas de prochain). */
  next_stade: Stade | null;
  /** Seuil min du stade suivant (`null` si Guide). */
  next_threshold: number | null;
  /** Pourcentage progression [0, 1] vers le prochain seuil. */
  percent: number;
}

export function getNextStadeProgress(stade: Stade, uniqueSpots: number): StadeProgress {
  const idx = STADES.indexOf(stade);
  const currentDesc = STADE_DESCRIPTORS[stade];
  const next = idx < STADES.length - 1 ? STADES[idx + 1]! : null;
  if (!next) {
    // Guide — pas de prochain. La progression vit dans la collection / accomplissements.
    return {
      current_stade: stade,
      current_count: uniqueSpots,
      next_stade: null,
      next_threshold: null,
      percent: 1, // pleinement Guide
    };
  }
  const nextDesc = STADE_DESCRIPTORS[next];
  // Progression normalisée entre [currentDesc.min, nextDesc.min] (= seuil de bascule).
  const range = nextDesc.min - currentDesc.min;
  const raw = (uniqueSpots - currentDesc.min) / Math.max(1, range);
  const percent = Math.max(0, Math.min(1, raw));
  return {
    current_stade: stade,
    current_count: uniqueSpots,
    next_stade: next,
    next_threshold: nextDesc.min,
    percent,
  };
}
```

**And** un test unit `app/src/lib/__tests__/stade-progress.test.ts` fige :
- `getNextStadeProgress("touriste", 0)` → `{ next_stade: "explorateur", next_threshold: 11, percent: 0 }`.
- `getNextStadeProgress("touriste", 5)` → `{ percent: 5/11 ≈ 0.45 }`.
- `getNextStadeProgress("touriste", 10)` → `{ percent: 10/11 ≈ 0.91 }`.
- `getNextStadeProgress("touriste", 11)` → `{ percent: 1 }` (NB : à 11 spots le stade est déjà `explorateur` côté `getStade`, mais le helper accepte tout state — robustesse).
- `getNextStadeProgress("guide", 100)` → `{ next_stade: null, percent: 1 }`.
- `getNextStadeProgress("explorateur", 15)` → `{ next_stade: "detective", next_threshold: 21, percent: (15-11)/(21-11) = 0.4 }`.

---

**AC #4 — Mount root layout + consumption**

**Given** [app/app/_layout.tsx](../../app/app/_layout.tsx) qui mount déjà `<BadgePremierSpawt>` consommant `pendingBadge`
**When** Story 5.4 est livrée
**Then** `_layout.tsx` est étendu pour mount `<StadeCelebration>` :

```tsx
// app/app/_layout.tsx (extension, dans RootLayout)

const pendingCelebration = useSpawterStore((s) => s.pendingCelebration);
const consumePendingCelebration = useSpawterStore((s) => s.consumePendingCelebration);

// ... return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
        {/* ... existing */}
        <BadgePremierSpawt
          visible={pendingBadge !== null}
          place_name={pendingBadge?.place_name}
          onDismiss={() => { void consumePendingBadge(); }}
        />
        <StadeCelebration
          visible={pendingCelebration !== null}
          from_stade={pendingCelebration?.from_stade}
          to_stade={pendingCelebration?.to_stade}
          unique_spots={pendingCelebration?.unique_spots}
          onDismiss={() => { void consumePendingCelebration(); }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
// );
```

**And** **ordre d'affichage** quand Premier Spawt **et** montée de stade surviennent simultanément (théoriquement : 1er spawt → montée si déjà 10 spots uniques pré-existants — pas en V1 alpha mais defensive) :

- `BadgePremierSpawt` mount **avant** `StadeCelebration` dans l'arborescence Modal.
- Les 2 `Modal` empilent — le visuel dépend de la `Z-order` React Native. **V1** : tester sur device si nécessaire. **Recommandation** : Premier Spawt s'affiche en premier (priorité narrative), le user dismiss, puis StadeCelebration apparaît.

**Trade-off** : pas de queue formelle — V1 simplifie. Sprint 2 = queue ordonnée si conflit observé.

---

**AC #5 — Voix du Chat : ton évolutif dans les 24h**

**Given** PRD §3.1 Feature 3 — « Le ton change dans les 24h suivantes au maximum »
**When** Story 5.4 est livrée
**Then** :

1. La transition est **instantanée côté store** : `set({ spawter: { ..., stade: "explorateur" } })` (Story 5.1 — déjà câblé via `maxStade`).
2. Tous les écrans qui consomment `chat-voice.ts` (HomeD, fiche lieu, etc.) re-rendent au prochain mount avec le nouveau stade — donc le nouveau ton.
3. `chat-voice.ts` `chatKey(moment, stade)` produit une clé i18n qui pointe vers le nouveau stade : `chat.explorateur.welcome_back` au lieu de `chat.touriste.welcome_back`.
4. **PRD « dans les 24h max »** = upper bound, V1 = **instantané**. Acceptable (plus performant que la spec exige).
5. La célébration `StadeCelebration` elle-même utilise `chatKey("stade_up_<to>", <from>)` — la voix Chat **source** (Touriste qui dit « 11 spots. Tu n'es plus Touriste... »).

**And** un test smoke `chat-voice-coverage.test.ts` (déjà existant) reste vert — `CHAT_MOMENTS` inclut `stade_up_*` (4 moments).

---

**AC #6 — Anti-replay set-once par stade**

**Given** AsyncStorage key prefix `spawt:stade:celebrated:`
**When** Story 5.4 est livrée
**Then** :

1. Au franchissement de seuil détecté dans `registerSpawt`, le helper `isStadeCelebrated(to_stade)` vérifie le flag.
2. Si le flag existe (timestamp ISO posé précédemment) → `pendingCelebration` **n'est pas** set, la célébration ne s'affiche pas.
3. Si absent → `pendingCelebration` est set, `consumePendingCelebration` set le flag au tap CTA.
4. **Edge case** : un user qui efface AsyncStorage (rare, surtout en mode démo via `resetAll`) re-célèbre — acceptable, cohérent Story 4.2.
5. **Edge case** : un user qui revient sur l'app après crash entre `set({ spawter, pendingCelebration })` et `consumePendingCelebration` → `pendingCelebration` est en mémoire mais pas persisté côté AsyncStorage. Au prochain boot : `hydrate()` ne re-stocke pas le `pendingCelebration` (state transient, pas dans `loadPalais/loadSpawter/loadSpawts`). **Conséquence V1** : la célébration peut être **perdue** si le user kill l'app dans la fenêtre milliseconde post-spawt. **Acceptable** — il restera la modification `spawter.stade` (vérité), juste pas la cérémonie. Sprint 2 = persister `pendingCelebration` côté AsyncStorage si Alexandre demande (defer).

**And** un test `spawter-store-celebration.test.ts` couvre :
- 1er franchissement 11 spots → `pendingCelebration = { from: "touriste", to: "explorateur", unique_spots: 11 }`.
- `consumePendingCelebration` → flag AsyncStorage posé + state null.
- Re-jouer un franchissement vers le même stade (théorique — `maxStade` empêche, mais test defensive) → no-op si flag posé.
- 4 franchissements successifs (11/21/31/51) → 4 célébrations distinctes, 4 flags distincts.

---

**AC #7 — Performance + UX < 500ms post-spawt**

**Given** un spawt verified qui franchit un seuil
**When** Story 5.4 est livrée
**Then** :

1. `registerSpawt` retourne (Promise résolue) en `< 500ms` (NFR-PERF-03 — invariant Epic 4) **incluant** le set du `pendingCelebration`.
2. Le `Modal` `StadeCelebration` se monte au prochain re-render du root layout (sélecteur `useSpawterStore((s) => s.pendingCelebration)`).
3. L'animation fade-in (400ms) est sur le UI thread (Reanimated 4 `useSharedValue`).
4. **Cible end-to-end** : `< 500ms` entre le tap « Confirmer » d'un spawt verified et le 1er frame de la célébration. Mesurable manuellement.

**And** la latence n'augmente **pas** si Story 4.2 (`pendingBadge`) survient simultanément — les 2 modals s'empilent indépendamment.

---

**AC #8 — i18n + events.md (pas de nouvel event V1)**

**Given** le fichier [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 5.4 est livrée
**Then** la section `celebration.*` est ajoutée :

```json
"celebration": {
  "cta": "Continuer",
  "cta_aria": "Fermer la célébration",
  "from_stade_aria": "Tu étais {{stade}}",
  "to_stade_aria": "Tu es maintenant {{stade}}",
  "progress_label": "{{current}} / {{next_threshold}} spots vers {{next_stade}}",
  "progress_label_guide": "Tu es Guide. La Meute marche derrière toi."
}
```

**And** les 4 clés Chat existantes (`chat.touriste.stade_up_explorateur`, `chat.explorateur.stade_up_detective`, `chat.detective.stade_up_djidji`, `chat.djidji.stade_up_guide`) sont validées extractibles (déjà ✅ — cf. lecture i18n existante).

**And** **aucun nouvel event analytics V1** — `stade_unlocked` (déjà émis Story 5.1) couvre l'analyse du funnel « franchissement → célébration vue ». La métrique « % spawters qui ferment la célébration vs dismiss instantané » est differable (defer D-541).

---

**AC #9 — Test Tantie Rose + sign-off Alexandre + tests + triple gate**

**Given** PRD §9.3 + Experience Principle #5
**When** Story 5.4 est livrée
**Then** **Test Tantie Rose** (Alexandre) est passé **explicitement** :

1. *Tantie Rose comprend-elle ?* — Oui : « Tu es Explorateur », barre de progression simple, pas de jargon.
2. *Brice Konan partage-t-il sans honte ?* — Oui : gr-night + or = premium, ton solennel respecté, pas de confettis kitsch.
3. *Dominic se sent appartenir ?* — Oui : la voix Chat utilise le ton du stade source (« Tu n'es plus Touriste... »), le nouveau stade est célébré sans gamification de basse-cour.

**And** la suite de tests :

1. **`stade-progress.test.ts`** — 6 cas (cf. AC #3).
2. **`StadeCelebration.test.tsx`** (RTL + jest-expo) :
   - Render avec props synthétiques `{ visible: true, from_stade: "touriste", to_stade: "explorateur", unique_spots: 11 }` → trouve « Touriste », « Explorateur », CTA.
   - Tap sur CTA → `onDismiss` called.
   - Voix Chat silent (clé vide) → pas de bloc citation.
   - `to_stade: "guide"` → `next_stade: null` → barre progression hide.
   - Pas de confettis (assert : pas d'import de `react-native-confetti`, pas de useEffect qui joue un son).
3. **`spawter-store-celebration.test.ts`** :
   - Franchissement 11 spots → `pendingCelebration` set + flag AsyncStorage absent.
   - `consumePendingCelebration` → flag posé + state null.
   - Re-spawt → `pendingCelebration` reste null (flag check).
   - 4 franchissements (11/21/31/51) → 4 célébrations.
   - Reset démo → `pendingCelebration` reset (mais flags AsyncStorage persistent cohérence Story 4.2).

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile (smoke).
**And** **Sign-off Alexandre explicit** dans le CHANGELOG entry — pas de merge sans Test Tantie Rose tracé.

## Tasks / Subtasks

- [ ] **Task 1 — Helper `stade-progress.ts`** (AC: #3)
  - [ ] Créer `app/src/lib/stade-progress.ts` avec `getNextStadeProgress(stade, uniqueSpots)`.
  - [ ] Tests unit `stade-progress.test.ts` (6 cas listés AC #3).

- [ ] **Task 2 — Composant `StadeCelebration`** (AC: #2, #5)
  - [ ] Créer `app/src/components/StadeCelebration.tsx` selon snippet AC #2.
  - [ ] Reanimated 4 fade-in 400ms + halo pulse soft.
  - [ ] LinearGradient `gradient.night`.
  - [ ] Glyphe `✦` doré (pattern `BadgePremierSpawt`).
  - [ ] Chat citation via `chatKey(stade_up_<to>, <from>)` + gracefully silent si clé vide.
  - [ ] Barre progression via `getNextStadeProgress`.
  - [ ] **PAS** d'import de confettis, sons, kid-friendly animations.

- [ ] **Task 3 — State store + détection** (AC: #1, #6)
  - [ ] Ajouter `pendingCelebration: PendingCelebration | null` à `SpawterStore`.
  - [ ] Ajouter `consumePendingCelebration` action.
  - [ ] Helper privé `isStadeCelebrated(stade)` + constante `STADE_CELEBRATED_PREFIX`.
  - [ ] Câblage `registerSpawt` : après bloc Story 5.1, set `pendingCelebration` si pas encore célébré.
  - [ ] `reset` clear `pendingCelebration`.

- [ ] **Task 4 — Mount root layout** (AC: #4)
  - [ ] Étendre `app/app/_layout.tsx` pour mount `<StadeCelebration>`.
  - [ ] Sélecteurs `pendingCelebration` + `consumePendingCelebration`.
  - [ ] Préserver `<BadgePremierSpawt>` Story 4.2 (sans modif).

- [ ] **Task 5 — i18n** (AC: #8)
  - [ ] Étendre `fr.json` section `celebration.*` (6 clés).
  - [ ] Valider les 4 clés `chat.<stade>.stade_up_*` extractibles (déjà ✅).

- [ ] **Task 6 — Tests** (AC: #9)
  - [ ] `stade-progress.test.ts` (6 cas).
  - [ ] `StadeCelebration.test.tsx` (5 cas).
  - [ ] `spawter-store-celebration.test.ts` (5 cas).
  - [ ] Étendre `spawter-store-stade.test.ts` (Story 5.1) — assert qu'au franchissement, `pendingCelebration` est set ET event `stade_unlocked` émis.

- [ ] **Task 7 — Test Tantie Rose + sign-off Alexandre + triple gate + CHANGELOG** (AC: #9)
  - [ ] Manual : afficher l'écran sur Tecno Spark + Pixel mid-range + iPhone récent.
  - [ ] Capture vidéo 5s à montrer Alexandre.
  - [ ] Sign-off `Triple sign-off: Stéphanie + Kidam + Alexandre` dans CHANGELOG.
  - [ ] CHANGELOG `feat(stade)` Story 5.4 + Epic 5 close.

## Dev Notes

### 1. Décision D1 — Voix Chat = source (`from_stade`), pas destination

PRD §9.3 + `chat-voice.ts` matrice : la clé i18n `chat.<stade>.stade_up_<destination>` n'est extractible **que pour le stade source** (les 4 autres stades ont la clé vide ou silent).

Exemple `fr.json:285-289` :
```
"touriste": {
  "stade_up_explorateur": "11 spots. Tu n'es plus Touriste — tu es Explorateur. Ton territoire commence à se dessiner.",
  "stade_up_detective": "",
  "stade_up_djidji": "",
  "stade_up_guide": ""
}
```

Le Touriste parle de **lui-même**, qui devient Explorateur. La célébration appelle donc `chatKey("stade_up_explorateur", "touriste")`. Au stade `explorateur`, la même moment serait silent (clé vide → renvoyée comme `chat.explorateur.stade_up_explorateur` brute, traité comme silence).

**Cohérence** : le Chat « source » parle UNE fois, au moment du passage. Pas de double voix.

### 2. Décision D2 — Pas de queue ordonnée Premier Spawt + Stade Celebration

V1 simplifie : si les 2 événements surviennent simultanément (théorique — premier spawt à `unique_spots = 10` qui devient 11, OR cas test seed qui prep le store), les 2 Modal mount **en parallèle**.

**Trade-off observable** : `Modal` natif RN gère un seul `presentation: "fullScreenModal"` à la fois sur iOS — le 2e peut clignoter. Sur Android, les 2 Modal sont superposés.

**Mitigation V1** : tester manuellement le scenario en alpha. Si UX dégradée → Sprint 2 = queue (defer D-542).

**Probabilité V1 alpha** : très faible — un Premier Spawt arrive à `unique_spots = 0 → 1`, jamais à 10 → 11. Donc concurrent quasi-impossible.

### 3. Décision D3 — Pattern dots gold formel = report Sprint 2

PRD §15 + UX specs canoniques mentionnent `pattern-dots-gold` (motif de petits points dorés sur fond noir). V1 = **pas livré** :

- `tokens.ts` ne l'expose pas.
- Pas de SVG / pattern asset embarqué.
- V1 utilise `gradient.night` + halo doré central via `elevation.glow` + cercle backgrounder via Reanimated.

**Trade-off** : visuel V1 sera **plus minimaliste** que la spec UX canonique. Acceptable :
- Le ton solennel quasi-rituel est respecté.
- Test Tantie Rose porte sur la **sensation** pas sur le détail pixel.
- Sprint 2 = ajouter le motif via `<Svg>` pattern (`react-native-svg` déjà installée).

**Defer D-543** : intégrer `pattern-dots-gold` proper Sprint 2.

### 4. Décision D4 — Glyphe `✦` au lieu de `CatIcon`

Le PRD parle de « gros CatIcon » dans la célébration. V1 = pas de `CatIcon.tsx` (la mascotte cat est représentée textuellement « Le Chat » dans le copy). Pattern `BadgePremierSpawt` (Story 4.2) utilise `✦` = symbole cohérent brand or, et la signature graphique est validée Stéphanie + Alexandre Story 4.2.

**Cohérence** : la célébration de stade = même rituel narratif que le badge Premier Spawt. Réutiliser le `✦` aligne la grammaire visuelle.

**Sprint 2** : si Sally (UX) livre un `CatIcon.tsx` SVG, swap (defer D-544).

### 5. Décision D5 — Animation halo pulse (pas confetti, pas spin)

Le `withSequence` + 3 `withTiming` produit une respiration douce (1 → 0.95 → 1, sur ~3,6s total). Anti-Duolingo :

- ❌ Pas de spin rapide (50 → 360deg).
- ❌ Pas de scale > 1.2 (kid-friendly).
- ❌ Pas de bounce easing.
- ✅ `Easing.inOut(Easing.cubic)` = douce.
- ✅ Amplitude minimale (5% scale).

Test Tantie Rose : si Alexandre trouve que la pulse est **encore trop** vive, l'amplitude peut être réduite à `1 → 0.98` (defer minor — pas bloquant V1).

### 6. Décision D6 — Pas de son ding (project-context anti-pattern)

Aucun import de `expo-av` (sound), pas de fichier audio embarqué. Le moment est **silencieux** : c'est volontaire — la solennité demande le silence (les rituels n'utilisent pas de son lof-fi).

**Trade-off** : un user qui découvre la célébration en mode silencieux n'a pas de feedback audio. **Acceptable** — l'attention est tout entière sur le visuel + le mot du Chat.

### 7. Non-régression Stories 1-5.3

- **Story 5.1** `stade_unlocked` event reste émis (Story 5.4 ne remplace pas, elle ajoute le state UI).
- **Story 5.2** `unlockTitle` reste câblée — la célébration mount **avant** ou **après** l'unlock du titre côté store n'a pas d'importance UX (le user voit le titre dans la collection au prochain mount du profil).
- **Story 4.2** `BadgePremierSpawt` cohabite — cf. Decision D2.
- **Stack auth/onboarding/feed/place** : `_layout.tsx` est étendu sans casser le mount des autres Stack.Screen (le Modal est rendu en dehors du Stack natif).

### 8. Performance

- `registerSpawt` : +1 lecture AsyncStorage (`isStadeCelebrated`) ~5ms. Toujours `< 500ms` total.
- `StadeCelebration` mount : 1 sélecteur Zustand + Modal natif. < 50ms perçu.
- Animation Reanimated 4 worklet : UI thread, 60 FPS.
- Pas d'I/O réseau, pas d'await.

### 9. Sign-off

- **Stéphanie** (tech) : revue `getNextStadeProgress` totalité (Guide edge case, division par 0 mitigée par `Math.max(1, range)`), revue Reanimated 4 halo pulse driver Android (test Tecno).
- **Kidam** (analytics) : confirmer **pas de nouvel event V1** (`stade_unlocked` suffit), confirmer cohorte « moment de vérité passage de stade » trackable via funnel `stade_unlocked → app_open J+1` (sticky retention).
- **Alexandre** (brand) : **Test Tantie Rose obligatoire** sur la celebration UI, audit copy `celebration.*` (« Tu étais Touriste », « Continuer »), audit voix Chat 4 moments stade_up déjà extraits (FR cohérent), validation **pas de confettis / pas de ding** stricte.

### 10. Defers identifiés

- **D-541** — Event analytics `celebration_dismissed` avec time-to-dismiss (Sprint 2 si Kidam veut mesurer l'attention).
- **D-542** — Queue ordonnée Premier Spawt + Stade Celebration (Sprint 2 si concurrence observée en alpha).
- **D-543** — Pattern dots gold formel (SVG asset Sprint 2, alignement UX canonique).
- **D-544** — `CatIcon.tsx` mascotte SVG (Sprint 2 si Sally livre).
- **D-545** — Colonne `last_celebrated_stade` côté `spawter_progression` pour anti-replay server-authoritative (Sprint 2 — corrige D-505 Story 5.1).
- **D-546** — Persistance `pendingCelebration` côté AsyncStorage pour survivre kill app entre `set` et `consume` (V2 robustesse).
- **D-547** — Animation refined (motif lent, halo pulse plus organique) Sprint 2 si Alexandre demande.

### 11. Risk

- **Risque #1** — `Modal` RN bug sur Android Tecno (driver) — déjà connu Story 4.2 (`BadgePremierSpawt` tested OK). Mitigation : pattern identique réutilisé.
- **Risque #2** — Voix Chat clé manquante (drift i18n) → la célébration affiche la clé brute « chat.touriste.stade_up_explorateur ». **Mitigation** : guard `chatIsSilent` test `text === chatI18nKey || trim().length === 0` → traite comme silence (pas de bloc citation). Le test `StadeCelebration.test.tsx` couvre.
- **Risque #3** — Alexandre rejette le visuel V1 (manque pattern, manque CatIcon) → blocage merge. **Mitigation** : tracer en defer D-543/D-544 + capture vidéo dès la dev → review precoce avant le merge.
- **Risque #4** — Concurrence Premier Spawt + Stade Celebration (cas hypothétique). **Mitigation** : tester manuellement le scenario seed (force `unique_spots: 10` puis premier spawt). Si UX cassée → queue Sprint 2.
- **Risque #5** — User dismiss trop rapide (< 1s) sans lire le mot du Chat → ressenti « gamifié ». **Mitigation** : l'animation fade-in 400ms + halo pulse 1200ms encourage à attendre. Pas de blocage forcé (user reste maître).

### Project Structure Notes

- **1 nouveau composant** : `app/src/components/StadeCelebration.tsx`.
- **1 nouveau helper** : `app/src/lib/stade-progress.ts`.
- **1 fichier modifié** : `app/src/store/spawter-store.ts` (+ state + action + helper + détection dans `registerSpawt`).
- **1 fichier modifié** : `app/app/_layout.tsx` (+ mount `<StadeCelebration>`).
- **1 fichier modifié** : `app/src/i18n/fr.json` (+ section `celebration.*`).
- **3 fichiers tests** : `stade-progress.test.ts`, `StadeCelebration.test.tsx`, `spawter-store-celebration.test.ts`.
- **Pas de modif analytics V1** (`stade_unlocked` suffit).
- **Pas de nouvelle dépendance** (Reanimated 4 + expo-linear-gradient déjà installés).
- **Pas de migration SQL** — Story 5.1 + 5.2 ont livré les tables, anti-replay V1 = AsyncStorage local.

### References

- [_bmad-output/planning-artifacts/epics.md#L1058-L1077](../planning-artifacts/epics.md#L1058-L1077) Story 5.4
- [_bmad-output/planning-artifacts/PRD.md §3.1 FR-010 + Feature 3](../planning-artifacts/PRD.md) Progression par stades + ton Chat 24h max
- [_bmad-output/planning-artifacts/PRD.md §9.3](../planning-artifacts/PRD.md) Voix du Chat + anti-Duolingo
- [_bmad-output/planning-artifacts/PRD.md §16.4](../planning-artifacts/PRD.md) Distribution stades cible M12 (cohorte trackable)
- [_bmad-output/planning-artifacts/architecture.md#L364-L365](../planning-artifacts/architecture.md#L364-L365) Moteur `chat-voice.ts`
- [_bmad-output/planning-artifacts/architecture.md#L776](../planning-artifacts/architecture.md#L776) Epic 5 mapping `StadeCelebration`
- [_bmad-output/project-context.md §Voix du Chat + §Anti-patterns produit + §Test Tantie Rose](../project-context.md)
- [_bmad-output/implementation-artifacts/5-1-progression-par-stades-recompute.md](5-1-progression-par-stades-recompute.md) Story 5.1 detection
- [_bmad-output/implementation-artifacts/5-2-collection-de-titres-titre-affiche.md](5-2-collection-de-titres-titre-affiche.md) Story 5.2 unlock titre simultané
- [_bmad-output/implementation-artifacts/4-2-notification-le-guet-confirmation-du-spawt-badge-premier-spawt.md](4-2-notification-le-guet-confirmation-du-spawt-badge-premier-spawt.md) Pattern `pendingBadge`
- [app/src/components/BadgePremierSpawt.tsx](../../app/src/components/BadgePremierSpawt.tsx) Pattern Modal Reanimated 4 (anti-Duolingo référence)
- [app/src/lib/chat-voice.ts](../../app/src/lib/chat-voice.ts) `CHAT_MOMENTS`, `chatKey`, `isChatSilent`
- [app/src/types/stade.ts](../../app/src/types/stade.ts) `STADES`, `STADE_DESCRIPTORS`, `getStade`, `maxStade`
- [app/src/i18n/fr.json:285-352](../../app/src/i18n/fr.json#L285-L352) 4 clés `chat.<stade>.stade_up_*`

## Dev Agent Record

### Agent Model Used

_(à compléter au moment de la dev)_

### Debug Log References

_(à compléter)_

### Completion Notes List

_(à compléter)_

### File List

_(à compléter)_
