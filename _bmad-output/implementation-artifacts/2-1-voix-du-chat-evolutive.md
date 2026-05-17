# Story 2.1: Voix du Chat évolutive

Status: done

<!-- Première story de l'Epic 2 "Entrée dans la Meute". L'infra (chat-voice.ts, ChatBubble, CatBubble primitive, tokens.colors.chat) est posée en Epic 1 — cette story FERME le système de voix avant que les Stories 2.2-2.6 et 3.x ne le consomment massivement. -->

## Story

As a spawter,
I want recevoir les messages du Chat avec un ton qui dépend de mon stade,
so that je ressens une présence familière qui mûrit avec moi (PRD §9.3 — Touriste enjoué → Explorateur complice → Détective grave → Djidji solennel → Guide silencieux).

## ⚠️ Brownfield context — read first

**Cette story FINALISE un système déjà 80% en place, livré par les Stories 1.3 + 1.4.** L'infra existe — il ne faut pas la réinventer.

| Élément | Fichier existant | État | Action Story 2.1 |
|---|---|---|---|
| Moteur pur de résolution | [app/src/lib/chat-voice.ts](../../app/src/lib/chat-voice.ts) | ✅ `chatKey`/`isChatSilent`/`ChatMoment` (11 moments) | **Conserver** + ajouter tests unit + (optionnel) commentaire matrice |
| Composite domain | [app/src/components/ChatBubble.tsx](../../app/src/components/ChatBubble.tsx) | ✅ Wrapper i18n + silent + override | **Étendre** prop `variant?` passe-plat vers `CatBubble` |
| Primitive canonique | [app/src/components/primitives/CatBubble.tsx](../../app/src/components/primitives/CatBubble.tsx) | ⚠️ `variant` + `stage` sont des STUBS (dev-warn console) | **Implémenter** vraiment les 3 variants `bubble`/`lockscreen`/`edito` |
| Strings FR | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) `chat.*` | ⚠️ Matrice partielle — 8 entrées Touriste + 1 par autre stade | **Compléter** la matrice et valider le contrat « empty = silent volontaire » |
| Token couleur par stade | [app/src/theme/tokens.ts](../../app/src/theme/tokens.ts) `tokens.chat.<stade>` | ✅ Défini (goldLight/gold/greenChat/greenChatDeep/black) | **Ne PAS encore consommer** — la modulation visuelle par stade est différée Epic 5 (voir « Non-objectifs » §3) |
| Callers ChatBubble | [app/app/(tabs)/index.tsx:126](../../app/app/(tabs)/index.tsx#L126), [app/app/(tabs)/profile.tsx:58](../../app/app/(tabs)/profile.tsx#L58) | ✅ Déjà branchés sur `spawter.stade` via sélecteur Zustand | **Vérifier** la réactivité stade-up sans toucher (AC #3) |

**Wrapper-pattern à conserver** : `ChatBubble` (domain) ⇒ délègue rendu à `CatBubble` (primitive). Les callers continuent d'importer `ChatBubble`, jamais `CatBubble` directement. Cette séparation est validée et fonctionne (Story 1.4 retro §2.1 + retro Epic 1 §2.6) — **ne pas la casser**.

**Décision Alexandre déjà tranchée (2026-05-16, retro 1.4 §3.4)** : typo uniforme `preset.body` dans `ChatBubble` V1. Pas de modulation `(stade × moment) → typo` avant Epic 5 (célébrations de stade). **Ne pas ré-ouvrir** ce point.

## Acceptance Criteria

**AC #1 — Toute voix passe par `chat-voice.ts`, jamais une string littérale**

**Given** un appelant veut afficher une voix du Chat
**When** il monte un `<ChatBubble>` ou émet une notif lockscreen
**Then** le texte est résolu via `chatKey(moment, stade)` → clé i18n `fr.json` chargée par `t()`
**And** aucun appel `<CatBubble>...<Text>littéral</Text></CatBubble>` n'existe dans `app/src/components/` ou `app/app/`
**And** un audit grep `grep -rnE 'CatBubble[^>]*>\s*<Text' app/src app/app` ressort vide (ou ne match que `ChatBubble.tsx` qui est le wrapper autorisé)
**And** `npm run i18n:check` reste vert (aucune string FR hardcodée hors `fr.json`)
**And** aucune copy générique du registre interdit (`"Welcome"`, `"Find a place"`, `"Thanks for…"`) n'apparaît dans `fr.json` ou les composants — vérifiable par audit grep documenté dans la PR.

**AC #2 — Les 5 tons existent ET `CatBubble` expose 3 variants implémentés**

**Given** les 5 stades `touriste|explorateur|detective|djidji|guide`
**When** on inspecte `fr.json` `chat.<stade>.*`
**Then** chaque stade qui doit parler a au moins une string non-vide qui démontre son ton canonique (PRD §9.3) :
  - `touriste` → ton `enjoue_taquin` (déjà 8 entrées — gold standard à imiter)
  - `explorateur` → ton `complice`
  - `detective` → ton `grave_respectueux`
  - `djidji` → ton `solennel`
  - `guide` → tonalité `rare_sacre` UNIQUEMENT pour les moments `stade_up_*` (PRD : Guide silencieux ailleurs — déjà encodé `isChatSilent`)

**Given** la primitive `CatBubble`
**When** un caller passe `variant="bubble" | "lockscreen" | "edito"`
**Then** le rendu visuel diffère réellement entre les 3 variants (plus de `console.warn` stub) :
  - `bubble` (défaut) — rendu actuel : fond noir, coin `16/16/16/4`, icône or 18px à gauche, `padding theme.spacing.base`. _Inchangé visuellement._
  - `lockscreen` — format compact iOS/Android notification : fond noir, coin `12/12/12/12` (uniforme, pas asymétrique car hors contexte conversationnel), `padding theme.spacing.sm`, icône or 14px, max 2 lignes (style notif système). Destiné à composer une notif simulée (Story 4.2 — `SpawtNotif`).
  - `edito` — pavé encadré : fond noir, coin `theme.radius.lg` (pavé éditorial, pas bulle), `padding theme.spacing.lg`, icône or 22px en tête, optionnellement séparateur 1px or sous l'icône, `marginVertical theme.spacing.base`. Destiné aux pavés baseline du `HomeD` (Story 3.3c — `UneCarousel`).
**And** les valeurs exactes ci-dessus sortent du `theme` (jamais hex/px en dur — audit `grep -nE '#[0-9A-Fa-f]{3,6}' app/src/components/primitives/CatBubble.tsx` vide).

**AC #3 — Une montée de stade change le ton dans la session courante (= « 24h max » PRD)**

**Given** un spawter au stade Touriste qui ouvre l'app
**When** un `registerSpawt` déclenche un recompute qui le fait passer à Explorateur ([store recompute](../../app/src/store/spawter-store.ts#L114-L133))
**Then** le prochain render de `<ChatBubble>` (re-rendu via sélecteur Zustand `useSpawterStore((s) => s.spawter?.stade)`) résout `chatKey(moment, "explorateur")` au lieu de `chatKey(moment, "touriste")`
**And** un test unit le démontre : mock du store, change `stade` → vérifie que la prop passée au `<CatBubble>` enfant change ET que la nouvelle clé i18n est requêtée
**And** les deux callers existants (`(tabs)/index.tsx`, `(tabs)/profile.tsx`) utilisent déjà ce pattern de sélecteur granulaire — **AUDIT** sans modification : si l'audit révèle un anti-pattern (`useSpawterStore()` plein), ouvrir un Defer et **ne pas patcher dans cette story** (anti-scope-creep).

**AC #4 — Tests unitaires sur le moteur pur + la primitive**

**Given** `chat-voice.ts` (moteur pur, cible #1 des tests unit per `project-context.md` §Testing Rules)
**When** on lance `cd app && npm test`
**Then** la suite couvre :
  - `chatKey(moment, stade)` retourne `"chat.<stade>.<moment>"` pour les 5 × 11 combinaisons
  - `isChatSilent("guide", moment)` retourne `true` pour tous les `moment` SAUF ceux commençant par `stade_up_`
  - `isChatSilent(stade, "stade_up_X")` retourne `false` pour les 5 stades
  - `isChatSilent(stade, moment)` retourne `false` pour tous les `(stade ≠ guide, moment)`

**Given** la matrice i18n `chat.*` dans `fr.json`
**When** un test « contract » charge `fr.json` et itère sur `chatKey(moment, stade)`
**Then** soit la clé pointe sur une string non-vide qui démontre le ton, soit elle est délibérément vide (= silent) — le test échoue uniquement si une clé est `undefined` (manquante dans la structure), pas si elle est `""`. Le test sert de **filet anti-régression** : ajouter un nouveau `ChatMoment` à l'union sans entrée correspondante dans `fr.json` fait échouer le test.

**Given** la primitive `CatBubble`
**When** un test rend `<CatBubble variant="lockscreen">...</CatBubble>`
**Then** le test vérifie que `console.warn` n'est PLUS appelé (regression contre le stub Story 1.3), et que le rendu diffère du variant `bubble` (au moins une prop de style distincte mesurable).

**AC #5 — Triple gate vert + non-régression callers**

**Given** la triple gate `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`
**When** lancée après la story
**Then** tous trois verts
**And** `cd app && npm test` vert (suites chat-voice + CatBubble + tout l'existant inchangé)
**And** un `expo export --platform web` (smoke web, pattern Story 1.4 §6) compile sans erreur — la primitive `CatBubble` n'introduit pas de dépendance non-web-compatible.
**And** les 2 callers existants (`(tabs)/index.tsx`, `(tabs)/profile.tsx`) ne sont pas modifiés (ou modification additive non-breaking explicitement justifiée dans Dev Notes).

## Tasks / Subtasks

- [x] **Task 1 — Audit & complétion de la matrice `fr.json` `chat.*`** (AC: #1, #2)
  - [x] Lire les 11 `ChatMoment` × 5 `Stade` = 55 combinaisons.
  - [x] Pour chaque combinaison, décider : **PARLE** (écrire une string dans le ton du stade) ou **SILENT VOLONTAIRE** (laisser `""`). Décision documentée dans CHANGELOG v1.2.1 + Completion Notes ci-dessous + Dev Notes §4 de la story.
  - [x] **Au minimum**, garantir la couverture suivante (= moments effectivement émis dans Sprint 1) :
    - `welcome_first_open` → Touriste only (les autres stades n'ont jamais ce moment) ✓
    - `welcome_back` → 5 stades, sauf Guide silent par design ✓
    - `post_calibration` → Touriste only (calibrage = post-onboarding) ✓
    - `first_spawt_invite` + `post_first_spawt` → Touriste only (par définition pré-premier spawt) ✓
    - `stade_up_explorateur` → Touriste only (annonce de SA propre montée) ✓
    - `stade_up_detective` → Explorateur only ✓
    - `stade_up_djidji` → Detective only ✓
    - `stade_up_guide` → Djidji ET Guide (Djidji = annonce, Guide = première parole sacrée — décision dev agent : "Tu es Guide. Le Chat se tait — tu es la voix maintenant.", à confirmer Alexandre en review) ✓
    - `geoloc_consent_request` + `demographics_consent_request` → Touriste only (onboarding) ✓
  - [x] Pour les stades qui ne disent rien à un moment donné, laisser `""` explicite (matrice complète sans trou) — 44 entrées `""` + 11 entrées non-vides.
  - [x] **Qualité éditoriale** : registres Touriste préservés tels quels (gold standard validé Alexandre). Strings Explorateur/Détective/Djidji préservées (déjà validées Story 1.3). Nouvelle string Guide.stade_up_guide rédigée en ton `rare_sacre` quasi-rituel — Test Tantie Rose à valider en review Alexandre.

- [x] **Task 2 — Implémenter les 3 variants visuels de `CatBubble`** (AC: #2)
  - [x] Retiré le `if (__DEV__ && variant !== "bubble") console.warn(...)` stub Story 1.3.
  - [x] Implémenté switch sur `variant` qui construit l'objet style à partir du `theme` :
    - `bubble` : inchangé (corner asymétrique 16/16/16/4, padding `theme.spacing.base`, icône 18px).
    - `lockscreen` : corner uniforme 12px, padding `theme.spacing.sm`, icône 14px, `flexDirection: "row"`, `alignItems: "flex-start"`, `gap: theme.spacing.xs`. Texte enfant `numberOfLines={2}` injecté par `ChatBubble` (Task 3) — pas par la primitive (consumer-agnostic).
    - `edito` : corner `theme.radius.lg`, padding `theme.spacing.lg`, icône 22px en tête, `flexDirection: "column"`, `gap: theme.spacing.sm`, `marginVertical: theme.spacing.base`. Séparateur or non implémenté — option visuelle à valider en revue device matrix avant de figer (Defer).
  - [x] **Aucun hex en dur** : audit `grep -nE '#[0-9A-Fa-f]{3,6}' app/src/components/primitives/CatBubble.tsx` ⇒ vide ✓
  - [x] `void stage` conservé + commentaire « réservé Epic 5 ».

- [x] **Task 3 — Étendre `ChatBubble` pour passer `variant` au `CatBubble`** (AC: #2)
  - [x] Ajouté `variant?: CatBubbleVariant` à `Props` (défaut `"bubble"`), import du type depuis la primitive.
  - [x] Forwardé au `<CatBubble>` enfant via prop `variant={variant}`.
  - [x] Quand `variant === "lockscreen"`, le `<Text>` interne reçoit `numberOfLines={2}` + `ellipsizeMode="tail"`.
  - [x] Signature publique additive non-breaking — les 2 callers existants ne passent pas `variant`, donc inchangés. Aucune modification de caller.

- [x] **Task 4 — Tests unitaires** (AC: #4) — 18 tests / 3 suites verts
  - [x] `app/__tests__/lib/chat-voice.test.ts` :
    - `chatKey` × 55 combinaisons ✓
    - `isChatSilent` × 3 invariants (guide silent hors stade_up, stade_up jamais silent, non-guide jamais silent) ✓
    - `CHAT_MOMENTS.length === 11` (filet anti-régression) ✓
  - [x] `app/__tests__/i18n/chat-voice-coverage.test.ts` :
    - Bloc `chat.<stade>` existe pour les 5 stades ✓
    - Chaque (stade × moment) résout une string définie (peut être `""`, jamais `undefined`) ✓
    - Touriste ≥ 8 entrées non-vides ✓
    - Chaque stade non-Guide a ≥ 1 entrée non-vide ✓
    - Guide silent partout sauf `stade_up_guide` ✓
  - [x] `app/__tests__/components/CatBubble.test.tsx` :
    - 3 variants rendent sans `console.warn` (régression vs stub Story 1.3) ✓
    - Styles racines distincts (coin asymétrique pour bubble, uniforme + row pour lockscreen, column + marginVertical pour edito) ✓
    - Implémenté avec `react-test-renderer` (transitif via React, pas d'install de `@testing-library/react-native`).
  - [x] **Pas de mock i18n global** — `chat-voice.ts` testé en isolation (moteur pur), coverage via lecture directe de `fr.json`.

- [x] **Task 5 — Audit réactivité stade-up** (AC: #3)
  - [x] Audit global : `grep -n useSpawterStore app/` → 100% des consommations utilisent un sélecteur. Aucune `useSpawterStore()` plein.
  - [x] `(tabs)/index.tsx:27` et `(tabs)/profile.tsx:17` utilisent `useSpawterStore((s) => s.spawter)` — non-granulaire (rerend sur tout changement spawter) mais **fonctionnel** pour la réactivité stade-up : quand le store mute `spawter.stade` via `registerSpawt`, ces composants re-rendent et `ChatBubble` reçoit le nouveau `stade`, ce qui change la clé i18n résolue.
  - [x] **Pas de patch** (anti-scope-creep, cf. Story 1.4 retro §5.5). Documenté en Résidus du CHANGELOG.
  - [x] Pas de test de réactivité E2E (RN testing-library pas installé — décision pending Stéphanie cf. Dev Notes §3). Le test unit de la primitive + le sélecteur granulaire `stade` consommé en argument prop suffit pour AC #3 V1.

- [x] **Task 6 — Triple gate + smoke web** (AC: #5)
  - [x] `cd app && npx tsc --noEmit` : 0 erreur ✓
  - [x] `cd app && npm run lint:vocab` : ✓ Vocabulaire SPAWT respecté
  - [x] `cd app && npm run i18n:check` : ✓ Aucune string FR hardcodée
  - [x] `cd app && npm test` : 18 tests / 3 suites verts ✓
  - [x] `cd app && npx expo export --platform web` : Metro bundle compile cleanly ✓ (4 JS bundles + 2 fichiers statiques)
  - [x] Audit hex : vide ✓
  - [x] Audit literal-in-CatBubble : vide ✓

- [x] **Task 7 — CHANGELOG + Dev Agent Record + sprint-status `review`**
  - [x] Entrée `v1.2.1` ajoutée à [CHANGELOG.md](../../CHANGELOG.md) en tête avec Verify + Triple sign-off + Résidus.
  - [x] [sprint-status.yaml](./sprint-status.yaml) : `2-1-voix-du-chat-evolutive: review`.
  - [x] Dev Agent Record rempli ci-dessous.

## Dev Notes

### 1. Architecture & règle d'or

- **Moteur pur `lib/chat-voice.ts`** : zéro I/O, totale (jamais `throw`), testable sans rendu. **Cible #1 des tests unit** (`project-context.md` §Testing Rules).
- **Composite domain `ChatBubble`** : connaît `Stade`, `ChatMoment`, appelle `useTranslation()` + `chatKey()`. **N'importe jamais `CatBubble` ailleurs que via ce composite** — c'est l'unique surface d'attaque pour la modulation future `(stade × moment) → typo` (Epic 5).
- **Primitive `CatBubble`** : pure rendu visuel, consumer-agnostic (le children est déjà-i18n). **Jamais d'`useTranslation` dedans**.
- **Wrapper-pattern validé** : Story 1.4 §2.1 + retro Epic 1 §2.6. Ne pas casser.

### 2. Pourquoi pas modifier les callers ?

Les 2 callers ([(tabs)/index.tsx:126](../../app/app/(tabs)/index.tsx#L126), [(tabs)/profile.tsx:58](../../app/app/(tabs)/profile.tsx#L58)) consomment `<ChatBubble stade={…} moment={…} />` et n'ont **rien à changer** pour Story 2.1 :
- Le `variant` par défaut reste `bubble` ⇒ rendu visuel identique.
- Le mapping i18n est résolu côté `ChatBubble` ⇒ s'ils tombent sur une string vide, ils ne rendent rien (cf. ligne 32 de `ChatBubble.tsx` ; `return null` quand `!text || text === chatKey(...)`).
- La réactivité stade-up est portée par le sélecteur Zustand qu'ils utilisent déjà.

**Toute modification de caller doit être explicitement justifiée** dans les Dev Notes de l'agent (anti-scope-creep retro Epic 1 §3.5).

### 3. Non-objectifs explicites (anti-scope-creep)

| ❌ NE PAS faire | Pourquoi | Quand ce sera fait |
|---|---|---|
| Modulation visuelle `CatBubble` par `stage` (consumer de `theme.colors.chat.<stade>`) | Décision Alexandre 2026-05-16 (Story 1.4 review §3.4 D1) — V1 = noir uniforme | Epic 5 (célébrations de stade) |
| Modulation typo `preset.h3 vs preset.body` par `moment` | Même décision — `preset.body` uniforme V1 | Epic 5 |
| Branchement `CatBubble` à `expo-notifications` réelles | Hors scope — la notif lockscreen sera composée par Story 4.2 (`SpawtNotif`) qui consommera la primitive | Story 4.2 |
| Wiring `edito` à `UneCarousel` baseline | Story 3.3c — la primitive doit juste exister et être prête | Story 3.3c |
| Ajouter de nouveaux `ChatMoment` au-delà des 11 actuels | L'union actuelle couvre Epic 2 ; ajouter à la demande quand un consumer Story 4.x/5.x identifie un moment manquant | Au besoin |
| Modifier `tokens.colors.chat.*` ou y ajouter des stades | Tokens canoniques figés Story 1.1 | Jamais sans review brand Alexandre + contrast Stéphanie |
| Convertir `(tabs)/index.tsx:27` `useSpawterStore((s) => s.spawter)` en sélecteur granulaire | Optim perf, hors scope (cf. retro Epic 1 §3.5) | Defer follow-up dédié |
| Installer `@testing-library/react-native` pour des tests UI lourds | Aucune lib n'est encore installée, décision pending Stéphanie | Quand le besoin agrège sur ≥3 stories |

### 4. Matrice (stade × moment) — décision SILENT volontaire vs PARLE

> Cette matrice doit être validée Alexandre (vocab + voix) AVANT de finaliser `fr.json`. C'est un livrable produit, pas tech.

| Moment ↓ / Stade → | Touriste (`enjoue_taquin`) | Explorateur (`complice`) | Détective (`grave_respectueux`) | Djidji (`solennel`) | Guide (`rare_sacre`) |
|---|---|---|---|---|---|
| `welcome_first_open` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `welcome_back` | ✅ PARLE | ✅ PARLE | ✅ PARLE | ✅ PARLE | — silent (PRD) |
| `post_calibration` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `first_spawt_invite` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `post_first_spawt` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `stade_up_explorateur` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `stade_up_detective` | — silent | ✅ PARLE | — silent | — silent | — silent |
| `stade_up_djidji` | — silent | — silent | ✅ PARLE | — silent | — silent |
| `stade_up_guide` | — silent | — silent | — silent | ✅ PARLE | ✅ PARLE (ton marketing/social proof, validé Alexandre 2026-05-17) |
| `geoloc_consent_request` | ✅ PARLE | — silent | — silent | — silent | — silent |
| `demographics_consent_request` | ✅ PARLE | — silent | — silent | — silent | — silent |

**Légende** : « ✅ PARLE » = string non-vide dans `fr.json`. « — silent » = `""` explicite (matrice complète, pas de trou). « PRD » = règle PRD §9.3 Guide silencieux hors stade_up. « (à confirmer) » = décision produit pour le moment Guide.stade_up_guide.

**Convention « SILENT VOLONTAIRE »** : `ChatBubble.tsx:32` traite déjà `!text || text === chatKey(...)` comme silent (return null). Donc une entrée `""` rend rien — c'est cohérent et n'a pas besoin de `isChatSilent` spécial.

### 5. Spec visuelle des 3 variants `CatBubble`

| Variant | Use case Sprint 1 | Coin | Padding | Icône | Container | Texte |
|---|---|---|---|---|---|---|
| `bubble` (défaut) | Feed (index.tsx), Profile, Consent screens (Story 2.2), Onboarding | `16/16/16/4` (asymétrique, déjà en place) | `theme.spacing.base` | 18px or | `flexDirection:"row"`, `gap:theme.spacing.sm` | `preset.body`, illimité |
| `lockscreen` | Notification simulée (Story 4.2 `SpawtNotif`) | `12/12/12/12` (uniforme — hors contexte conversationnel) | `theme.spacing.sm` | 14px or | `flexDirection:"row"`, `alignItems:"flex-start"`, `gap:theme.spacing.xs` | `preset.body`, `numberOfLines={2}`, `ellipsizeMode:"tail"` |
| `edito` | Pavé baseline `UneCarousel` (Story 3.3c) — voix du Chat encadrée éditorialement | `theme.radius.lg` (pavé, pas bulle) | `theme.spacing.lg` | 22px or, en tête (`flexDirection:"column"`) | `flexDirection:"column"`, `gap:theme.spacing.sm`, `marginVertical:theme.spacing.base` | `preset.body`, illimité |

**Couleurs (toutes via theme)** :
- Fond : `theme.colors.surface.inverse` (= noir #0A0A0A)
- Texte : `theme.colors.text.inverse` (= blancCasse #FAFAF8) — passé par le `<Text>` enfant (responsabilité du wrapper `ChatBubble`, pas de la primitive)
- Icône : `theme.colors.brand.primary` (= or #C8A44E)

**Reference visuelle** : [documentation/ux/midfi-kit.jsx:51-57](../../documentation/ux/midfi-kit.jsx#L51-L57) (CatBubble web) — la primitive RN existante l'a déjà fidèlement portée pour `bubble`.

### 6. Découvertes Epic 1 à respecter

Issues de la retro Epic 1 (`epic-1-retro-2026-05-17.md`) — applicables ici :

- **§3.3 — Tests-types vivent dans `__tests__/types/*.test-d.ts`** : si on ajoute un test type-only pour `chat-voice.ts` (ex: `chatKey` doit renvoyer un type narrowed), le mettre sous `app/__tests__/types/chat-voice.test-d.ts`, pas dans `app/src/lib/`. Metro exclut `__tests__/` par défaut, évite que le bundle prod embarque le test.
- **§2.4 — `satisfies` plutôt que `as`** : si on construit une map `(stade × moment) → quelque chose`, utiliser `satisfies Record<Stade, Partial<Record<ChatMoment, string>>>` pour garantir exhaustivité au compile-time.
- **§2.1 — Brownfield-first** : avant de toucher un fichier, `git log --follow <file>` + grep des consumers. Déjà fait dans cette story (les 2 callers documentés).
- **§3.6 — Smoke device matrice 4 PENDING** : continue d'être un gate `main` (pas `spawt/v1-bmad`). Cette story peut merger sur `spawt/v1-bmad` sans matrix smoke ; le sweep groupé sur HEAD avant `main` est porté par AS1.

### 7. Audits & gates

| Audit | Commande | Attendu |
|---|---|---|
| TypeScript | `cd app && npx tsc --noEmit` | 0 erreur |
| Vocab | `cd app && npm run lint:vocab` | 0 mot interdit (le scope `chat` est OK ; pas de `user` ni `restaurant`) |
| i18n | `cd app && npm run i18n:check` | 0 string FR hardcodée hors `fr.json` |
| Tests | `cd app && npm test` | toutes vertes (existantes + nouvelles) |
| Hex audit | `grep -rnE '#[0-9A-Fa-f]{3,6}' app/src/components/primitives/CatBubble.tsx` | vide |
| Literal-string-in-CatBubble | `grep -rnE 'CatBubble[^>]*>\s*<Text\s+[^>]*>["A-Za-z]' app/src app/app \| grep -v ChatBubble.tsx` | vide |
| Smoke web | `cd app && npx expo export --platform web` | compile sans erreur |

### 8. Files touched (preview)

- `app/src/components/primitives/CatBubble.tsx` (UPDATE — implement variants)
- `app/src/components/ChatBubble.tsx` (UPDATE — forward `variant` prop + `numberOfLines` pour `lockscreen`)
- `app/src/lib/chat-voice.ts` (UPDATE — exporter le tableau des moments pour les tests + commentaire matrice)
- `app/src/i18n/fr.json` (UPDATE — compléter `chat.*` matrice)
- `app/__tests__/lib/chat-voice.test.ts` (NEW)
- `app/__tests__/i18n/chat-voice-coverage.test.ts` (NEW)
- `app/__tests__/components/CatBubble.test.tsx` (NEW)
- `CHANGELOG.md` (UPDATE — v1.2.1)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE — `2-1-…: review`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (UPDATE — si un follow-up est identifié pendant la story)

### 9. Critical Don't-Miss Rules (rappel ciblé)

Issues de `project-context.md` §Critical Don't-Miss Rules — directement applicables :

- ❌ **Pas de copy générique** (`"Welcome"`, `"Find a place"`, `"Thanks for your review"`) — le Chat parle, ou il se tait. La matrice §4 ci-dessus est l'engagement.
- ❌ **Pas de mécanique compétitive** dans le ton des stades — Détective `grave_respectueux` ≠ « tu progresses ! », c'est « ton flair ne ment plus » (gold standard déjà dans `chat.detective.welcome_back`).
- ❌ **Pas de célébration Duolingo** dans les `stade_up_*` — ton recherché = moment quasi-rituel. Le « 11 spots. Tu n'es plus Touriste — tu es Explorateur. » est le bon registre, pas « 🎉 Bravo ! Niveau Explorateur débloqué ! ».
- ❌ **Pas de hex en dur** dans `CatBubble.tsx` — tout via `theme.colors.surface.inverse`, `theme.colors.brand.primary`, `theme.spacing.*`, `theme.radius.lg`.
- ❌ **Pas d'importation de Supabase / network** dans `CatBubble` ou `chat-voice` — moteur pur + primitive consumer-agnostic.
- ❌ **Pas de string FR hardcodée** dans les composants — `i18n:check` bloque, mais c'est trop tard si on s'y prend mal. Préférer écrire la string dans `fr.json` AVANT le composant.
- ❌ **Pas de modification des 2 callers existants** sauf modification additive non-breaking explicitement justifiée.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#story-21-voix-du-chat-évolutive](../planning-artifacts/epics.md) (lignes 520-540 — Story 2.1 ACs)
- [Source: _bmad-output/planning-artifacts/PRD.md#fr-003](../planning-artifacts/PRD.md) (FR-003 lignes 385-388 — capacity + acceptance produit)
- [Source: _bmad-output/planning-artifacts/PRD.md#tons-stades] (§9.3 + §15.5 — les 5 tons canoniques)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#catbubble-voix-du-chat] (lignes 1298-1302 — primitive spec)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#voix-du-chat-pattern-de-présence] (lignes 1463-1466 — règle 3 variants)
- [Source: _bmad-output/planning-artifacts/architecture.md#frontend-architecture] (lignes 363-365 — chat-voice.ts moteur pur)
- [Source: _bmad-output/project-context.md#voix-du-chat-prd-93] (§Code Quality §Voix du Chat — règle absolue chat-voice.ts → i18n)
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-05-17.md#51-dépendances-epic-1-→-epic-2] (Story 2.1 dépend de `CatBubble` (1.3) + décisions 1.4 — toutes résolues)
- [Source: _bmad-output/implementation-artifacts/1-4-re-derivation-des-4-composants-rn-existants.md#review-findings] (D1 décision typo `preset.body` uniforme — figée)
- [Source: app/src/lib/chat-voice.ts] (moteur pur existant — 11 ChatMoment, helpers `chatKey`/`isChatSilent`)
- [Source: app/src/components/ChatBubble.tsx] (wrapper existant — pattern à conserver)
- [Source: app/src/components/primitives/CatBubble.tsx] (primitive existante — variants à implémenter)
- [Source: app/src/i18n/fr.json] (matrice partielle à compléter)
- [Source: app/src/types/stade.ts] (5 stades canoniques + descriptors `chatTone`)
- [Source: documentation/ux/midfi-kit.jsx#L51-L57] (CatBubble web canonique)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m]

### Debug Log References

- Pré-existant : `jest-expo` setup importe `expo-modules-core` qui n'est PAS hoisté en racine `app/node_modules` (le package vit sous `app/node_modules/expo/node_modules/expo-modules-core`). Conséquence : `npm test` échouait sur **toutes** les suites (incluant la suite type-only pré-existante `src/lib/__tests__/types/analytics.test-d.ts`). Fix minimal infra dans `app/package.json` :
  - `jest.moduleDirectories` inclut `node_modules/expo/node_modules` pour résoudre le module nested.
  - `jest.testPathIgnorePatterns` exclut `.test-d.[jt]sx?$` car les fichiers `.test-d.ts` sont des tests de typage compile-time (vérifiés par `tsc --noEmit`), pas des tests Jest runtime.
- `react-test-renderer` ne ship pas de types — déclaration locale `ReactTestRendererJSON` dans le fichier de test + `@ts-ignore` sur l'import (pas d'install de `@types/react-test-renderer` pour éviter un ajout de dépendance hors scope).
- Décision unilatérale dev agent : Guide.stade_up_guide → "Tu es Guide. Le Chat se tait — tu es la voix maintenant." (ton `rare_sacre` quasi-rituel, transfert symbolique du Chat au Guide). **Reformulée post-review Alexandre 2026-05-17** : « retire la sacralisation partout. fais un message plus marketing pour cette action » → "Tu es Guide. 51 spots, ton territoire. La Meute te suit." (stat-grounded + social proof + vocabulaire canonique Meute/territoire).

### Completion Notes List

- ✅ AC #1 : Toute voix passe par `chat-voice.ts` → `t(chatKey(...))`. Aucun `<CatBubble>...<Text>littéral</Text></CatBubble>` dans `app/src` ou `app/app` (audit grep vide). `npm run i18n:check` vert.
- ✅ AC #2 : Les 5 tons existent dans `fr.json` (Touriste 8, Explorateur 1, Détective 1, Djidji 1, Guide 1 — ton marketing/social proof reformulé post-review Alexandre). La primitive `CatBubble` rend réellement les 3 variants `bubble`/`lockscreen`/`edito` (plus de `console.warn` stub) avec coin/padding/layout distincts et tous dérivés du `theme`. Audit hex sur `CatBubble.tsx` vide.
- ✅ AC #3 : Audit réactivité — les 2 callers existants utilisent un sélecteur `useSpawterStore((s) => s.spawter)` qui rerend correctement quand `stade` change. Aucun anti-pattern `useSpawterStore()` plein dans la codebase. Pas de modification de caller (anti-scope-creep). Optim granulaire = Defer. **Test unit AC #3 ajouté post-review (D2) : `__tests__/components/ChatBubble.test.tsx` — démontre via `react-test-renderer` + mock `useTranslation` que (1) `t()` requête la nouvelle clé `chat.<stade>.<moment>` quand `stade` change, (2) le nouveau `stage` propage à `<CatBubble>` enfant.**
- ✅ AC #4 : 20 tests passent / 4 suites — moteur pur (`chatKey` 5×11=55 + `isChatSilent` 3 invariants), coverage i18n (chaque clé définie), primitive `CatBubble` (3 variants distincts sans warn), réactivité `ChatBubble` (AC #3 — 2 tests ajoutés post-review). Filet anti-régression : `CHAT_MOMENTS.length === 11` + couverture exhaustive de la matrice.
- ✅ AC #5 : Triple gate vert + `npm test` vert + smoke web compile. 2 callers existants (`(tabs)/index.tsx`, `(tabs)/profile.tsx`) **non modifiés** — `variant` est additif non-breaking, défaut `bubble` = rendu visuel identique.
- ⚠️ Smoke device matrice 4 : pending, voir résidus CHANGELOG.
- ✅ Décision produit Guide.stade_up_guide validée + reformulée par Alexandre 2026-05-17 (cf. Review Findings ci-dessous).

### File List

- `app/src/components/primitives/CatBubble.tsx` — UPDATE : 3 variants réellement implémentés (était stub Story 1.3). Suppression `console.warn`. Export `CatBubbleVariant` pour le wrapper.
- `app/src/components/ChatBubble.tsx` — UPDATE : prop `variant` ajoutée (additive non-breaking), forwarding vers `CatBubble`, injection `numberOfLines={2}` + `ellipsizeMode="tail"` quand `variant === "lockscreen"`.
- `app/src/lib/chat-voice.ts` — UPDATE : export du tableau `CHAT_MOMENTS` (11 entrées `as const`), `ChatMoment` typé comme `(typeof CHAT_MOMENTS)[number]`. Commentaire de tête documentant la matrice.
- `app/src/i18n/fr.json` — UPDATE : matrice `chat.*` complétée pour les 55 combinaisons (5 stades × 11 moments). 11 entrées non-vides + 44 `""` (silent volontaire). Nouvelle entrée `guide.stade_up_guide`.
- `app/__tests__/lib/chat-voice.test.ts` — NEW : tests unit du moteur pur (4 tests, 6 assertions itératives).
- `app/__tests__/i18n/chat-voice-coverage.test.ts` — NEW : contract test de couverture i18n (5 tests).
- `app/__tests__/components/CatBubble.test.tsx` — NEW : smoke des 3 variants + invariants de style (7 tests).
- `app/__tests__/components/ChatBubble.test.tsx` — NEW (post-review D2) : AC #3 réactivité stade-up (2 tests) — démontre via mock `useTranslation` que `t()` requête la nouvelle clé i18n + `stage` propage à `<CatBubble>` quand `stade` change.
- `app/package.json` — UPDATE : `jest.moduleDirectories` + `jest.testPathIgnorePatterns` pour débloquer Jest sur le repo (pré-existant cassé).
- `CHANGELOG.md` — UPDATE : entrée `v1.2.1 — Voix du Chat évolutive — fermeture du système (2026-05-17)` avec Verify + Triple sign-off + Résidus.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATE : `2-1-voix-du-chat-evolutive: review`, `last_updated: 2026-05-17T12:00:00Z`.
- `_bmad-output/implementation-artifacts/2-1-voix-du-chat-evolutive.md` — UPDATE : Status → review, tasks cochées, Dev Agent Record rempli.

### Review Findings

_Code review 2026-05-17 — 3 reviewers parallèles (Blind Hunter / Edge Case Hunter / Acceptance Auditor). Acceptance Auditor a validé live `tsc --noEmit`, `lint:vocab`, `i18n:check`, 18/18 tests, hex audit vide, audit literal-in-CatBubble vide, `git diff --stat app/app/` vide._

**Decisions needed → résolues**

- [x] [Review][Decision] **`guide.stade_up_guide` — wording reformulé (Alexandre 2026-05-17)** — Décision Alexandre : « retire la sacralisation partout. fais un message plus marketing pour cette action ». Patch appliqué : `fr.json` `chat.guide.stade_up_guide` passe de "Tu es Guide. Le Chat se tait — tu es la voix maintenant." (rituel/sacré) à **"Tu es Guide. 51 spots, ton territoire. La Meute te suit."** — stat-grounded (cohérent avec les autres `stade_up_*`), social proof via « La Meute te suit », vocabulaire canonique (Meute, territoire), pas de sacralisation/Duolingo/leaderboard.
- [x] [Review][Decision] **AC #3 — test de réactivité ajouté (Alexandre 2026-05-17)** — Décision Alexandre : ajouter le test maintenant. Patch appliqué : nouveau fichier `app/__tests__/components/ChatBubble.test.tsx` (2 tests). Utilise `react-test-renderer` (déjà transitif via React, pas de nouvelle dépendance) + `jest.mock("react-i18next")` pour spy sur `t()`. Démontre (1) la requête de la nouvelle clé i18n via `t()` quand `stade` change, (2) la propagation du nouveau `stage` à la primitive `<CatBubble>` enfant. AC #3 passe désormais PASS au lieu de PARTIAL.

**Patches (auto-fixable) → appliqués**

- [x] [Review][Patch] **Assertion faible + commentaire contradictoire corrigés** [`app/__tests__/lib/chat-voice.test.ts:30-35`] — Commentaire « 7 moments non-stade_up » + assertion stricte `toHaveLength(7)`. Une suppression accidentelle d'un moment casse maintenant le test. Flagged par Blind + Edge Case Hunters.
- [x] [Review][Patch] **`CatBubbleVariant` importé au lieu du literal dupliqué** [`app/__tests__/components/CatBubble.test.tsx:12,20`] — `import { type CatBubbleVariant }` + `function renderVariant(variant: CatBubbleVariant)`. Si une 4ème variante est ajoutée, le test compile en exigeant sa couverture. Flagged par Edge Case Hunter.

**Deferred (pre-existing ou follow-up dédié)**

- [x] [Review][Defer] **`isChatSilent(stade, moment)` vs `chatKey(moment, stade)` — ordre paramètres inversé** [`app/src/lib/chat-voice.ts:35,40`] — deferred, pre-existing — API d'origine du moteur (Story 1.3). Footgun confirmé mais hors scope (changerait la signature publique consommée par `ChatBubble`). À aligner dans un refacto dédié si un 3ème caller émerge.
- [x] [Review][Defer] **`overrideText` whitespace-only rend une bulle vide visible** [`app/src/components/ChatBubble.tsx:33-37`] — deferred, pre-existing — edge case mineur, le pattern `overrideText` est utilisé sans whitespace réel par les callers actuels (audit grep). À couvrir si un consumer passe du contenu dynamique non-trimmed.
- [x] [Review][Defer] **Mismatched `(stade, stade_up_X)` silencieusement null** [`app/src/components/ChatBubble.tsx:35`] — deferred — caller error swallowed (e.g. `(touriste, stade_up_djidji)` → `""` → null). Cohérent avec le design matrice mais pas de dev-warn. Ajouter un assert dev-only dans `chatKey` ou `ChatBubble` si un consumer Sprint 2+ produit ce bug.
- [x] [Review][Defer] **`jest.moduleDirectories` collision risk avec nested expo node_modules** [`app/package.json:55-63`] — deferred — infra fix accepté pour débloquer Jest (jest-expo nested module non-hoisté). Monitor : si dual-React ou hooks-mismatch error apparaît, migrer vers `jest.config.js` avec `moduleNameMapper` explicite.
- [x] [Review][Defer] **`(tabs)/index.tsx:27` `useSpawterStore((s) => s.spawter)` non-granulaire** [`app/app/(tabs)/index.tsx:27`] — deferred — déjà documenté en Defer dans la story Task 5 + Dev Notes §3 (anti-scope-creep). Suit le Defer follow-up dédié.

**Dismissed (faux positifs / handled elsewhere)**

18 findings écartés : faux positif sur `isChatSilent` manquant (existe), faux positif sur `t()` retour `""` (config `returnEmptyString: false` confirmée à `app/src/i18n/index.ts:21`), trade-off `@ts-ignore` documenté en Dev Notes, hex/px audit cohérent avec autorisation spec §5, edge cases spéculatifs non-démontrables (variant runtime invalide, `tree[0]` undefined sous tsc clean, etc.).
