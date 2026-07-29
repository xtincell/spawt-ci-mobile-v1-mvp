# SPAWT — Document de passation de la version finale

**Date : 2026-07-26** · Livrable contractuel de la version finale iOS + Android (branche `claude/app-finale-ios-android-f8ewrp`).
**Public : une équipe de développement qui n'a jamais vu le projet** et qui doit assurer la suite de la vie de l'app.
Ce document est le point d'entrée ; il référence les runbooks détaillés au lieu de les dupliquer. En cas de conflit entre documents, l'ordre de préséance est : **le code → l'amendement PRD du 26/07/2026 (`AMENDEMENT_PRD_2026-07-26.md`, repo docs) → ce document → le reste**.

---

## 1. Vue d'ensemble

### Le produit en 5 lignes

SPAWT tue les 45 minutes perdues à chercher où manger à Abidjan. Un chat (félin — Moka — pas un chatbot) guide chaque **spawter** vers les lieux qui correspondent à son **Palais** (profil gustatif à 5 axes), pas vers les « 10 meilleurs restos de Cocody ». La data vient de la communauté (la **Meute**) via des **spawts** (visites vérifiées par géolocalisation — mécanique « **Le Guet** »). La monétisation est un abonnement **Spawter Gold** (B2C) et des offres **Pro / Spawt Gold** (B2B lieux), vendus **exclusivement sur le web** (modèle Spotify/Netflix, conformité Apple 3.1.3 — aucun achat in-app). Version finale = **37 features** (19 MVP + 18 post-MVP, Podcast exclu), la plupart des features V2 livrées **derrière des feature flags OFF** pour une activation progressive sans redéploiement.

### Les 4 repos

| Repo | Rôle | Stack |
|---|---|---|
| `spawt-ci-mobile-v1-mvp` | **Monorepo produit** : `app/` (l'app mobile), `spawt-admin/` (console équipe), `supabase/` (migrations + Edge Functions + migrator), `scripts/` (conformity-check), `documentation/` (runbooks). `src/` + racine Vite = prototype web **GELÉ** (référence visuelle, ne jamais développer dedans). | Expo SDK 55 / RN 0.83 · Refine v5 · Postgres/Supabase · Deno |
| `project_spawt_mobile_ci` | **Portail web public `spawt.online`** : landing, login OTP, achat Gold (`/gold`), compte/factures, espace B2B (`/pro`, `/pro/dashboard`), ambassadeurs, pages légales + page publique de suppression de compte. | Vite 5 · React 18 · react-router 7 · supabase-js · vitest |
| `spawt-meute-quiz` | **Quiz « La Meute » `quiz.spawt.online`** : quiz d'archétype + waitlist (n° Pionnier, parrainage), back-office admin, exports orga. Serveur Node autonome, schéma Postgres idempotent au boot. | Node 20 natif (`server.mjs`) · Postgres · Brevo (optionnel) |
| `project_spawt` | **Repo documentaire** : PRD source (docx), bible produit, brandbook, `AMENDEMENT_PRD_2026-07-26.md`, copie de ce document. | — |

### Carte des déploiements (Coolify, VPS Hostinger `76.13.128.23`)

Instance Coolify : `https://coolify.powerupgraders.com` (v4). Tout le DNS `spawt.online` pointe en A sur le VPS.

| Service Coolify | Domaine | Source | Notes |
|---|---|---|---|
| `spawt-supabase` (stack Supabase self-hosted, uuid `k4b877n1twp09syxgjg4jc2a`) | `https://api.spawt.online` (gateway Kong) | migrations + fonctions du repo mobile | GoTrue (auth) · PostgREST · Realtime · Storage · edge-runtime (fonctions Deno) · Postgres. **LA base unique** (amendement PRD §2) : schéma app 0001→0050 + tables du quiz absorbées. |
| `spawt-quiz` | `https://quiz.spawt.online` | repo `spawt-meute-quiz` | Rebranchable sur le Postgres du stack par simple `DATABASE_URL` (runbook `BASCULE_DATABASE_URL.md`). |
| `spawt-admin` | `https://admin.spawt.online` | `spawt-admin/` du repo mobile | Statique nginx, env `VITE_*` build-time. |
| portail | `https://spawt.online` | repo `project_spawt_mobile_ci` | Dockerfile (build Vite + nginx, fallback SPA). |
| App mobile | App Store + Play Store | repo mobile, `app/` | Builds **EAS cloud** (jamais sur le VPS), OTA via **EAS Update** (channels `preview`/`production`). |

Historique : le projet Supabase **cloud** `ucymjsxmnzdxvvupgaof` est **clôturé** (amendement PRD §2) — toute référence à lui dans les documents antérieurs (CLAUDE.md §État déployé, skills) est historique.

### Principe d'exploitation : « zéro accès prod requis »

- **Livrer = `git push`** : la GitHub App Coolify redéploie automatiquement admin/portail/quiz ; les builds mobiles partent de GitHub Actions vers EAS (secret `EXPO_TOKEN`).
- **Migrations auto-appliquées au déploiement** : le migrator (`supabase/migrator/` — conteneur one-shot idempotent, table `schema_migrations`, advisory lock, fail-fast) s'exécute au boot/pré-déploiement du backend. L'équipe de dev n'a jamais besoin d'un accès à la base de prod.
- **Actions manuelles = runbooks** exécutés par le propriétaire dans l'UI Coolify (terminaux de conteneurs inclus) : cutover de base, secrets, flips de flags. Les secrets (`JWT_SECRET`, `SERVICE_ROLE_KEY`…) ne quittent jamais Coolify.
- **Signature mobile hors VPS** : keystore Android managé par EAS (compte Expo `xtincell`), credentials Apple via `eas credentials`.

---

## 2. Architecture technique

### 2.1 L'app mobile (`app/`)

- **Stack** : Expo SDK 55, React Native 0.83 (`newArchEnabled: true`), expo-router (file-based routing), TypeScript strict, Zustand (`app/src/store/`), i18next. Pas de TanStack Query, pas de NativeWind.
- **Routes** (`app/app/`) : `(onboarding)/` consent → phone → otp → profile → calibration → palais-reveal ; `(tabs)/` index (feed), carte (MapLibre), spawter (check-in manuel), meute, profile ; `place/[id]/` (+ `reviews`), `review/[spawt_id]`, `search`, `saved`, `settings`, `progression`, `rapide`, `explore` (+ `explore/[slug]`), `crew/[id]`, `wrapped`, `reservations`, `suggest-place`.
- **Adaptateur de données** : `app/src/lib/data-source.ts` bascule **démo** (fixtures `app/src/data/`, aucune connexion) vs **Supabase** (`data-source.supabase.ts`) selon la présence de `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Toute feature data doit fonctionner dans les deux modes (démo = dégradé acceptable, jamais de crash).
- **Thème** : source unique `app/src/theme/tokens.ts` (hook `useTheme`). **Aucun hex ailleurs** (vérifié mécaniquement par le conformity-check). Palette canonique brandbook : noir `#0A0A0A`, or `#C8A44E`, vert chat `#2D6B4F`, blanc cassé `#FAFAF8` ; fond `surface.base #FFFFFF` (R14). Polices : Klinsman (display — noms PostScript `KlinsmanTypeface*`, différents des noms de fichiers .otf) + Gotham (corps).
- **i18n** : toute string UI passe par `app/src/i18n/` (`fr.json`), vérifié par `i18n:check`. Vocabulaire de marque verrouillé par `lint:vocab` : jamais « restaurant », « check-in », « user », « leaderboard », « gamification » — dire lieu/spot, spawt, spawter, la Meute, progression.
- **Moteurs purs** (`app/src/lib/`) : `matching.ts` (score composite 0.15·cosine + 0.30·distance + 0.30·note pondérée + 0.10·recency + 0.15·novelty), `palais-engine.ts` + `palais-signals.ts` (apprentissage par décroissance), `archetype-engine.ts` (13 archétypes, portage à parité du moteur du quiz), `weighted-rating.ts` (poids 1x→3x par stade), `stade-progress.ts`, `progression-engine.ts` (badges), `opening-hours.ts`, `paywall-geo.ts`, `guet/` (voir skill `spawt-guet`), `offline-queue.ts` (spawts hors-ligne, backoff), `city.ts` (multi-villes), `monitoring.ts` (Sentry no-op sans DSN).
- **Auth** : OTP custom via Edge Functions (PAS le provider SMS natif Supabase) — la session GoTrue émise est réelle (access + refresh tokens). Google/Apple sign-in via expo-auth-session/expo-apple-authentication.

### 2.2 Le backend (`supabase/`)

- **Un seul Postgres** (stack `spawt-supabase`) : schéma applicatif **0001→0050** (48 fichiers — les numéros 0015-0016 sont des trous réservés, normaux) + les tables du quiz La Meute absorbées (`meute_waitlist`, `table_versions`, `admin_config`, `app_config`, `brevo_queue` — base `spawt_quiz` dédiée dans la même instance, cf. `BASCULE_DATABASE_URL.md`). La migration `0033_meute_heritage` fait le pont : RPC `claim_meute_heritage` (héritage archétype + n° Pionnier par téléphone +225 canonique à la première connexion).
- **RLS partout** : owner-only (`spawter_id = auth.uid()`) pour les données spawter, helpers `is_admin_staff()` / `is_active_staff()` pour le staff, bypass `service_role` pour les Edge Functions. La sécurité vit dans la base — aucune confiance dans le client.
- **Edge Functions Deno** (`supabase/functions/` — 9 fonctions + module partagé `_shared/payment/`) :

| Fonction | Contrat (résumé — le contrat complet est en tête de chaque `index.ts`) |
|---|---|
| `otp-send` | `POST {phone_e164}` → envoi SMS Termii. Rate limits : 5/h/numéro, 20/h/IP. **Mock par défaut** sans `TERMII_API_KEY` (aucun secret requis). Numéros reviewer whitelistés (`REVIEWER_PHONE_E164`) : jamais de SMS, même en live. CORS fail-closed (`ALLOWED_ORIGINS`). |
| `otp-verify` | `POST {phone_e164, otp_code}` → `{access_token, refresh_token, user_id}` (session GoTrue réelle via generateLink + verifyOtp ; refresh natif). Code mock universel **`123456`** (6 chiffres, aligné pin Termii — version finale). Reviewer : code fixe `REVIEWER_OTP_CODE`. Appelle `claim_meute_heritage` post-session (strictement non bloquant) et enrichit la réponse `meute_heritage`. |
| `moderate-spawter` | `POST {spawter_id, action: ban/unban/warning, reason}` — caller `spawt_staff` actif. Atomique : UPDATE + signOut forcé + soft-delete des avis du banni + `admin_audit_log`. |
| `seed-inventory` | `POST` (staff admin) — upsert idempotent de lieux + 3 avis fondateurs `is_seed=true`, validation Zod (coordonnées bornées Abidjan), recompute ADN serveur, audit par lieu. |
| `payment-checkout` | `POST {plan: gold_monthly/gold_annual/pro/b2b_gold, return_url?}` (Bearer = access_token du spawter ou du compte B2B) → `{payment_url, transaction_id}`. 403 `not_b2b` (plan B2B sans compte `b2b_accounts` rattaché — rattachement lieu↔compte = acte admin), 409 `already_active`, 502 `provider_error`. |
| `payment-webhook` | Endpoint **public** appelé par CinetPay (`--no-verify-jwt`). Sécurité : HMAC `x-token` **+ règle d'or** : toute activation est re-confirmée par un appel server-to-server `/v2/payment/check` avant écriture. Active subscription/invoice/entitlement ; synchronise le rôle B2B à l'activation, **jamais de rétrogradation automatique**. |
| `payment-cron` | 1×/jour (pg_cron + pg_net, seed `payment_cron_setup.sql` ; auth header `x-cron-key` = `CRON_SECRET`). Cycle Mobile Money : rappels J-3 / J, grâce, expiration (détail §4). Push best-effort — un échec ne bloque jamais une transition. |
| `push-send` | `POST` — 2 modes d'auth : service_role (interne, ex. payment-cron) ou staff admin (limite 3 campagnes/jour, auditées `push_campaign` — CHECK étendu par la migration 0047). Ciblage `spawter_ids` / `stade` / `archetype` / `gold_only`. Envoi API Expo par chunks de 100, purge des tokens `DeviceNotRegistered`. |
| `wrapped-stats` | `POST {year?}` (Bearer spawter) → agrégats annuels du spawter (spawts, communes, cuisine, lieu fétiche, archétype, badges…). Chaque champ est best-effort nullable — jamais de 500 partielle. |

- **Anti-fraude** : 6 règles SQL en triggers (migration `0012`) — 1 spawt/4h/même lieu (rejet), 5/jour, vitesse > 100 km/h, session < 5 min, etc. Testées dans `supabase/tests/antifraud_triggers.sql`.
- **Migrator** (`supabase/migrator/`) : conteneur one-shot (Dockerfile + `migrate.sh`) qui applique `migrations/NNNN_*.sql` dans l'ordre — idempotent (`schema_migrations`), sérialisé (`pg_advisory_xact_lock`), transactionnel, fail-fast. Les `.down.sql` sont ignorés (rollback = opération manuelle réfléchie). Branché en pré-déploiement Coolify : migration en erreur = déploiement bloqué.

### 2.3 Le portail (`project_spawt_mobile_ci` → spawt.online)

SPA Vite/React sans SSR, servie par nginx (Dockerfile). **Mêmes gates que le mobile** : `npm run lint:vocab` (dialecte + « aucun hex hors `src/theme/tokens.*` »), `npm run typecheck`, `npm test` (vitest), `npm run build`. Auth = le même flux OTP que l'app (fonctions `otp-send`/`otp-verify`, session GoTrue en localStorage). Tunnel de paiement codé contre le contrat exact de `payment-checkout` (spec exécutable : `src/lib/__tests__/api.test.ts`) ; poll d'entitlement 3 s / 2 min max (`src/lib/entitlement.ts`). Dashboard B2B branché sur les vues `b2b_place_stats_monthly` / `b2b_place_funnel` / `reservation_requests` (migrations 0042/0043) avec dégradation propre si une vue n'existe pas encore (« stats en construction »). Mode démo sans backend, `VITE_PAYMENT_MOCK=1` pour développer le checkout à sec.

### 2.4 L'admin (`spawt-admin/` → admin.spawt.online)

Refine v5 + Vite + React 18. Pages : `lieux` (CRUD + ticket moyen + menus), `moderation`, `signalements`, `suggestions` (approbation pré-remplie → fiche lieu), `fonctionnalites` (interrupteurs de feature flags par scope — l'outil de pilotage produit), `metriques` (AARRR), `push` (campagnes), `defis`, `evenements`, `promotions` (avec `ContratBanner` — garde-fou Contrat SPAWT), `comptes`, `b2b`, `explore` (curation des carnets). **Toute action d'écriture passe par `admin_audit_log`** (migration 0017, actions étendues par 0047). Tests : vitest (133+).

### 2.5 Le quiz (`spawt-meute-quiz` → quiz.spawt.online)

Serveur Node natif (`server.mjs`, `node:http` + `pg`) : statique `public/` + `/api/*`. Schéma **idempotent au boot** (`initSchema()` — tables + vues + bootstrap admin). Durci pour la prod : **refus de démarrer sans `SESSION_SECRET`** (cookie de session admin signé HMAC), exports orga protégés par header `x-admin-key`, CORS par `ALLOWED_ORIGINS`, `/api/health` réel (`SELECT 1` → 200/503). Agnostique à sa base : **rebranchable sur le Postgres du stack `spawt-supabase` par simple changement de `DATABASE_URL`** (runbook `BASCULE_DATABASE_URL.md` — piège des sequences SERIAL documenté). Brevo optionnel (clé lue en priorité dans la table `app_config`).

---

## 3. Les 37 features (état au 2026-07-26)

Référence exécutable : `documentation/conformity-checklist.yaml` + `node scripts/conformity-check.mjs` (branché en CI — chaque ligne ci-dessous est vérifiée mécaniquement : fichiers, exports, migrations, clés i18n, flags). « Flag OFF » = livré dans le binaire et la base, activable sans redéploiement (admin → Fonctionnalités).

### 19 features MVP (PRD §3.1)

| # | Feature | Où (fichiers clés) | Flag | État |
|---|---|---|---|---|
| F01 | Inscription / auth (OTP + Google/Apple) | `app/app/(onboarding)/phone.tsx`, `otp.tsx` ; `supabase/functions/otp-send`, `otp-verify` ; migrations 0007/0009 | — | ✅ (OTP mock par défaut, bascule SMS réel = secrets) |
| F02 | Onboarding léger (consent ARTCI, profil, calibrage Palais) | `(onboarding)/consent.tsx`, `profile.tsx`, `calibration.tsx`, `palais-reveal.tsx` ; 0008/0020 | `onboarding-origin-country` (ON) | ✅ |
| F03 | Feed personnalisé | `(tabs)/index.tsx`, `ModeStories.tsx`, `UneCarousel.tsx` ; `matching.ts#rankPlaces`, `opening-hours.ts#partitionOpenFirst` (lieux ouverts d'abord, R20) | — | ✅ |
| F04 | Fiche lieu (onglets Média/Menu/Avis, carte statique, horaires, prix F CFA) | `app/app/place/[id]/index.tsx`, `components/place/PlaceTabs.tsx` ; 0010/0030 | `place-avg-price` (ON) | ✅ |
| F05 | Le Spawt / Le Guet (check-in géolocalisé) | `app/src/lib/guet/` (`geofence.ts#armGuet`, `guet-orchestrator.ts#bootGuet`), `GuetIndicator.tsx` ; 0011/0012 | `guet-geofence` (ON internal/alpha/beta, **OFF prod**) | ✅ câblé bout-en-bout ; test réel = APK (pas Expo Go) |
| F06 | Avis structuré post-spawt + apprentissage du Palais | `app/app/review/[spawt_id].tsx`, `palais-signals.ts`, `weighted-rating.ts` ; 0013/0021/0025 (ADN recalculé côté serveur) | — | ✅ |
| F07 | Profil (carte spawter, avatar) | `(tabs)/profile.tsx`, `SpawterCard.tsx`, `storage-avatars.ts` ; 0031 | — | ✅ |
| F08 | 5 stades de maturité | `stade-progress.ts`, `types/stade.ts` ; 0014/0022 — seuils PRD §5.2 (0-10/11-20/21-30/31-50/50+ spots uniques) | — | ✅ |
| F09 | Favoris cross-device | `app/app/saved.tsx` ; 0024 (`saved_places`, sync + union-merge) | — | ✅ |
| F10 | Recherche + filtres | `app/app/search.tsx`, `search.ts#searchPlaces`, `FilterSheet.tsx` | — | ✅ |
| F11 | Carte interactive (MapLibre) | `(tabs)/carte.tsx`, dep `@maplibre/maplibre-react-native` | — | ✅ (dégradation propre si module natif absent) |
| F12 | Coup de Cœur | `CoupDeCoeurButton.tsx` ; 0028 | — | ✅ |
| F13 | Push basiques | `push-token.ts#registerPushToken` (canal Android `spawt`) ; `push-send` ; 0034 | — | ✅ côté code ; **FCM/APNs = étape humaine** (runbook stores §4) |
| F14 | Paywall géographique (3 km gratuit / Gold) | `paywall-geo.ts` (`FREE_RADIUS_KM = 3`, `isPlaceLocked`), `GoldUpsellSheet.tsx`, `spawter-gold.ts` | `paywall-geo` (**OFF partout**) | ✅ livré éteint — activation §7 |
| F15 | Paiement Mobile Money (CinetPay via `IPaymentProvider`) | `supabase/functions/payment-*`, `_shared/payment/` ; 0032 ; seed `payment_cron_setup.sql` | — | ✅ côté code ; compte CinetPay + sandbox = humain (§4) |
| F16 | Partage WhatsApp | fiche lieu + `ReservationSheet.tsx` (wa.me) | — | ✅ |
| F17 | Modération (signalement + file admin) | `ReportReviewSheet.tsx`, `moderate-spawter` ; 0019/0026 | — | ✅ |
| F18 | Création de fiche lieu (équipe) + suggestions Meute | `seed-inventory`, `spawt-admin/src/pages/lieux/create.tsx`, `app/app/suggest-place.tsx` ; 0039 | `suggestions-lieux` (OFF) | ✅ |
| F19 | Admin panel (Refine) | `spawt-admin/` (14 sections) ; 0017/0018 | — | ✅ |

### 18 features post-MVP (PRD §4.1 — toutes dans la version finale, amendement §3)

| # | Feature | Où | Flag | État |
|---|---|---|---|---|
| P01 | Mode Rapide (swipe) | `app/app/rapide.tsx`, `SwipeDeck.tsx`, `rapide-deck.ts` ; 0046 (signaux swipe) | `mode-rapide` (OFF) | ✅ |
| P02 | Mode Crew (vote temps réel) | `app/app/crew/[id].tsx`, `lib/crew/` (realtime → fallback polling), `CrewBlock.tsx` ; 0038/0048 (clôture par l'hôte) | `mode-crew` (OFF) | ✅ |
| P03 | Mode Explore (magazine) | `app/app/explore.tsx`, `explore/[slug].tsx` ; 0045 ; curation via admin | `mode-explore` (OFF) | ✅ |
| P04 | 13 archétypes (+ mue, héritage quiz) | `archetype-engine.ts` (parité quiz vérifiée par fixtures), `ArchetypeCard.tsx`, `archetype-mue.ts` (mue = constat neutre, inertie 5 recalculs) ; 0033 (`claim_meute_heritage`, n° Pionnier) | — | ✅ |
| P05 | Cartes collectibles | `progression/CollectionSection.tsx` ; 0037 | `collectibles` (OFF) | ✅ |
| P06 | Fondations matching ML | `user_signals` append-only (0003/0046) + score composite `matching.ts` — le modèle ML lui-même = V2+ (10K+ spawts) | — | ✅ fondations |
| P07 | Réservation 1-tap | `app/app/reservations.tsx`, `reservations.ts#buildWaMeUrl`, `ReservationSheet.tsx` ; 0042 | `reservation-1tap` (OFF) | ✅ |
| P08/P09 | Dashboards B2B Gold / Pro | socle 0032/0043 (**agrégats n ≥ 3 uniquement**) + portail `/pro/dashboard` + admin `b2b/` | `b2b-dashboards` (OFF) | ✅ |
| P10 | Badges (32, data-driven) | `progression-engine.ts#buildBadgeStates`, `BadgesSection.tsx` ; 0036 | `badges-v2` (OFF) | ✅ |
| P11 | SPAWT Wrapped | `app/app/wrapped.tsx`, `wrapped.ts`, fonction `wrapped-stats` | `wrapped` (OFF) | ✅ |
| P12 | Podcast | **EXCLU** (« jamais dans l'app », PRD §4.1) — absence vérifiée par regex en CI | — | ∅ par design |
| P13 | Paws (monnaie d'activité) | `PawsSection.tsx` ; 0035 (ledger **append-only**) | `paws` (OFF) | ✅ |
| P14 | Défis collectifs + streaks privés | `DefisSection.tsx` ; 0040 — **sans leaderboard** (Contrat SPAWT : `challenge_progress` n'a PAS de colonne `spawter_id`, vérifié en CI) | `defis-collectifs` (OFF) | ✅ |
| P15 | Share card auto-générée | `share/ShareCard.tsx`, `share-card.ts#captureAndShareView` (view-shot + expo-sharing) | — | ✅ |
| P16 | Multi-villes | `city.ts#getActiveCity` ; 0041 (référentiel — Abidjan actif, Dakar prêt) | — | ✅ |
| P17 | Site web / landing | repo `project_spawt_mobile_ci` (portail complet) + quiz `spawt-meute-quiz` | — | ✅ (hors monorepo) |
| P18 | Programme ambassadeur | 0044 (`ambassadors`, 3 paliers) + portail `/ambassadeurs` | — | ✅ |

S'y ajoute (hors numérotation PRD, livrée en version finale) : **événements & promotions de lieux** — migrations 0049/0050, pages admin `evenements`/`promotions` (garde-fou Contrat), app : section « En ce moment » sur la fiche lieu + pastilles feed + rangée de la semaine (`PlaceActivitySection.tsx`, `EventsWeekRow.tsx`, `place-activity.ts`) — flag `evenements-promos` (OFF).

---

## 4. Le système de paiement bout-en-bout

### 4.1 Le chemin nominal (B2C Gold)

```
  APP MOBILE (lecture seule — AUCUN bouton d'achat, conformité Apple 3.1.3)
      │  lit la vue active_entitlements (RLS own) → statut Gold affiché
      │
  SPAWTER ─── navigue de lui-même ───► PORTAIL spawt.online
      │                                   /connexion  (OTP — même backend que l'app)
      │                                   /gold       (2 950 F TTC/mois · 29 500 F TTC/an)
      ▼
  /gold/paiement ──POST──► Edge `payment-checkout` (Bearer access_token)
      │                        crée subscription 'pending' + transaction_id
      │                        appelle CinetPay /v2/payment (IPaymentProvider)
      ◄── {payment_url} ───────┘
      │
  page CinetPay (Orange Money · Wave · MTN MoMo · XOF)
      │ paiement                                │ notify_url (server-to-server)
      ▼                                         ▼
  redirect {return_url}?transaction_id=…   Edge `payment-webhook` (public)
  = /gold/retour                               1. vérifie HMAC x-token
      │ poll active_entitlements               2. RÈGLE D'OR : re-confirme via
      │ (3 s, 2 min max)                          CinetPay /v2/payment/check
      │                                        3. subscription 'active' + invoice
      ▼                                           + entitlement (0032)
  « Bienvenue chez les Gold » ; l'app          4. B2B : synchro b2b_accounts.role
  reflète le statut à la prochaine lecture
```

B2B (`pro` / `b2b_gold`) : même tunnel depuis `/pro`, mais le compte payeur doit être **rattaché à un lieu** dans `b2b_accounts` (acte admin, sinon 403 `not_b2b`) ; l'unicité d'abonnement est vérifiée **par lieu**.

### 4.2 Cycle de vie Mobile Money (pas de prélèvement automatique)

`payment-cron` (quotidien, `_shared/payment/subscription-lifecycle.ts`) :

1. **J-3** avant échéance → push « Ton Gold expire dans 3 jours ».
2. **J** (échéance) → push « C'est aujourd'hui ».
3. Échéance dépassée → statut **`grace`**, `grace_until = échéance + 7 j`, push d'entrée en grâce.
4. **J+8** (`grace_until` dépassé) → statut **`expired`** : retour au spawter gratuit ; les données premium restent en base (90 jours, PRD SPEC 4 §4.5).

B2B : même machine à états, deux différences assumées — rappels best-effort (un compte B2B n'a en général pas de token push) et **l'expiration ne touche jamais `b2b_accounts.role`** : la coupure d'accès B2B est un acte humain (le dashboard portail signale l'expiration).

### 4.3 Activation du paiement (ordre impératif)

1. Compte marchand CinetPay + KYC → récupérer les clés **sandbox** (`CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`).
2. Poser les clés en secrets Coolify (service backend) + `PAYMENT_RETURN_BASE_URL` + `CRON_SECRET` ; activer le cron (seed `payment_cron_setup.sql`).
3. **Paiement de test bout-en-bout en sandbox** — dont la **validation du format HMAC réel du webhook** (l'ordre de concaténation des champs `WEBHOOK_HMAC_FIELDS` dans `_shared/payment/cinetpay.ts` est documenté mais doit être confirmé contre un webhook sandbox réel ; la règle d'or `getStatus` protège en attendant).
4. Bascule clés **production**, re-test.
5. Seulement alors : **flip du flag `paywall-geo`** (admin → Fonctionnalités, scope par scope). Règle produit : pas de paywall sans moyen de payer.

---

## 5. Base de données

### 5.1 Conventions

- Fichiers `supabase/migrations/NNNN_description.sql` + **`.down.sql` apparié obligatoire** (réversible, idempotent `DROP IF EXISTS`). Trous 0015-0016 = réservés, ne pas combler.
- Logique non triviale (triggers, RPC) → tests SQL dans `supabase/tests/` (8 suites : `antifraud_triggers`, `badges_unlock`, `collective_challenges`, `crew_rls`, `meute_heritage`, `paws_ledger`, `place_adn_recompute`, `subscriptions_invoices` — scénarios BEGIN/ROLLBACK, à jouer via psql).
- `lower_snake_case`, `timestamptz` systématique, FK spawter = `spawter_id uuid REFERENCES spawters(id) ON DELETE CASCADE`, trigger `set_updated_at()` (0001).
- Application en prod : **par le migrator uniquement** (git push → pré-déploiement Coolify). Les `.down.sql` ne sont jamais joués automatiquement.

### 5.2 Tables par domaine

| Domaine | Tables / objets (migration) |
|---|---|
| Identité & auth | `spawters` (0001, modération 0019, date de naissance 0020, `quiz_archetype`/`pionnier_seq` 0033), `spawt_staff` (0001), `otp_attempts` (0007/0009), `user_palais` (0008), suppression de compte : RPC `request_account_deletion` — anonymisation immédiate + purge J+30 (0029) |
| Lieux | `places` + `place_adn` (0010, recompute serveur 0025, guards colonne 0023), menus (0030), `saved_places` (0024), `coups_de_coeur` (0028), `review_reports` (0026), `place_suggestions` (0039), `place_events` (0049), `place_promotions` (0050) |
| Spawts & avis | `spawt_checkin` (0011 — cycle Guet + avis + photos), anti-fraude (0012), buckets Storage `place-photos` (0013) / `avatars` (0031) |
| Progression | `spawter_progression` + `collection_titres` (0014/0022), `paws_ledger` (0035), badges (0036), collectibles (0037), défis collectifs `collective_challenges`/`challenge_progress` (0040), streaks privés |
| Social / modes | `crew_sessions` + propositions + votes (0038, clôture hôte 0048), contenu Explore (0045), réservations `reservation_requests` (0042) |
| Commerce | `customers`/`plans`/`currencies` (0002), `subscriptions`/`invoices` + vue `active_entitlements` (0032), `b2b_accounts` + vues agrégées (0043), `ambassadors` (0044) |
| Data / ML | `user_signals` **append-only** (0003, types étendus 0046) |
| Infra | `feature_flags` (0004, hyphens 0027), `admin_audit_log` (0017, actions étendues 0047), `push_tokens` (0034), référentiel villes (0041) |
| Héritage quiz | pont `meute_heritage` + RPC `claim_meute_heritage` (0033) ; tables du quiz gérées par `initSchema()` du serveur quiz (base `spawt_quiz` du même Postgres) |

### 5.3 Invariants (à ne jamais casser)

- **`user_signals` et `paws_ledger` sont append-only** (pas d'UPDATE/DELETE).
- **Agrégats B2B : n ≥ 3** — les vues 0043 renvoient NULL sous 3 événements (anti-réidentification). Jamais de données individuelles côté B2B.
- **Contrat SPAWT (anti-compétition)** : `challenge_progress` n'a **pas** de colonne `spawter_id` — le leaderboard individuel est impossible **par construction**. Aucun vocabulaire de classement (vérifié par `lint:vocab` + conformity-check, y compris dans `fr.json`).
- Avis : soft-delete only (modération) ; visibilité par RLS 0021 ; note pondérée par stade côté moteur.
- Anti-fraude 0012 : ne pas contourner (`is_seed=true` est le seul bypass, réservé au seed).

### 5.4 Ajouter une migration (procédure)

1. `ls supabase/migrations/` → prendre le prochain numéro libre (ne pas combler 0015-0016).
2. Écrire `NNNN_verbe_objet.sql` + `NNNN_verbe_objet.down.sql` ; RLS dès le CREATE TABLE ; tests SQL si trigger/RPC.
3. Si la feature a un flag : seed dans `supabase/seed/feature_flags_*.sql` (`ON CONFLICT DO NOTHING`, OFF par défaut).
4. Mettre à jour `documentation/conformity-checklist.yaml` (nouvelle entrée ou assertion `migrations:`).
5. Commit + push → le migrator applique au déploiement. Vérifier le log du migrator (exit 0).

---

## 6. Qualité & CI

### 6.1 La quadruple gate (bloquante avant tout commit ET tout build distribué)

Depuis `app/` :

```bash
npm run typecheck    # tsc --noEmit — 0 erreur
npm run lint:vocab   # vocabulaire de marque interdit
npm run i18n:check   # aucune string UI hors i18n
npm test             # jest — 0 failed
node ../scripts/conformity-check.mjs   # (depuis la racine : node scripts/conformity-check.mjs)
```

Le conformity-check vérifie les 37 features, les textes exacts de la note MAJ (R1→R28), le code OTP `123456`, le Contrat SPAWT, « aucun hex hors tokens.ts » et l'enveloppe native. Sortie 1 au moindre ❌ ; les ⚠️ `expected_pending` (ex. placeholders `REMPLACER_*` de `eas.json`) ne bloquent pas. Maintenance de la checklist : `scripts/README.md`.

### 6.2 Les suites de tests

| Suite | Où / commande | Volume | Note |
|---|---|---|---|
| Jest app mobile | `cd app && npm test` | ≈ 700 (693 au dernier audit du 26/07, avant les tests événements) | Machine à états Guet, moteurs purs, composants, parité archétypes quiz (fixtures générées) |
| Vitest admin | `cd spawt-admin && npm test` | 133+ | Pages + logique (audit, Contrat) |
| Vitest portail | repo portail, `npm test` | 118+ | Dont la spec exécutable du contrat `payment-checkout` |
| **Deno (Edge Functions)** | `deno test` dans `supabase/functions/` | payment (cinetpay/factory/lifecycle/types), otp, push, wrapped | ⚠️ **Deno est absent du runner de dev** — ces tests doivent être exécutés en CI ou dans un environnement disposant de deno. Ne pas les considérer « passés » sur la seule foi du typecheck. |
| Tests SQL | `supabase/tests/*.sql` via psql | 8 suites | Manuels (BEGIN/ROLLBACK) — à jouer après toute modif des triggers concernés |

### 6.3 Workflows CI (`.github/workflows/`)

- **`eas-build.yml`** — quadruple gate + conformity-check **puis** build EAS. Déclencheurs :
  - tag `build-android-YYYY-MM-DD-N` → APK **preview** (alpha sideload), `versionCode`/`buildNumber` = N injectés + `EXPO_PUBLIC_BUILD_DATE` ;
  - tag `build-android-prod-YYYY-MM-DD-N` → **.aab production** (store) ;
  - tag `build-ios-YYYY-MM-DD-N` → **.ipa production** (TestFlight/App Store) ;
  - `workflow_dispatch` (plateforme + profil au choix).
- **`eas-update.yml`** — OTA JS **manuel uniquement** (channel `preview`) ; jamais d'OTA automatique sur commit.
- Secret GitHub requis : `EXPO_TOKEN`. Versioning : `version` `1.1.0`, `versionCode`/`buildNumber` `8` ; `runtimeVersion.policy: appVersion` (une OTA ne touche que les builds de même version). **Tout build livré est journalisé dans `RELEASES.md`** (numéro, date, tag, commit) ; notes de version stores prêtes dans `STORE_LISTING_FR.md` §8.
- Piège : le tag `build-android-*` (sans `prod`) produit un APK de test, pas le `.aab` exigé par Google.

---

## 7. Runbooks opérationnels (référencés, pas dupliqués)

| Opération | Runbook | Résumé |
|---|---|---|
| Cutover de la base (cloud → self-hosted) & system design cible | `MIGRATION_COOLIFY.md` (racine repo mobile) | GO/NO-GO RAM VPS (§2.0 — vérifier ≥ 4 Go libres AVANT de démarrer la stack), dump/restore, fonctions dans le volume edge-runtime, buckets Storage, bascule des clients (OTA app + redeploy admin), cloud en pause 30 j comme filet, rollback < 30 min |
| Bascule de la base du quiz | `spawt-meute-quiz/BASCULE_DATABASE_URL.md` | dump 5 tables → base `spawt_quiz` du stack, piège des sequences SERIAL (n° Pionnier), smoke tests, rollback = ancienne `DATABASE_URL` |
| Soumission stores (Apple + Google + FCM) | `documentation/RUNBOOK_SOUMISSION_STORES.md` | comptes, credentials EAS, compte démo reviewer (§2.8a), argumentaire 3.1.3 (§2.8b), Data Safety, checklist finale §6 (dont **≥ 20 lieux seedés avant publication**) |
| Fiches stores (textes/screenshots) | `documentation/STORE_LISTING_FR.md` | prêt à coller ; plan de screenshots §7 |
| Formulaires confidentialité | `documentation/DATA_SAFETY_PRIVACY.md` | mapping exact Data Safety (Google) + App Privacy (Apple) ; marqueurs `[À VALIDER PAR JURISTE]` |
| Activation du paiement | §4.3 ci-dessus | sandbox → validation HMAC → prod → flip `paywall-geo` |
| Activation OTP réel | `HUMAN_TODO.md` §OTP | poser `TERMII_API_KEY` (+ `TERMII_SENDER_ID`) et `MOCK_TERMII=false` sur le backend — **rien à changer côté app** (6 chiffres unifiés). Reviewer stores : `REVIEWER_PHONE_E164` + `REVIEWER_OTP_CODE` (code ≠ `123456` ; à retirer/changer après la review) |
| Campagnes push | admin → page Push, ou `POST push-send` (staff : 3 campagnes/jour, audit `push_campaign`) | ciblage stade/archétype/gold ; pré-requis Android : FCM configuré (runbook stores §4) |
| Seed des 20 lieux | fonction `seed-inventory` + gabarits `supabase/seed/inventory.template.csv` / `inventory.example.csv` | avis fondateurs `is_seed=true` ; **règle de publication** : jamais publier avec moins de 20 lieux en base de prod (checklist §6 du runbook stores) |

### Flip des feature flags — liste complète et défauts

Table `feature_flags` (scope `internal`/`alpha`/`beta`/`prod`, override par spawter possible). Pilotage : **admin → Fonctionnalités** (ou `UPDATE feature_flags SET enabled=… WHERE flag_code=… AND scope=…`). Les seeds sont `ON CONFLICT DO NOTHING` : re-seeder ne modifie jamais une base vivante. Rollout conseillé : internal → alpha → beta → prod.

| Flag | Défaut seedé | Rôle |
|---|---|---|
| `guet-geofence` | internal/alpha/beta **ON**, prod **OFF** | kill-switch du Guet |
| `paywall-geo` | **OFF partout** | paywall 3 km — à n'activer qu'après le paiement en prod (§4.3) |
| `place-avg-price` | **ON partout** | prix moyen F CFA (OFF = retour échelle ₣₣₣) — décision Q4 réversible |
| `onboarding-origin-country` | **ON partout** | question « Pays d'origine » — décision R3 réversible |
| `mode-rapide`, `mode-crew`, `mode-explore`, `badges-v2`, `collectibles`, `paws`, `wrapped`, `reservation-1tap`, `defis-collectifs`, `suggestions-lieux`, `b2b-dashboards`, `evenements-promos` | **OFF partout** | vague V2 — activation progressive post-lancement, feature par feature |

---

## 8. Secrets & comptes (noms uniquement — JAMAIS de valeurs dans un repo)

### 8.1 Par service

| Service | Variables | Où les poser |
|---|---|---|
| **App mobile (build)** | `EXPO_PUBLIC_SUPABASE_URL` (`https://api.spawt.online` en prod), `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN` ; optionnels : `EXPO_PUBLIC_MAPBOX_TOKEN`, `EXPO_PUBLIC_GOOGLE_MAPS_KEY`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (+ variantes `_IOS_`/`_ANDROID_`), `EXPO_PUBLIC_DEV_AUTOLOGIN_*` (dev only) | env EAS par profil (`preview`/`production`) sur expo.dev |
| **CI GitHub** | `EXPO_TOKEN` | repo → Settings → Secrets → Actions |
| **Credentials mobiles** | keystore Android (managé EAS), certificat + provisioning + clé APNs iOS, clé ASC API (`.p8`), clé de service **FCM V1** (JSON), `app/secrets/play-service-account.json` (gitignoré) ; `app/google-services.json` = config client, **committé** | `eas credentials` / gestionnaire de mots de passe de l'équipe |
| **Edge Functions (backend Coolify)** | `TERMII_API_KEY`, `TERMII_SENDER_ID`, `MOCK_TERMII`, `ALLOWED_ORIGINS` (CSV — doit inclure `https://spawt.online`), `REVIEWER_PHONE_E164`, `REVIEWER_OTP_CODE`, `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`, `PAYMENT_RETURN_BASE_URL`, `CRON_SECRET` (+ `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` injectés par la stack) | variables du service `spawt-supabase` dans Coolify |
| **Stack Supabase self-hosted** | `SERVICE_PASSWORD_POSTGRES`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET` | générés par Coolify — **ne quittent jamais Coolify** |
| **Migrator** | `DATABASE_URL` (droits DDL) | service migrator Coolify |
| **Quiz** | `DATABASE_URL`, `SESSION_SECRET` (**obligatoire en prod** — refus de démarrer sinon), `ADMIN_KEY`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (premier boot seulement), `ALLOWED_ORIGINS`, `BREVO_API_KEY`/`BREVO_TEMPLATE_ID` (ou table `app_config`) | app `spawt-quiz` Coolify |
| **Portail** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APPSTORE_URL`, `VITE_PLAYSTORE_URL`, `VITE_PAYMENT_MOCK` (jamais en prod) | app portail Coolify — **Build Variables** (figées au build → redeploy à chaque changement) |
| **Admin** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | app `spawt-admin` Coolify — Build Variables |

### 8.2 Comptes externes & coûts

| Compte | Sert à | Coût (connu au 26/07/2026 — re-vérifier à l'exécution) |
|---|---|---|
| Apple Developer Program | builds device iOS, TestFlight, App Store | 99 USD/an |
| Google Play Console | publication Android | 25 USD (une fois) ; compte Organisation recommandé (D-U-N-S), sinon règle 12 testeurs/14 jours |
| Expo/EAS (compte `xtincell`) | builds cloud, **keystore Android managé** (sa perte = impossibilité de mettre à jour l'app), OTA | gratuit puis quota builds payant selon usage |
| Firebase (FCM) | push Android | gratuit |
| Termii | SMS OTP (+ sender ID approuvé) | à la consommation (par SMS) |
| CinetPay | agrégateur Mobile Money (Orange Money, Wave, MTN MoMo) | commission par transaction ; KYC requis |
| Sentry | crashs app (`EXPO_PUBLIC_SENTRY_DSN` — code silencieux sans DSN) | free tier au départ |
| Brevo | e-mails du quiz (« ta carte ») | free tier au départ |
| Hostinger | VPS (Coolify + tout l'hébergement) + DNS `spawt.online` | abonnement VPS ; upgrade RAM possiblement requis (§9) |
| GitHub (`xtincell/*`) | repos + Actions + GitHub App Coolify | free tier |

Hygiène (à faire, cf. `MIGRATION_COOLIFY.md` §6 et `HUMAN_TODO.md`) : révoquer les tokens API Coolify et mots de passe partagés en clair dans d'anciens chats ; rotation clé SSH.

---

## 9. Décisions & dettes assumées

### Décisions structurantes (actées)

1. **Amendement PRD du 26/07/2026** (`project_spawt/AMENDEMENT_PRD_2026-07-26.md` — prime sur le PRD) : paiement **web uniquement** (3.1.3, jamais de bouton d'achat ni de lien vers `/gold` dans l'app) ; base **unifiée sur le VPS** (cloud Supabase clôturé) ; périmètre = **37 features** ; OTP **6 chiffres** unifié (`123456` en mock).
2. **Contrat SPAWT** : aucun classement individuel — rendu impossible par le schéma (0040) et vérifié en CI.
3. **Palette/typo** : brandbook canonique (le PRD §15 est périmé — erratum v1.0.3) ; seuils de stades = PRD §5.2 (le doc Gamification de février est périmé).
4. **Downgrade B2B = acte humain** : ni le webhook ni le cron ne rétrogradent `b2b_accounts.role`.
5. **OTA manuel uniquement** ; version figée `1.1.0` jusqu'à décision de release.

### Décisions produit encore ouvertes (implémentées en réversible)

- **Q4 — méthode du prix moyen** (décideur : Kidam) : convention éditoriale « repas/pers. hors boissons » appliquée, flag `place-avg-price` pour couper. Cf. `documentation/decisions-produit-ouvertes-2026-07-07.md`.
- **R3 — pays d'origine** (décideuse : Stephanie) : conservé, flag `onboarding-origin-country` pour couper sans redéploiement.
- Conversion premium 3,3 % vs cible 5-8 % (amendement §5.1) : arbitrage business non tranché.

### Dettes techniques assumées (connues, documentées, non bloquantes)

| Dette | Détail | Où c'est tracé |
|---|---|---|
| Deno absent du runner de dev | les tests des Edge Functions n'ont pas tourné localement — **à exécuter en CI/env avec deno** avant toute modif des fonctions | §6.2 ; header `sprint-status.yaml` |
| HMAC CinetPay à valider en sandbox | l'ordre `WEBHOOK_HMAC_FIELDS` suit la doc CinetPay mais doit être confirmé contre un webhook réel ; la règle d'or (`getStatus`) protège en attendant | `_shared/payment/cinetpay.ts` (commentaire l.51) |
| RAM du VPS à vérifier | la stack self-hosted ≈ 2,5-4 Go de RAM en plus — GO/NO-GO **avant** de démarrer `spawt-supabase` | `MIGRATION_COOLIFY.md` §2.0 |
| Realtime → polling | le Mode Crew tente Supabase Realtime et retombe en polling si indisponible (self-hosted à valider sous charge) | `app/src/lib/crew/crew-realtime.ts` |
| FCM non configuré = push Android muets | l'app dégrade proprement (pas de crash) mais aucune notif du Guet tant que `google-services.json` + clé FCM V1 ne sont pas en place | runbook stores §4 |
| Push receipts Expo non consommés | purge des tokens sur tickets immédiats uniquement (V1) | header `push-send/index.ts` |
| SPOF VPS unique | mitigations : backups Coolify à activer (S3/local), cloud en pause 30 j pendant le cutover, runbooks = IaC implicite | `MIGRATION_COOLIFY.md` §7 |
| `eas.json` : `REMPLACER_ASC_APP_ID`/`REMPLACER_APPLE_TEAM_ID` | placeholders tant que le compte Apple n'existe pas — ⚠️ attendu du conformity-check | `HUMAN_TODO.md` |
| Keystore Android = compte Expo `xtincell` | dépendance forte à ce compte ; sécuriser l'accès | skill `spawt-release` |
| Enveloppe native figée | ne pas ajouter de module natif sans re-tester un build EAS complet (`newArchEnabled` RN 0.83) | `HUMAN_TODO.md` §Fait |
| Docs `docs/` du repo mobile | snapshot figé du 2026-05-13, **périmé** — ne jamais s'y fier pour « est-ce implémenté » | `CLAUDE.md` |

---

## 10. Par où commencer (le premier jour de la nouvelle équipe)

1. **Cloner les 4 repos** (§1). Pré-requis : Node ≥ 20, npm. (Deno et Docker : seulement pour les Edge Functions et le migrator.)
2. **App mobile en mode démo** (aucun backend requis) :
   ```bash
   cd spawt-ci-mobile-v1-mvp/app
   npm ci --legacy-peer-deps
   npm run typecheck && npm run lint:vocab && npm run i18n:check && npm test
   cd .. && node scripts/conformity-check.mjs      # la quadruple gate + conformité doivent être vertes
   cd app && npx expo start                        # OTP démo : 123456
   ```
   ⚠️ Expo Go ne couvre ni le geofencing background (Guet), ni les push, ni Apple Sign-In — pour ça : dev build / APK (tag `build-android-…`).
3. **Portail** : `cd project_spawt_mobile_ci && npm ci && cp .env.example .env && npm run dev` (mode démo sans backend ; `VITE_PAYMENT_MOCK=1` pour le tunnel de paiement). Gates : `npm run lint:vocab && npm run typecheck && npm test && npm run build`.
4. **Admin** : `cd spawt-ci-mobile-v1-mvp/spawt-admin && npm ci && npm test`.
5. **Quiz** : `cd spawt-meute-quiz && npm install && DATABASE_URL=postgresql://localhost/spawt npm start` (Postgres local ; schéma auto au boot).
6. **Lire, dans cet ordre** :
   1. `CLAUDE.md` (racine repo mobile) + les 4 skills `.claude/skills/spawt-*/SKILL.md` (context → dev → release → guet) ;
   2. ce document ;
   3. `project_spawt/AMENDEMENT_PRD_2026-07-26.md` (les décisions qui priment sur le PRD) ;
   4. `documentation/conformity-checklist.yaml` + `documentation/AUDIT_NOTE_MAJ_R1-R28.md` (l'état vérifié feature par feature) ;
   5. `HUMAN_TODO.md` (ce qui reste côté équipe/propriétaire) ;
   6. `MIGRATION_COOLIFY.md` + `spawt-meute-quiz/BASCULE_DATABASE_URL.md` (l'infra) ;
   7. `documentation/RUNBOOK_SOUMISSION_STORES.md` (+ `STORE_LISTING_FR.md`, `DATA_SAFETY_PRIVACY.md`) au moment de publier.
7. **État git au moment de la passation** : la version finale vit sur `claude/app-finale-ios-android-f8ewrp` (53 commits au-dessus de `spawt/build-8`) ; `main` est en retard — le merge est une décision listée dans `HUMAN_TODO.md`. Journal des livraisons : `CHANGELOG.md` (vue dev) et `RELEASES.md` (vue testeur, dernier APK : build 8, v1.1.0).
8. **Règle d'or pour la suite** : une gate rouge = on ne commit pas ; un hex hors `tokens.ts` = violation ; une string UI hors i18n = violation ; une migration sans `.down.sql` = violation ; un doute produit = le Contrat SPAWT et l'amendement PRD tranchent.
