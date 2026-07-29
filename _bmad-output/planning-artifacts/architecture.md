---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-14'
inputDocuments:
  - _bmad-output/project-context.md
  - _bmad-output/planning-artifacts/PRD.md
  - _bmad-output/planning-artifacts/PRD-source-extracted.md
  - _bmad-output/planning-artifacts/PRD-validation-report.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/implementation-readiness-report-2026-05-14.md
  - documentation/SPRINT_1_CAHIER_DES_CHARGES.md
  - documentation/analytics/events.md
  - documentation/personas/stephanie.md
  - documentation/personas/kidam.md
  - documentation/personas/alexandre.md
  - docs/index.md
  - docs/project-overview.md
  - docs/architecture-mobile-app.md
  - docs/data-models-mobile-app.md
  - docs/api-contracts-mobile-app.md
  - docs/integration-architecture.md
  - docs/source-tree-analysis.md
  - docs/development-guide-mobile-app.md
  - docs/deployment-guide.md
  - docs/component-inventory-mobile-app.md
  - docs/architecture-prototype-web.md
  - docs/data-models-prototype-web.md
  - docs/development-guide-prototype-web.md
  - docs/component-inventory-prototype-web.md
workflowType: 'architecture'
project_name: 'Spawt mobile CI'
user_name: 'Alexandre'
date: '2026-05-14'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
41 FR au PRD v1.0.2, dont 27 dans le périmètre Sprint 1 (décomposés en
~31 stories sur 6 epics). Lecture architecturale :
- **Enabler FR (Epic 1 — fondation)** : FR-024 (signaux append-only),
  FR-027→030 (séparation entités spawters/spawt_staff/customers/plans/
  currencies), FR-031 (tokens design), FR-041 (feature flags runtime).
  Ce sont des contrats de schéma + d'infra, pas des features user-facing.
- **Moteurs métier purs** : FR-004 (score composite `matching.ts`),
  FR-025 (décroissance exponentielle du Palais `palais-engine.ts`),
  FR-026 (ADN du lieu), FR-037 (note pondérée par stade), FR-003
  (voix du Chat `chat-voice.ts`) — sans I/O, totaux, cible #1 des tests.
- **Brique data centrale** : FR-006 (Le Guet — géofence 10m, timer 15min,
  snooze ×3, modes actif/passif/manuel), FR-039 (offline queue), couplée
  aux 6 règles anti-fraude DR-FRAUD-01→06.
- **Surfaces de découverte** : FR-004/005/009/013/016/037 (Home HomeD,
  fiche lieu, favoris, recherche, partage WhatsApp) — autonomes sur les
  seeds via l'adapter `data-source`.
- **Identité** : FR-008/010 (profil, carte spawter flip, radar Palais,
  collection de titres, 5 stades) — moat de rétention.
- **Admin** : FR-023/032 (panel web séparé `spawt_staff`, pré-chargement
  inventaire + avis fondateurs `is_seed`).
- **Sprint 2 hors scope décomposition** : FR-011/012/014/015/017→022,
  033/034/036/038 — tracés mais non architecturés en détail ici.

**Non-Functional Requirements:**
40 NFR qui contraignent directement l'architecture :
- **Performance terrain** (NFR-PERF-01→07) : feed P95 < 3s sur 3G,
  bundle JS < 500 KB gzippé, APK < 50 MB → pas de framework UI tiers,
  import dynamique de `@supabase/supabase-js` non négociable.
- **Géolocalisation** (NFR-GEO-01→04) : périmètre 10m, précision < 30m
  sinon fallback manuel, moyenne 3 GPS / 30s, GPS off si batterie < 10%.
- **Disponibilité / résilience** (NFR-AVAIL-01→03) : offline queue +
  sync < 60s, géofences persistées OS-level, tolérance OS-tue-app
  (Tecno/Infinix/Samsung) latence max 5 min.
- **Sécurité / conformité** (NFR-SEC-01→04) : RLS `spawter_id = auth.uid()`
  sur toutes les tables PII, consent géoloc bloquant horodaté, TLS 1.2+,
  soft-delete < 5s + anonymisation J+30.
- **Anti-fraude** (NFR-FRAUD-01→06) : 6 triggers SQL côté Supabase —
  enforcement serveur, la duplication client `ANTIFRAUD_RULES` est
  purement informative.
- **Observabilité** (NFR-OBS-01→04) : wrapper analytics typé forçant la
  taxonomie `events.md` (union types — event hors taxonomie ne compile
  pas), Sentry crash-free > 99%, 9 types de signaux capturés.
- **i18n / vocab** (NFR-I18N-01/02) : 100% strings extraites + audit
  `lint:vocab` bloquant.
- **Portabilité** (NFR-PORT-01) : `country_code` sur spawters/places/
  plans/currencies — un spawter Guide à Abidjan, Touriste à Dakar.
- **Conservation data** (NFR-DATA-01→03) : `user_signals` append-only
  strict (trigger Postgres bloquant UPDATE/DELETE), overwrite sur
  `user_palais`/`spawter_progression`, append sur `collection_titres`.

**Scale & Complexity:**
Complexité moyenne-élevée — portée non par le volume de features mais
par la densité d'invariants (anti-fraude, conformité CI, vocabulaire
bloquant, voix du Chat, Contrat anti-leaderboard §20.1) et la contrainte
terrain (matrice 4 devices, 3G, OS-tue-app).

- Primary domain: mobile-app (Expo SDK 55 / RN 0.83 / TS strict) +
  panel admin web secondaire (React + Refine/AdminJS, codebase séparée)
- Complexity level: medium-high
- Estimated architectural components: ~7 couches —
  (1) Expo Router + RouteGuard passif, (2) stores Zustand,
  (3) moteurs purs `lib/`, (4) adapter `data-source` + impl Supabase,
  (5) schéma Supabase 15 tables + RLS + 6 triggers anti-fraude,
  (6) design system (tokens canoniques + primitives `midfi-kit`),
  (7) panel admin web

### Technical Constraints & Dependencies

- **Brownfield** : `app/` déjà scaffolé, Phase 0 quasi terminée
  (CHANGELOG v1.1.2). Pas de bootstrap — l'Epic 1 = alignement de
  fondation. Le code racine `/src/` est le prototype-web Vite figé,
  hors scope V1.
- **Arbitrages fondateurs figés V1** : Supabase (PostgreSQL managé +
  Auth + Storage + Edge Functions), CinetPay derrière l'interface
  `IPaymentProvider`, Zustand (pas de Redux), adapter `data-source`,
  local-first, moteurs purs `lib/`.
- **Livraison canonique Sprint 1** : EAS Build APK Android sideloadable
  (`preview`, `buildType: apk`). Expo Go = démo seulement (pas de
  géoloc background). iOS `.ipa` = chemin secondaire manuel.
- **Pas de pipeline CI actif** : la triple gate locale
  (`tsc --noEmit` + `lint:vocab` + `i18n:check`) est la barrière ;
  cible `.github/workflows/mobile-ci.yml`.
- **Pas d'endpoints REST custom** : consommation directe des tables via
  le SDK Supabase ; les contrats sont les shapes de SELECT/upsert.
- **Décisions ouvertes à ne pas trancher seul** : formule
  `session_duration_minutes` + définition « fin de session » (tech lead),
  formules KPIs (Madame Sun + Kidam), provider analytics PostHog vs
  Mixpanel, framework E2E Maestro vs Detox, provider OTP Twilio vs Termii.
- **Source UX canonique** : `documentation/ux/` (kit `midfi-kit.jsx` +
  `spawt-tokens.css` + brandbook v1.0) prime sur PRD §15 et
  `tokens.ts` (en drift) — réalignement prérequis bloquant (UX-DR1).

### Cross-Cutting Concerns Identified

- **Géolocalisation background** — Le Guet : géofencing natif,
  permissions Android/iOS + consent ARTCI, fallback batterie/précision,
  survie OS-tue-app. Traverse Epic 2 (consent), Epic 4 (Le Guet).
- **Local-first & offline** — store + AsyncStorage avant sync,
  fire-and-forget, queue offline transparente. Traverse tous les epics.
- **i18n + vocabulaire** — 100% strings via `fr.json`, voix du Chat via
  `chat-voice.ts`, audits bloquants. Traverse toutes les surfaces UI.
- **Sécurité & conformité PII** — RLS sur toutes les tables PII, consent
  granulaire, soft-delete/anonymisation, aucun secret côté mobile.
- **Anti-fraude** — 6 triggers SQL serveur + colonne `flag_reason` ;
  client informatif uniquement.
- **Feature flags runtime** — chaque feature merge derrière un flag
  (4 scopes internal/alpha/beta/prod), pas de branche longue durée.
- **Design system canonique** — tokens unique source, primitives
  `midfi-kit` portées en RN, audit hex-en-dur post-merge.
- **Observabilité typée** — wrapper analytics contraint par `events.md`.
- **Multi-part repo** — `app/` canonical vs `/src/` prototype figé ;
  aucune communication runtime.

## Starter Template Evaluation

### Primary Technology Domain

**Deux cibles, deux postures :**

1. **mobile-app (`app/`) — brownfield, AUCUN starter.** Expo SDK 55 / RN 0.83 /
   TS strict / Zustand / expo-router est déjà scaffolé (Phase 0 quasi terminée,
   CHANGELOG v1.1.2). Tous les choix de fondation sont figés et documentés dans
   `_bmad-output/project-context.md`. La « commande d'initialisation » du mobile
   est l'historique git, pas un `create-*`. Aucune évaluation de starter
   pertinente — y appliquer un starter serait une refonte stérile.
2. **admin panel web (Epic 6 / FR-023) — greenfield.** Seule codebase à
   initialiser. C'est l'objet de cette évaluation.

### Starter Options Considered (admin panel web)

| Option | Verdict |
|---|---|
| **Refine sur Vite + React** | ✅ **Retenu.** Framework React headless orienté CRUD/admin, data-provider + auth-provider Supabase officiels (`@refinedev/supabase`), compatible accès direct-tables + RLS du projet. |
| **AdminJS** | ❌ Écarté. Suppose un ORM serveur (Prisma/Sequelize) — friction directe avec le modèle « pas d'endpoints REST custom, consommation directe des tables Supabase » et la RLS `spawter_id = auth.uid()`. |
| **Vite + React minimal** | ❌ Écarté. Contrôle total mais tout le CRUD lieux / modération / métriques à coder à la main — effort disproportionné face à Refine qui le fournit. |

### Selected Starter: Refine (preset `refine-supabase`, sur Vite + React + TS)

**Rationale for Selection:**
- **Connecteur Supabase officiel** (`@refinedev/supabase`) : data-provider +
  auth-provider gérés, cohérent avec l'accès direct-tables + RLS du projet —
  pas d'ORM serveur intermédiaire à introduire.
- **Headless** : Refine ne force aucune librairie UI. L'admin reste sobre,
  pas de drift brand (l'admin n'est pas user-facing, mais reste un outil
  `spawt_staff`).
- **CRUD/modération/métriques natifs** : Epic 6 (CRUD lieux, file de
  modération triée, gestion comptes, métriques basiques) tombe dans le
  cœur de cible de Refine — peu de code à écrire.
- **Codebase séparée** : conforme à la décision « codebase web séparée »
  des epics ; auth distincte des spawters publics, restreinte à `spawt_staff`.
- **Stack proche de l'existant** : Vite + React + TypeScript — le prototype-web
  figé tourne déjà sur Vite 5, l'équipe connaît l'outillage.

**Initialization Command:**

```bash
# Versions vérifiées sur npm — mai 2026 :
# @refinedev/core 5.0.12 (Refine v5) · @refinedev/supabase 6.0.2
# @refinedev/cli 2.16.52 · @refinedev/react-router 2.0.4
npm create refine-app@latest -- --preset refine-supabase spawt-admin
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript + React 18+ sur Vite. Codebase web autonome (`spawt-admin/`),
sans communication runtime avec `app/` (cohérent integration-architecture.md).

**Styling Solution:**
Headless — aucune librairie UI imposée par le preset. À trancher au Step 4
si besoin (Ant Design / MUI / custom sobre). L'admin n'étant pas user-facing,
pas de contrainte brand canonique `documentation/ux/`.

**Build Tooling:**
Vite 5 (dev server + HMR + build). Aligné sur l'outillage du prototype-web.

**Testing Framework:**
Non fourni par le preset — à aligner sur la stratégie de test globale
(décision Step 4+). L'admin n'est pas dans la triple gate mobile.

**Code Organization:**
Conventions Refine : `src/` avec resources (lieux, place_adn, modération,
comptes), `src/utility/supabaseClient.ts` auto-généré par le CLI (à recâbler
sur les env vars `spawt-admin` — jamais le `service_role_key` côté client).

**Development Experience:**
data-provider + auth-provider Supabase prêts, hooks CRUD typés, hot reload
Vite. RLS Supabase = la barrière d'accès — l'admin lit/écrit via le SDK
comme le mobile, pas via une API custom.

**Contraintes héritées du projet (à respecter dès l'init) :**
- Auth `spawt_staff` distincte des `spawters` publics (séparation amendement
  team §4.1) — l'admin ne se connecte jamais avec un compte spawter.
- Aucun `service_role_key` côté client admin : si une opération exige le
  service role, elle passe par une Edge Function Supabase.
- Actions critiques (ban, suppression) auditées avec horodatage + auteur
  `spawt_staff_id`.

**Note:** L'initialisation via `npm create refine-app@latest -- --preset
refine-supabase spawt-admin` doit être la première story d'implémentation
de l'Epic 6.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Backend = Supabase (figé) ; schéma 15 tables + RLS + 6 triggers anti-fraude
- Outillage migrations = Supabase CLI (`supabase/migrations/*.sql`, réversibles)
- Auth = Termii OTP → session JWT Supabase Auth via Edge Function `otp-send`
- Validation runtime = Zod à la frontière de l'adapter `data-source`
- Le Guet = `expo-location` geofencing + `expo-task-manager` + `expo-notifications` + queue AsyncStorage
- Stockage média = Supabase Storage (buckets `place-photos` / `place-covers`)
- Avis seed = colonne `is_seed` sur `spawt_checkin`

**Important Decisions (Shape Architecture):**
- Analytics = wrapper `analytics.ts` typé, provider **PostHog** (agnostique, surchargeable Kidam)
- Admin = Refine v5 + Vite (Step 3), déployé sur **Cloudflare Pages**
- State = Zustand (2 stores existants) + hook `useFlag` sur store feature-flags léger
- Edge Functions = `otp-send` (Phase 1.1), `cinetpay-webhook` (Sprint 2), job anonymisation J+30 (NFR-SEC-04)

**Deferred Decisions (ne pas trancher seul — signalées) :**
- `session_duration_minutes` + définition « fin de session » → tech lead (cahier §4.7)
- Formules KPIs Engagement/Activation/Rétention → Madame Sun + Kidam + tech lead
- Framework E2E Maestro vs Detox → Stéphanie
- Branchement final PostHog vs Mixpanel → Kidam + Madame Sun (le wrapper ne bloque pas)
- Profil EAS `production` iOS + OTA Expo Updates → en attente compte Apple Developer
- 8 amendements Claude `[pending]` → triple sign-off Stéphanie + Kidam + Alexandre

### Data Architecture

- **Base** : PostgreSQL managé via Supabase (figé). 15 tables — `spawters`,
  `spawt_staff`, `customers`, `plans`, `currencies`, `places`, `place_adn`,
  `user_palais`, `spawter_progression`, `collection_titres`, `user_signals`,
  `spawt_checkin`, `subscriptions`, `invoices`, `feature_flags`.
- **Migrations** : Supabase CLI, fichiers `supabase/migrations/*.sql`
  versionnés, **chaque migration a un script `down`** (red flag Stéphanie :
  pas de migration non-réversible). Branches Supabase preview pour tester les
  triggers anti-fraude (Phase 1.3).
- **Historisation** (amendement team §4.6) : overwrite (`user_palais`,
  `spawter_progression`) · append (`collection_titres`) · append-only strict
  (`user_signals` — trigger Postgres bloquant UPDATE/DELETE).
- **Avis fondateurs** : colonne `is_seed BOOLEAN DEFAULT false` sur
  `spawt_checkin`. Un avis seed = un `spawt_checkin` (spawter_id = compte
  staff/ally). Inclus dans le calcul ADN, filtré `is_seed = false` à
  l'affichage du compteur public. Aucune table `seed_reviews` séparée —
  pas de duplication de la logique d'alimentation ADN.
- **Validation runtime** : **Zod** à la frontière de `data-source.supabase.ts`
  (`zod@4.4.3`). Les SELECT/upsert Supabase sont validés au parse ; les types
  TS de `app/src/types/` deviennent dérivés des schémas Zod (`z.infer`) au fur
  et à mesure. Échec de parse → fallback propre (cohérent local-first), jamais
  une donnée malformée jusqu'aux moteurs purs `lib/`.
- **Caching** : pas de lib de server-state (pas de TanStack Query). Le cache
  EST le local-first — store Zustand + AsyncStorage, adapter `data-source` qui
  retourne `{ mode, data }` avec fallback seeds transparent.
- **Stockage média** : Supabase Storage. Bucket `place-photos` (RLS écriture
  limitée au sous-dossier `<spawter_id>/<spawt_id>/`), bucket `place-covers`
  (read-only public). Compression client-side 80 % / 1 MB max **avant** upload
  (NFR-PERF-07, NFR-COST-02). Résout le drift PRD §12.1 (Cloudinary) en faveur
  de project-context + api-contracts.

### Authentication & Security

- **Auth spawter** : OTP SMS via **Termii** (routes locales CI, déliverabilité
  Orange/MTN/Moov) bridgé par une Edge Function `otp-send` qui ouvre une
  session **JWT Supabase Auth**. Google Sign-In en secondaire + Sign in with
  Apple (exigence Apple §4.0). Aucune méthode email+password.
- **Auth staff** : `spawt_staff` — credentials distincts des spawters publics,
  jamais de connexion croisée. Le panel admin s'authentifie comme `spawt_staff`.
- **Authorization** : RLS Postgres `spawter_id = auth.uid()` sur toutes les
  tables PII (`spawters`, `user_palais`, `spawter_progression`,
  `collection_titres`, `mue_tracking`, `spawt_checkin`, `user_signals`,
  `customers`, `subscriptions`, `invoices`). `spawt_staff` inaccessible aux
  comptes publics. Filtre `is_published` côté client ET RLS serveur sur `places`.
- **Secrets** : aucun secret sous `EXPO_PUBLIC_*` (inliné dans le bundle).
  `service_role_key`, `TERMII_API_KEY`, `CINETPAY_API_KEY` → Edge Functions /
  variables serveur uniquement. Le panel admin n'utilise jamais le
  `service_role` côté client.
- **Conformité ARTCI / Loi 2013-450** : consent bloquant à l'onboarding
  (FR-040, 2 timestamps distincts `cgv_accepted_at` / `geoloc_consent_at`),
  soft-delete < 5 s + anonymisation J+30 (job planifié — Edge Function cron ou
  `pg_cron`), TLS 1.2+ au gateway Supabase. PostHog en hosting EU/self-host
  pour respecter « pas de transfert hors CI sans accord ».
- **Anti-fraude** : 6 triggers SQL sur `spawt_checkin` (DR-FRAUD-01→06) +
  colonne `flag_reason`. Le client (`ANTIFRAUD_RULES`) reste informatif.

### API & Communication Patterns

- **Pas d'endpoints REST custom** : consommation directe des tables via le SDK
  `@supabase/supabase-js` (import dynamique). Les contrats = les shapes de
  SELECT/upsert, validés par Zod côté client.
- **Adapter `data-source` (règle d'or)** : les écrans ne touchent jamais
  Supabase. `data-source.ts` (interface) délègue à `data-source.supabase.ts`
  (chargé via `await import()`), retourne `{ mode: "supabase" | "fallback",
  data }`, fallback transparent vers les seeds — pas d'exception en bordure.
- **Edge Functions** : `otp-send` (bridge Termii, Phase 1.1), `cinetpay-webhook`
  (Sprint 2 — confirme paiement → upsert `subscriptions`), job anonymisation
  J+30 (NFR-SEC-04). Pas de canal Realtime en Sprint 1.
- **Gestion d'erreurs** : moteurs purs `lib/` totaux (retour `null`/défaut
  documenté, jamais `throw` brut). I/O Supabase/AsyncStorage = catch-and-log,
  jamais propagé en plein écran. Wrapper `__DEV__` pour les logs (pas de PII en
  prod).
- **Synchronisation** : local-first strict — store + AsyncStorage écrits
  **avant** la sync ; sync = fire-and-forget (`void saveSpawter(...)`), jamais
  d'`await` réseau dans une action user-facing. Offline → queue AsyncStorage,
  sync < 60 s au retour réseau (NFR-AVAIL-02).

### Frontend Architecture

- **Routing** : expo-router file-based, typed routes, `RouteGuard` passif
  (observe le store, redirige `(onboarding)` ↔ `(tabs)`, aucune logique métier).
- **State** : Zustand — `spawter-store` (durable, persisté AsyncStorage) +
  `onboarding-draft` (éphémère). Feature flags via hook `useFlag(code)` sur un
  store léger hydraté depuis la table `feature_flags`, rafraîchi par polling
  TTL < 60 s (4 scopes `internal`/`alpha`/`beta`/`prod`). Sélecteurs granulaires.
- **Moteurs purs `lib/`** : `matching.ts` (score composite PRD §8.1),
  `palais-engine.ts` (décroissance exponentielle), `chat-voice.ts` (mapping
  stade × moment). Sans I/O, totaux, cible #1 des tests unitaires.
- **Le Guet (brique data centrale, FR-006)** : `expo-location`
  `startGeofencingAsync` (régions natives 10 m, basse conso) + **ajout
  `expo-task-manager@55.0.16`** (`defineTask` — callback background persistant
  OS-level, survit à l'OS-tue-app) + `expo-notifications` (locales, marchent
  offline). Moyenne des 3 dernières positions GPS / 30 s (NFR-GEO-03) ;
  précision > 30 m → fallback mode manuel (NFR-GEO-02) ; batterie < 10 % → GPS
  off + mode manuel (NFR-GEO-04). Spawts en queue AsyncStorage, sync
  fire-and-forget. Mode démo (Expo Go) : géofence non armée → CTA manuel
  « Je spawt ici ».
- **Design system** : RN primitives + tokens canoniques (`spawt-tokens.css` →
  `tokens.ts` réaligné) + primitives `midfi-kit` portées en RN. Pas de
  framework UI tiers (bundle < 500 KB gzippé, NFR-PERF-06). Polices Klinsman +
  Gotham via `expo-font`. `react-native-reanimated` sur le UI thread.
- **Performance** : import dynamique Supabase non négociable, photos servies
  CDN (Supabase Storage) jamais bundlées, sélecteurs Zustand granulaires,
  paths SVG mémoïsés. Cibles : feed P95 < 3 s sur 3G, APK < 50 MB.
- **i18n** : 100 % des strings via `i18next` + `fr.json` (`fr-CI`), voix du
  Chat via `chat-voice.ts`. Audits `lint:vocab` + `i18n:check` bloquants.

### Infrastructure & Deployment

- **Mobile** : EAS Build — profil `preview` APK Android sideloadable = chemin
  canonique Sprint 1. Expo Go = démo seulement. iOS `.ipa` = secondaire manuel.
  Profil `production` iOS + OTA Expo Updates différés (compte Apple Developer).
- **Backend** : Supabase (free tier OK pour l'alpha). RLS activée sur toutes
  les tables PII dès la création. Buckets Storage configurés Phase 1.3.
- **Admin** : `spawt-admin` (Refine v5 + Vite) déployé sur **Cloudflare Pages**
  (free tier généreux, edge global — latence correcte depuis Abidjan, build
  Vite supporté). Protection d'accès en plus de l'auth `spawt_staff`.
- **Analytics** : `posthog-react-native@4.45.5` derrière le wrapper typé
  `analytics.ts` (union types contraints par `events.md` — un event hors
  taxonomie ne compile pas). Hosting EU/self-host (conformité données CI).
- **Monitoring** : Sentry (crash-free > 99 %, NFR-OBS-01) — à installer.
- **CI/CD** : cible `.github/workflows/mobile-ci.yml` lançant la triple gate
  (`tsc --noEmit` + `lint:vocab` + `i18n:check`) + `npm test` sur chaque PR.
  En attendant : triple gate locale = la barrière. EAS Build déclenchable par
  webhook sur merge.
- **Environnements** : `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY` côté mobile ;
  secrets serveur (`service_role`, Termii, CinetPay) en Edge Functions.

### Decision Impact Analysis

**Implementation Sequence:**
1. **Epic 1 — Fondation** : tokens canoniques + polices · schéma Supabase
   (migrations CLI réversibles) + RLS · schémas Zod · table + hook
   `feature_flags` · wrapper `analytics.ts` (PostHog) · `user_signals`
   append-only.
2. **Epic 2 — Entrée** : Edge Function `otp-send` (Termii) + auth Supabase ·
   consent ARTCI bloquant · onboarding `OnbMidfi` + calibrage Palais.
3. **Epic 3 — Découverte** : adapter `data-source` mode live · `places` /
   `place_adn` · HomeD + feed + fiche + recherche + favoris + partage.
4. **Epic 4 — Le Spawt** : `spawt_checkin` + `expo-task-manager` geofencing ·
   notifs locales · queue offline · avis + Supabase Storage photos ·
   `palais-engine` + ADN · 6 triggers anti-fraude.
5. **Epic 5 — Identité** : `spawter_progression` + `collection_titres` ·
   profil + carte spawter flip + radar Palais + stades.
6. **Epic 6 — Admin** : init `spawt-admin` (Refine) · CRUD lieux · modération ·
   métriques · pré-chargement inventaire + avis seed · déploiement Cloudflare.

**Cross-Component Dependencies:**
- Le **schéma Supabase + RLS** (Epic 1) bloque toute écriture authentifiée des
  Epics 2-6 en mode live.
- L'**adapter `data-source`** + schémas Zod conditionnent les Epics 3-6 (mode
  live) — les Epics restent autonomes en mode fallback sur les seeds.
- L'**auth Termii + RLS** conditionne tout accès aux tables PII.
- **Le Guet** (Epic 4) dépend de `spawt_checkin`, du consent géoloc (Epic 2) et
  de `expo-task-manager` (nouvelle dépendance).
- Le **wrapper analytics** est transverse — instrumenté dès l'Epic 1, consommé
  par tous.
- Les **feature flags** (Epic 1) gating chaque feature des Epics 2-6 (pas de
  branche longue durée).
- Le **panel admin** (Epic 6) dépend du schéma Epic 1 **et** de la migration `places` / `place_adn` (Epic 3, Story 3.3a) — les Stories 6.2/6.3 opèrent sur ces tables. Séquencé après l'Epic 3 ; par ailleurs autonome (aucune dépendance aux features mobiles user-facing).

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Source canonique des patterns existants :** `_bmad-output/project-context.md`
(120 règles) reste **la** référence pour le naming, les exports, le vocabulaire,
l'i18n, les tokens, les stores, les moteurs purs, la sécurité et les anti-patterns.
Cette section ne **re-litige pas** ces règles — elle verrouille uniquement les
**patterns nouveaux** introduits par les décisions Step 4 (Zod, Termii OTP,
`expo-task-manager`, Supabase Storage, PostHog wrapper, Refine admin) et les
**points de conflit** où deux agents IA pourraient diverger.

**Critical Conflict Points Identified:** 8 zones où les agents pourraient faire
des choix incompatibles — schémas Zod, migrations, Edge Functions, queue offline,
feature flags, événements analytics, Le Guet, codebase admin.

### Naming Patterns

**Database Naming Conventions:**
- Tables : `snake_case` pluriel pour les collections (`spawters`, `places`,
  `user_signals`), `snake_case` pour les tables 1:1 / techniques (`place_adn`,
  `user_palais`, `spawt_checkin`, `feature_flags`). Noms figés par le PRD §13 +
  amendements team §4 — ne pas renommer.
- Colonnes : `snake_case`. FK : `<entité>_id` pointant vers `spawters(id)` /
  `places(id)` / `customers(id)` (jamais vers une table `users` générique).
- Index : `idx_<table>_<colonnes>` (ex. `idx_signals_spawter` sur
  `user_signals(spawter_id, created_at)`).
- Migrations : `supabase/migrations/NNNN_<verbe>_<objet>.sql` +
  **fichier `down` appairé `NNNN_<verbe>_<objet>.down.sql`** (réversibilité
  Stéphanie). Le `down` est revu en même temps que le `up`.
- Triggers anti-fraude : `trg_antifraud_<règle>` sur `spawt_checkin`.

**API / Edge Functions Naming:**
- Pas d'endpoints REST custom. Edge Functions dans `supabase/functions/<nom>/`,
  `kebab-case` (`otp-send`, `cinetpay-webhook`, `anonymize-deleted-spawters`).
- Contrat de réponse Edge Function uniforme : `{ data: T | null, error:
  { code: string, message: string } | null }` — jamais de `throw` en bordure,
  jamais de 5xx brut. Cohérent avec le pattern adapter `data-source`.
- Buckets Storage : `place-photos` (écriture RLS `<spawter_id>/<spawt_id>/`),
  `place-covers` (read-only public). Chemin objet :
  `<spawter_id>/<spawt_id>/<index>.jpg`.

**Code Naming Conventions:**
- Voir `project-context.md` §Convention de naming (figé) : fichiers TS
  `kebab-case.ts`, composants `PascalCase.tsx`, constantes `UPPER_SNAKE_CASE`,
  types `PascalCase`, préfixe `Spawt` interdit sur les composants techniques.
- **Nouveau** — schémas Zod : `app/src/types/<entité>.schema.ts`, export nommé
  `<Entité>Schema` (ex. `SpawterSchema`, `PlaceSchema`). Le type TS est
  **dérivé** : `export type Spawter = z.infer<typeof SpawterSchema>`.
- **Nouveau** — feature flags : `flag_code` en `kebab-case` préfixé par le
  périmètre (`onboarding-consent`, `feed-home-d`, `guet-geofence`,
  `admin-moderation`). Hook `useFlag("guet-geofence")`.
- **Nouveau** — événements analytics : `snake_case` préfixé par domaine
  (déjà figé dans `events.md`) — aucun event hors `events.md`.

### Structure Patterns

**Project Organization:**
- `app/` (canonical mobile) — structure figée dans `project-context.md` /
  `source-tree-analysis.md` : `src/{theme,types,lib,store,components,i18n,data/seed}`
  + `app/` (routes expo-router). Pas de variantes (`utils/`, `helpers/`, `core/`
  interdits). Barrels `index.ts` autorisés uniquement dans `src/types/`.
- `supabase/` (nouveau, à la racine `app/` ou racine repo selon CLI) :
  `migrations/` (+ `.down.sql` appairés), `functions/<nom>/`.
- `spawt-admin/` (nouveau, codebase Refine séparée) — conventions Refine, aucune
  communication runtime avec `app/`.
- Tests : co-localisés `*.test.ts` à côté du module testé (cible #1 = moteurs
  purs `lib/`). Pas de dossier `__tests__/`.

**File Structure Patterns:**
- Queue offline : un module dédié `app/src/lib/offline-queue.ts` (pas dispersé
  dans les stores). API : `enqueue(spawt)`, `flush()`, `inspect()`, `purge()`.
- Le Guet : `app/src/lib/guet/` — `geofence.ts` (wrapper `expo-location`
  `startGeofencingAsync`), `guet-task.ts` (`expo-task-manager` `defineTask`,
  enregistré au niveau module pour persister OS-level), `guet-notifications.ts`.
- Wrapper analytics : `app/src/lib/analytics.ts` (unique point d'émission).
- Schémas Zod : `app/src/types/*.schema.ts`.

### Format Patterns

**API / Data Exchange Formats:**
- Adapter `data-source` : `{ mode: "supabase" | "fallback", data }` — figé.
- Edge Functions : `{ data, error }` (cf. ci-dessus).
- JSON / colonnes : `snake_case` partout (DB ↔ client). Pas de transformation
  camelCase — les types Zod reflètent les colonnes telles quelles.
- Dates : ISO 8601 UTC en stockage et en transport. **Jamais** de date relative
  codée en dur (« il y a 2 jours ») — calcul à l'affichage (project-context).
- Booléens : `true`/`false`. `null` explicite (jamais `undefined` côté DB) —
  `exactOptionalPropertyTypes` impose d'omettre la clé ou de typer
  `| undefined` explicitement côté TS.
- Argent : entiers FCFA (`price_ht`, `tva_amount`, `price_ttc`), pas de float.

**Validation Format:**
- Toute donnée franchissant `data-source.supabase.ts` est `XSchema.safeParse()`
  — jamais `.parse()` brut (pas de `throw` en bordure). Échec → `mode:
  "fallback"` + log `__DEV__`, jamais d'écran d'erreur.

### Communication Patterns

**Event System Patterns:**
- Analytics : émission **exclusivement** via `analytics.ts`. Signature typée —
  `track(event, props)` où `event` ∈ union des noms `events.md` et `props` est
  le type associé à cet event. Un event hors taxonomie **ne compile pas**.
  `spawter_id` injecté automatiquement par le wrapper.
- `user_signals` : insertion append-only via une action de store dédiée, jamais
  d'`UPDATE`/`DELETE` (trigger Postgres bloquant).
- Notifications Le Guet : locales (`expo-notifications`), clé i18n
  `notif.guet.prompt` avec interpolation `{place_name}` — jamais de copy
  littérale.

**State Management Patterns:**
- Zustand : mutations **uniquement** via actions exportées (`finalizeOnboarding`,
  `registerSpawt`, `recordConsent`…) — jamais de `set()` direct depuis un
  composant. Sélecteurs granulaires `useSpawterStore((s) => s.spawter)`.
- Local-first : toute action user écrit store + AsyncStorage **avant** la sync ;
  sync = `void saveX(...)` fire-and-forget. Recompute dérivés (`unique_spots` →
  `stade`) après chaque mutation.
- Feature flags : store léger séparé, hydraté depuis `feature_flags`, polling
  TTL < 60 s ; lecture via `useFlag(code)` uniquement.
- Le Guet : la tâche `expo-task-manager` est enregistrée **au niveau module**
  (top-level), pas dans un composant — sinon elle ne survit pas à l'OS-kill.

### Process Patterns

**Error Handling Patterns:**
- Moteurs purs `lib/` (`matching`, `palais-engine`, `chat-voice`) : **totaux** —
  retour `null` / valeur par défaut documentée, jamais `throw new Error(string)`.
- I/O (Supabase, AsyncStorage, Storage, Edge Functions) : catch-and-log
  (`__DEV__`), jamais propagé en plein écran utilisateur. Fallback gracieux
  (mode démo, placeholder photo, queue offline).
- Edge Functions : retour `{ data, error }`, jamais de 5xx brut côté client.
- Pas de PII (`phone`, `gender`, `age_range`) dans les logs niveau INFO/DEBUG.

**Loading & Resilience Patterns:**
- Local-first → l'action s'affiche **avant** la confirmation réseau. Pas de
  spinner bloquant sur une action user.
- Offline → `offline-queue` transparente, sync < 60 s au retour réseau, aucun
  message d'erreur agressif. File inspectable/purgeable depuis Profil.
- `useEffect` async → toujours flag `cancelled` ou `AbortController`.
- Le Guet : précision GPS > 30 m → mode manuel ; batterie < 10 % → mode manuel ;
  Expo Go → CTA manuel « Je spawt ici ».

### Enforcement Guidelines

**All AI Agents MUST:**
- Lire `_bmad-output/project-context.md` **avant toute implémentation** dans
  `app/` — ce sont des invariants, pas des guidelines.
- Passer la **triple gate** avant chaque commit : `cd app && npx tsc --noEmit
  && npm run lint:vocab && npm run i18n:check`.
- Faire passer toute donnée serveur par un schéma Zod (`safeParse`) à la
  frontière de l'adapter — jamais de donnée non validée vers les moteurs purs.
- Émettre tout événement analytics via `analytics.ts` et uniquement avec un nom
  présent dans `events.md`.
- Appairer chaque migration `up` d'un fichier `.down.sql` réversible.
- Gating chaque feature des Epics 2-6 derrière un `feature_flag` (pas de branche
  longue durée).
- Ne jamais trancher seul une décision historisée (`session_duration_minutes`,
  formules KPIs, framework E2E, amendements `[pending]`) — signaler et continuer.

**Pattern Enforcement:**
- Audits bloquants en local : `tsc --noEmit`, `lint:vocab`, `i18n:check` +
  grep hex post-merge. Cible CI : `.github/workflows/mobile-ci.yml`.
- Violation de pattern → drift à corriger dans le **commit suivant** (séparé
  d'une feature), cf. table « Drift signals » du project-context.
- Évolution d'un pattern durable → remonter pour mise à jour du
  `project-context.md`, ne pas inventer un détour.

### Pattern Examples

**Good Examples:**
```ts
// Zod = source de vérité, type dérivé
export const SpawterSchema = z.object({ id: z.string(), phone_e164: z.string(), /* … */ });
export type Spawter = z.infer<typeof SpawterSchema>;

// Adapter : safeParse, jamais de throw en bordure
const parsed = PlaceWithAdnSchema.array().safeParse(raw);
if (!parsed.success) return { mode: "fallback", data: SEED_PLACES };

// Analytics typé
analytics.track("spawt_completed", { place_id, check_in_type: "active", is_verified: true });

// Tâche Le Guet enregistrée au niveau module
TaskManager.defineTask(GUET_TASK, async ({ data }) => { /* … */ });
```

**Anti-Patterns:**
```ts
// ❌ throw en bordure d'adapter
const data = PlaceSchema.parse(raw); // casse le mode démo

// ❌ event ad hoc hors events.md
analytics.track("user_did_something", {}); // ne doit pas compiler

// ❌ set() direct depuis un composant
useSpawterStore.setState({ spawter }); // passer par une action exportée

// ❌ await réseau dans une action user-facing
await saveSpawter(spawter); // doit être : void saveSpawter(spawter)

// ❌ migration sans .down.sql appairé
// ❌ defineTask dans un composant (ne survit pas à l'OS-kill)
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
Spawt mobile CI/
├── src/                              # ⚪ prototype-web Vite — FIGÉ, ne pas livrer V1
├── public/  ·  index.html  ·  vite.config.js  ·  package.json   # prototype-web
├── CHANGELOG.md                      # journal Conventional Commits versionné par Sprint
├── documentation/                    # source amont produit (PRD, cahier, personas, UX, analytics)
├── docs/                             # doc brownfield BMad (sortie LLM)
├── _bmad/  ·  _bmad-output/           # méthode BMAD + artefacts planning/implementation
│
├── app/                              # 🔵 mobile-app — CANONICAL V1 (Expo SDK 55 / RN 0.83)
│   ├── package.json  ·  app.json  ·  eas.json  ·  tsconfig.json  ·  babel.config.js
│   ├── README.md  ·  expo-env.d.ts
│   ├── .env                          # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (non commit)
│   ├── app/                          # expo-router — file-based routing
│   │   ├── _layout.tsx               # RootLayout + RouteGuard + Providers
│   │   ├── index.tsx                 # Splash gr-night « Entrer dans la Meute »
│   │   ├── (onboarding)/             # Stack — consent / phone / profile / calibration
│   │   ├── (tabs)/                   # Tabs 5 onglets — Feed · Carte · [FAB] · Meute · Palais
│   │   │   ├── _layout.tsx  ·  index.tsx (HomeD)  ·  carte.tsx  ·  meute.tsx  ·  palais.tsx
│   │   └── place/[id].tsx            # Fiche lieu
│   ├── src/
│   │   ├── theme/                    # tokens.ts (réaligné spawt-tokens.css) + ThemeProvider + typo
│   │   ├── types/                    # *.schema.ts (Zod = source) → *.ts (z.infer) ; index.ts (barrel)
│   │   │   ├── spawter.schema.ts  ·  place.schema.ts  ·  palais.schema.ts
│   │   │   ├── stade.schema.ts  ·  spawt.schema.ts  ·  feature-flag.schema.ts
│   │   │   └── index.ts
│   │   ├── lib/                      # moteurs purs + I/O adapters
│   │   │   ├── matching.ts  ·  palais-engine.ts  ·  chat-voice.ts        # moteurs purs (totaux)
│   │   │   ├── data-source.ts  ·  data-source.supabase.ts                # adapter (règle d'or)
│   │   │   ├── supabase.ts  ·  storage.ts  ·  offline-queue.ts            # I/O
│   │   │   ├── analytics.ts          # wrapper typé PostHog (events.md = union types)
│   │   │   ├── auth.ts               # bridge OTP → session Supabase Auth
│   │   │   └── guet/                 # Le Guet — geofence.ts · guet-task.ts · guet-notifications.ts
│   │   ├── store/                    # spawter-store.ts · onboarding-draft.ts · feature-flags.ts
│   │   ├── data/seed/                # places.ts · sample-spawter.ts
│   │   ├── components/               # primitives midfi-kit portées RN + composites Sprint 1
│   │   └── i18n/                     # index.ts · fr.json (toutes les strings UI)
│   └── scripts/                      # lint-vocab.mjs · i18n-check.mjs
│
├── supabase/                         # 🟢 NOUVEAU — infra DB partagée (mobile + admin)
│   ├── config.toml
│   ├── migrations/                   # NNNN_<verbe>_<objet>.sql + NNNN_<...>.down.sql appairé
│   │   ├── 0001_create_spawters_spawt_staff.sql            (+ .down.sql)
│   │   ├── 0002_create_customers_plans_currencies.sql      (+ .down.sql)
│   │   ├── 0003_create_user_signals_appendonly.sql         (+ .down.sql)
│   │   ├── 0004_create_feature_flags.sql                   (+ .down.sql)
│   │   ├── 0005_create_places_place_adn.sql                (+ .down.sql)
│   │   ├── 0006_create_user_palais.sql                     (+ .down.sql)
│   │   ├── 0007_create_spawt_checkin.sql                   (+ .down.sql)
│   │   ├── 0008_antifraud_triggers.sql                     (+ .down.sql)
│   │   ├── 0009_create_progression_collection_titres.sql   (+ .down.sql)
│   │   ├── 0010_create_subscriptions_invoices.sql          (+ .down.sql)
│   │   └── 0011_storage_buckets_rls.sql                    (+ .down.sql)
│   ├── functions/                    # Edge Functions (Deno)
│   │   ├── otp-send/                 # bridge Termii → session Supabase Auth (Phase 1.1)
│   │   ├── cinetpay-webhook/         # confirme paiement → upsert subscriptions (Sprint 2)
│   │   └── anonymize-deleted-spawters/   # job J+30 — NFR-SEC-04
│   └── seed/                         # seed inventaire 50-100 lieux + 150-300 avis is_seed
│
├── spawt-admin/                      # 🟢 NOUVEAU — panel admin (Refine v5 + Vite + TS)
│   ├── package.json  ·  vite.config.ts  ·  tsconfig.json
│   ├── .env                          # VITE_SUPABASE_URL / _ANON_KEY (jamais service_role)
│   └── src/
│       ├── App.tsx                   # Refine + dataProvider/authProvider Supabase
│       ├── utility/supabaseClient.ts # client Supabase (anon key)
│       └── resources/                # lieux · place_adn · moderation · comptes · metriques
│
└── .github/workflows/
    └── mobile-ci.yml                 # NOUVEAU — triple gate + npm test sur PR
```

### Architectural Boundaries

**API Boundaries:**
- **Aucune API REST custom.** Le mobile et l'admin parlent à Supabase via le SDK
  (`@supabase/supabase-js`). Les seuls « endpoints » sont les Edge Functions
  (`otp-send`, `cinetpay-webhook`, `anonymize-deleted-spawters`), contrat
  `{ data, error }`.
- **Frontière de confiance = RLS Postgres.** `spawter_id = auth.uid()` sur les
  tables PII ; `spawt_staff` inaccessible aux comptes publics. Anon key côté
  client (mobile + admin), `service_role` jamais hors Edge Functions.

**Component Boundaries:**
- **Écrans → adapter, jamais Supabase direct.** Tout accès données passe par
  `lib/data-source.ts`. `data-source.supabase.ts` chargé en `await import()`.
- **Composants dumb.** Pas de logique métier dans les composants — déléguée aux
  moteurs purs `lib/` et aux stores Zustand.
- **Stores → actions exportées.** Mutation d'état uniquement via actions
  (`finalizeOnboarding`, `registerSpawt`, `recordConsent`…).
- **`RouteGuard` passif.** Observe le store, redirige `(onboarding)` ↔ `(tabs)` ;
  aucune orchestration métier.

**Service Boundaries:**
- **`app/` ↔ `spawt-admin/` : aucune communication runtime.** Codebases séparées,
  seul point commun = le projet Supabase (schéma partagé). Cohérent
  `integration-architecture.md`.
- **`app/` ↔ `src/` (prototype-web) : aucune communication, vocabulaire divergent.**
  Le prototype reste figé, hors livraison V1.
- **Le Guet ↔ OS.** `expo-task-manager` `defineTask` enregistré au niveau module
  — frontière avec le scheduler OS (géofences persistées niveau natif).

**Data Boundaries:**
- **Frontière de validation = `data-source.supabase.ts`.** Toute donnée serveur
  est `XSchema.safeParse()` ici ; en aval (moteurs, stores, écrans), la donnée
  est garantie typée. Échec → `mode: "fallback"`.
- **Frontière local ↔ distant.** Store + AsyncStorage = vérité locale ; Supabase
  = sync fire-and-forget. `offline-queue.ts` est le tampon des spawts hors-ligne.
- **Historisation.** `user_signals` append-only (trigger Postgres) ;
  `user_palais` / `spawter_progression` overwrite ; `collection_titres` append.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- **Epic 1 — Fondation** → `app/src/theme/` (tokens + polices) ·
  `app/src/types/*.schema.ts` (Zod) · `supabase/migrations/0001-0004` + RLS ·
  `app/src/store/feature-flags.ts` + `lib/` hook `useFlag` ·
  `app/src/lib/analytics.ts` · `app/src/components/` (primitives `midfi-kit`).
- **Epic 2 — Entrée** → `app/app/(onboarding)/` · `app/src/lib/auth.ts` ·
  `supabase/functions/otp-send/` · `app/src/lib/chat-voice.ts` ·
  `app/src/store/onboarding-draft.ts` · `supabase/migrations/0006` (`user_palais`).
- **Epic 3 — Découverte** → `app/app/(tabs)/index.tsx` (HomeD) ·
  `app/app/place/[id].tsx` · `app/src/lib/data-source*.ts` ·
  `supabase/migrations/0005` (`places`/`place_adn`) · `app/src/lib/matching.ts` ·
  `app/src/components/` (`PlaceCard`, `UneCarousel`, `ModeStories`, `SearchBar`…).
- **Epic 4 — Le Spawt** → `app/src/lib/guet/` · `app/src/lib/offline-queue.ts` ·
  `supabase/migrations/0007-0008` (`spawt_checkin` + triggers anti-fraude) ·
  `app/src/lib/palais-engine.ts` · `supabase/migrations/0011` (buckets Storage) ·
  `app/src/components/` (`GuetIndicator`, `SpawtSheet`).
- **Epic 5 — Identité** → `app/app/(tabs)/palais.tsx` ·
  `supabase/migrations/0009` (`spawter_progression`/`collection_titres`) ·
  `app/src/components/` (`SpawterCard`, `PalaisRadar`, `StadeCelebration`).
- **Epic 6 — Admin** → `spawt-admin/` (entièrement) · `supabase/seed/` ·
  `supabase/migrations/0001` (`spawt_staff`) · déploiement Cloudflare Pages.

**Cross-Cutting Concerns:**
- **Conformité ARTCI / sécurité** → `app/app/(onboarding)/consent.tsx` ·
  RLS dans chaque migration `supabase/migrations/` ·
  `supabase/functions/anonymize-deleted-spawters/`.
- **i18n + vocabulaire** → `app/src/i18n/fr.json` · `app/scripts/lint-vocab.mjs`
  + `i18n-check.mjs` · audit transverse à tous les composants.
- **Analytics** → `app/src/lib/analytics.ts` (point unique) · taxonomie
  `documentation/analytics/events.md`.
- **Design tokens** → `app/src/theme/tokens.ts` (source unique) · primitives
  `app/src/components/`.
- **Feature flags** → `supabase` table `feature_flags` ·
  `app/src/store/feature-flags.ts` · hook `useFlag` consommé partout.

### Integration Points

**Internal Communication:**
- Écrans → stores Zustand (sélecteurs) → actions → adapter `data-source` /
  moteurs purs `lib/`. `RouteGuard` observe le store et route.
- Le Guet : `guet-task.ts` (background OS) → `offline-queue.ts` → store
  `registerSpawt` → recompute `unique_spots`/`stade` → sync fire-and-forget.

**External Integrations:**
- **Supabase** : PostgreSQL + Auth + Storage + Edge Functions (SDK, anon key).
- **Termii** : SMS OTP, via Edge Function `otp-send` (clé serveur uniquement).
- **CinetPay** : paiement Mobile Money derrière `IPaymentProvider`, webhook Edge
  Function (Sprint 2).
- **PostHog** : analytics, via wrapper `analytics.ts`, hosting EU/self-host.
- **Sentry** : crash reporting (à installer).
- **CDN Supabase Storage** : photos lieux/avis.

**Data Flow:**
1. Action user → store (+ AsyncStorage) immédiatement → UI mise à jour.
2. Sync fire-and-forget → adapter → `data-source.supabase.ts` → Zod `safeParse`
   → Supabase (RLS).
3. Le Guet : géofence OS → tâche background → queue offline → store → sync.
4. Avis → `palais-engine` (Palais) + ADN serveur ; `user_signals` append-only ;
   `analytics.track()` → PostHog.
5. Admin : `spawt-admin` → SDK Supabase (RLS `spawt_staff`) → mêmes tables.

### File Organization Patterns

**Configuration Files:**
- Mobile : `app/{package.json,app.json,eas.json,tsconfig.json,babel.config.js}`.
- DB/infra : `supabase/config.toml`.
- Admin : `spawt-admin/{package.json,vite.config.ts,tsconfig.json}`.
- CI : `.github/workflows/mobile-ci.yml`.
- Env : `.env` par codebase (`app/`, `spawt-admin/`), jamais commit ; secrets
  serveur en variables Edge Functions.

**Source Organization:**
- `app/src/` : un dossier par responsabilité (`theme`, `types`, `lib`, `store`,
  `components`, `i18n`, `data/seed`) — pas de variantes (`utils/`, `core/`
  interdits). Barrel `index.ts` uniquement dans `types/`.
- `app/app/` : routing file-based, groupes parenthésés `(onboarding)` / `(tabs)`.

**Test Organization:**
- Tests co-localisés `*.test.ts` à côté du module — cible #1 : moteurs purs
  `lib/` (`matching.test.ts`, `palais-engine.test.ts`, `chat-voice.test.ts`),
  `getStade`, constantes `ANTIFRAUD_RULES`, adapter `data-source`.
- E2E : framework non choisi (Maestro vs Detox — décision Stéphanie, différée).

**Asset Organization:**
- Polices Klinsman/Gotham : `app/src/theme/fonts/` (ou `assets/fonts/`), chargées
  via `expo-font`. Photos lieux : CDN Supabase Storage, jamais bundlées.

### Development Workflow Integration

**Development Server Structure:**
- Mobile : `cd app && npx expo start --tunnel` (démo Expo Go, Le Guet non armé).
- Admin : `cd spawt-admin && npm run dev` (Vite HMR).
- DB : `supabase start` (stack locale) + `supabase db reset` (rejoue migrations).

**Build Process Structure:**
- Mobile : EAS Build profil `preview` → APK Android sideloadable (canonique
  Sprint 1). `production` AAB différé.
- Admin : `vite build` → `spawt-admin/dist/`.
- Triple gate avant chaque commit : `cd app && npx tsc --noEmit &&
  npm run lint:vocab && npm run i18n:check`.

**Deployment Structure:**
- Mobile : EAS Build (cloud Expo) → `.apk` distribué pour l'alpha 5 spawters.
- Admin : Cloudflare Pages (build Vite, edge global).
- DB : `supabase db push` (migrations) ; Edge Functions `supabase functions
  deploy`. Branches Supabase preview pour tester les triggers anti-fraude.
- CI cible : `.github/workflows/mobile-ci.yml` (triple gate + `npm test` sur PR).

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
Toutes les technologies sont compatibles et les versions vérifiées sur npm
(mai 2026) : `zod@4.4.3`, `expo-task-manager@55.0.16` (aligné SDK 55),
`posthog-react-native@4.45.5`, Refine v5 (`@refinedev/core@5.0.12` +
`@refinedev/supabase@6.0.2`). Aucune décision contradictoire : Supabase reste le
backend unique (DB + Auth + Storage + Edge Functions), CinetPay isolé derrière
`IPaymentProvider`, le drift PRD (Cloudinary) résolu vers Supabase Storage.
`expo-task-manager` ne fonctionne qu'en build natif — cohérent avec la livraison
canonique EAS APK et le mode démo Expo Go dégradé (CTA manuel).

**Pattern Consistency:**
Les patterns du Step 5 soutiennent les décisions du Step 4 : Zod = source de
vérité valide la décision « validation runtime à la frontière de l'adapter » ;
le contrat `{ data, error }` des Edge Functions reflète l'adapter `data-source` ;
le naming `snake_case` DB ↔ client évite toute couche de transformation ;
les conventions héritées de `project-context.md` (exports nommés, vocabulaire,
i18n, tokens, stores via actions) restent la référence non re-litigée.

**Structure Alignment:**
La structure projet supporte chaque décision : `supabase/migrations/` +
`.down.sql` appairés portent la réversibilité ; `app/src/lib/guet/` isole Le Guet ;
`app/src/types/*.schema.ts` matérialise Zod-source ; `spawt-admin/` séparé
respecte « aucune communication runtime ». Les frontières (RLS, adapter,
validation, local/distant) sont explicites et placées.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
Les 6 epics sont architecturalement supportés et mappés à des emplacements
concrets (cf. Requirements to Structure Mapping). Séquence d'implémentation
cohérente avec les dépendances : Epic 1 (fondation) débloque 2-6 ; Epic 6
(admin) autonome sur le schéma Epic 1.

**Functional Requirements Coverage:**
Les 27 FR du périmètre Sprint 1 ont un support architectural :
- Enabler FR (FR-024, 027-031, 041) → schéma `supabase/migrations/` + RLS +
  feature flags + analytics wrapper.
- Moteurs (FR-003, 004, 025, 026, 037) → `app/src/lib/` purs.
- Le Guet & résilience (FR-006, 035, 039) → `app/src/lib/guet/` +
  `offline-queue.ts` + triggers anti-fraude.
- Auth & onboarding (FR-001, 002, 040) → `(onboarding)/` + `lib/auth.ts` +
  Edge Function `otp-send`.
- Découverte & identité (FR-005, 008-010, 013, 016, 023, 032) → écrans
  `(tabs)/`, `place/[id]`, `spawt-admin/`.
Les 14 FR Sprint 2 sont tracés mais hors décomposition (cohérent epics.md).

**Non-Functional Requirements Coverage:**
- Perf (NFR-PERF) → pas de framework UI tiers, import dynamique Supabase, CDN
  photos, sélecteurs granulaires.
- Géo/résilience (NFR-GEO, NFR-AVAIL) → `expo-location` geofencing +
  `expo-task-manager` + `offline-queue` + fallbacks batterie/précision.
- Sécurité/conformité (NFR-SEC, DR-ARTCI) → RLS sur toutes tables PII, consent
  bloquant, Edge Function anonymisation J+30, secrets hors `EXPO_PUBLIC_*`,
  PostHog hosting EU/self-host.
- Anti-fraude (NFR-FRAUD) → 6 triggers SQL `0008_antifraud_triggers.sql`.
- Observabilité (NFR-OBS) → wrapper `analytics.ts` typé, `user_signals`
  append-only, Sentry (à installer).
- i18n/portabilité (NFR-I18N, NFR-PORT) → `fr.json` + audits, `country_code`
  partout.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Toutes les décisions critiques sont documentées avec versions vérifiées et
rationale. Les décisions différées sont explicitement listées avec leur owner
(`session_duration_minutes` → tech lead, formules KPIs → Madame Sun + Kidam,
E2E → Stéphanie, PostHog/Mixpanel final → Kidam) — elles ne bloquent pas
l'implémentation des Epics 1-5.

**Structure Completeness:**
Arbre projet complet et spécifique, fichiers et dossiers nommés, 11 migrations
identifiées, 3 Edge Functions, frontières et points d'intégration mappés.

**Pattern Completeness:**
8 points de conflit identifiés et traités, conventions de naming/structure/
communication/process couvertes avec exemples « good » et « anti-patterns »,
guidelines d'enforcement (triple gate, audits bloquants) explicites.

### Gap Analysis Results

**Critical Gaps:** Aucun. Rien ne bloque le démarrage de l'implémentation.

**Important Gaps (intentionnels — différés avec owner) :**
- Décisions historisées non tranchées : `session_duration_minutes` + « fin de
  session » (tech lead), formules KPIs (Madame Sun + Kidam), framework E2E
  Maestro/Detox (Stéphanie), branchement final PostHog/Mixpanel (Kidam).
- Triple sign-off des 8 amendements Claude `[pending]` (Stéphanie + Kidam +
  Alexandre) — ne bloque pas le code, conditionne leur statut formel.
- Profil EAS `production` iOS + OTA Expo Updates — en attente compte Apple
  Developer.

**Nice-to-Have Gaps :**
- Token `--alert-red` absent du kit `spawt-tokens.css` (UX-DR2) — à ajouter via
  revue Alexandre + Stéphanie (contraste) avant l'implémentation des états erreur.
- Artefacts process à créer : `documentation/qa/device_matrix.md`,
  `documentation/kpis/formulas.md` — référencés, hors scope éditorial archi.
- Sentry à installer (NFR-OBS-01) — connu, non bloquant Phase 0.
- Choix librairie UI de `spawt-admin` (headless Refine) — différable au démarrage
  Epic 6.

### Validation Issues Addressed

Aucun problème critique. Les écarts « important » sont des décisions
volontairement différées à leurs owners (le project-context impose « ne pas
trancher seul ») — l'architecture les **signale** et continue, conformément au
protocole. Le drift Cloudinary ↔ Supabase Storage a été résolu (Step 4). Le
drift tokens canoniques (`tokens.ts` vs `spawt-tokens.css`) est tracé comme
prérequis bloquant de l'Epic 1 (UX-DR1).

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION (16/16 items cochés, aucun gap
critique ; les gaps « important » sont des décisions différées avec owner
identifié, hors chemin critique des Epics 1-5).

**Confidence Level:** high — projet brownfield avec arbitrages fondateurs déjà
éprouvés, project-context.md riche (120 règles), PRD validé 4.92/5, UX spec
complète, décisions ouvertes tranchées collaborativement.

**Key Strengths:**
- Fondations éprouvées (brownfield) — pas de pari technologique, l'architecture
  aligne et complète plutôt que de bootstrapper.
- Densité d'invariants protégée par des audits bloquants (triple gate) +
  validation runtime Zod + analytics typé.
- Le Guet (risque #1) traité par le chemin Expo canonique, conscient de
  l'OS-tue-app et du mode démo dégradé.
- Conformité ARTCI portée structurellement (RLS, consent, anonymisation,
  hosting analytics EU).
- Séparation nette des codebases (mobile / admin / DB partagée) sans couplage
  runtime.

**Areas for Future Enhancement:**
- Sprint 2 : `IPaymentProvider`/CinetPay, paywall géo, carte Mapbox, Realtime,
  notifications push serveur, modération branchée sur les signalements.
- V2 : matching ML sur `user_signals` (déjà append-only — matière première
  prête), multi-villes (`country_code` déjà partout).
- Pipeline CI à câbler (`.github/workflows/mobile-ci.yml`), Sentry, OTA.

### Implementation Handoff

**AI Agent Guidelines:**
- Lire `_bmad-output/project-context.md` ET ce document avant toute
  implémentation — décisions et patterns sont des invariants.
- Suivre les décisions architecturales exactement, utiliser les patterns du
  Step 5, respecter les frontières du Step 6.
- Passer la triple gate avant chaque commit ; gating chaque feature derrière un
  `feature_flag` ; ne jamais trancher seul une décision différée.

**First Implementation Priority:**
Epic 1 — Story 1.1 (réalignement `tokens.ts` sur `spawt-tokens.css`) en
parallèle de l'initialisation `supabase` (CLI + migrations `0001-0004` + RLS).
Le réalignement des tokens est le prérequis bloquant de tout le design system ;
le schéma de fondation débloque les Epics 2-6.
