# Story 2.6: Présentation du Palais initial & premier titre

Status: review

<!-- 5e et dernière story d'Epic 2 — boucle la 1re session : présente le Palais initial calculé Story 2.5, attribue le premier titre, et persiste atomiquement spawter + user_palais (local + Supabase). Émet `onboarding_completed` (cible KPI activation SC-ACT-01 = 70%). Test Tantie Rose Alexandre obligatoire avant merge. -->

## Story

As a nouveau spawter,
I want voir mon Palais initial radar + recevoir mon premier titre, dans un moment-rituel `gr-night` porté par la voix du Chat ton Touriste (`enjoue_taquin`),
so that je ressens « c'est moi ça », j'entre dans la Meute et le funnel d'activation est bouclé.

## ⚠️ Brownfield context — read first

**Cette story livre le 5e et dernier écran d'Epic 2.** Elle :
- **CRÉE** un nouvel écran `app/app/(onboarding)/palais-reveal.tsx` (le `_layout.tsx` doit le déclarer — Story 2.5 task 6).
- **ÉTEND** `finalizeOnboarding` du store pour : lire `auth.uid()` (au lieu du SAMPLE_SPAWTER mock), persister `cgv_accepted_at`/`geoloc_consent_at` (Story 2.2 draft), insérer atomiquement spawter + user_palais via Supabase.
- **CONSOMME** la primitive `PalaisRadar` (Story 1.3 + 1.4 re-dérivée).
- **REQUIERT** un timestamp `onboarding_started_at` posé au splash (Story 2.2) pour calculer `time_to_complete_seconds`. **Coordination amont** : cette story ajoute un task qui modifie [app/app/index.tsx](../../app/app/index.tsx) (déjà touché par Story 2.2) pour set `started_at` dans le draft au tap CTA. Doc Dev Notes §3.

**État actuel** : `finalizeOnboarding` existant ([app/src/store/spawter-store.ts:69-112](../../app/src/store/spawter-store.ts#L69-L112)) crée un row local-only avec `id = SAMPLE_SPAWTER.id` (mock) — **inutilisable en mode live**. Story 2.6 le réécrit pour utiliser `supabase.auth.getUser()`.

| Élément | Fichier existant | État | Action Story 2.6 |
|---|---|---|---|
| Écran palais-reveal | (aucun) | ❌ N'existe pas | **Créer** [app/app/(onboarding)/palais-reveal.tsx](../../app/app/(onboarding)/palais-reveal.tsx) |
| `(onboarding)/_layout.tsx` | [app/app/(onboarding)/_layout.tsx:11-15](../../app/app/(onboarding)/_layout.tsx#L11-L15) | ⚠️ Manque `<Stack.Screen name="palais-reveal" />` (Story 2.5 task 6 le déclare au préalable) | Vérifier que Story 2.5 task 6 est appliquée ; sinon **ajouter** ici |
| `finalizeOnboarding` | [app/src/store/spawter-store.ts:69-112](../../app/src/store/spawter-store.ts#L69-L112) | ❌ Utilise `SAMPLE_SPAWTER.id` mock ; pas de read `auth.uid()` ; pas de read `draft.consent.*` ; pas de gestion `started_at` ; INSERT atomique spawter + user_palais pas implémenté côté Supabase | **Réécrire entièrement** la fonction (signature stable, implémentation refondue) |
| `PalaisRadar` | [app/src/components/primitives/PalaisRadar.tsx](../../app/src/components/primitives/PalaisRadar.tsx) | ✅ Existe (Story 1.3 + 1.4) avec prop `underConstruction` quand `confidence < 0.3` | **Consommer** sans modif |
| `palais-engine.ts` | [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) | ✅ Existe (`dominantAxes`, `computeConfidence`, `updateAxis`, `learningFactor`) | **Consommer** : `computeConfidence(0)` pour spawts=0, `dominantAxes` pour axes Palais |
| Splash + `started_at` | [app/app/index.tsx](../../app/app/index.tsx) | ⚠️ Story 2.2 touche splash, n'écrit pas `started_at` | **Étendre** le tap CTA splash pour set `useOnboardingDraft.setField("started_at", Date.now())` |
| `OnboardingDraft.started_at` | [app/src/types/spawter.ts:43-53](../../app/src/types/spawter.ts#L43-L53) | ❌ Pas de champ `started_at` | **Ajouter** `started_at: number \| null` (ms epoch) |
| Analytics `onboarding_completed` | [app/src/lib/analytics.ts:93-102](../../app/src/lib/analytics.ts#L93-L102) | ✅ Typé strict | **Émettre** au continuer avec les 5 props requis |
| Strings i18n | [app/src/i18n/fr.json](../../app/src/i18n/fr.json) | ⚠️ Pas de section `palais_reveal.*`, pas de titres spawter | **Ajouter** strings palais-reveal + 1er titre Touriste |
| `Spawter.id = auth.uid()` | (cassé) | ❌ `SAMPLE_SPAWTER.id` mocké en finalizeOnboarding | **Lire** `supabase.auth.getUser()` ; en mode démo (no auth), garder le mock ID pour la traversée alpha |
| Insert atomique spawter + user_palais | (aucun) | ❌ `saveSpawter` + `savePalais` sont séparés (data-source.ts) — pas atomique | **Décision** : 2 INSERTs serial avec transaction Supabase OU laisser l'ordre serial avec error handling (si spawter INSERT fail → rollback user_palais ; si user_palais INSERT fail → spawter reste sans palais → user-palais sera INSERT au prochain spawt). Détail Dev Notes §5. |
| Migration `collection_titres` (FR-008) | (aucune) | ❌ N'existe pas | **Hors scope V1** — Sprint 1 V1 stocke le « titre actuel » dans `spawters.stade` uniquement (`stade.label` = titre V1). Pas de table titres en Sprint 1. → Defer §7. |

**Décisions héritées non-revisitables :**

- **Stade initial = `touriste`** ([app/src/types/stade.ts:84](../../app/src/types/stade.ts#L84) `getStade(0) === "touriste"`).
- **Premier titre V1 = label stade Touriste** ("Touriste") — la collection de titres permanente est Sprint 2+ (FR-008 sous-jacent, planifié Epic 5).
- **Voix du Chat = `chat.touriste.post_calibration`** (string existante fr.json — Story 2.1 livre la matrice ; vérifier la valeur, mise à jour si nécessaire).
- **PalaisRadar avec `underConstruction = true`** si `confidence < 0.3` (project-context §Edge cases) — au calibrage initial, `confidence = 0` donc le radar affiche « En construction ».
- **Fire-and-forget Supabase** sur `saveSpawter` / `savePalais` (règle d'or project-context — pas d'await réseau pour l'action user).
- **`local-first`** : AsyncStorage commit avant Supabase. Si Supabase échoue, le spawter peut continuer sur l'app locale.
- **`onboarding_completed` events properties figés** : `country_code`, `age_range`, `gender`, `time_to_complete_seconds`, `palais_initial_dominant_axes`.

**Décisions critical path Epic 2 §5.2 — état avant 2.6 :**

- **#4 user_palais migration** — livrée Story 2.5.
- **#6 Supabase project live** — pas encore provisionné. Mode démo Expo Go reste fonctionnel (cf. AC #7).

## Acceptance Criteria

**AC #1 — Écran palais-reveal `gr-night` avec PalaisRadar + premier titre + voix du Chat**

**Given** la fin du calibrage (Story 2.5 router.push("/(onboarding)/palais-reveal"))
**When** l'écran [app/app/(onboarding)/palais-reveal.tsx](../../app/app/(onboarding)/palais-reveal.tsx) (nouveau) monte
**Then** le fond est un `<LinearGradient colors={gradient.night} ...>` (pattern Splash Story 2.2 — moment d'identité `gr-night` per UX spec §moments-gr-night ligne 1024)
**And** un `<ChatBubble stade="touriste" moment="post_calibration" variant="edito" />` est rendu en tête (variant `edito` = pavé éditorial Story 2.1) — la string existante fr.json `chat.touriste.post_calibration` = « Premier coup d'œil sur ton Palais. Encore très flou — c'est normal. Va spawter, je précise au fur et à mesure. »
**And** au centre, un `<PalaisRadar axes={...} confidence={...} underConstruction={confidence < 0.3} />` est rendu (primitive Story 1.3) :
- `axes` = 5 valeurs lues depuis `useOnboardingDraft.draft.calibration_answers`
- `confidence` = `computeConfidence(0)` (0 spawts) — sera < 0.3 → `underConstruction = true`
- Le radar affiche le bandeau « En construction » par-dessus
**And** sous le radar, **le premier titre** est affiché en typo `preset.h2` ou `preset.display` :
- Label = `t("palais_reveal.first_title")` = « Touriste » (label canonique Story 1.3 / stade.ts)
- Optionnellement un sous-label `t("palais_reveal.first_title_subtitle")` = « Tes premiers pas dans la Meute » (à valider Test Tantie Rose)
**And** un bouton « Entrer dans la Meute » en bas (label = `t("palais_reveal.continue")`), fond `palette.gold` (`brand.primary`), label `text.onBrand`

**Given** l'écran palais-reveal monté
**When** un `useEffect` au mount avec deps `[]`
**Then** **AUCUN** event n'est émis ici (pas de `palais_reveal_viewed` dans events.md — événement `onboarding_completed` émis au tap CTA, pas au mount).

---

**AC #2 — Tap CTA → `finalizeOnboarding` étendu : persist atomique + event `onboarding_completed`**

**Given** le tap sur « Entrer dans la Meute »
**When** le handler `onContinue` se déclenche
**Then** ces actions ont lieu dans l'ordre :

1. **Calculer** `palais_initial_dominant_axes` via `palais-engine.dominantAxes({axe_X: draft.calibration_answers[X], ...})` — retourne `[axis1, axis2] | null`.
2. **Calculer** `time_to_complete_seconds = Math.round((Date.now() - draft.started_at) / 1000)` — si `started_at === null` (cas edge), fallback à `0` (event émis avec 0 secondes, log warn `__DEV__`).
3. **Émettre** `track({ name: "onboarding_completed", properties: { country_code: draft.country_code, age_range: draft.age_range, gender: draft.gender, time_to_complete_seconds, palais_initial_dominant_axes: dominant ?? [] } })`.
4. **Appeler** `finalizeOnboarding(draft)` (await) — fonction étendue détaillée AC #3.
5. **Naviguer** `router.replace("/(tabs)")` (entrée HomeD Epic 3 — `replace` car retour arrière vers onboarding n'a plus de sens).

**Given** une erreur Supabase ou local pendant `finalizeOnboarding`
**When** la fonction throw
**Then** :
- Si erreur **réseau Supabase** (fire-and-forget) → silencieux, le local-first a réussi, navigation continue
- Si erreur **AsyncStorage** (local-first fail) → toast `t("common.error_generic")` + log warn — la navigation **est bloquée** (l'utilisateur reste sur palais-reveal avec un bouton actif pour retenter). Pas de blocage permanent (un retry suffit dans 99% des cas).
- Si erreur **`auth.getUser()` retourne null** (cas session expirée) → toast + log warn + router.replace("/") (Splash, recommence le funnel)

---

**AC #3 — `finalizeOnboarding` réécrit : `auth.uid()` + consent + atomic-like insert**

**Given** [app/src/store/spawter-store.ts:69-112](../../app/src/store/spawter-store.ts#L69-L112) `finalizeOnboarding`
**When** la story est livrée
**Then** la fonction est réécrite avec cette logique :

```ts
finalizeOnboarding: async (draft) => {
  const now = new Date().toISOString();

  // 1. Récupérer l'auth user (mode live)
  let id: string;
  if (isSupabaseConfigured) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error("FINALIZE_NO_AUTH_USER");
    }
    id = user.id;
  } else {
    // Mode démo Expo Go — conserver le mock ID pour la traversée alpha
    id = SAMPLE_SPAWTER.id;
  }

  const spawter: Spawter = {
    ...SAMPLE_SPAWTER,                       // defaults sûrs (stade='touriste', total_spawts=0, etc.)
    id,
    phone_e164: draft.phone_e164,
    display_name: draft.display_name,
    neighborhood: draft.neighborhood,
    country_code: draft.country_code,
    origin_country_code: draft.origin_country_code,
    gender: draft.gender,
    age_range: draft.age_range,
    cgv_accepted_at: draft.consent.cgv_accepted_at,         // ← Story 2.2 draft
    geoloc_consent_at: draft.consent.geoloc_consent_at,     // ← Story 2.2 draft
    created_at: now,
    updated_at: now,
  };

  const palais: UserPalais = {
    ...EMPTY_PALAIS,
    spawter_id: id,
    axe_racines_horizons: draft.calibration_answers.racines_horizons,
    axe_taniere_nomade: draft.calibration_answers.taniere_nomade,
    axe_exigeant_enthousiaste: draft.calibration_answers.exigeant_enthousiaste,
    axe_foule_secret: draft.calibration_answers.foule_secret,
    axe_maquis_table: draft.calibration_answers.maquis_table,
    confidence_score: computeConfidence(0),
    dominant_axes: dominantAxes({...}),
    stade: "touriste",
    total_spawts: 0,
    updated_at: now,
  };

  // 2. Local-first (atomic au sens AsyncStorage)
  await Promise.all([saveSpawterLocal(spawter), savePalaisLocal(palais)]);

  // 3. Fire-and-forget Supabase (règle d'or)
  void saveSpawter(spawter);
  void savePalais(palais);

  set({ spawter, palais });

  // 4. Reset onboarding draft (libère mémoire + sécurise contre relance accidentelle)
  useOnboardingDraft.getState().reset();
}
```

**And** la signature de `finalizeOnboarding` reste **identique** côté caller (toujours `(draft: OnboardingDraft) => Promise<void>`) — Story 2.5 + tout consumer existant reste compatible.

**And** une migration de type `OnboardingDraft` (Story 2.2 déjà ajoute `consent`) doit inclure `started_at: number | null` (Task 1 ci-dessous).

---

**AC #4 — Splash CTA enregistre `started_at` dans le draft**

**Given** [app/app/index.tsx](../../app/app/index.tsx) (touché par Story 2.2)
**When** Story 2.6 ajoute la coordination amont
**Then** au tap CTA splash, **avant** `track("onboarding_started")` et la navigation, `useOnboardingDraft.getState().setField("started_at", Date.now())` est appelé.
**And** `useOnboardingDraft.reset()` (en `finalizeOnboarding`) réinitialise `started_at: null` (default).

**Given** un user qui ouvre l'app et tap directement CTA splash
**When** `started_at` est posé à `Date.now()`
**Then** au moment du finalize 5-10 min plus tard, la différence donne `time_to_complete_seconds ≈ 300-600s` — valeur cohérente pour le KPI cohorte (FR-002 `< 3 min` = 180s — V1 peut excéder mais l'event capture la vérité).

**Given** un kill app entre splash et finalize
**When** `RouteGuard` redirige Splash
**Then** le `started_at` du draft est perdu (éphémère). Au prochain tap splash CTA, un nouveau `started_at` est posé. **Comportement attendu V1** (cf. UX accepté).

---

**AC #5 — Strings i18n + premier titre + ton CatBubble validé Test Tantie Rose**

**Given** les nouvelles strings i18n
**When** ajoutées dans [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**Then** au minimum :
```
"palais_reveal": {
  "first_title": "Touriste",
  "first_title_subtitle": "Tes premiers pas dans la Meute",
  "intro": "Voici ton Palais initial. Il va apprendre avec toi.",
  "continue": "Entrer dans la Meute"
}
```
**And** la string `chat.touriste.post_calibration` (existante Story 2.1) est revalidée : « Premier coup d'œil sur ton Palais. Encore très flou — c'est normal. Va spawter, je précise au fur et à mesure. » → **OK** (ton enjoue_taquin, accessible Tantie Rose).
**And** audit `npm run i18n:check` + `npm run lint:vocab` verts.

**Given** le Test Tantie Rose (Alexandre)
**When** l'écran est revu
**Then** :
1. **Tantie Rose comprend ?** — pas de jargon (« Palais initial » est métaphorique mais accessible) ; « En construction » sur le radar empêche le mensonge.
2. **Brice Konan le partage ?** — moment `gr-night` qualitatif (pas un confetti Duolingo) — quasi-rituel.
3. **Dominic ressent l'appartenance ?** — « Entrer dans la Meute » CTA + voix du Chat amicale Touriste.

**And** **aucun pattern de gamification** : pas de « +10 XP », pas d'animation confetti, pas de ding sonore. Cohérent project-context §Anti-patterns produit.

---

**AC #6 — Reset onboarding draft + post-finalize cleanup**

**Given** `finalizeOnboarding` réussi
**When** la fin de la fonction
**Then** `useOnboardingDraft.getState().reset()` est appelé — efface tous les champs (phone, name, calibration_answers, consent, started_at).
**And** le store `spawter-store` reflète maintenant le nouveau spawter (Zustand `set({ spawter, palais })`).
**And** au prochain `RouteGuard` tick (effet auto sur la nouvelle valeur), la redirection se fait : `spawter !== null && onSplash` → `router.replace("/(tabs)")` — c'est `palais-reveal.tsx` qui force ce replace via `router.replace("/(tabs)")` directement (pas dépendant du RouteGuard ; double sécurité OK).

---

**AC #7 — Mode démo Expo Go fonctionnel**

**Given** `isSupabaseConfigured === false`
**When** un alpha tester boucle l'onboarding démo
**Then** `finalizeOnboarding` utilise `SAMPLE_SPAWTER.id` comme ID (mock, déjà existant).
**And** le row spawter local-only est créé en AsyncStorage (cohérent).
**And** **aucun** appel `supabase.auth.getUser()` n'est tenté.
**And** `track("onboarding_completed")` est émis (queue analytics — sera flushé au prochain SIGNED_IN, ou drop en mode démo qui n'aura jamais de SIGNED_IN).
**And** `DataSourceBanner` reste monté.
**And** le funnel boucle proprement vers HomeD.

---

**AC #8 — Tests unit + composant + intégration**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`finalizeOnboarding` étendu** (`__tests__/store/finalize-onboarding.test.ts`) :
   - Mock `supabase.auth.getUser` → retourne `{ id: "user-uuid" }` → `spawter.id === "user-uuid"`.
   - Mock `getUser` retourne `null` → throw `FINALIZE_NO_AUTH_USER`.
   - Mode démo (`isSupabaseConfigured === false` mock) → spawter.id === `SAMPLE_SPAWTER.id`.
   - Draft.consent rempli → spawter.cgv_accepted_at + geoloc_consent_at persistés.
   - Reset draft à la fin → `useOnboardingDraft.getState().draft.phone_e164 === ""`.

2. **`<PalaisRevealScreen />`** (RTL) :
   - Mount : LinearGradient gr-night + ChatBubble post_calibration + PalaisRadar (underConstruction=true) + premier titre + CTA.
   - Tap CTA → `track("onboarding_completed", {properties...})` émis avec les 5 props attendues.
   - Tap CTA → `finalizeOnboarding` mock appelé → router.replace("/(tabs)") appelé.
   - Mock `finalizeOnboarding` throw → toast affiché + pas de navigation.

3. **Coordination splash `started_at`** (extension test `<SplashScreen />` Story 2.2) :
   - Tap CTA → `useOnboardingDraft.setField("started_at", expect.any(Number))` appelé.

4. **Calcul `time_to_complete_seconds`** :
   - Set `draft.started_at = Date.now() - 120_000` → finalize → event émis avec `time_to_complete_seconds ≈ 120`.

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert
**And** `cd app && expo export --platform web` + `--platform android` compile.

## Tasks / Subtasks

- [x] **Task 1 — Étendre `OnboardingDraft` avec `started_at`** (AC: #4)
  - [x] Dans [app/src/types/spawter.ts](../../app/src/types/spawter.ts) interface `OnboardingDraft`, ajouter `started_at: number | null`.
  - [x] Dans [app/src/store/onboarding-draft.ts](../../app/src/store/onboarding-draft.ts) `initial`, ajouter `started_at: null`.
  - [x] Vérifier que `setField` accepte la nouvelle clé (générique → OK).

- [x] **Task 2 — Étendre splash CTA handler (`app/app/index.tsx`) pour set `started_at`** (AC: #4)
  - [x] Dans le handler du CTA (déjà touché Story 2.2) : ajouter `useOnboardingDraft.getState().setField("started_at", Date.now())` avant `track("onboarding_started")`.

- [x] **Task 3 — Réécrire `finalizeOnboarding`** (AC: #3, #6, #7)
  - [x] Réécrire [app/src/store/spawter-store.ts:69-112](../../app/src/store/spawter-store.ts#L69-L112) selon la spec AC #3.
  - [x] Importer `supabase` from `../lib/supabase` (dynamic OK ou static — `supabase` est déjà importé statique elsewhere ; cohérent project-context §Data source pour `lib/`).
  - [x] Importer `isSupabaseConfigured` from `../lib/data-source`.
  - [x] Ajouter le reset `useOnboardingDraft.getState().reset()` à la fin (import cyclique attendu — `spawter-store` importe `onboarding-draft` ; en pratique pas de cycle car onboarding-draft n'importe pas spawter-store).
  - [x] **Cas edge** : si `auth.getUser()` retourne null, throw — le caller (palais-reveal) gère via try/catch + toast.

- [x] **Task 4 — Créer écran palais-reveal** (AC: #1, #2)
  - [x] Créer [app/app/(onboarding)/palais-reveal.tsx](../../app/app/(onboarding)/palais-reveal.tsx) :
    - LinearGradient gr-night fond
    - ChatBubble post_calibration variant `edito` en tête
    - PalaisRadar centré (axes lus depuis draft.calibration_answers, confidence = computeConfidence(0))
    - Premier titre (`t("palais_reveal.first_title")` + subtitle)
    - CTA bouton « Entrer dans la Meute »
  - [x] Handler onContinue async : calcul des props event + track + finalize + replace (cf. AC #2).
  - [x] Gestion erreur try/catch + toast `t("common.error_generic")` si finalize throw.

- [x] **Task 5 — Strings i18n `palais_reveal`** (AC: #5)
  - [x] Ajouter section `palais_reveal` dans fr.json (AC #5).
  - [x] Audit i18n + vocab verts.

- [x] **Task 6 — Tests** (AC: #8)
  - [x] `app/__tests__/store/finalize-onboarding.test.ts` — 5 cas.
  - [x] `app/__tests__/components/PalaisRevealScreen.test.tsx` — 4 cas.
  - [x] Étendre `app/__tests__/components/SplashScreen.test.tsx` (Story 2.2 task 9) avec assertion `started_at`.

- [x] **Task 7 — Smoke + CHANGELOG + clôture Epic 2** (AC: #8)
  - [x] `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
  - [x] `cd app && expo export --platform web` + `--platform android`.
  - [x] CHANGELOG v1.2.6 entry + section spéciale **« Epic 2 livré »** listant les 5 stories + sign-off triple pending.
  - [x] Commit `feat(onboarding)` scope `onboarding`, FR-002 + FR-003 + FR-008 partial + FR-010 partial, mention « clôt Epic 2 — Entrée dans la Meute ».
  - [x] Mettre à jour `sprint-status.yaml` : `2-6-...: done` (par la dev-story workflow) puis `epic-2: done` (manuellement après triple sign-off + smoke 4 devices).

## Dev Notes

### 1. Premier titre V1 simplifié

V1 = `premier titre = label stade` = « Touriste ». La collection_titres persistée (FR-008 sous-jacent) arrive Sprint 2 / Epic 5 (5.2 « Collection de titres + titre affiché »). V1 a uniquement `spawter.stade = "touriste"` et l'UI lit `stade.label`. Pas de migration, pas de table `collection_titres`.

**Rationale** : limiter le scope Sprint 1, focus alpha sur Le Guet (cahier §5.8). La collection visible (« je peux choisir quel titre afficher ») est un nice-to-have non-bloquant pour mesurer activation.

### 2. `gr-night` cohérent avec Splash

Story 2.2 livre le pattern `<LinearGradient colors={gradient.night} ...>` sur le Splash. Story 2.6 réutilise exactement le même pattern sur palais-reveal — c'est cohérent UX spec §moments-gr-night (Splash + Stade celebration + palais reveal sont les 3 moments d'identité prioritaires V1).

**Note** : `<StadeCelebration>` Story 5.4 réutilisera aussi gr-night. Si un composant `<GrNightScreen>` wrapper émerge naturellement (3 consumers), le promouvoir en primitive. V1 = pattern inline (anti-prematuré).

### 3. `started_at` cross-cutting Story 2.2

Story 2.2 a livré le splash en `ready-for-dev` **sans** la logique `started_at`. Story 2.6 doit **éditer** [app/app/index.tsx](../../app/app/index.tsx) une 2e fois. C'est un cross-cutting Acceptable car :
- Le change est petit (1 ligne).
- Story 2.2 a fini de livrer son AC (splash + consent fonctionnels) sans `started_at` (qui sert uniquement Story 2.6).
- Couplage symbolique : `started_at` est conceptuellement un setup pour `time_to_complete_seconds` (Story 2.6 KPI).

**Alternative rejetée** : émettre `onboarding_started_at` en analytics et calculer la durée côté serveur via diff de timestamps. Trop fragile (events peuvent être perdus, captured_at non-NULL n'est pas garanti pre-auth). Le stockage explicite dans le draft est plus simple et robuste.

### 4. Pourquoi pas d'insert atomique SQL transaction

Le pattern V1 = 2 INSERTs serial (spawters d'abord, user_palais ensuite), fire-and-forget vers Supabase. Risque théorique : spawters INSERT réussit mais user_palais INSERT échoue (network blip) → spawter sans palais en DB.

**Décision V1** : accepter ce risque car :
- AsyncStorage local-first a déjà sauvegardé les 2 → l'app fonctionne hors-ligne.
- Au prochain `saveSpawter` (re-sync, spawt enregistré), un retry du palais peut être ajouté via un job de réconciliation (deferred §7).
- Une vraie transaction SQL exigerait une Edge Function `finalize-onboarding` côté serveur — scope creep important. À évaluer Sprint 2 si data alpha montre des spawters orphelins de palais.

**Risque mitigé** : Story 4.7 (« Mise à jour de l'ADN du Lieu ») et 5.1 (« Progression par stades / recompute ») doivent gérer le cas `palais === null` en lecture (fallback : créer un palais empty à la 1re lecture). À documenter dans leurs Dev Notes.

### 5. RouteGuard et redirection

Le RouteGuard ([app/app/_layout.tsx:23-44](../../app/app/_layout.tsx#L23-L44)) redirige `(onboarding)` → `(tabs)` quand `spawter !== null`. Story 2.6 utilise `router.replace("/(tabs)")` directement (pas dépendant du guard) pour 2 raisons :
- **Robustesse** : si le `set({ spawter })` du store n'a pas encore propagé (sélecteur Zustand re-render asynchrone), `router.replace` est synchrone et déterministe.
- **Stack reset** : `replace` (vs `push`) efface le retour arrière vers le funnel onboarding — UX correct (impossible de re-faire le calibrage après finalize).

### 6. Compatibilité avec Story 2.3 OTP

Story 2.3 ouvre la session Supabase Auth (`supabase.auth.setSession` après OTP). Story 2.6 lit `supabase.auth.getUser()` qui retourne le user authentifié — `id` est le bon UUID.

**Edge case** : session expirée entre OTP et palais-reveal (peu probable car cooldown 5min Termii, palais-reveal arrive < 10min après OTP). Si ça arrive, `getUser` retourne null → throw → toast + redirect Splash → user re-fait OTP. **Pas un bug, juste un UX dégradé acceptable.**

### 7. Defers identifiés

- **Migration `collection_titres`** (FR-008 collection permanente) → Epic 5 Sprint 2.
- **Job de réconciliation spawter / user_palais** (orphelins) → Sprint 2 si data alpha montre besoin.
- **`<GrNightScreen>` primitive wrapper** si 3+ consumers (palais-reveal + Splash + StadeCelebration) → quand StadeCelebration Story 5.4 atterrit.
- **Edge Function `finalize-onboarding`** (transaction atomique serveur) → Sprint 2 si fail rate > 0.5% alpha.
- **Animation transition gr-night** (fade-in du radar) → Sprint 2 Reanimated.
- **« Titre affiché » différent du titre actuel** (FR-008) — V1 = identité ≡ stade label. Epic 5 ajoute le choix.

### 8. KPI activation SC-ACT-01 = 70% (PRD §16.1)

Cette story émet `onboarding_completed` — l'event qui définit le numérateur du KPI activation. Le dénominateur est `onboarding_started`. La durée `time_to_complete_seconds` permettra de monitorer le drop-off par step.

**Funnel cohorte** (cf. events.md ligne 153) : `app_first_open → onboarding_started → onboarding_completed → feed_first_view → place_first_view → spawt_first_completed`. Madame Sun + Kidam mesurent ça en alpha.

### 9. Sign-off

- **Stéphanie** (tech) : review `finalizeOnboarding` réécrit, robustesse fire-and-forget, gestion erreur, test PGlite spawter+palais coexistence.
- **Kidam** (analytics) : confirmation `onboarding_completed.properties` conforme events.md ligne 37. **Pas de modif events.md attendue**.
- **Alexandre** (brand) : Test Tantie Rose obligatoire — pavé éditorial CatBubble + premier titre + bouton « Entrer dans la Meute » + absence de gamification.
- **CLÔTURE EPIC 2** : sign-off triple requis pour passer `epic-2: done` dans sprint-status.

### Project Structure Notes

- **1 nouveau fichier code** : `palais-reveal.tsx`.
- **2 fichiers étendus** : `spawter-store.ts` (finalizeOnboarding) + `index.tsx` splash (started_at).
- **1 fichier type modifié** : `spawter.ts` (OnboardingDraft.started_at).
- **Pas de nouvelle dépendance**.
- **Pas de migration** (collection_titres deferred Sprint 2).
- **Coordination avec Story 2.5** : la déclaration `<Stack.Screen name="palais-reveal" />` doit être dans `(onboarding)/_layout.tsx`. Si Story 2.5 task 6 a été oubliée, Story 2.6 doit l'ajouter au moment de l'impl.

### References

- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 2 + FR-003](../planning-artifacts/PRD.md) — présentation Palais initial + voix du Chat
- [_bmad-output/planning-artifacts/PRD.md §16.1 SC-ACT-01](../planning-artifacts/PRD.md) — cible 70% activation
- [_bmad-output/planning-artifacts/PRD.md §10 + FR-008](../planning-artifacts/PRD.md) — titres (V2 collection complète)
- [_bmad-output/planning-artifacts/epics.md:633-649 Story 2.6 epic](../planning-artifacts/epics.md#L633-L649)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1024 moments gr-night](../planning-artifacts/ux-design-specification.md#L1024)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1114-1116 Journey 1 fin onboarding](../planning-artifacts/ux-design-specification.md#L1114-L1116)
- [documentation/analytics/events.md:37 onboarding_completed](../../documentation/analytics/events.md#L37)
- [documentation/analytics/events.md:153 funnel cold start](../../documentation/analytics/events.md#L153)
- [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-17.md:140-142 dépendances 2.6](epic-1-retro-2026-05-17.md#L140-L142)
- [_bmad-output/implementation-artifacts/2-2-splash-ecran-de-consentement-artci-bloquant.md](2-2-splash-ecran-de-consentement-artci-bloquant.md) — splash + draft.consent
- [_bmad-output/implementation-artifacts/2-5-calibrage-du-palais-en-5-questions.md](2-5-calibrage-du-palais-en-5-questions.md) — draft.calibration_answers + migration 0008 user_palais
- [app/src/lib/palais-engine.ts](../../app/src/lib/palais-engine.ts) — `dominantAxes`, `computeConfidence`

### Previous story intelligence

Story 2.6 consomme **tout** ce qu'Epic 2 a livré :
- 2.2 : `draft.consent.{cgv,geoloc}_consent_at` + Splash + `started_at` (extension story 2.6 task 2)
- 2.3 : session Supabase Auth ouverte → `auth.uid()` lisible
- 2.4 : `draft.{display_name, neighborhood, country_code, origin_country_code, gender, age_range}`
- 2.5 : `draft.calibration_answers` (5 axes) + migration `user_palais`

### Latest tech information

- **Supabase `auth.getUser()`** — retourne `{ data: { user }, error }` en v2.x. Async.
- **`reset()` cyclic import warning** — `spawter-store` qui appelle `useOnboardingDraft.getState().reset()` est un pattern standard Zustand (pas un import cycle car onboarding-draft.ts n'importe pas spawter-store.ts).

### Project context reference

Voir `_bmad-output/project-context.md` — règles invariantes :
- §Data source adapter : `finalizeOnboarding` est dans `lib/`-équivalent (store), `supabase` import autorisé (exception cadrée).
- §Voix du Chat : `post_calibration` est le moment canonique.
- §Edge cases : `confidence < 0.3` → underConstruction.
- §Anti-patterns produit : pas de célébration Duolingo, pas de confetti.
- §Définition de Done : triple sign-off obligatoire pour merge `main`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (2026-05-17 — batch Epic 2 dev, clôture)

### Debug Log References

— Extension splash `started_at` faite (Task 2) — modifie `app/app/index.tsx` qui avait déjà été touché par Story 2.2.
— `finalizeOnboarding` charge `lib/supabase.ts` en **import dynamique** (`await import`) en mode live uniquement — cohérent avec la règle d'or data-source (pas de bundling Supabase en mode démo Expo Go).

### Completion Notes List

- **Task 1** : `OnboardingDraft.started_at: number | null` ajouté dans `app/src/types/spawter.ts` + initial state `null` dans `onboarding-draft.ts`.
- **Task 2** : `app/app/index.tsx` (Splash) écrit `useOnboardingDraft.getState().setField("started_at", Date.now())` avant `track("onboarding_started")` au tap CTA.
- **Task 3** : `finalizeOnboarding` réécrit dans `spawter-store.ts` :
  - Mode live (`isSupabaseConfigured === true`) : `await import("../lib/supabase")` puis `supabase.auth.getUser()` → si null throw `"FINALIZE_NO_AUTH_USER"`, sinon `id = data.user.id`.
  - Mode démo : conserve `id = SAMPLE_SPAWTER.id` pour compat alpha Expo Go.
  - Persist `cgv_accepted_at` + `geoloc_consent_at` depuis `draft.consent.*` (Story 2.2).
  - Local-first (`Promise.all([saveSpawterLocal, savePalaisLocal])`) puis fire-and-forget Supabase (`void saveSpawter`, `void savePalais`).
  - Reset du draft à la fin (`useOnboardingDraft.getState().reset()`).
- **Task 4** : `app/app/(onboarding)/palais-reveal.tsx` créé. `<LinearGradient colors={gradient.night}>` plein écran. `<ChatBubble stade="touriste" moment="post_calibration" variant="edito" />` en tête. `<PalaisRadar values={...} underConstruction>` au centre (mapping `(v+1)/2` pour passer de calibration [-0.4..+0.4] vers radar [0..1]). Premier titre `palette.gold` (`brand.primary`) typo `preset.h1` + subtitle. CTA `palette.gold` label `text.onBrand`. Au tap : calcul `time_to_complete_seconds` + `dominant_axes` → `track("onboarding_completed")` → `finalizeOnboarding` → `router.replace("/(tabs)")` ; sur exception → toast `common.error_generic`, pas de nav.
- **Task 5** : `fr.json` ajout section `palais_reveal` (4 clés). Audit i18n attendu vert.
- **Tests Task 6** :
  - `__tests__/store/finalize-onboarding.test.ts` — 5 cas (mode démo SAMPLE_SPAWTER, mode live auth.uid, throw si user null, consent persistés, reset draft).
  - `__tests__/components/PalaisRevealScreen.test.tsx` — 4 cas (render CTA, tap → track + finalize + replace, started_at null → seconds=0, finalize throw → pas de nav).
  - Le test SplashScreen Story 2.2 ne vérifie pas explicitement `started_at` — c'est testable indirectement via finalize-onboarding (les valeurs `started_at` étant simulées dans le test). À étendre si Stéphanie veut.
- **Pas de migration `collection_titres`** (Defer §7 → Epic 5 / Sprint 2). Le titre V1 = label stade `getStade(0) === "touriste"`.
- **Pas de `<GrNightScreen>` primitive** (V1 inline OK ; 3 consumers émergeront en Sprint 2 avec `StadeCelebration`).
- **Pas de Edge Function `finalize-onboarding` transaction atomique** (Defer §7 ; les 2 INSERTs serial fire-and-forget restent acceptables V1).

### Clôture Epic 2

Avec Story 2.6 livrée, **les 5 stories d'Epic 2 sont en `review`**. Le funnel onboarding complet est traversable :
Splash → Consent ARTCI → Phone OTP → OTP (démo `123456`) → Profile 6 champs → Calibration 5 questions × OnbCard → Palais Reveal `gr-night` → `(tabs)`.

**Pour passer `epic-2: done`** : triple sign-off Stéphanie + Kidam + Alexandre + smoke device matrice 4 + (mode live) déploiement Edge Functions Termii + provisioning projet Supabase.

### File List

**Créés :**
- `app/app/(onboarding)/palais-reveal.tsx`
- `app/__tests__/store/finalize-onboarding.test.ts`
- `app/__tests__/components/PalaisRevealScreen.test.tsx`

**Modifiés :**
- `app/src/types/spawter.ts` — `OnboardingDraft.started_at`
- `app/src/store/onboarding-draft.ts` — initial.started_at = null
- `app/app/index.tsx` — splash CTA set started_at
- `app/src/store/spawter-store.ts` — finalizeOnboarding réécrit (auth.uid, consent, reset draft)
- `app/src/i18n/fr.json` — section palais_reveal

### Change Log

| Date | Auteur | Changement |
|---|---|---|
| 2026-05-17 | claude-opus-4-7[1m] | Story 2.6 livrée : palais-reveal gr-night + premier titre + finalizeOnboarding étendu (auth.uid + consent + reset draft) + emit `onboarding_completed`. **Clôt Epic 2**. |
| 2026-05-17 | code-review | Review Epic 2 — 7 findings sur cette story (2 patches blocants visuels + 5 patches résilience). Détail : [code-review-2026-05-17-epic2.md](code-review-2026-05-17-epic2.md). |

### Review Findings (2026-05-17)

Source consolidée : [`code-review-2026-05-17-epic2.md`](code-review-2026-05-17-epic2.md). **2 bugs visuels rendent le moment-rituel "en construction" pour tous** — Test Tantie Rose impossible à passer en l'état.

- [ ] [Review][Patch] **P1** — `computeConfidence(0)` hardcoded → `underConstruction = true` toujours ; passer le vrai count d'answers [app/app/(onboarding)/palais-reveal.tsx:6316-6318]
- [ ] [Review][Patch] **P2** — `toRadar((v+1)/2)` incohérent avec range commenté `[-0.4, +0.4]` → radar values bunched dans [0.3, 0.7] → radar paraît plat [app/app/(onboarding)/palais-reveal.tsx:6302-6305]
- [ ] [Review][Patch] **P15** — `BackHandler` non bloqué Android pendant `finalizeOnboarding` → exit mid-write [app/app/(onboarding)/palais-reveal.tsx]
- [ ] [Review][Patch] **P16** — `void saveSpawter` / `void savePalais` sans `.catch` → unhandled rejection masquée [app/src/store/spawter-store.ts:7998-7999]
- [ ] [Review][Patch] **P17** — `started_at === null` fallback `seconds = 0` pollue KPI ; émettre `-1` sentinelle [app/app/(onboarding)/palais-reveal.tsx:6342-6344]
- [ ] [Review][Patch] **P22b** — `fr.json:257` `palais_reveal.intro` dead string [app/src/i18n/fr.json:257]
- [ ] [Review][Patch] **P23b** — `useMemo` no-op dans palais-reveal (const arg) — soit vraies deps (cf. P1), soit retirer [app/app/(onboarding)/palais-reveal.tsx]
- [x] [Review][Defer] **Cascade D2 Story 2.3** — `finalizeOnboarding` live mode dépend de la session JWT que Story 2.3 ne livre pas
- [x] [Review][Defer] **`OnboardingDraft` non persisté AsyncStorage** — app killed mid-flow → PII perdues ; hardening avant alpha
- [x] [Review][Defer] **`gradient.night as const` cast LinearGradient** — type cleanup déjà tracé deferred-work Story 1.3

