# Story 5.3: Profil spawter & carte spawter flip

Status: ready-for-dev

<!-- Story UI Epic 5 — consomme Story 5.1 (stade, progression) + Story 5.2
(collection titres + titre affiché). Livre l'écran `(tabs)/profile.tsx`
complet (refactor du stub existant) + composant `SpawterCard` flip 3D
Reanimated 4. Recto gr-night = identité (rang, n°, nom, titre affiché,
stats héro). Verso bg-warm = PalaisRadar 5 axes canoniques + 2 dominants.
Gate Gold (V1.5+) : 2 axes en accès gratuit, 5 axes pour Gold (V1 = stub
si flag `is_gold` absent, V1.5 wirera le flag). -->

## Story

As a spawter,
I want consulter mon profil avec mon Palais et ma carte d'identité,
so that mon profil est un objet de fierté quotidien — j'identifie qui je suis dans la Meute en un coup d'œil, et je peux retourner ma carte pour découvrir mes axes de goût dominants.

## ⚠️ Brownfield context — read first

État courant Story 5.3 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Écran `(tabs)/profile.tsx` | [app/app/(tabs)/profile.tsx](../../app/app/%28tabs%29/profile.tsx) | ⚠️ Stub partiel — affiche nom, neighborhood, stade, ChatBubble, `AxisRadar` 5 axes en vrac, bouton OfflineQueueInspector, reset démo | **Refactor complet** — remplacer par le profil cible (SpawterCard flip + sections) ; conserver le bouton OfflineQueueInspector (Story 4.3 cross-cutting) + reset démo |
| Composant `AxisRadar` | [app/src/components/AxisRadar.tsx](../../app/src/components/AxisRadar.tsx) | ✅ Existe — 5 axes bipolaires, prop `underConstruction`, prop `size` | **Consommer** — utilisé recto+verso de la carte (verso = grand format, profil global = peut être supprimé du body et déplacé sur la carte) |
| `PalaisRadar` primitive | [app/src/components/primitives/PalaisRadar.tsx](../../app/src/components/primitives/PalaisRadar.tsx) | ✅ Existe — primitive midfi-kit | **Consommer indirectement** via `AxisRadar` |
| `ChatBubble` composant | [app/src/components/ChatBubble.tsx](../../app/src/components/ChatBubble.tsx) | ✅ Existe — consomme `chat-voice.ts` mapping | **Consommer** — moment dédié `profile_opened` à ajouter Sprint 2 (V1 = pas de ChatBubble sur profil pour éviter encombrement) |
| State `spawter`, `palais`, `collectionTitres` | [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) | ⚠️ `spawter` + `palais` existent. `collectionTitres` livré par Story 5.2 | **Consommer** — sélecteurs granulaires (`useSpawterStore((s) => s.spawter)`) |
| `STADE_DESCRIPTORS` (label, behavior) | [app/src/types/stade.ts:26-77](../../app/src/types/stade.ts#L26-L77) | ✅ Existe | **Consommer** — affichage nom du stade + comportement |
| Flag `is_gold` côté spawter | `Spawter` type | ❌ Pas présent — `customer_id` existe mais pas de boolean dérivé V1 | **Stub V1** — helper `isGoldSpawter(spawter): boolean` retournant `false` (V1 = pas de Gold actif). Sprint 2 wirera via `customer_id !== null && subscriptions.is_active`. Acceptable car V1 = pas de paywall paiement. |
| Composant `SpawterCard` flip 3D | (aucun) | ❌ | **Créer** — `app/src/components/SpawterCard.tsx` |
| Réanimated 4 useSharedValue + interpolate rotateY | déjà importé Reanimated 4.2.1 | ✅ Disponible | **Consommer** — flip 3D smooth |
| Icône Chat (mascotte) | recherche `CatIcon` | ⚠️ À vérifier — pattern Story 4.2 `✦` glyphe utilisé en placeholder | **Stub V1** — réutiliser glyphe `✦` doré OU créer petit SVG/glyphe initialé dans le composant. Pas critique pour Story 5.3 (la carte affiche le nom du spawter, pas le Chat) |
| Style `gr-night` + `pattern-dots-gold` + halo or | [app/src/theme/tokens.ts](../../app/src/theme/tokens.ts) | ✅ `gradient.night`, `palette.gold`, `elevation.glow` | **Consommer** — pas de nouveau token brand |
| Quick links (Mes spots, spawts, réglages) | (aucun) | ❌ | **Créer** — navigation vers `/saved` (existant Story 3.6), `/spawts` (futur — V1 stub `Alert`), `/settings` (futur — V1 stub) |
| Lieux sauvegardés count | [app/src/store/spawter-store.ts](../../app/src/store/spawter-store.ts) | ✅ `savedPlaceIds: Set<string>` | **Consommer** — `savedPlaceIds.size` |
| Spawts/avis counts | spawter | ✅ `total_spawts` ; `reviews` count = `spawts.filter(s => s.note_etoiles !== null).length` | **Calculer** côté écran |
| `geoloc_consent_at`, `cgv_accepted_at` | spawter | ✅ Existent (Story 2.x) | **Hors scope** profil V1 — réservé écran réglages |

**Décisions héritées non-revisitables** :

- **5 axes canoniques Palais** (drift D8) : Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table. Figés via `PALAIS_AXES` + `PALAIS_AXIS_LABELS` ([app/src/types/palais.ts](../../app/src/types/palais.ts)).
- **Bipolaire** : valeurs ∈ [-1, 1], `AxisRadar` mappe `|value|` à distance + sélectionne label gauche/droit selon signe.
- **Gate `confidence_score < 0.3`** → afficher « En construction » plutôt qu'un radar non fiable (project-context invariant). Prop `underConstruction` consommée d'`AxisRadar`.
- **Gate Gold (V1.5+)** : 2 axes en accès gratuit, 5 axes complets pour Gold. **V1 = hook prêt mais Gold toujours `false`**. La carte recto affiche **toujours** les stats héro (pas conditionné Gold) — la limitation Gold ne s'applique **qu'au verso radar**. Sprint 2 wirera le flag.
- **Performance cible** : ouverture < 1,5s (PRD §3.1 FR-008 acceptance). Pas de `await` réseau dans le rendu — sélecteurs Zustand uniquement.
- **Identité avant utilité** (PRD §20.1) — la carte spawter est un **objet de fierté**, pas un dashboard de stats. Ton premium, soigné, **pas** gamifié.
- **Vocabulaire SPAWT** : « ta carte », « ta meute », « tes spots », « tes spawts ». Pas de « tu as gagné X points ».
- **i18n strict** : toute string FR via `t()`.
- **Pas de hex en dur** — `useTheme()` partout.

## Acceptance Criteria

**AC #1 — Composant `SpawterCard` avec flip 3D**

**Given** le dossier `app/src/components/`
**When** Story 5.3 est livrée
**Then** [app/src/components/SpawterCard.tsx](../../app/src/components/SpawterCard.tsx) existe :

```tsx
// app/src/components/SpawterCard.tsx (nouveau)
// PRD §3.1 FR-008 + §20.1 — carte spawter flip 3D : identité avant utilité.
// Recto gr-night (identité) ↔ verso bg-warm (Palais radar 5 axes).
// Reanimated 4 useSharedValue + interpolate rotateY (UI thread, 60 FPS).
// PAS de gamification (project-context anti-pattern).

import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useTheme } from "../theme/ThemeProvider";
import { gradient } from "../theme/tokens";
import { AxisRadar } from "./AxisRadar";
import { STADE_DESCRIPTORS } from "../types/stade";
import type { Spawter } from "../types/spawter";
import type { UserPalais } from "../types/palais";
import { track } from "../lib/analytics";

interface Props {
  spawter: Spawter;
  palais: UserPalais;
  /** Clé i18n du titre affiché (Story 5.2). Fallback = titre du stade actuel. */
  displayedTitleKey: string;
  /** Gate radar (V1 = false par défaut, hook prêt pour V1.5 Gold). */
  isGold: boolean;
  /** Stats héro pour le recto. */
  totalSpawts: number;
  uniqueSpots: number;
  reviewsCount: number;
}

const FLIP_DURATION_MS = 600;

export function SpawterCard({
  spawter, palais, displayedTitleKey, isGold,
  totalSpawts, uniqueSpots, reviewsCount,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const flipProgress = useSharedValue(0); // 0 = recto, 1 = verso

  const handleFlip = useCallback(() => {
    const target = flipProgress.value > 0.5 ? 0 : 1;
    flipProgress.value = withTiming(target, {
      duration: FLIP_DURATION_MS,
      easing: Easing.inOut(Easing.cubic),
    });
    track({
      name: "spawter_card_flipped",
      properties: { to: target === 0 ? "recto" : "verso" },
    });
  }, [flipProgress]);

  const rectoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg`;
    const opacity = flipProgress.value < 0.5 ? 1 : 0;
    return { transform: [{ rotateY }], opacity, backfaceVisibility: "hidden" };
  });
  const versoStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg`;
    const opacity = flipProgress.value > 0.5 ? 1 : 0;
    return { transform: [{ rotateY }], opacity, backfaceVisibility: "hidden" };
  });

  const adnReady = palais.confidence_score >= 0.3;
  const stadeDesc = STADE_DESCRIPTORS[spawter.stade];

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel={t("profile.card_flip_aria")}
      style={{ aspectRatio: 0.7 }}
    >
      {/* RECTO (gr-night, identité) */}
      <Animated.View
        style={[
          { position: "absolute", inset: 0, borderRadius: theme.radius.card, overflow: "hidden" },
          rectoStyle,
        ]}
      >
        <LinearGradient
          colors={gradient.night}
          style={{ flex: 1, padding: theme.spacing.lg, justifyContent: "space-between" }}
        >
          {/* Header : n° spawter + stade (top-right "rang") */}
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...theme.typography.preset.overline, color: theme.colors.text.inverseSecondary }}>
              {t("profile.card_id_prefix")} #{spawter.id.slice(0, 6).toUpperCase()}
            </Text>
            <Text style={{ ...theme.typography.preset.overline, color: theme.colors.brand.primary }}>
              {t(`stade.${spawter.stade}`)}
            </Text>
          </View>

          {/* Centre : avatar (placeholder) + nom + titre affiché */}
          <View style={{ alignItems: "center" }}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: theme.colors.brand.primary,
              alignItems: "center", justifyContent: "center",
              marginBottom: theme.spacing.base,
            }}>
              <Text style={{
                ...theme.typography.preset.display,
                color: theme.colors.text.onBrand,
              }}>
                {spawter.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ ...theme.typography.preset.h1, color: theme.colors.text.inverse, textAlign: "center" }}>
              {spawter.display_name}
            </Text>
            <Text style={{ ...theme.typography.preset.caption, color: theme.colors.brand.primary, marginTop: theme.spacing.xs }}>
              {t(displayedTitleKey)}
            </Text>
          </View>

          {/* Stats héro */}
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBlock label={t("profile.stat_spawts")} value={totalSpawts} theme={theme} />
            <StatBlock label={t("profile.stat_spots")} value={uniqueSpots} theme={theme} />
            <StatBlock label={t("profile.stat_avis")} value={reviewsCount} theme={theme} />
          </View>

          {/* Comportement du stade (citation discrète) */}
          <Text style={{
            ...theme.typography.preset.small,
            color: theme.colors.text.inverseSecondary,
            textAlign: "center",
            fontStyle: "italic",
          }}>
            {stadeDesc.behavior}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* VERSO (bg-warm, Palais radar) */}
      <Animated.View
        style={[
          { position: "absolute", inset: 0, borderRadius: theme.radius.card, overflow: "hidden" },
          versoStyle,
        ]}
      >
        <View style={{
          flex: 1, padding: theme.spacing.lg,
          backgroundColor: theme.colors.surface.subtle,
          alignItems: "center", justifyContent: "center",
        }}>
          {!isGold ? (
            // V1 défaut : 2 axes en accès gratuit (cf. Dev Notes §3 — Gold V1.5+).
            <PalaisRadarGated palais={palais} visibleAxesCount={2} underConstruction={!adnReady} />
          ) : (
            <PalaisRadarGated palais={palais} visibleAxesCount={5} underConstruction={!adnReady} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Helpers stat + radar gated extraits pour lisibilité.
function StatBlock({ label, value, theme }: { label: string; value: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ ...theme.typography.preset.display, color: theme.colors.brand.primary }}>
        {value}
      </Text>
      <Text style={{ ...theme.typography.preset.overline, color: theme.colors.text.inverseSecondary }}>
        {label}
      </Text>
    </View>
  );
}
```

**And** un composant interne `PalaisRadarGated` accepte `visibleAxesCount: 2 | 5` :

```tsx
// Interne SpawterCard.tsx
interface RadarGatedProps {
  palais: UserPalais;
  visibleAxesCount: 2 | 5;
  underConstruction: boolean;
}

function PalaisRadarGated({ palais, visibleAxesCount, underConstruction }: RadarGatedProps) {
  const { t } = useTranslation();
  // V1 = 2 axes → on rend 5 axes mais on masque 3 via underConstruction-style.
  // Décision Dev Notes §3 : V1 simplifie en rendant tous les 5 axes avec un overlay
  // « Gold » sur 3 axes. Sprint 2 = vraie partition.
  // V1 PRAGMATIQUE : on rend toujours les 5 axes (AxisRadar existant), mais on
  // affiche un teaser texte "+3 axes Gold" sous le radar quand `visibleAxesCount === 2`.
  // (Évite de toucher la primitive AxisRadar qui n'expose pas la sélection partielle V1.)
  return (
    <>
      <AxisRadar
        axes={[
          { value: palais.axe_racines_horizons, negLabel: t("axis.racines"), posLabel: t("axis.horizons") },
          { value: palais.axe_taniere_nomade,   negLabel: t("axis.taniere"), posLabel: t("axis.nomade")   },
          { value: palais.axe_exigeant_enthousiaste, negLabel: t("axis.exigeant"), posLabel: t("axis.enthousiaste") },
          { value: palais.axe_foule_secret,     negLabel: t("axis.foule"),   posLabel: t("axis.secret")   },
          { value: palais.axe_maquis_table,     negLabel: t("axis.maquis"),  posLabel: t("axis.table")    },
        ]}
        size={220}
        underConstruction={underConstruction}
        underConstructionLabel={t("palais.underConstruction")}
      />
      {visibleAxesCount === 2 && !underConstruction ? (
        <Text style={{ marginTop: 12, fontSize: 12, opacity: 0.7, textAlign: "center" }}>
          {t("profile.palais_gold_teaser")}
        </Text>
      ) : null}
    </>
  );
}
```

**And** le composant est testable visuellement via Storybook (V1.5+ — pas livré V1) et fonctionnellement via test unit (cf. AC #6).

---

**AC #2 — Écran `(tabs)/profile.tsx` refactorisé**

**Given** [app/app/(tabs)/profile.tsx](../../app/app/%28tabs%29/profile.tsx) stub actuel
**When** Story 5.3 est livrée
**Then** l'écran est refactorisé selon la structure :

```tsx
// app/app/(tabs)/profile.tsx (refactor complet)

import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { useTheme } from "../../src/theme/ThemeProvider";
import { SpawterCard } from "../../src/components/SpawterCard";
import { OfflineQueueInspector } from "../../src/components/OfflineQueueInspector";
import { useSpawterStore } from "../../src/store/spawter-store";
import { STADE_DESCRIPTORS } from "../../src/types/stade";
import { resetAll } from "../../src/lib/storage";
import { inspect } from "../../src/lib/offline-queue";
import { isGoldSpawter } from "../../src/lib/spawter-gold"; // nouveau helper V1 stub
import { defaultTitleKeyForStade } from "../../src/lib/titres-catalogue"; // Story 5.2
import { track } from "../../src/lib/analytics";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const spawter = useSpawterStore((s) => s.spawter);
  const palais = useSpawterStore((s) => s.palais);
  const spawts = useSpawterStore((s) => s.spawts);
  const savedPlaceIds = useSpawterStore((s) => s.savedPlaceIds);
  const collectionTitres = useSpawterStore((s) => s.collectionTitres);
  const setDisplayedTitle = useSpawterStore((s) => s.setDisplayedTitle);
  const reset = useSpawterStore((s) => s.reset);

  // Story 4.3 — offline queue inspector (préservé du stub précédent).
  const [queueSize, setQueueSize] = useState(0);
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const refreshQueueSize = useCallback(async () => {
    const list = await inspect();
    setQueueSize(list.length);
  }, []);
  useEffect(() => {
    void refreshQueueSize();
    const id = setInterval(() => { void refreshQueueSize(); }, 5000);
    return () => clearInterval(id);
  }, [refreshQueueSize]);

  // Analytics : profil ouvert.
  useEffect(() => {
    track({ name: "profile_opened", properties: {} });
  }, []);

  if (!spawter || !palais) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg }}>
          <Text style={{ color: theme.colors.text.secondary }}>{t("profile.onboarding_pending")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Stats dérivés.
  const reviewsCount = spawts.filter((s) => s.note_etoiles !== null).length;
  const isGold = isGoldSpawter(spawter); // V1 = toujours false.
  const displayedTitleRow = collectionTitres.find((r) => r.is_displayed);
  const displayedTitleKey = displayedTitleRow?.title_key ?? defaultTitleKeyForStade(spawter.stade);

  const stadeDesc = STADE_DESCRIPTORS[spawter.stade];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: theme.colors.surface.base }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        {/* Header neighborhood */}
        <Text style={{
          ...theme.typography.preset.overline,
          color: theme.colors.text.tertiary,
        }}>
          {spawter.neighborhood ?? t("profile.neighborhood_unknown")}
        </Text>

        {/* La carte spawter flip 3D */}
        <SpawterCard
          spawter={spawter}
          palais={palais}
          displayedTitleKey={displayedTitleKey}
          isGold={isGold}
          totalSpawts={spawter.total_spawts}
          uniqueSpots={spawter.unique_spots}
          reviewsCount={reviewsCount}
        />

        {/* Comportement du stade (sous la carte) */}
        <View style={{
          padding: theme.spacing.base,
          backgroundColor: theme.colors.surface.subtle,
          borderRadius: theme.radius.lg,
        }}>
          <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}>
            {t("profile.stade_section_title")}
          </Text>
          <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.primary, marginTop: theme.spacing.xs }}>
            {stadeDesc.behavior}
          </Text>
        </View>

        {/* Collection de titres (Story 5.2 — toggle) */}
        <CollectionTitlesSection
          collectionTitres={collectionTitres}
          displayedTitleKey={displayedTitleKey}
          onSetDisplayed={(key) => { void setDisplayedTitle(key); }}
        />

        {/* Quick links */}
        <View style={{ gap: theme.spacing.sm }}>
          <QuickLink label={t("profile.link_saved")} count={savedPlaceIds.size} onPress={() => router.push("/saved")} />
          <QuickLink label={t("profile.link_spawts")} count={spawter.total_spawts} onPress={() => Alert.alert(t("profile.link_spawts_stub"))} />
          <QuickLink label={t("profile.link_settings")} onPress={() => Alert.alert(t("profile.link_settings_stub"))} />
        </View>

        {/* Story 4.3 — inspector (conservé) */}
        {queueSize > 0 ? (
          <Pressable onPress={() => setInspectorVisible(true)}>
            <Text>{t("offline_queue.open_button")} · {queueSize}</Text>
          </Pressable>
        ) : null}

        {/* Reset démo (conservé) */}
        <Pressable onPress={async () => { await resetAll(); reset(); }}>
          <Text style={{ color: theme.colors.state.danger, textAlign: "center" }}>
            {t("profile.reset_demo")}
          </Text>
        </Pressable>
      </ScrollView>
      <OfflineQueueInspector
        visible={inspectorVisible}
        onClose={() => { setInspectorVisible(false); void refreshQueueSize(); }}
      />
    </SafeAreaView>
  );
}
```

**And** la section `CollectionTitlesSection` et `QuickLink` sont des **sub-components du même fichier** ou extraits dans `app/src/components/profile/` (recommandation : extrait pour lisibilité).

---

**AC #3 — Section « Collection de titres » avec toggle**

**Given** la collection est livrée par Story 5.2
**When** Story 5.3 est livrée
**Then** le composant `CollectionTitlesSection` :

1. Affiche un header `t("profile.collection_title")` (« Tes titres »).
2. Si `collectionTitres.length === 0` (théoriquement impossible car Touriste unlock se fait à finalize, mais defensive) : affiche `t("profile.collection_empty")` (« Tes titres apparaîtront ici à chaque montée »).
3. Sinon : mappe sur les rows triées par `unlocked_at` desc.
4. Chaque titre = `Pressable` avec :
   - Label `t(row.title_key)` (i18n auto).
   - Indicateur visuel si `is_displayed` (cocarde or, contraste WCAG AA).
   - Au tap → `onSetDisplayed(row.title_key)` (qui appelle `setDisplayedTitle` côté store).
5. **Pas d'animation gamifiée** (anti-Duolingo). Transition simple — couleur change, c'est tout.

```tsx
// app/src/components/profile/CollectionTitlesSection.tsx (nouveau)
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeProvider";
import type { CollectionTitreRow } from "../../types/collection-titres";

interface Props {
  collectionTitres: CollectionTitreRow[];
  displayedTitleKey: string;
  onSetDisplayed: (title_key: string) => void;
}

export function CollectionTitlesSection({ collectionTitres, displayedTitleKey, onSetDisplayed }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (collectionTitres.length === 0) {
    return (
      <View style={{ padding: theme.spacing.base }}>
        <Text style={{ ...theme.typography.preset.caption, color: theme.colors.text.tertiary }}>
          {t("profile.collection_title")}
        </Text>
        <Text style={{ ...theme.typography.preset.body, color: theme.colors.text.secondary }}>
          {t("profile.collection_empty")}
        </Text>
      </View>
    );
  }

  const sorted = [...collectionTitres].sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at));

  return (
    <View>
      <Text style={{
        ...theme.typography.preset.caption,
        color: theme.colors.text.tertiary,
        marginBottom: theme.spacing.sm,
      }}>
        {t("profile.collection_title")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {sorted.map((row) => {
          const isDisplayed = row.title_key === displayedTitleKey;
          return (
            <Pressable
              key={row.id}
              onPress={() => { if (!isDisplayed) onSetDisplayed(row.title_key); }}
              accessibilityRole="button"
              accessibilityState={{ selected: isDisplayed }}
              accessibilityLabel={t("profile.title_select_aria", { title: t(row.title_key) })}
              style={{
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.base,
                borderRadius: theme.radius.full,
                backgroundColor: isDisplayed ? theme.colors.brand.primary : theme.colors.surface.subtle,
                borderWidth: 1,
                borderColor: isDisplayed ? theme.colors.brand.primary : theme.colors.border.subtle,
              }}
            >
              <Text style={{
                ...theme.typography.preset.caption,
                color: isDisplayed ? theme.colors.text.onBrand : theme.colors.text.primary,
              }}>
                {t(row.title_key)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```

---

**AC #4 — Helper `isGoldSpawter` (stub V1)**

**Given** le dossier `app/src/lib/`
**When** Story 5.3 est livrée
**Then** [app/src/lib/spawter-gold.ts](../../app/src/lib/spawter-gold.ts) existe :

```ts
// PRD §11 — Spawter Gold (premium). V1 = stub `false` car le funnel paiement
// CinetPay arrive Sprint 2. Hook prêt pour V1.5 wirage `customer_id !== null
// && subscriptions.is_active` (jointure avec table customers qui existe déjà
// Story 1.x amendement 4.2).

import type { Spawter } from "../types/spawter";

/** Indique si un spawter est Gold (premium actif). V1 = toujours false. */
export function isGoldSpawter(_spawter: Spawter): boolean {
  // Sprint 2 : check `_spawter.customer_id !== null` + lookup subscriptions.is_active.
  // V1 = pas de paywall paiement, donc personne n'est Gold.
  return false;
}
```

**And** la function est consommée par :
- `(tabs)/profile.tsx` pour la prop `isGold` de `SpawterCard`.
- Pas d'autres consommateurs V1 (le paywall feed `PRD FR-015` est hors scope Story 5.3 — déjà géré ailleurs).

---

**AC #5 — Gate `confidence_score < 0.3` → `underConstruction`**

**Given** un spawter récent (`unique_spots < 7` typiquement → `confidence < 0.3`)
**When** la carte est flippée et le verso est rendu
**Then** le radar affiche « En construction » via la prop `underConstruction={true}` d'`AxisRadar` (label `t("palais.underConstruction")`).
**And** le teaser Gold « +3 axes Gold » est **masqué** si `underConstruction` (cohérent : pas de prom avant que les 2 axes soient fiables).
**And** la confidence persiste : `palais.confidence_score` recomputed par Story 4.6 à chaque review. La gate dégèle automatiquement (pas d'action utilisateur nécessaire) dès que confidence ≥ 0.3 (typiquement vers 12+ spots uniques avec quelques avis).

---

**AC #6 — Performance < 1,5s + analytics**

**Given** PRD §3.1 FR-008 acceptance « L'écran s'ouvre en moins de 1,5 seconde »
**When** Story 5.3 est livrée
**Then** :

1. L'écran rend **immédiatement** à partir du state Zustand local (pas d'`await` réseau côté `useEffect` — les sélecteurs sont synchrones).
2. L'animation flip ne déclenche pas de re-render parent (Reanimated 4 sur UI thread via `useSharedValue` + `useAnimatedStyle`).
3. `SpawterCard` est **memoisable** : props sont stables tant que `spawter`, `palais`, `collectionTitres` ne mute pas. **Recommandation** : `React.memo` côté `SpawterCard` (déjà cohérent project-context performance gotchas « Sélecteurs Zustand granulaires »).
4. Events analytics émis :
   - `profile_opened` au mount (1× par session de tab — `useEffect` sans deps).
   - `spawter_card_flipped` à chaque flip avec `to: "recto" | "verso"`.
   - `title_displayed_changed` au toggle d'un titre (déjà émis par Story 5.2 `setDisplayedTitle`).

**And** `profile_opened` + `spawter_card_flipped` sont ajoutés à `analytics.ts` + `events.md` (cf. AC #8).

---

**AC #7 — Tests + triple gate + smoke + Test Tantie Rose**

**Given** la suite de tests
**When** `cd app && npm test`
**Then** :

1. **`spawter-gold.test.ts`** — `isGoldSpawter(any spawter)` retourne `false` (V1 stub).
2. **`SpawterCard.test.tsx`** (React Testing Library + jest-expo) :
   - Render avec props synthétiques → trouve le `display_name`, le label du stade, les 3 stats.
   - Tap sur la carte → `flipProgress` swap (testé via `onPress` mock + assert `track` appelé avec `spawter_card_flipped`).
   - `isGold: false` + `confidence: 0.5` → radar visible côté verso, teaser Gold visible.
   - `isGold: true` → radar 5 axes, pas de teaser.
   - `confidence: 0.2` → `underConstruction: true`, pas de teaser.
3. **`CollectionTitlesSection.test.tsx`** :
   - 0 titres → empty state rendu.
   - 3 titres dont 1 displayed → la pastille displayed a le style or, les 2 autres normal.
   - Tap sur un titre non-displayed → `onSetDisplayed` callback called avec la bonne clé.
4. **`profile-screen.test.tsx`** (smoke RTL) :
   - Spawter null → onboarding pending.
   - Spawter présent → SpawterCard mount + CollectionTitlesSection mount + QuickLinks mount.

**Given** la triple gate
**When** lancée
**Then** `tsc --noEmit && lint:vocab && i18n:check && npm test` vert.
**And** `expo export --platform android` compile (smoke).
**And** **Test Tantie Rose** (Alexandre) passe :
1. *Tantie Rose comprend-elle ?* — Oui (« Ta carte », « Tes titres », « Tes spots »).
2. *Brice Konan partage-t-il sans honte ?* — Oui (gr-night + or = premium).
3. *Dominic se sent appartenir ?* — Oui (la carte fait la fierté, pas l'utilité).

---

**AC #8 — i18n + events.md + analytics.ts**

**Given** le fichier [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 5.3 est livrée
**Then** la section `profile.*` est étendue :

```json
"profile": {
  "onboarding_pending": "Onboarding pas terminé.",
  "neighborhood_unknown": "Quartier non renseigné",
  "card_id_prefix": "SPAWTER",
  "card_flip_aria": "Retourner la carte pour voir le Palais",
  "stat_spawts": "Spawts",
  "stat_spots": "Spots uniques",
  "stat_avis": "Avis",
  "stade_section_title": "TON STADE",
  "collection_title": "TES TITRES",
  "collection_empty": "Tes titres apparaîtront ici à chaque montée.",
  "title_select_aria": "Afficher le titre {{title}}",
  "palais_gold_teaser": "+3 axes débloqués avec Spawter Gold (bientôt)",
  "link_saved": "Mes spots",
  "link_spawts": "Mes spawts",
  "link_settings": "Réglages",
  "link_spawts_stub": "Cet écran arrive au prochain sprint.",
  "link_settings_stub": "Cet écran arrive au prochain sprint.",
  "reset_demo": "Réinitialiser le compte (mode démo)"
}
```

**And** `events.md` §X (nouveau section ou §9) ajoute :

```md
| `profile_opened` | Ouverture de l'onglet profil | — |
| `spawter_card_flipped` | Flip de la carte spawter | `to` ("recto" | "verso") |
```

**And** [app/src/lib/analytics.ts](../../app/src/lib/analytics.ts) ajoute :
- `"profile_opened"` + `"spawter_card_flipped"` dans `EventName`.
- Entries `profile_opened: "view"` + `spawter_card_flipped: "click"` dans `EVENT_TO_SIGNAL`.

## Tasks / Subtasks

- [ ] **Task 1 — Helper Gold + Catalogue consommation** (AC: #4)
  - [ ] Créer `app/src/lib/spawter-gold.ts` avec `isGoldSpawter()` stub V1.
  - [ ] Snapshot test (assert false invariant).

- [ ] **Task 2 — Composant `SpawterCard`** (AC: #1, #5)
  - [ ] Créer `app/src/components/SpawterCard.tsx` + sous-composant `PalaisRadarGated`.
  - [ ] Reanimated 4 `useSharedValue` + `interpolate` rotateY 0→180.
  - [ ] LinearGradient recto `gradient.night`, surface verso `colors.surface.subtle` (= `palette.cremeSable` ≈ `bg-warm`).
  - [ ] Consommer `AxisRadar` au verso (passer 5 axes, prop `underConstruction`).
  - [ ] Memoize via `React.memo` ou exposer simple component (les rerenders sont contrôlés par les sélecteurs parent).

- [ ] **Task 3 — Composant `CollectionTitlesSection`** (AC: #3)
  - [ ] Créer `app/src/components/profile/CollectionTitlesSection.tsx`.
  - [ ] Sort by `unlocked_at` desc, render pastilles.
  - [ ] Empty state.
  - [ ] Callback `onSetDisplayed`.

- [ ] **Task 4 — Refactor écran `(tabs)/profile.tsx`** (AC: #2)
  - [ ] Remplacer le stub par la structure cible (header → SpawterCard → comportement → CollectionTitlesSection → QuickLinks → OfflineQueueInspector → reset démo).
  - [ ] Sélecteurs Zustand granulaires (1 par state).
  - [ ] `useEffect` mount → `track("profile_opened")`.
  - [ ] Quick links : `/saved` (router.push), `/spawts` + `/settings` stubs Alert.

- [ ] **Task 5 — i18n + events.md + analytics.ts** (AC: #8)
  - [ ] Étendre `fr.json` section `profile.*` (15+ clés).
  - [ ] `events.md` §9 ou nouveau §10 : `profile_opened`, `spawter_card_flipped`.
  - [ ] `analytics.ts` : ajouter 2 entries dans `EventName` + `EVENT_TO_SIGNAL`.

- [ ] **Task 6 — Tests** (AC: #7)
  - [ ] `spawter-gold.test.ts` (assert false).
  - [ ] `SpawterCard.test.tsx` (5 cas).
  - [ ] `CollectionTitlesSection.test.tsx` (3 cas).
  - [ ] `profile-screen.test.tsx` (2 cas smoke).
  - [ ] Pas de snapshot pixel-perfect (project-context invariant).

- [ ] **Task 7 — Triple gate + smoke + Test Tantie Rose** (AC: #7)
  - [ ] `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [ ] `expo export --platform android` compile.
  - [ ] Manual : screen render < 1,5s (mesure à l'œil sur Tecno Spark + Pixel mid-range).
  - [ ] CHANGELOG `feat(profile)` Story 5.3.

## Dev Notes

### 1. Décision D1 — `expo-linear-gradient` déjà installé

Architecture §3 + project-context Stack mentionnent `expo-linear-gradient ~55.0.14` installé Story 2.2. Pas de nouvelle dépendance pour Story 5.3.

**Si absent à la dev** : `npx expo install expo-linear-gradient` + valider que `app.json` n'en a pas besoin de plus.

### 2. Décision D2 — Flip 3D Reanimated 4 vs autres approches

Options envisagées :
- **A** — `Animated.View` legacy + `rotateY` interpolated. Performant mais déprécié.
- **B** — `react-native-flip-card` (lib tierce). +bundle, +risque.
- **C** — **Reanimated 4** (Project stack canonique) avec `useSharedValue` + `interpolate` rotateY. Worklet sur UI thread, 60 FPS garanti.

**Décision : C** — cohérent avec project-context « Reanimated 4.x impose le plugin Babel (déjà dans `babel.config.js`) ».

**Trade-off `backfaceVisibility`** : sur Android/iOS, le natif gère bien `backfaceVisibility: "hidden"` mais peut bug sur certains drivers Tecno/Infinix. **Mitigation** : double opacity gate (recto opacity = 1 si `< 0.5`, sinon 0) en plus de backfaceVisibility — défense en profondeur.

### 3. Décision D3 — Gate 2 vs 5 axes V1 = teaser texte, pas vraie partition

PRD §3.1 FR-008 : « Palais radar à 2 axes en accès gratuit ou 5 axes complets pour les Spawter Gold ». **Implémentation V1** :

- **Option A (cible)** : exposer une prop `axesToShow: 2 | 5` sur `AxisRadar` qui masquerait 3 axes (transparence, ou les laisser au centre). Complexe — touche la primitive midfi-kit, peut affecter les autres usages (Story 3.4 ADN).
- **Option B (V1 pragmatique)** : rendre toujours les 5 axes mais **ajouter un teaser texte** « +3 axes débloqués avec Spawter Gold (bientôt) » sous le radar quand `visibleAxesCount === 2`. L'utilisateur voit déjà ses 5 axes (transparence avant tout — PRD §20 « identité avant utilité »), le teaser communique l'avantage Gold.

**Décision V1 : Option B** — pragmatique, ne casse pas `AxisRadar`, V1.5 pourra introduire la vraie partition quand le paywall sera actif.

**Trade-off** : V1 ne « monétise » pas le radar caché. Acceptable Sprint 1 (pas de paywall paiement V1).

**V1.5+** : trancher avec Alexandre + Stéphanie si on partitionne vraiment ou si on garde la transparence.

### 4. Décision D4 — Pas de Chat sur le profil V1

PRD §3.1 Feature 8 ne mentionne pas le Chat sur le profil. Le profil V1 = identité statique, pas une page conversation. Le Chat parle ailleurs (HomeD, notif, célébrations Story 5.4).

**V2** : possibilité d'ajouter un moment `profile_opened` au `chat-voice.ts` avec un mot du Chat « Tu es là » selon le stade — mais pas critique V1 (encombre l'écran).

### 5. Décision D5 — Routes futures (`/spawts`, `/settings`) en stub

Le PRD §3.1 FR-008 mentionne « quick links Mes spots / spawts / réglages ». V1 :
- `/saved` existe (Story 3.6 — favoris). ✅
- `/spawts` n'existe pas — V1 stub `Alert("Cet écran arrive au prochain sprint")`.
- `/settings` n'existe pas — V1 stub idem.

**Trade-off** : 2 quick links inactifs. Acceptable Sprint 1 — l'identité prime sur l'utilité (la liste de spawts est secondaire). Sprint 2 livrera ces 2 écrans.

### 6. Décision D6 — Avatar = initiale, pas photo

PRD §3.1 FR-008 mentionne « nom, avatar, quartier ». La table `spawters.avatar_url` existe mais V1 = pas de upload photo profil (Story 2.x n'a pas livré). V1 = **avatar = initiale du nom sur fond or** (cohérent avec le glyphe `✦` du `BadgePremierSpawt`).

**Sprint 2** : upload photo profil via expo-image-picker + Supabase Storage (bucket déjà créé `place-photos`, ajouter `spawter-avatars`).

### 7. Non-régression Stories 1-4

- **Story 1.x** : `useTheme()`, tokens canoniques, primitives midfi-kit consommés. Pas de modif.
- **Story 2.x** : `finalizeOnboarding` continue de set `palais.confidence_score` initial via `computeConfidence(answeredCount)`. Story 5.3 lit ce score → la gate `< 0.3` fonctionne dès le 1er rendu (un spawter qui a répondu aux 5 questions a typiquement `confidence ≈ 0.2` = « En construction »).
- **Story 3.x** : `AxisRadar` est partagé entre Story 3.4 (fiche lieu ADN) et Story 5.3 (profil Palais). Pas de modif côté `AxisRadar` — la prop `underConstruction` est consommée dans les 2 contextes.
- **Story 4.x** : `BadgePremierSpawt` continue de mount au root layout (`pendingBadge` consommé). Story 5.3 voit le titre Premier Spawt dans la collection (cf. Story 5.2 câblage).
- **Story 5.1 + 5.2** : Story 5.3 consomme les stores enrichis. Si Story 5.2 livre `collectionTitres = []` (fresh), l'écran rend gracieusement (empty state).

### 8. Performance

- **Mount** : 1 sélecteur Zustand par state (5 sélecteurs), tous synchrones. < 50ms.
- **Render initial** : SpawterCard + CollectionTitlesSection + QuickLinks. Aucun fetch. < 200ms sur Tecno Spark.
- **Flip** : Reanimated 4 worklet → 60 FPS UI thread. Pas de re-render JS.
- **Cible < 1,5s** : largement respectée. Marge confortable pour Sprint 2 ajouts.

### 9. Sign-off

- **Stéphanie** (tech) : revue Reanimated 4 `backfaceVisibility` Android compat (test Tecno/Infinix), revue mémo `SpawterCard` (pas de re-render parasite), revue perf < 1,5s.
- **Kidam** (analytics) : confirmer `profile_opened` + `spawter_card_flipped` events.md §9 ou §10 (créer si nécessaire « Identité & Profil »), confirmer cohorte « % spawters qui flippent leur carte » V1.
- **Alexandre** (brand) : audit copy `profile.*` (« Ta carte », « Tes titres », « Tes spots »), Test Tantie Rose, validation Avatar = initiale OK V1, validation Teaser Gold « bientôt » acceptable.

### 10. Defers identifiés

- **D-531** — Upload photo profil V1.5+ (Story 5.3 PASS 2 si demande utilisateur).
- **D-532** — Vraie partition 2 vs 5 axes radar quand Gold actif (V1.5 paywall).
- **D-533** — Écrans `/spawts` + `/settings` V1.5+.
- **D-534** — Moment `profile_opened` dans `chat-voice.ts` (V2 si Alexandre demande).
- **D-535** — Animation contre-flip (auto-flip back après 5s d'inactivité) — UX nice-to-have, defer Sprint 2.
- **D-536** — `is_gold` câblé sur `customer_id + subscriptions.is_active` (Sprint 2 paiement CinetPay).

### 11. Risk

- **Risque #1** — Reanimated 4 `backfaceVisibility` bug sur driver Android Tecno/Infinix. **Mitigation** : double-gate (rotateY + opacity conditionnelle) ; test manuel obligatoire matrice 4 devices.
- **Risque #2** — Layout shift au mount si `collectionTitres` est hydraté async. **Mitigation** : empty state pendant l'hydrate (le store hydraté en parallèle des autres états, donc rapide en pratique — `hydrating: false` gate déjà géré côté RouteGuard).
- **Risque #3** — i18n `t(row.title_key)` pour des clés inconnues (drift Sprint 2) → la string retournée = la clé brute (« title.xxx »). **Mitigation** : `isKnownTitleKey` check côté `unlockTitle` Story 5.2 + snapshot test catalogue figé.
- **Risque #4** — Le teaser Gold V1 sonne « promotionnel » → risque drift brand. **Mitigation** : copy « +3 axes débloqués avec Spawter Gold (bientôt) » discret, italic, opacity 0.7 — informationnel pas vendeur. Audit Alexandre.

### Project Structure Notes

- **1 nouveau composant** : `app/src/components/SpawterCard.tsx`.
- **1 nouveau composant** : `app/src/components/profile/CollectionTitlesSection.tsx`.
- **1 nouveau helper** : `app/src/lib/spawter-gold.ts`.
- **1 fichier refactoré** : `app/app/(tabs)/profile.tsx`.
- **1 fichier modifié** : `app/src/lib/analytics.ts` (+ 2 events).
- **1 fichier modifié** : `app/src/i18n/fr.json` (+ section `profile.*`).
- **1 fichier modifié** : `documentation/analytics/events.md` (+ 2 lignes).
- **4 fichiers tests** : `spawter-gold.test.ts`, `SpawterCard.test.tsx`, `CollectionTitlesSection.test.tsx`, `profile-screen.test.tsx`.
- **Pas de nouvelle dépendance** (expo-linear-gradient déjà installée Story 2.2, Reanimated 4 déjà installée).
- **Pas de migration SQL** — Story 5.1 + 5.2 ont livré les tables.

### References

- [_bmad-output/planning-artifacts/epics.md#L1034-L1056](../planning-artifacts/epics.md#L1034-L1056) Story 5.3
- [_bmad-output/planning-artifacts/PRD.md §3.1 FR-008 + §5.1](../planning-artifacts/PRD.md) Profil spawter + Palais 5 axes
- [_bmad-output/planning-artifacts/PRD.md §20.1](../planning-artifacts/PRD.md) Identité avant utilité (anti-leaderboard)
- [_bmad-output/planning-artifacts/PRD.md §11](../planning-artifacts/PRD.md) Spawter Gold (helper stub V1)
- [_bmad-output/planning-artifacts/architecture.md#L355-L383](../planning-artifacts/architecture.md#L355-L383) Frontend architecture (Zustand + AxisRadar partagé)
- [_bmad-output/planning-artifacts/architecture.md#L776](../planning-artifacts/architecture.md#L776) Epic 5 mapping `SpawterCard` + `PalaisRadar`
- [_bmad-output/project-context.md §Performance gotchas + §Test Tantie Rose + §Voix du Chat](../project-context.md)
- [_bmad-output/implementation-artifacts/5-1-progression-par-stades-recompute.md](5-1-progression-par-stades-recompute.md)
- [_bmad-output/implementation-artifacts/5-2-collection-de-titres-titre-affiche.md](5-2-collection-de-titres-titre-affiche.md)
- [app/src/components/AxisRadar.tsx](../../app/src/components/AxisRadar.tsx) primitive consommée
- [app/src/components/BadgePremierSpawt.tsx](../../app/src/components/BadgePremierSpawt.tsx) pattern de référence (Reanimated 4 fade)
- [app/src/types/stade.ts](../../app/src/types/stade.ts) STADE_DESCRIPTORS, Stade
- [app/src/types/palais.ts](../../app/src/types/palais.ts) UserPalais, PalaisAxis
- [app/src/theme/tokens.ts](../../app/src/theme/tokens.ts) gradient.night, palette.gold, elevation.glow
- [app/app/(tabs)/profile.tsx](../../app/app/%28tabs%29/profile.tsx) stub actuel à refactor
- [documentation/ux/](../../documentation/ux/) Kit UX canonique (D8 — 5 axes Palais figés)

## Dev Agent Record

### Agent Model Used

_(à compléter au moment de la dev)_

### Debug Log References

_(à compléter)_

### Completion Notes List

_(à compléter)_

### File List

_(à compléter)_
