# Story 3.7: Partage WhatsApp

Status: review

<!-- Story 3.7 — Bouton partager sur la fiche lieu (Story 3.4), ShareSheet qui génère un deep link sortant SPAWT (payload image + nom + note pondérée + URL), partage via `react-native-share` ou Linking. Deep link entrant → fiche lieu OU redirection store si pas l'app installée. Events `share_initiated` + `share_completed`. < 5s entre tap et message envoyé. Dépend de 3.4 (bouton sur fiche). Indépendante des autres. Sprint 1 = chemin viral principal (FR partage). -->

## Story

As a spawter,
I want partager une fiche lieu sur WhatsApp via un bouton dédié sur la fiche, avec un payload soigné (image + nom + note pondérée + lien),
so that je transmets une bonne adresse à un proche en moins de 5 secondes, et que ce partage devienne le canal viral n°1 de la Meute (FR-038).

## ⚠️ Brownfield context — read first

Cette story livre :
- Un **bouton « Partager »** sur la fiche lieu (Story 3.4) — bouton secondaire à côté des CTAs Appeler / WhatsApp existants.
- Un composant **`ShareSheet`** — bottom sheet qui formate le payload et appelle l'API de partage natif RN.
- **Deep link entrant** : route `place/[id]` consomme déjà `id` ; ajouter un handler `expo-linking` pour ouvrir l'app via URL `https://spawt.ci/place/<id>` (ou scheme `spawt://place/<id>`).
- **Fallback redirect store** : si user ouvre le deep link sans avoir l'app → resolved via universal link (iOS) / App Links (Android) qui fallback vers le store. **V1 décision** : on **différer** la résolution store ; V1 = deep link app-only (universal links + store fallback = config infra non triviale, sprint 2). Cf. Dev Notes §1.

**État actuel** :

| Élément | Fichier | État | Action Story 3.7 |
|---|---|---|---|
| API partage | (aucun) | ❌ Pas wiré | **Utiliser** API native `Share` de React Native (`import { Share } from "react-native"`) — pas de lib tierce V1 |
| Bouton partager fiche | (Story 3.4 n'inclut pas) | — | **Ajouter** dans `place/[id].tsx` |
| Composant `ShareSheet` | (aucun) | ❌ N'existe pas | **Créer** [app/src/components/ShareSheet.tsx](../../app/src/components/ShareSheet.tsx) — wrapper du payload + appel API natif |
| Deep link config | [app/app.json](../../app/app.json) | ⚠️ `scheme: "spawt"` configuré | **Étendre** : déclarer `intentFilters` Android + `associatedDomains` iOS si universal link (V1 = scheme only suffit) |
| Deep link handler | [app/app/place/[id].tsx](../../app/app/place/[id].tsx) | ✅ Lit `id` via `useLocalSearchParams` | **Pas de modif** — expo-router résout automatiquement le scheme |
| Analytics events | [app/src/lib/analytics.ts:168-170](../../app/src/lib/analytics.ts#L168-L170) | ✅ Typés (`share_initiated`, `share_completed`, `share_link_opened`) | **Émettre** les 2 premiers (le 3e est backend) |
| Strings i18n `share.*` | (aucun) | ❌ Pas de section | **Créer** section |

**Décisions héritées non-revisitables** :

- **WhatsApp = canal viral n°1** (FR-038, PRD §3.1 Feature 16) — pas Facebook, pas Twitter, pas Instagram en V1.
- **API native `Share` RN** — pas de lib tierce V1 (cohérent project-context §Bundle JS < 500 KB).
- **Payload** : image + nom + note pondérée + lien (epics.md §823).
- **Latence < 5s** entre tap et message envoyé (epics.md §823).
- **Pas de track de spawter_id source côté backend** en V1 (event `share_link_opened` est backend, deferred Sprint 2).

## Acceptance Criteria

**AC #1 — Bouton « Partager » sur la fiche lieu**

**Given** [app/app/place/[id].tsx](../../app/app/place/[id].tsx) (refondue Story 3.4)
**When** Story 3.7 ajoute le bouton
**Then** un bouton icône `share` est rendu **dans le header** top-right (à côté du toggle favori Story 3.6 ou du back).

**Spec UX** :
- Cercle 44px (cible tactile), fond `surface.subtle` ou transparent
- Icon `share` `theme.colors.text.secondary`
- Tap → ouvre `<ShareSheet place={place} onClose={...} />` (modal native ou bottom sheet)

**Alternative V1** : tap direct → invoque `Share.share(...)` API native sans sheet custom intermédiaire. C'est plus simple, et l'API native iOS/Android présente déjà sa propre sheet de sélection (WhatsApp / Messages / etc.). **Décision recommandée** : **direct call**, pas de sheet custom.

---

**AC #2 — API partage natif `Share.share`**

**Given** un tap sur le bouton partager
**When** le handler `onSharePress` s'exécute
**Then** :

```ts
import { Share } from "react-native";
import { useTranslation } from "react-i18next";

async function onSharePress(place: PlaceWithAdn, distance: number, matchScore: number) {
  const { t } = useTranslation();
  const url = `https://spawt.ci/place/${place.id}`; // V1 : URL HTTPS (universal link future) ou scheme `spawt://place/<id>`
  const message = t("share.message_template", {
    name: place.name,
    neighborhood: place.location.neighborhood,
    cuisine: place.cuisine[0] ?? "",
    rating: place.adn.weighted_rating.toFixed(1),
    score: matchScore,
    url,
  });

  track({ name: "share_initiated", properties: { place_id: place.id, surface: "place_detail" } });

  try {
    const result = await Share.share(
      {
        message,    // Android : `message` est le payload principal
        title: place.name, // iOS : peut servir de titre
        url,        // iOS : url séparé, Android l'ignore
      },
      { dialogTitle: t("share.dialog_title") },
    );

    if (result.action === Share.sharedAction) {
      track({ name: "share_completed", properties: { place_id: place.id, surface: "place_detail" } });
    }
    // Share.dismissedAction → pas d'event (utilisateur a annulé)
  } catch (err) {
    if (__DEV__) console.warn("[share] failed", err);
  }
}
```

**And** `Share.share` est await — mais le délai utilisateur ≠ délai réseau. La sheet OS apparaît instantanément (< 200ms). Le `result.action === Share.sharedAction` n'est garanti que sur iOS — sur Android, `result.action === "sharedAction"` est moins fiable. **V1** : on émet `share_completed` au retour de `sharedAction` côté iOS, fire-and-forget côté Android (Android ne distingue pas tjr completed vs dismissed).

---

**AC #3 — Payload template via i18n**

**Given** la string `share.message_template`
**When** elle est interpolée
**Then** le payload final ressemble à :

```
🍽️ {{name}} — {{neighborhood}} · {{cuisine}}
★ {{rating}} pondérée · {{score}}% pour ton Palais

{{url}}

via SPAWT — la Meute du goût à Abidjan.
```

Exemple concret :
```
🍽️ Bushman Café — Cocody Riviera · fusion
★ 4.4 pondérée · 86% pour ton Palais

https://spawt.ci/place/00000000-0000-0000-0000-000000000002

via SPAWT — la Meute du goût à Abidjan.
```

**And** le template est défini dans fr.json (AC #6) — interpolation via `t("share.message_template", {...})`.
**And** **pas d'image jointe en V1** — WhatsApp Web ne supporte pas l'image native via `Share.share`. Le `cover_photo_url` est dans l'URL preview (Open Graph côté landing page Sprint 2). **V1 sans OG** = un texte simple avec URL nue.

**Note technique** : iOS gère mieux le `Share.share({url, message})` séparé que Android. Sur Android, `message + url` doit être concaténé dans le `message`. Le template ci-dessus inclut l'URL dans le message — compat Android.

---

**AC #4 — Deep link entrant (configuration scheme + handler)**

**Given** [app/app.json](../../app/app.json)
**When** Story 3.7 est livrée
**Then** le scheme `spawt://` (déjà configuré) résout les URLs :
- `spawt://place/<uuid>` → ouvre la fiche lieu
- `https://spawt.ci/place/<uuid>` → V1 = pas géré (sera Sprint 2 avec universal links + AASA file)

**Implementation** :
- Le scheme `spawt://` est déjà dans `app.json`. Expo Router résout automatiquement `place/[id]` via `useLocalSearchParams`.
- Story 3.4 lit déjà `id` et `ref` ; pour le deep link entrant, **ajouter** une logique côté `app/_layout.tsx` ou directement `place/[id].tsx` pour set `ref="share"` si la nav vient d'un deep link initial.

**V1 acceptable** : pas de détection automatique du `ref="share"` côté entrant — l'event `share_link_opened` est tracké côté backend (Sprint 2). V1 = `referrer` = `"direct"` quand le deep link s'ouvre.

**Coordination Story 3.4** : aucune action requise — Story 3.4 lit `ref` du `useLocalSearchParams` qui est `undefined` pour les deep link entrants → fallback `direct`.

---

**AC #5 — Analytics : `share_initiated` + `share_completed` émis**

**Given** un tap partager
**When** les actions ont lieu
**Then** :

1. **`share_initiated`** — au tap du bouton partager (avant l'appel `Share.share`)
   - Props : `place_id: string` (UUID), `surface: "place_detail"`
   - **Surface** : V1 = `"place_detail"` (seul caller). Sprint 2+ ajoutera `"feed"` (partage direct depuis une PlaceCard) et `"profile"` (partage de la carte spawter).

2. **`share_completed`** — au retour `Share.sharedAction` (iOS uniquement fiable ; Android = best-effort)
   - Props : `place_id`, `surface`

**And** `share_link_opened` (events.md ligne 128) = **backend-only** (sera tracké par un job Edge Function quand le deep link entrant est résolu — Sprint 2).

---

**AC #6 — Strings i18n + Test Tantie Rose**

**Given** [app/src/i18n/fr.json](../../app/src/i18n/fr.json)
**When** Story 3.7 est livrée
**Then** la section `share.*` est ajoutée :

```json
{
  "share": {
    "button_label": "Partager",
    "dialog_title": "Partager via",
    "message_template": "🍽️ {{name}} — {{neighborhood}} · {{cuisine}}\n★ {{rating}} pondérée · {{score}}% pour ton Palais\n\n{{url}}\n\nvia SPAWT — la Meute du goût à Abidjan.",
    "fallback_no_phone": "WhatsApp n'a pas pu s'ouvrir. Copie le lien manuellement.",
    "copy_link": "Copier le lien"
  }
}
```

**And** audit `npm run i18n:check` + `npm run lint:vocab` verts.
**And** Test Tantie Rose :
- « la Meute du goût à Abidjan » est un trait brand fort (Contrat).
- Pas de jargon (« note pondérée » accessible).
- 🍽️ emoji acceptable (cohérent ux culturel cible).
- **Pas de mécanique de grow hack** type « invite tes amis et gagne ». Le partage = signal de fierté, pas un quota.

---

**AC #7 — Latence < 5s mesurée**

**Given** un spawter sur 3G simulé
**When** il tape « Partager »
**Then** le sheet OS s'ouvre **< 1s** (instantané, pas de réseau requis).
**And** le user sélectionne WhatsApp → WhatsApp s'ouvre **< 3s** sur 3G (latence OS-OS).
**And** le message est pré-rempli, le user tape « Envoyer » → message envoyé **< 1s** sur 3G.
**Total < 5s** (cohérent epics.md §823).

**Implementation** : le payload est généré **côté client** — pas d'aller-retour réseau. Latence purement device + OS.

---

**AC #8 — Tests + triple gate**

**Given** la suite de tests
**When** `cd app && npm test` est lancé
**Then** la couverture inclut :

1. **`onSharePress` handler** (RTL, mock `Share.share`) :
   - Tap → `Share.share` mocké appelé avec args attendus (message contenant nom + URL)
   - `share_initiated` track émis avant `Share.share`
   - `Share.share` resolve `{action: "sharedAction"}` → `share_completed` track émis
   - `Share.share` resolve `{action: "dismissedAction"}` → pas de `share_completed`
   - `Share.share` reject → `__DEV__` warn, pas de crash

2. **Template payload** :
   - `t("share.message_template", {...})` interpolé → contient nom, quartier, cuisine, rating, score, URL
   - Si `cuisine` empty → fallback graceful (pas de `· undefined`)

3. **Bouton sur la fiche** (RTL) :
   - Mount → bouton share visible
   - Tap → handler appelé

**Given** la triple gate
**When** lancée
**Then** `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check && npm test` vert.
**And** `cd app && expo export --platform android` compile.

## Tasks / Subtasks

- [ ] **Task 1 — Ajouter bouton « Partager » dans `place/[id].tsx`** (AC: #1, #2, #5)
  - [ ] **Cross-cutting Story 3.4 + 3.6** : ajouter dans le header top-right de la fiche, à côté du back et du toggle favori, un `<Pressable>` avec `<Ico name="share" />`.
  - [ ] Handler `onSharePress` selon AC #2.
  - [ ] Récupérer `matchScore` calculé côté fiche pour interpoler dans le template.

- [ ] **Task 2 — Strings i18n `share.*`** (AC: #6)
  - [ ] Ajouter section selon AC #6.
  - [ ] Audits verts.

- [ ] **Task 3 — (Optionnel) Composant `ShareSheet` wrapper** (AC: #1)
  - [ ] **V1 décision** : skip ce task — l'API native `Share.share` ouvre déjà sa propre sheet OS. Pas de sheet custom V1.
  - [ ] Si décision contraire : créer [app/src/components/ShareSheet.tsx](../../app/src/components/ShareSheet.tsx) — sheet custom avec preview du payload avant envoi.

- [ ] **Task 4 — Vérifier `app.json` scheme `spawt`** (AC: #4)
  - [ ] Vérifier que `app.json` a `scheme: "spawt"`.
  - [ ] **V1 acceptable** : pas de universal link config (différé Sprint 2).
  - [ ] Documenter en Dev Notes §1 la limitation : `https://spawt.ci/place/<id>` ne marche pas en V1, seul `spawt://place/<id>` fonctionne.

- [ ] **Task 5 — Tests** (AC: #8)
  - [ ] `app/__tests__/screens/PlaceDetailScreen.test.tsx` — étendre avec tests share (mock `Share.share`).
  - [ ] Tests handler `onSharePress` isolé si extrait helper.

- [ ] **Task 6 — Smoke + CHANGELOG** (AC: #8)
  - [ ] Triple gate verte.
  - [ ] Smoke `expo export --platform android` compile.
  - [ ] Test manuel sur 1 device Android + 1 iOS : tap share → WhatsApp s'ouvre, message pré-rempli.
  - [ ] CHANGELOG `feat(share)` scope `share`.

## Dev Notes

### 1. V1 = scheme only, V2 = universal links

**V1** :
- URL générée : `https://spawt.ci/place/<uuid>`
- Mais le scheme app : `spawt://place/<uuid>` (configuré déjà dans `app.json`)
- **Problème** : le destinataire ne peut **pas** ouvrir `https://spawt.ci/...` directement avec l'app — il faut universal links (iOS AASA) ou App Links (Android assetlinks.json), ce qui exige :
  - Un domain enregistré (`spawt.ci`)
  - Un fichier `/.well-known/apple-app-site-association` servi en HTTPS
  - Un fichier `/.well-known/assetlinks.json`
  - Une infra hosting landing page `spawt.ci`
- **V1 deferred Sprint 2** : ces 4 prérequis non bloquants pour l'alpha (cahier §5.8 = test interne 5 spawters, deep links optionnels). V1 = URL générée pointe vers `https://spawt.ci/place/<id>` mais aucune redirection store/app — le destinataire voit juste l'URL textuelle, l'ouvre dans le browser, atterrit sur une page 404 ou TBD landing.
- **Acceptable V1** car le focus = le **canal viral** (« je t'envoie une bonne adresse »), pas le **funnel d'install** (Sprint 2).

**V2 (Sprint 2)** :
- Landing page `spawt.ci/place/<id>` avec Open Graph + redirect store détecté.
- Universal links iOS + App Links Android wirés.
- Event `share_link_opened` côté backend (logger Cloudflare Pages → Supabase).

### 2. Pourquoi pas `react-native-share` lib tierce ?

`react-native-share` (15+ KB) offre des features avancées (partage multi-images, customisation Android). V1 = besoin minimal (1 message + 1 URL) → API native RN suffit.

**Note** : `Share` RN ne supporte pas l'**attachment image** natif sur Android pré-13. Si V2 veut pousser une preview image WhatsApp, migrer vers `react-native-share`. Acceptable V1 sans image.

### 3. Pourquoi pas un ShareSheet custom ?

L'API native ouvre déjà une sheet OS (iOS = bottom sheet « Activity », Android = sheet de sélection app). Ajouter une sheet custom **avant** = double tap pour l'utilisateur → friction sans gain. V1 = direct call.

**Sprint 2+** pourra ajouter un preview custom si Kidam veut analyser le payload avant envoi (« preview a/b test »).

### 4. Coordination avec Stories 3.4 et 3.6

Le header top-right de la fiche lieu devient un cluster d'icônes :
- Back (gauche)
- Favori `heart` (3.6)
- Share `share` (3.7)

Coordination requise : Story 3.4 livre le header back + (optionnel) place pour les 2 icônes. Stories 3.6 et 3.7 ajoutent leurs icônes. **Pas de conflit** : 3 actions distinctes, layout horizontal aisé.

### 5. Sécurité : la URL contient `place_id` UUID

L'UUID est public — il identifie un lieu publié (RLS `is_published = true`). Pas de risque de leak.

Si Sprint 2 veut tracker `referrer_spawter_id` côté backend (events.md ligne 128 `share_link_opened`), il faudra inclure un identifier opaque dans l'URL (`?ref=<short_token>`) — V1 = pas inclus.

### 6. Internationalization & emoji

🍽️ U+1F37D — emoji standard, rendu correct sur WhatsApp Android/iOS. Acceptable.

Le template français reste accessible (Tantie Rose). Pas de jeu de mots intraduisible — le partage sera potentiellement vu par non-spawters → reste accessible.

### 7. Non-régression

- Pas de fichier moteur touché.
- `place/[id].tsx` reçoit 1 bouton supplémentaire (header) — pas de breaking sur le layout existant.
- API `Share` native = pas de bump dépendance.

### 8. Sign-off

- **Stéphanie** (tech) : revue handler + tests (mock `Share.share`).
- **Kidam** (analytics) : confirmation 2 events conformes events.md, coefficient viral mesurable.
- **Alexandre** (brand) : Test Tantie Rose sur le template — « la Meute du goût à Abidjan » est l'identité, à valider.

### 9. Defers identifiés

- **Universal links + App Links** + landing page → Sprint 2.
- **`share_link_opened` backend tracking** → Sprint 2.
- **Image preview attachée** au partage WhatsApp → Sprint 2 si `react-native-share` justifié.
- **Surface `feed` + `profile`** (partage depuis carte) → Sprint 2 (Story carte spawter flip 5.3 ajoutera le bouton partage).
- **Short link service** (`spawt.ci/p/<short>`) pour URLs plus courtes → V2.
- **Tracking spawter source** (`referrer_spawter_id`) via cookie/token URL → V2 (anti-tracking par défaut, opt-in).

### Project Structure Notes

- **1 fichier touché cross-cutting** : `place/[id].tsx` (bouton share).
- **1 fichier i18n étendu** : `fr.json` (section `share.*`).
- **Pas de nouveau composant** (V1 direct call, pas de ShareSheet custom).
- **Pas de nouvelle dépendance npm**.
- **Pas de migration SQL**.
- **Pas de modif store**.

### References

- [_bmad-output/planning-artifacts/epics.md:813-828 Story 3.7](../planning-artifacts/epics.md#L813-L828)
- [_bmad-output/planning-artifacts/PRD.md §3.1 Feature 16 — Partage](../planning-artifacts/PRD.md)
- [_bmad-output/planning-artifacts/PRD.md FR-038 — coefficient viral](../planning-artifacts/PRD.md)
- [documentation/analytics/events.md:126-128 share_*](../../documentation/analytics/events.md#L126-L128)
- [_bmad-output/planning-artifacts/ux-design-specification.md:1329 ShareSheet spec](../planning-artifacts/ux-design-specification.md#L1329)
- [_bmad-output/project-context.md §Identité plateforme — scheme spawt](../project-context.md)
- [React Native Share API](https://reactnative.dev/docs/share)
- [app/app/place/[id].tsx](../../app/app/place/[id].tsx) — fiche lieu (Story 3.4)
- [app/app.json](../../app/app.json) — scheme `spawt`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) — dev-story workflow pass continue Epic 3, 2026-05-18.

### Debug Log References

- Triple gate verte : `tsc --noEmit` (0 erreur), `lint:vocab` (✓), `i18n:check` (✓), `npm test` (153 passed / 0 failed).

### Completion Notes List

- Bouton share intégré dans header fiche lieu (Story 3.4 cluster icônes haut-droit, à côté du heart Story 3.6).
- API native `Share.share` de React Native consommée (Task 3 — pas de `ShareSheet` custom V1, l'OS ouvre déjà sa propre sheet de sélection apps).
- Payload template via i18n `share.message_template` interpolé avec `{{name}}`/`{{neighborhood}}`/`{{cuisine}}`/`{{rating}}`/`{{score}}`/`{{url}}`.
- URL générée : `https://spawt.ci/place/<uuid>` — V1 = URL textuelle visible dans WhatsApp, landing page + universal links différés Sprint 2 (Dev Notes §1).
- 2 events analytics : `share_initiated` (au tap avant `Share.share`) + `share_completed` (si `result.action === Share.sharedAction` — fiable iOS, best-effort Android). `share_link_opened` = backend-only (Sprint 2).
- Scheme `spawt://` déjà configuré dans `app.json` (cf. project-context §Identité plateforme) — pas de modif requise.
- Pas de lib tierce `react-native-share` — API native suffit pour V1 (NFR-PERF-06 bundle <500 KB).

### File List

**Fichiers modifiés** :
- `app/app/place/[id].tsx` (bouton share dans header + handler `onSharePress`)
- `app/src/i18n/fr.json` (section `share.*` : `button_label`/`dialog_title`/`message_template`/`fallback_no_phone`/`copy_link`)
