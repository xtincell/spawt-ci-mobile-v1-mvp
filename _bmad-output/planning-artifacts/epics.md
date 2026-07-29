---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - _bmad-output/planning-artifacts/PRD.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/architecture-mobile-app.md
  - docs/api-contracts-mobile-app.md
  - docs/data-models-mobile-app.md
  - documentation/SPRINT_1_CAHIER_DES_CHARGES.md
  - documentation/analytics/events.md
language: fr
project_name: SPAWT
scope: Sprint 1 V1 — 12 features priorisées (cahier §3.1)
---

# SPAWT - Epic Breakdown

## Overview

Ce document décompose les exigences du PRD V1, de la spécification UX Design et de l'architecture mobile-app en epics et stories implémentables pour SPAWT — compagnon de découverte culinaire identitaire pour Abidjan.

**Périmètre :** Sprint 1 V1 = 12 features priorisées sur 19 (cahier §3.1). Les FR/NFR marqués `Sprint 2` ci-dessous sont extraits pour traçabilité complète mais ne seront **pas** décomposés en stories dans ce document (scope figé par le cahier Sprint 1 + la spec UX).

**Projet brownfield :** `app/` (Expo SDK 55 / RN 0.83 / TS strict) est déjà scaffolé — Phase 0 quasi terminée (CHANGELOG v1.1.2). Il n'y a **pas** de starter template à initialiser ; l'Epic 1 portera l'alignement de fondation (tokens canoniques, tables Supabase, feature flags, i18n) et non un bootstrap from scratch.

## Requirements Inventory

### Functional Requirements

> 41 FRs extraits du PRD v1.0.2. Champ `[Phase]` : Sprint 1 = décomposable en stories ici ; Sprint 2 = hors scope de ce document.

**Inscription, identité et calibrage**

- **FR-001** — Authentification spawter : création/reconnexion via numéro de téléphone + OTP (primaire) ou Google Sign-In (secondaire). OTP délivré < 30s pour 95% des envois. Pas d'email+password. `[Sprint 1]`
- **FR-002** — Onboarding et calibrage initial du Palais : 5 questions de calibrage (1 par axe bipolaire) générant un Palais initial -40/+40 par axe, + saisie quartier, cuisine préférée, budget, contexte, `country_code`, `origin_country_code`, `gender`, `age_range`. Complétion < 3 min, cible 70%. `[Sprint 1]`
- **FR-003** — Voix du chat évolutive : messages du Chat dont le ton dépend du stade courant (5 tons). Wording centralisé en strings i18n. Changement de ton sous 24h après montée de stade. `[Sprint 1]`

**Découverte et exploration**

- **FR-004** — Feed personnalisé : liste ordonnée par score composite `0,15·cosine + 0,30·distance + 0,30·note_pondérée + 0,10·recency + 0,15·novelty`, score affiché borné [50%, 99%]. ≥10 lieux, P95 < 3s sur 3G. `[Sprint 1]`
- **FR-005** — Fiche lieu détaillée : photo, nom, quartier, cuisine, prix, note pondérée, horaires, adresse, boutons Appeler/WhatsApp, score matching, signaux spéciaux, radar ADN si ≥5 avis sinon « ADN en construction ». Ouverture < 2s. `[Sprint 1]`
- **FR-006** — Le Spawt (Le Guet) : détection passive périmètre 10m, timer 15min, notification locale, snooze ×3, fenêtre +30min post-sortie, spawt passif (poids 0,5x) si non-réponse. Anti-fraude DR-FRAUD-01..06 appliquée. Spawt simple < 30s. `[Sprint 1]`
- **FR-007** — Avis structuré : note étoiles 1-5 obligatoire, tags rapides multi-select (5 valeurs), texte libre ≤ 500c, 1-3 photos compressées 80%/1MB. Poids algorithmique par stade (1x→3x). Met à jour ADN + Palais. `[Sprint 1]`

**Identité et progression**

- **FR-008** — Profil spawter : nom, avatar, quartier, stade, titre actuel + titre affiché, nombre de spawts/avis, lieux sauvegardés, radar Palais 2 axes (gratuit) / 5 axes (Gold), collection de titres permanente. Titre affiché choisi librement. Ouverture < 1,5s. `[Sprint 1]`
- **FR-009** — Sauvegarde de lieux (favoris) : ajout/retrait d'un lieu depuis la fiche, consultation depuis le profil. Action < 500ms. Favori = signal de matching. `[Sprint 1]`
- **FR-010** — Progression par stades : 5 stades selon spots uniques vérifiés (Touriste 0-10, Explorateur 11-20, Détective 21-30, Djidji 31-50, Guide 50+). Écran de célébration + titre ajouté + voix du Chat ajustée à chaque seuil. La maturité ne recule jamais. `[Sprint 1]`
- **FR-011** — Coup de Cœur (monnaie sociale rare) : quota mensuel par stade (1/1/1/2/3, +1 Gold), reset le 1er du mois. `[Sprint 2]`
- **FR-012** — Système d'archétypes et mues : archétype dérivé des 2 axes Palais dominants, mue si axes stables 30j + 5 spots dans la nouvelle direction. `[Sprint 2]`

**Recherche et navigation**

- **FR-013** — Recherche et filtres : recherche texte (nom, cuisine, quartier) + filtres combinables AND (cuisine, budget 3 tranches, distance, note min). Résultats < 1,5s sur 3G. `[Sprint 1]`
- **FR-014** — Carte interactive : vue carte avec pins, zoom, filtre catégorie, deep link navigation. Style dark. `[Sprint 2]`
- **FR-015** — Paywall géographique : compte gratuit = rayon 3km, lieux hors zone floutés avec mention Premium. Gold = tout Abidjan. `[Sprint 2]`

**Communauté et viralité**

- **FR-016** — Partage WhatsApp : partage d'une fiche lieu via deep link sortant (image + nom + note + lien), redirection store si app non installée. Partage < 5s. `[Sprint 1]`
- **FR-017** — Signalement et modération : bouton « Signaler » sur un avis, file d'attente admin, décision humaine (garder/supprimer/warning/ban). `[Sprint 2]`
- **FR-018** — Création modérée de fiche lieu : suggestion de lieu absent via formulaire, validation/rejet équipe sous 7j. `[Sprint 2]`

**Notifications**

- **FR-019** — Notifications push et locales : 6 types (bienvenue, rappel Le Guet locale, nouveau lieu, activité sur avis, montée de stade, mue). Plafond 3-4/sem hors Le Guet. `[Sprint 2]`

**Monétisation**

- **FR-020** — Souscription Spawter Gold : 2 500 FCFA HT/mois ou 25 000 FCFA HT/an via Mobile Money agrégé CinetPay (Orange Money, Wave, MTN MoMo). Activation immédiate post-confirmation. `[Sprint 2]`
- **FR-021** — Gestion d'abonnement avec grace period : rappels J-3 / jour J, grace period 7j, downgrade auto J+8, données premium conservées 90j masquées. `[Sprint 2]`
- **FR-022** — Émission de facture conforme : facture séquentielle `SPAWT-2026-NNNN` par email + SMS sous 30s, TVA 18%. `[Sprint 2]`

**Administration**

- **FR-023** — Panel admin web : membre `spawt_staff` peut CRUD lieux, modérer les avis, gérer les comptes spawter, consulter les métriques basiques. Auth distincte des spawters publics, actions critiques auditées. `[Sprint 1]`

**Data layer et signaux**

- **FR-024** — Collecte de signaux append-only : capture en `user_signals` de chaque action significative (spawt, review, view, save, share, search, filter, click, dismiss). Aucune mutation, rétention infinie V1. `[Sprint 1]`
- **FR-025** — Mise à jour du Palais par décroissance exponentielle : `learningFactor = max(0,05, 1/(1+n_spots×0,05))`, recalcul incrémental, mapping signaux PRD §20.5, politique overwrite. `[Sprint 1]`
- **FR-026** — Mise à jour de l'ADN du Lieu : mise à jour depuis sous-critères + tags de l'avis. Avis `is_seed = true` alimentent l'ADN mais sont exclus du compteur public. < 5 avis → « ADN en construction ». `[Sprint 1]`

**Séparation entités (amendements team §4)**

- **FR-027** — Séparation `spawters` / `spawt_staff` : comptes publics B2C séparés des comptes équipe interne. Toutes les FK pointent vers `spawters(id)`. `[Sprint 1]`
- **FR-028** — Table commerciale `customers` : entité applicative séparée de l'entité commerciale, créée à l'upgrade Gold. `subscriptions`/`invoices` pointent vers `customers.id`. `[Sprint 1]` (B2C uniquement)
- **FR-029** — Catalogue de plans tarifaires : table `plans` (`code`, `label`, `price_ht`, `currency_id`, `country_code`, `period`, `is_active`). Seed Sprint 1 = `gold_monthly`, `gold_annual` (CI/XOF). `[Sprint 1]`
- **FR-030** — Catalogue de devises multi-pays : table `currencies` (ISO 4217, `base_rate`, `modifier`, `country_code`). Seed XOF actif, hooks de conversion inactifs V1. `[Sprint 1]`

**Direction artistique et tokens**

- **FR-031** — Système de tokens design : toutes couleurs/typo/espacements en source unique, exportés CSS variables + JSON Figma. Aucune valeur en dur. Mode sombre préparé mais inactif V1. `[Sprint 1 — Phase 0]`

**Carte et inventaire**

- **FR-032** — Pré-chargement de l'inventaire initial + avis fondateurs : 50-100 lieux dont 20 Mission 1, chacun avec 3 avis fondateurs `is_seed = true` (150-300 avis seed). Aucune carte vide, distinction admin avis fondateur/communauté. `[Sprint 1]`

**Suppression / export (conformité ARTCI)**

- **FR-033** — Suppression de compte et export self-service : soft-delete + anonymisation J+30, export JSON. `[Sprint 2]`

**Sanctions communautaires**

- **FR-034** — Application des sanctions Faux-Pas : `spawt_staff` applique Warning / BAN selon les Faux-Pas, traçabilité audit. `[Sprint 2]`

**Badges et signaux spéciaux**

- **FR-035** — Badge `Premier Spawt` (verrou activation) : attribué au 1er spawt vérifié, lève le verrou d'accès aux avis détaillés. Attribution < 5s. `[Sprint 1]`
- **FR-036** — Badges spéciaux du lieu : badges automatiques par job batch quotidien (Coup de Cœur, Pépite Vérifiée, Institution, Fidélité, Découverte, Table Diverse, Noctambule Vérifié). `[Sprint 2]`
- **FR-037** — Note communautaire pondérée : `note_affichée = Σ(note×poids_stade)/Σ(poids_stade)`, poids 1x→3x. Recalcul incrémental. `[Sprint 1]`

**Interface paiement abstraite**

- **FR-038** — Interface de paiement abstraite : `IPaymentProvider` (`initiate`, `getStatus`, `confirm`, `refund`, `parseWebhook`). CinetPay = impl. V1 remplaçable. `[Sprint 2]`

**Mode offline et résilience**

- **FR-039** — Stockage local des spawts en attente de synchronisation : spawts détectés enregistrés localement, sync auto au retour réseau. Aucune perte pour coupure < 24h, file inspectable/purgeable. `[Sprint 1]`

**Consent ARTCI explicite (amendement Claude §5.2)**

- **FR-040** — Écran de consentement ARTCI à l'onboarding : avant la 1re question de calibrage, 2 checkboxes non pré-cochées (CGU/CGV + collecte données/géoloc), bouton « Continuer » désactivé sinon. Consentement historisé (`cgv_accepted_at`, `geoloc_consent_at`), révocable. Bloquant. `[Sprint 1]`

**Feature flags système (amendement Claude §5.5)**

- **FR-041** — Système de feature flags : table `feature_flags(flag_code, spawter_id NULL, enabled, scope, expires_at NULL)`, hook `useFlag(code)`, 4 scopes (`internal`/`alpha`/`beta`/`prod`), ouverture progressive depuis le panel admin, TTL < 60s côté client. `[Sprint 1 — Phase 0]`

### NonFunctional Requirements

> 40 NFRs extraits du PRD v1.0.2. Tous actifs en V1 (pas de feature flag sur les NFR).

**Performance — temps de réponse**

- **NFR-PERF-01** — Feed (FR-004) servi en < 3s P95 sur 3G, mesuré par Sentry sur Android mid-range.
- **NFR-PERF-02** — Fiche lieu (FR-005) ouverte en < 2s P95 sur 3G, mesuré par Sentry.
- **NFR-PERF-03** — Spawt (FR-006) persisté en < 500ms P95 du confirm à l'ACK backend.
- **NFR-PERF-04** — Notification Le Guet délivrée < 30s du trigger geofencing quand réseau présent.

**Performance — taille et bundle**

- **NFR-PERF-05** — APK installé < 50 MB sur Android (Google Play Console).
- **NFR-PERF-06** — Bundle JS initial < 500 KB gzippé au 1er lancement.
- **NFR-PERF-07** — Photos d'avis (FR-007) compressées à 80% qualité et 1 MB max par image.

**Géolocalisation**

- **NFR-GEO-01** — Périmètre de détection Le Guet = 10 mètres.
- **NFR-GEO-02** — Précision GPS < 30m requise pour valider un spawt `verified` ; sinon fallback mode manuel.
- **NFR-GEO-03** — Moyenne des 3 dernières positions GPS sur 30s avant déclenchement Le Guet.
- **NFR-GEO-04** — GPS désactivé et bascule spawt manuel quand batterie < 10%.

**Disponibilité et résilience**

- **NFR-AVAIL-01** — 99,9% uptime du backend public en heures ouvrées (08:00-22:00 GMT).
- **NFR-AVAIL-02** — Spawts mis en file localement hors-ligne et synchronisés sous 60s au retour réseau.
- **NFR-AVAIL-03** — Tolérance à la terminaison agressive des OEM Android (Tecno, Infinix, Samsung) : geofences persistées au niveau OS, latence max 5 min.

**Conformité et sécurité**

- **NFR-SEC-01** — RLS sur toutes les tables Supabase contenant des PII spawter.
- **NFR-SEC-02** — Consentement explicite requis avant l'activation du tracking géoloc (timestamp stocké + écran onboarding bloquant).
- **NFR-SEC-03** — Communications client-serveur en TLS 1.2+.
- **NFR-SEC-04** — Soft-delete d'un compte sous 5s, anonymisation des PII sous 30 jours.

**Anti-fraude (technique, distinct de la modération humaine)**

- **NFR-FRAUD-01** — Rejet des spawts sur le même lieu dans les 4h d'un spawt vérifié (trigger SQL).
- **NFR-FRAUD-02** — Flag de tout spawter cumulant > 5 spawts/jour (trigger SQL `flag_reason`).
- **NFR-FRAUD-03** — Flag de toute séquence impliquant un déplacement > 100 km/h entre 2 spawts vérifiés.
- **NFR-FRAUD-04** — Poids 0,5x sur tout spawt `is_verified = false`.
- **NFR-FRAUD-05** — Flag du compte quand 10+ patterns de spawt identiques en 7 jours glissants.
- **NFR-FRAUD-06** — Flag de tout spawt avec `left_at - arrived_at < 5 min` ET `check_in_type = 'active'`.

**Observabilité**

- **NFR-OBS-01** — Taux de sessions crash-free > 99% (Sentry, fenêtre 7j glissants).
- **NFR-OBS-02** — Collecte des events funnel AARRR dans Mixpanel ou PostHog avec cohort tracking.
- **NFR-OBS-03** — Capture des 9 types de signaux dans `user_signals` append-only.
- **NFR-OBS-04** — `documentation/analytics/events.md` = source unique des noms/propriétés d'events ; aucun event ad hoc sans ajout préalable, identifiants `EVT-XX` référencés dans les tickets.

**Internationalisation**

- **NFR-I18N-01** — 100% des strings user-facing extraites dans la couche i18n (i18next + `app/src/i18n/fr.json`), locale par défaut `fr-CI`, audit build `i18n:check` bloquant.
- **NFR-I18N-02** — Audit vocabulaire `lint:vocab` bloquant sur tout terme hors-glossaire dans `app/src/**` et `app/app/**`.

**Architecture portable (multi-villes)**

- **NFR-PORT-01** — Ajout d'une nouvelle ville sans refactoring de code (colonne `country_code` sur `spawters`, `places`, `plans`, `currencies`) ; un spawter peut être Guide dans une ville et Touriste dans une autre.

**Capacité et charge**

- **NFR-CAP-01** — Support de 15 000 MAU (cible M12) en respectant NFR-PERF-01..04.
- **NFR-CAP-02** — Support de 500 spawts/jour et 200 avis/jour à M12 sans dégradation.
- **NFR-CAP-03** — Service de jusqu'à 800 lieux avec requêtes feed sub-seconde à M12.

**Coûts opérationnels**

- **NFR-COST-01** — Plafonnement des coûts API Mapbox via cache de tuiles agressif + rate limiting.
- **NFR-COST-02** — Minimisation des coûts de stockage photos (compression 1 MB max + lazy loading).

**Conservation et migration data**

- **NFR-DATA-01** — `user_signals` append-only sans mutation de ligne (trigger Postgres bloquant UPDATE/DELETE).
- **NFR-DATA-02** — Conservation des données premium 90 jours après downgrade en état masqué.
- **NFR-DATA-03** — Politique overwrite sur `user_palais` et `spawter_progression` ; trajectoire historique uniquement via `collection_titres` et `user_signals`.

**Paiement Mobile Money**

- **NFR-PAY-01** — Confirmation d'un paiement CinetPay sous 60s pour 95% des transactions.
- **NFR-PAY-02** — Fallback vers un provider de paiement de secours sans refactoring (via `IPaymentProvider`).

### Additional Requirements

> Exigences techniques issues de l'architecture mobile-app, des contrats d'API, des data models et du cahier Sprint 1. Elles ne sont pas des FR/NFR mais contraignent fortement la décomposition en stories — en particulier l'Epic de fondation (Phase 0).

**Projet & fondation**

- **Projet brownfield — pas de starter template.** `app/` (Expo SDK 55 / RN 0.83 / TS strict / Zustand / expo-router) est déjà scaffolé, Phase 0 quasi terminée (CHANGELOG v1.1.2). L'Epic 1 = alignement de fondation, pas un bootstrap.
- **Triple gate locale obligatoire avant chaque commit** : `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check`. Aucun pipeline CI actif — la triple gate locale est la barrière (cible : `.github/workflows/mobile-ci.yml`).
- **Chemin de livraison canonical Sprint 1 = EAS Build APK Android sideloadable** (`preview` profile, `buildType: apk`). Tout code mobile doit rester compatible build `preview` Android. Expo Go = démo uniquement (pas de geoloc background). iOS `.ipa` = chemin secondaire manuel.

**Schéma de données Supabase (à créer Sprint 1 Phase 0-1)**

- **15 tables attendues** : `spawters`, `spawt_staff`, `customers`, `plans`, `currencies`, `places`, `place_adn`, `user_palais`, `spawter_progression`, `collection_titres`, `user_signals`, `spawt_checkin`, `subscriptions`, `invoices`, `feature_flags`. Migrations versionnées réversibles.
- **RLS** sur les tables PII : `spawter_id = auth.uid()` sur `spawt_checkin`, `user_palais`, `spawters` (+ autres tables PII NFR-SEC-01).
- **6 triggers SQL anti-fraude** (Phase 1.3) implémentant DR-FRAUD-01..06 + colonne `flag_reason` sur `spawt_checkin` — la duplication client (`ANTIFRAUD_RULES`) est purement informative.
- **Politique d'historisation** : overwrite (`user_palais`, `spawter_progression`) ; append (`collection_titres`) ; append-only strict (`user_signals`).
- **Buckets Storage** (Phase 1.3) : `place-photos` (RLS écriture limitée au sous-dossier `<spawter_id>/<spawt_id>/`), `place-covers` (read-only public).

**Patterns d'architecture à respecter**

- **Adapter pattern data-source (règle d'or)** : les écrans ne touchent jamais Supabase directement — toujours via `lib/data-source.ts`. L'adapter retourne `{ mode, data }`, fallback transparent vers les seeds, pas d'exception en bordure.
- **Import dynamique de Supabase** : `data-source.supabase.ts` chargé via `await import()` — jamais d'import statique de `@supabase/supabase-js` depuis un écran (casse le mode démo + le bundle).
- **Moteurs purs `lib/`** : `matching.ts` (score composite), `palais-engine.ts` (décroissance exponentielle), `chat-voice.ts` (mapping stade×moment) — sans I/O, totaux, testables unitairement. Cible #1 des tests.
- **Local-first** : toute écriture met à jour le store Zustand + AsyncStorage **avant** la sync Supabase ; sync = fire-and-forget (`void saveSpawter(...)`), jamais d'`await` réseau dans une action user-facing.
- **`RouteGuard` passif** : observe le store, redirige (`(onboarding)` ↔ `(tabs)`), n'orchestre aucune logique métier.
- **Recompute dérivés côté client** après chaque mutation : `unique_spots` → `stade` via `getStade()` ; tout `SpawtCheckin` passe par `registerSpawt` du store.

**Auth & intégrations**

- **Auth OTP** : provider Twilio Verify ou Termii (CIV-friendly) via Edge Function, session JWT Supabase Auth ; Google Sign-In secondaire + Sign in with Apple (exigé par Apple si Google exposé) ; `(onboarding)/phone.tsx` est aujourd'hui un stub.
- **Wrapper analytics typé** : `app/src/lib/analytics.ts` à créer — force le respect de la taxonomie `events.md` via union types TypeScript (nom d'event + propriétés). Provider PostHog vs Mixpanel = décision ouverte (Kidam + Madame Sun).
- **Pas d'endpoints REST custom** : consommation directe des tables via le SDK ; les contrats sont les shapes de SELECT/upsert (`places` join `place_adn`, upserts `on_conflict`).

**Store compliance & permissions**

- Permissions manifest Android (`ACCESS_FINE/COARSE/BACKGROUND_LOCATION`, `CAMERA`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`, `INTERNET`, `WAKE_LOCK`) + iOS (`NSLocation*`, `NSCamera*`, `NSPhotoLibrary*`, `NSUserNotifications*`), wording `fr-CI` conforme Loi 2013-450.
- Google Play : Data Safety, Background Location declaration form (justifié Le Guet), target API 34. Apple : §3.1.1 (paiement externe accepté), §4.0 (Sign in with Apple), §5.1.1 (privacy labels + account deletion), §1.2 (modération UGC). Age rating 17+.

**Process & Définition de Done**

- **Matrice 4 devices imposée** avant chaque merge : Tecno Spark (low-end), Infinix Hot, Samsung A-series, iPhone récent + iPhone ~2 ans. Document `documentation/qa/device_matrix.md` à créer Phase 0.
- **Budget perf chiffré** (Définition de Done) : Time to first feed P95 < 3s sur 3G + Android mid-range, bundle JS < 500 KB gzippé, APK < 50 MB.
- **Triple sign-off obligatoire** avant merge sur `main` : Stéphanie (qualité/QA) + Kidam (analytics/KPI) + Alexandre (brand/vocab/copy) + Tech Lead (code/migrations/flags/i18n).
- **Alpha interne 5 spawters × 1 semaine** en fin de Sprint 1 — focus exclusif fiabilité du Guet ; pivot manuel (QR code) si KO.
- **Décisions ouvertes à ne pas trancher seul** : formule `session_duration_minutes` + définition « fin de session » (tech lead), formules KPIs (Madame Sun + Kidam), provider analytics, framework E2E (Maestro vs Detox), allocation devices, budget consent juridique CGU/CGV.

### UX Design Requirements

> Exigences extraites de la spécification UX Design (`ux-design-specification.md`). La source canonique UX/brand est `documentation/ux/` (kit `midfi-kit.jsx` + `spawt-tokens.css` + brandbook v1.0) — au-dessus du PRD §15 et de `tokens.ts` (en drift). Chaque UX-DR est assez spécifique pour générer une story avec des AC testables.

**Fondation visuelle (Phase 0 — prérequis bloquant)**

- **UX-DR1** — Réaligner `app/src/theme/tokens.ts` sur `documentation/ux/spawt-tokens.css` : palette canonique (Noir `#0A0A0A`, Or `#C8A44E`, Or clair `#E8D5A0`, Vert Chat `#2D6B4F`, Vert Chat foncé `#1F4D39`, Blanc cassé `#FAFAF8`, Ambre `#E89A39`, Crème sable `#EFE8DC`, Blanc pur `#FFFFFF`, Graphite `#333333`, Gris moyen `#8A8A8A`), tokens sémantiques (`--bg`, `--bg-card`, `--bg-warm`, `--ink`/`-soft`/`-mute`, `--line`/`-strong`), gradients (`gr-night`, `gr-gold`, `gr-sand`, `sh-glow`), radius (`r-s 4`/`r-m 8`/`r-l 16`/`r-card 20`), élévations (`sh-s`/`sh-m`/`sh-l`). PRD §15.1/§15.3 à amender.
- **UX-DR2** — Ajouter le token manquant `--alert-red` au kit (états erreur, badge « trending ») — non défini dans `spawt-tokens.css`, revue Alexandre + Stéphanie (contraste).
- **UX-DR3** — Intégrer les polices **Klinsman** (display — Light/Regular/Bold) + **Gotham** (body — Book/Medium/Bold) via `expo-font`, fallback système ; implémenter l'échelle typographique (`t-display`/`h1`/`h2`/`h3`/`body`/`small`/`caption`/`data`/`overline`).
- **UX-DR4** — Porter les primitives canoniques de `midfi-kit.jsx` en RN : `Ico` (~26 icônes SVG 24×24 stroke 1.6), chips (`chip`/`-gold`/`-green`/`-dark`/`-outline`), boutons (`btn-primary`/`-gold`/`-gold-grad`/`-secondary`/`-ghost`), `CatBubble`+`CatIcon`, `Wordmark`, `SpawtPin`, `MatchScore`, `Stars`, `PalaisRadar` (pentagonal `fill #2D6B4F`), `pattern-dots`/`-gold`, `TabBar` 5 onglets.
- **UX-DR5** — Re-dériver les 4 composants RN existants sur les tokens + primitives canoniques : `ChatBubble` → `CatBubble` (fond noir, coin `16 16 16 4`), `PlaceCard` → carte éditoriale, `AxisRadar` → `PalaisRadar`, `DataSourceBanner` → re-skin.
- **UX-DR6** — Corriger le drift D7 : `Stars` du kit `max=4` → `max=5` (cohérent note 1-5 PRD §7.2 et `app/src/types/spawt.ts`).

**Composants composites Sprint 1**

- **UX-DR7** — `PlaceCard` (carte éditoriale) : 3 variants `hero`/`row`/`numbered`, contenu (photo, kicker overline, nom Klinsman, `MatchScore`, `Stars` 1-5, cuisine·quartier, distance icône `walk`, prix FCFA), états `default`/`pressed`/`is_seed`/`ADN en construction`, cible ≥44pt + `accessibilityLabel`.
- **UX-DR8** — `UneCarousel` + `UneCard` : carrousel swipeable (scroll-snap) des Unes éditoriales du Home `HomeD`, `UneCard` = photo hero 200-240px + dégradé + kicker + titre Klinsman + byline + médaille coin, baseline du Chat synchronisée, `accessibilityRole="adjustable"`.
- **UX-DR9** — `ModeStories` : sélecteur « JE SORS POUR… » en tête de `HomeD`, chips circulaires 44px (glyph + label + sub), état actif (bordure noire 2.5px + pastille verte), entrée `+ Plus`, `accessibilityRole="radiogroup"`.
- **UX-DR10** — `GuetIndicator` : pastille verte pulsée + « Le Chat fait le guet chez {place_name}… » (Klinsman), états `armé`/`seuil 15min`/`snoozé`, `accessibilityLiveRegion="polite"`.
- **UX-DR11** — `SpawtSheet` / `ReviewForm` : sheet de notation post-Guet — header lieu, `CatBubble`, note 1-5 étoiles, tags rapides (chips `chip-dark` toggle), photos 0-3 optionnelles, CTA « Spawter ce lieu » désactivé tant que note vide, états `offline` (queue locale FR-039), drag-handle + focus piégé.
- **UX-DR12** — `SpawterCard` (carte flip) : recto `gr-night` (rang, n°, avatar, nom, titre, citation, stats héro) / verso `bg-warm` (`PalaisRadar` 5 axes + 2 axes dominants), flip 3D au tap, variant `premium` (couronne or), `accessibilityRole="button"`.
- **UX-DR13** — `StadeCelebration` : `gr-night` + `pattern-dots-gold` + halo, gros `CatIcon`, ancien stade barré → nouveau en or, mot du Chat, barre de progression — **sans son « ding » ni confettis**, ton solennel quasi-rituel.
- **UX-DR14** — Composants supportants Sprint 1 : `OnbCard`, `OnbStep`, `OtpInput`, `Splash` (`gr-night`), `Masthead` (bandeau daté), `FeuilletonRow`, `AdnTags` (ADN en chips, pas radar), `AvisCard`, `SearchBar` + `FilterChips` + `FilterSheet`, `ListeCard`, `ShareSheet` (deep link WhatsApp), `EmptyState` (« le chat tousse »).

**Structure & navigation**

- **UX-DR15** — Onboarding Sprint 1 = `OnbMidfi` (cartes visuelles multi-select, 5 questions de calibrage du Palais — décision D10) ; le flow `Onb1-5` quartier/style/budget/mode est écarté du Sprint 1.
- **UX-DR16** — Home Sprint 1 = `HomeD` (masthead daté + `ModeStories` 44px + `UneCarousel` + édito du Chat + feuilleton « Et aussi dans le mode » — décision D11) ; le `HomeContextuel` (drill-down par mode) est reporté V1.5.
- **UX-DR17** — Navigation 5 onglets : Feed · Carte · [FAB + Spawter] · Meute · Palais ; FAB central rond noir 48px (icône `plus` or, débord -22px) porte l'action centrale Spawter ; `TabBar` 78px (safe-area incluse).
- **UX-DR18** — Login/Signup en **OTP only + Google Sign-In secondaire** (drift D1) ; les écrans email/password du kit (`midfi-screens-5`) sont obsolètes, à refaire.
- **UX-DR19** — Corriger la copy de la notif Le Guet : « VTC » → « Le Guet » (drift D6).
- **UX-DR20** — Axes Palais canoniques (drift D8) : Racines/Horizons · Tanière/Nomade · Exigeant/Enthousiaste · Foule/Secret · Maquis/Table ; `ProfilTerritoire` du kit (axes inventés) est une erreur.

**Décisions de scope / drifts à appliquer**

- **UX-DR21** — Retirer des écrans V1 : « Réserver · Premium » et paiement « Visa » (drift D9) — réservation = V2, paiement = Mobile Money agrégé CinetPay only.
- **UX-DR22** — Favoris renommés (drift D5) : « Tanière » = cercle privé d'amis (sens du kit) ; les favoris reçoivent un nouveau nom (proposition « Mes spots » / « Ma liste », à fixer). Le social de groupe (Crew / Meute fil / listes-vote) reste hors Sprint 1.
- **UX-DR23** — Garde-fous Contrat à la Tribu : « paws » gardé comme compteur **non-convertible** (le +50% paws Gold est supprimé — drift D2) ; « reconnaissances » gardé **non-public** (jamais en classement ni compteur social — drift D3). À re-challenger en revue Contrat dédiée.
- **UX-DR24** — Sprint 1 = **1 seul badge `Premier Spawt`** ; les « Jalons » multiples du kit (`midfi-screens-5`) sont V1.5+ (drift D4).

**Patterns transversaux**

- **UX-DR25** — Pattern « En construction » : `confidence < 0.3` (Palais) ou `< 5 avis` (ADN) → afficher « En construction », jamais un radar/une note non fiable (Experience Principle #3, anti-mensonge user).
- **UX-DR26** — Voix du Chat : toute string UI représentant une voix passe par `chat-voice.ts` → clé i18n, mapping (stade × moment) ; `CatBubble` 3 variants (`bubble`/`lockscreen`/`edito`) ; ton qui mûrit `enjoue_taquin` → `complice` → `grave_respectueux` → `solennel` → `rare_sacre` ; aucune copy générique.
- **UX-DR27** — Light-first + moments `gr-night` : le corps de l'app est clair (`--bg` blanc cassé) ; `gr-night` n'est pas un thème mais un traitement de moment (Splash, célébration de stade, carte spawter recto, paywall, notif Le Guet lock-screen, hero éditorial). Mode sombre intégral = hors V1.
- **UX-DR28** — Accessibilité WCAG 2.1 AA : **re-validation contraste obligatoire** sur la palette canonique (Or `#C8A44E` + Vert Chat `#2D6B4F` sur blanc cassé ET sur `gr-night`) ; cibles tactiles ≥44×44pt + `hitSlop` ; VoiceOver/TalkBack sur les 4 journeys critiques ; font scaling OS jusqu'à +200% sans casse ; info jamais codée par la seule couleur (chiffre + icône + état en doublon) ; `accessibilityLabel`/`Role`/`State` sur tout interactif.
- **UX-DR29** — Responsive par classe de device : largeur de référence 360pt, layout flex RN (jamais de dimension absolue sur un conteneur), portrait-only, 3 garde-fous (petit écran ≤360pt/5" conçu en priorité, grand écran ≥412pt sans blanc maladroit, densité de police) vérifiés sur la matrice 4 devices ; `aspectRatio` sur les médias.
- **UX-DR30** — Hiérarchie de boutons : une seule action primaire par écran, `btn-primary`/`btn-gold-grad`/`btn-secondary`/`btn-ghost`, sticky CTA pleine largeur en bas des fiches, état désactivé non-punitif (CTA grisé tant que le formulaire est invalide).
- **UX-DR31** — Mode démo comme affordance : `DataSourceBanner` monté en permanence quand `dataSourceMode === "fallback"` (`--amber-warm`, jamais caché) ; CTA manuel « Je spawt ici » sur la fiche lieu quand Le Guet n'est pas armé (Expo Go).

**Contrainte de validation transverse** — chaque écran Sprint 1 doit passer le **Test Tantie Rose** (3 questions : Tantie Rose comprend-elle ? / Brice Konan le partagerait-il sans honte ? / Dominic sent-il qu'il appartient ?) avant sign-off Alexandre, en plus de la triple gate technique.

### FR Coverage Map

> Couverture des 27 FRs Sprint 1. Les 14 FRs Sprint 2 (FR-011, 012, 014, 015, 017→022, 033, 034, 036, 038) ne sont pas mappés — hors scope de ce document.

- **FR-001** : Epic 2 — Authentification OTP + Google Sign-In
- **FR-002** : Epic 2 — Onboarding et calibrage initial du Palais
- **FR-003** : Epic 2 — Voix du Chat évolutive (infra `chat-voice.ts`)
- **FR-004** : Epic 3 — Feed personnalisé par score composite
- **FR-005** : Epic 3 — Fiche lieu détaillée
- **FR-006** : Epic 4 — Le Spawt / Le Guet
- **FR-007** : Epic 4 — Avis structuré
- **FR-008** : Epic 5 — Profil spawter (radar Palais, collection de titres)
- **FR-009** : Epic 3 — Sauvegarde de lieux (favoris)
- **FR-010** : Epic 5 — Progression par stades
- **FR-013** : Epic 3 — Recherche et filtres
- **FR-016** : Epic 3 — Partage WhatsApp
- **FR-023** : Epic 6 — Panel admin web
- **FR-024** : Epic 1 — Collecte de signaux append-only
- **FR-025** : Epic 4 — Mise à jour du Palais par décroissance exponentielle
- **FR-026** : Epic 4 — Mise à jour de l'ADN du Lieu
- **FR-027** : Epic 1 — Séparation `spawters` / `spawt_staff`
- **FR-028** : Epic 1 — Table commerciale `customers`
- **FR-029** : Epic 1 — Catalogue de plans tarifaires
- **FR-030** : Epic 1 — Catalogue de devises multi-pays
- **FR-031** : Epic 1 — Système de tokens design
- **FR-032** : Epic 6 — Pré-chargement de l'inventaire initial + avis fondateurs
- **FR-035** : Epic 4 — Badge `Premier Spawt` (verrou activation)
- **FR-037** : Epic 3 — Note communautaire pondérée
- **FR-039** : Epic 4 — Stockage local des spawts en attente de synchronisation
- **FR-040** : Epic 2 — Écran de consentement ARTCI à l'onboarding
- **FR-041** : Epic 1 — Système de feature flags

## Epic List

### Epic 1: Fondation canonique & schéma de données
Socle technique et visuel sur lequel toutes les features s'appuient : tokens design alignés sur le kit canonique `documentation/ux/`, polices Klinsman/Gotham, primitives `midfi-kit` portées en RN, schéma Supabase complet (15 tables + RLS + séparation d'entités), feature flags runtime, collecte de signaux append-only, audits i18n/vocab bloquants. Projet brownfield — exception « fondation » assumée : couche pré-conçue mono-domaine (config + schéma + tokens) ordonnée en premier. Porte UX-DR1→6, NFR-I18N-01/02, NFR-OBS-03/04, NFR-SEC-01, NFR-DATA-01/03, infra des triggers anti-fraude.
**FRs covered:** FR-024, FR-027, FR-028, FR-029, FR-030, FR-031, FR-041

### Epic 2: Entrée dans la Meute — auth, consent & calibrage du Palais
Un nouveau spawter crée son compte, donne son consentement ARTCI (verrou bloquant Loi 2013-450), calibre son Palais initial via 5 questions et entre dans l'app. La voix du Chat est introduite ici. Onboarding `OnbMidfi`, OTP only + Google Sign-In secondaire. Cible 70% de complétion (SC-ACT-01). Porte UX-DR15, UX-DR18, NFR-SEC-02.
**FRs covered:** FR-040, FR-001, FR-002, FR-003

### Epic 3: Découverte — Home, feed, fiche lieu, recherche & favoris
Le spawter explore les lieux scorés pour son Palais, consulte des fiches détaillées, cherche/filtre, sauvegarde en favori et partage sur WhatsApp. Home `HomeD` (stories de modes + carrousel de Unes), nav 5 onglets, score composite [50%, 99%], note pondérée par stade. Fonctionne sur les seeds (`SEED_PLACES`) — autonome sans l'Epic 6. Porte UX-DR7/8/9/16/17/22, NFR-PERF-01/02.
**FRs covered:** FR-004, FR-005, FR-009, FR-013, FR-016, FR-037

### Epic 4: Le Spawt — Le Guet, avis structuré & apprentissage du Palais
Le spawter prouve sa présence physique via Le Guet (geofence 10m, timer 15min, snooze ×3, modes actif/passif/manuel), donne un avis structuré ; son Palais et l'ADN du lieu s'enrichissent. Brique data centrale et point d'activation produit. Offline queue, badge `Premier Spawt` au 1er spawt. Porte UX-DR10/11/19/25/31, NFR-GEO-01→04, NFR-FRAUD-01→06, NFR-PERF-03/04, NFR-AVAIL-02/03.
**FRs covered:** FR-006, FR-007, FR-025, FR-026, FR-035, FR-039

### Epic 5: Identité du spawter — profil, Palais radar & stades
Le spawter consulte son identité (carte spawter flip, radar Palais, collection de titres permanente, titre affiché choisi librement), voit son Palais évoluer et monte de stade lors d'un moment quasi-rituel non gamifié. Identité avant utilité — moat de rétention. Porte UX-DR12/13/20/23/24.
**FRs covered:** FR-008, FR-010

### Epic 6: Panel admin & opération de contenu
L'équipe SPAWT (`spawt_staff`) gère les lieux via un panel web (CRUD), pré-charge l'inventaire initial (50-100 lieux dont 20 Mission 1) et les avis fondateurs (`is_seed`), et consulte les métriques basiques. Codebase web séparée (React + Refine/AdminJS), auth distincte des spawters publics, actions critiques auditées. Dépend du schéma de l'Epic 1 **et** de la migration `places` / `place_adn` (Story 3.3a) — donc séquencé après l'Epic 3. Par ailleurs autonome (aucune dépendance aux features mobiles).
**FRs covered:** FR-023, FR-032

### Epic 7: Release ops & versioning (Sprint Change Proposal v2 — 2026-06-02)
Outillage de release pour l'alpha : schéma de versioning (`v1.0.0 — build N`), journal `RELEASES.md` côté testeur (distinct de `CHANGELOG.md`), et surface in-app du build (`BuildBadge`) pour que les testeurs citent le build exact en bug report. Transverse infra + 1 primitif UI, aucune dépendance produit. Zéro migration.
**FRs covered:** (release ops — hors FR produit)

## Epic 1: Fondation canonique & schéma de données

Socle technique et visuel sur lequel toutes les features s'appuient : tokens design alignés sur le kit canonique `documentation/ux/`, polices Klinsman/Gotham, primitives `midfi-kit` portées en RN, schéma Supabase des entités de fondation (séparation B2C/staff, entités commerciales, signaux append-only, feature flags). Projet brownfield — chaque story ne crée que les tables dont elle a besoin ; `places`, `user_palais`, `spawt_checkin`, etc. sont créées dans leurs épics respectifs.

### Story 1.1: Réalignement des tokens canoniques

As a développeur SPAWT,
I want `app/src/theme/tokens.ts` réaligné sur `documentation/ux/spawt-tokens.css`,
So that tous les écrans consomment la palette de marque canonique sans hex en dur.

**Acceptance Criteria:**

**Given** le kit canonique `spawt-tokens.css`
**When** `tokens.ts` est réécrit
**Then** il porte la palette canonique (Noir `#0A0A0A`, Or `#C8A44E`, Or clair `#E8D5A0`, Vert Chat `#2D6B4F`, Vert Chat foncé `#1F4D39`, Blanc cassé `#FAFAF8`, Ambre `#E89A39`, Crème sable `#EFE8DC`, Graphite `#333333`, Gris moyen `#8A8A8A`), les tokens sémantiques (`bg`, `bg-card`, `bg-warm`, `ink/-soft/-mute`, `line/-strong`), les gradients (`gr-night`, `gr-gold`, `gr-sand`, `sh-glow`), les radius (`r-s/m/l/card`) et les élévations (`sh-s/m/l`)
**And** le token `--alert-red` est ajouté (états erreur, badge trending) avec une valeur validée en contraste

**Given** l'audit post-merge `grep -rnE "#[0-9A-Fa-f]{3,6}" app/src/components app/app | grep -v "tokens.ts"`
**When** il est lancé
**Then** il ressort vide
**And** la triple gate (`tsc --noEmit` + `lint:vocab` + `i18n:check`) passe

### Story 1.2: Intégration des polices Klinsman & Gotham + échelle typographique

As a développeur SPAWT,
I want les polices Klinsman et Gotham chargées et une échelle typographique disponible,
So that la voix visuelle de la marque est appliquée uniformément sur tous les écrans.

**Acceptance Criteria:**

**Given** les fichiers de `documentation/ux/fonts/`
**When** l'app démarre
**Then** Klinsman (Light/Regular/Bold) et Gotham (Book/Medium/Bold) sont chargées via `expo-font` avec fallback système si le chargement échoue

**Given** le thème
**When** un composant accède à la typographie
**Then** une échelle (`t-display`/`h1`/`h2`/`h3`/`body`/`small`/`caption`/`data`/`overline`) est exposée via des presets accessibles depuis `useTheme()`
**And** `t-body` a une taille ≥ 14 et respecte `PixelRatio.getFontScale()` (pas de hauteur de conteneur figée sur du texte)

### Story 1.3: Portage des primitives du kit midfi-kit en RN

As a développeur SPAWT,
I want les primitives canoniques du kit portées en composants React Native,
So that les écrans Sprint 1 se composent à partir du design system SPAWT.

**Acceptance Criteria:**

**Given** `documentation/ux/midfi-kit.jsx`
**When** les primitives sont portées
**Then** sont disponibles : `Ico` (~26 icônes SVG 24×24 stroke 1.6), chips (`chip`/`-gold`/`-green`/`-dark`/`-outline`), boutons (`btn-primary`/`-gold`/`-gold-grad`/`-secondary`/`-ghost`), `CatBubble`+`CatIcon`, `Wordmark`, `SpawtPin`, `MatchScore`, `Stars`, `PalaisRadar`, `pattern-dots`/`-gold`, `TabBar`
**And** `Stars` a `max=5` par défaut (drift D7 corrigé)
**And** `MatchScore` affiche le chip vert si score ≥ 85, neutre sinon, et porte un `●` en doublon de la couleur

**Given** les primitives portées
**When** la triple gate est lancée
**Then** aucune ne porte le préfixe `Spawt` (réservé au métier), chaque valeur passe par les tokens, aucun hex en dur

### Story 1.4: Re-dérivation des 4 composants RN existants

As a développeur SPAWT,
I want les 4 composants RN existants re-dérivés sur les tokens et primitives canoniques,
So that il n'existe plus aucun composant sur les anciens tokens en drift.

**Acceptance Criteria:**

**Given** les composants actuels (`ChatBubble`, `PlaceCard`, `AxisRadar`, `DataSourceBanner`)
**When** ils sont re-dérivés
**Then** `ChatBubble` devient `CatBubble` (fond noir, coin `16 16 16 4`, `CatIcon` or, Klinsman), `AxisRadar` devient `PalaisRadar` (pentagonal `fill #2D6B4F`), `PlaceCard` devient la carte éditoriale, `DataSourceBanner` est re-skinné sur les tokens canoniques (`--amber-warm`)

**Given** les écrans qui consommaient les anciens composants
**When** l'app est compilée
**Then** il n'y a pas de régression visuelle bloquante
**And** la triple gate passe

### Story 1.5: Schéma Supabase — entités spawter & staff + RLS

As a équipe SPAWT,
I want les tables `spawters` et `spawt_staff` créées avec leur RLS,
So that les comptes publics B2C sont séparés des comptes équipe interne dès la fondation.

**Acceptance Criteria:**

**Given** une migration versionnée réversible
**When** elle est appliquée
**Then** la table `spawters` existe avec les champs PRD §13.1 + amendement 4.5 (`country_code`, `origin_country_code`, `gender`, `age_range`, `customer_id`, `geoloc_consent_at`, `data_consent_at`) et la table `spawt_staff` existe
**And** `spawters.phone_e164` est UNIQUE

**Given** la RLS appliquée
**When** un compte public requête
**Then** `spawters` n'est lisible/modifiable que pour `id = auth.uid()` et `spawt_staff` est inaccessible aux comptes publics
**And** la convention « toute FK des tables métier pointe vers `spawters(id)` » est documentée dans la migration

### Story 1.6: Schéma Supabase — entités commerciales (customers, plans, currencies)

As a équipe SPAWT,
I want les tables `customers`, `plans` et `currencies` créées et seedées,
So that la fondation multi-pays / multi-devises est prête sans activer le paiement.

**Acceptance Criteria:**

**Given** une migration réversible
**When** elle est appliquée
**Then** `customers` (entité commerciale séparée, `customer_type`, `spawter_id`), `plans` (`code`, `label`, `price_ht`, `currency_id`, `country_code`, `period`, `is_active`) et `currencies` (`code` ISO 4217, `base_rate`, `modifier`, `country_code`, `is_active`) existent

**Given** les tables créées
**When** le seed Sprint 1 est exécuté
**Then** `plans` contient `gold_monthly` et `gold_annual` (CI/XOF) et `currencies` contient XOF avec `is_active = true`
**And** les hooks de conversion de devise sont présents mais inactifs en V1
**And** la RLS interdit l'accès public en écriture à ces 3 tables

### Story 1.7: Collecte de signaux append-only + wrapper analytics typé

As a équipe produit (Kidam),
I want la table `user_signals` append-only et un wrapper analytics typé,
So that chaque action significative est capturée et conforme à la taxonomie `events.md`.

**Acceptance Criteria:**

**Given** une migration
**When** elle est appliquée
**Then** `user_signals` existe (`spawter_id`, `signal_type`, `place_id`, `metadata` JSON, `created_at`) avec index `(spawter_id, created_at)` et `signal_type`, et un trigger Postgres bloque `UPDATE`/`DELETE` (append-only strict)
**And** la RLS sur `user_signals` est `spawter_id = auth.uid()`

**Given** `app/src/lib/analytics.ts`
**When** un event est émis
**Then** son nom et ses propriétés sont contraints par des union types TypeScript reflétant `documentation/analytics/events.md` — un event hors taxonomie ne compile pas
**And** les 9 types de signaux (spawt, review, view, save, share, search, filter, click, dismiss) sont représentables

### Story 1.8: Système de feature flags runtime

As a équipe SPAWT,
I want un système de feature flags activable au runtime par scope,
So that chaque feature merge derrière un flag sans nécessiter de branche longue durée.

**Acceptance Criteria:**

**Given** une migration
**When** elle est appliquée
**Then** `feature_flags(flag_code, spawter_id NULL, enabled, scope, expires_at NULL)` existe, avec les scopes `internal`/`alpha`/`beta`/`prod`

**Given** le hook `useFlag(code)`
**When** un composant l'appelle
**Then** il reçoit l'état du flag pour le scope et le spawter courants, avec un TTL de rafraîchissement < 60s
**And** un membre `spawt_staff` peut activer un flag pour un spawter spécifique (préparation alpha §5.8)
**And** aucun feature flag n'est posé sur les FR data-layer (FR-024 à FR-030) ni sur les NFR

## Epic 2: Entrée dans la Meute — auth, consent & calibrage du Palais

Un nouveau spawter crée son compte, donne son consentement ARTCI (verrou bloquant Loi 2013-450), calibre son Palais initial via 5 questions et entre dans l'app. La voix du Chat est introduite ici et réutilisée par toutes les surfaces ultérieures. Onboarding `OnbMidfi`, OTP only + Google Sign-In secondaire. Cible : 70% de complétion (SC-ACT-01).

### Story 2.1: Voix du Chat évolutive

As a spawter,
I want recevoir les messages du Chat avec un ton qui dépend de mon stade,
So that je ressens une présence familière qui mûrit avec moi.

**Acceptance Criteria:**

**Given** `chat-voice.ts`
**When** une voix UI est demandée
**Then** elle est résolue par un mapping `(stade × moment)` → clé i18n `fr.json`, jamais une string littérale
**And** aucune copy générique (« Welcome », « Find a place ») n'est utilisée

**Given** les 5 stades
**When** la voix est résolue
**Then** les 5 tons existent : `enjoue_taquin` (Touriste) → `complice` → `grave_respectueux` → `solennel` → `rare_sacre` (Guide)
**And** `CatBubble` expose 3 variants (`bubble`, `lockscreen`, `edito`)

**Given** une montée de stade
**When** elle survient
**Then** le ton du Chat change dans les 24h maximum

### Story 2.2: Splash & écran de consentement ARTCI bloquant

As a nouveau spawter,
I want un écran d'accueil puis un consentement explicite avant toute collecte,
So that j'entre dans l'app en confiance et conforme à la Loi 2013-450.

**Acceptance Criteria:**

**Given** le 1er lancement
**When** l'app s'ouvre
**Then** un Splash `gr-night` affiche « Entrer dans la Meute » et émet `onboarding_started` au tap

**Given** l'écran de consentement
**When** il s'affiche
**Then** 2 cases non pré-cochées sont présentées (CGU/CGV + collecte données/géoloc pour usage spawt uniquement), avec liens vers la politique de confidentialité et les CGU/CGV, et un `CatBubble` explique sans gronder

**Given** les 2 cases
**When** elles ne sont pas toutes deux cochées
**Then** le bouton « Continuer » est désactivé (gate bloquant non-punitif)

**Given** le consentement validé
**When** le spawter continue
**Then** `cgv_accepted_at` et `geoloc_consent_at` sont historisés sur `spawters` en timestamps distincts, et `consent_recorded` est émis par bloc

### Story 2.3: Authentification par OTP + Google Sign-In

As a nouveau spawter,
I want créer mon compte via mon numéro de téléphone + OTP,
So that je m'inscris avec la méthode standard en Côte d'Ivoire.

**Acceptance Criteria:**

**Given** l'écran téléphone
**When** je saisis un numéro CIV
**Then** un OTP 6 chiffres est envoyé via Twilio Verify / Termii, délivré < 30s pour 95% des envois, et `auth_otp_sent` est émis

**Given** `OtpInput` (6 cases, auto-advance)
**When** je saisis le code
**Then** un code valide ouvre une session JWT Supabase Auth et émet `auth_otp_validated` + `auth_signed_in` ; un code invalide est réessayable (< 3 essais avant friction) ; un renvoi ou changement de numéro est possible

**Given** les méthodes d'authentification
**When** l'écran de connexion s'affiche
**Then** Google Sign-In est disponible en méthode secondaire et Sign in with Apple est exposé en option équivalente (exigence Apple §4.0)
**And** aucune méthode email+password n'est disponible (drift D1)

**Given** le mode démo (Expo Go)
**When** l'écran téléphone est utilisé
**Then** `(onboarding)/phone.tsx` reste un stub fonctionnel sans OTP réel

### Story 2.4: Saisie du profil & PII démographiques

As a nouveau spawter,
I want renseigner mon profil et mes données démographiques,
So that mon identité de base est posée et le produit peut mesurer ses cohortes.

**Acceptance Criteria:**

**Given** l'écran profil
**When** je le complète
**Then** je saisis nom, quartier de résidence, cuisine préférée, budget habituel, contexte (solo/groupe), `country_code`, `origin_country_code`, `gender`, `age_range`

**Given** l'écran profil validé
**When** je continue
**Then** ces champs sont écrits sur la ligne `spawters` (amendement 4.5)

**Given** la collecte de PII
**When** l'écran demande `gender`/`age_range`/`origin_country_code`
**Then** le wording rend explicite leur usage (cohérent avec le consentement FR-040)
**And** le brouillon est persisté dans `onboarding-draft` (éphémère) ; une réouverture de l'app reprend proprement via `RouteGuard`

### Story 2.5: Calibrage du Palais en 5 questions

As a nouveau spawter,
I want répondre à 5 questions visuelles de calibrage,
So that mon Palais initial reflète mes goûts dès le départ.

**Acceptance Criteria:**

**Given** l'onboarding `OnbMidfi` (cartes visuelles multi-select, `OnbCard` + `OnbStep` avec barre de progression segmentée)
**When** je réponds aux 5 questions (une par axe : Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table)
**Then** chaque réponse émet `calibration_answered` avec `axis`, `direction`, `value` (`-0.4`/`0`/`+0.4`)

**Given** les 5 réponses données
**When** le calibrage se termine
**Then** un `UserPalais` initial est calculé avec des scores par axe entre -40 et +40, la table `user_palais` est créée par migration (politique overwrite, RLS `spawter_id = auth.uid()`)

**Given** un abandon de l'app en cours de calibrage
**When** l'app est rouverte
**Then** `onboarding-draft` conserve l'état et `RouteGuard` reprend à la bonne étape
**And** le flow `Onb1-5` (quartier/style/budget/mode) est écarté du Sprint 1 (décision D10)

### Story 2.6: Présentation du Palais initial & premier titre

As a nouveau spawter,
I want voir mon Palais initial et recevoir mon premier titre,
So that je ressens « c'est moi ça » et j'entre dans la Meute.

**Acceptance Criteria:**

**Given** le calibrage terminé
**When** l'écran final s'affiche
**Then** il présente le `PalaisRadar` initial et le premier titre attribué, porté par la voix du Chat ton Touriste (`enjoue_taquin`)

**Given** l'écran final validé
**When** le spawter continue
**Then** le `Spawter` et le `UserPalais` sont commités atomiquement en local (store + AsyncStorage) puis synchronisés en fire-and-forget vers Supabase, et `onboarding_completed` est émis (`country_code`, `age_range`, `gender`, `time_to_complete_seconds`, `palais_initial_dominant_axes`)
**And** `RouteGuard` redirige vers `HomeD` (groupe `(tabs)`)
**And** l'écran passe le Test Tantie Rose avant sign-off Alexandre

## Epic 3: Découverte — Home, feed, fiche lieu, recherche & favoris

Le spawter explore les lieux scorés pour son Palais, consulte des fiches détaillées, cherche/filtre, sauvegarde en favori et partage sur WhatsApp. Home `HomeD` (stories de modes + carrousel de Unes), navigation 5 onglets, score composite `[50%, 99%]`, note pondérée par stade. L'épic fonctionne sur les seeds (`SEED_PLACES`) — autonome sans l'Epic 6.

### Story 3.1: Navigation 5 onglets & FAB Spawter

As a spawter,
I want naviguer dans l'app via une barre à 5 onglets,
So that j'accède à toutes les surfaces et au geste central depuis n'importe où.

**Acceptance Criteria:**

**Given** le groupe `(tabs)`
**When** l'app est montée
**Then** la `TabBar` 78px affiche Feed · Carte · [FAB + Spawter] · Meute · Palais ; l'onglet actif est en `--spawt-black` avec `stroke-width 2`

**Given** le FAB central
**When** la `TabBar` est rendue
**Then** c'est un bouton rond noir 48px (icône `plus` or, débord -22px) qui porte l'action Spawter

**Given** les onglets Carte et Meute hors scope Sprint 1
**When** ils sont ouverts
**Then** ils affichent un `EmptyState` « le chat tousse » plutôt qu'un écran cassé
**And** `RouteGuard` reste passif (observe le store, redirige) et ne porte aucune logique métier

### Story 3.2: Note communautaire pondérée par stade

As a spawter,
I want que la note affichée d'un lieu reflète la maturité de ceux qui ont voté,
So that je fais confiance à une note qui n'est pas plate.

**Acceptance Criteria:**

**Given** une fonction pure de calcul
**When** elle reçoit des avis
**Then** elle retourne `note_affichée = Σ(note × poids_stade) / Σ(poids_stade)` avec poids Touriste 1x / Explorateur 1,5x / Détective 2x / Djidji 2,5x / Guide 3x

**Given** un nouvel avis
**When** il est intégré
**Then** la note se recalcule incrémentalement (pas from scratch) et est stockée sur `place_adn.weighted_rating`

**Given** la fonction de calcul
**When** elle est testée
**Then** elle est sans I/O et testable unitairement (moteur pur `lib/`)

> **Note de découpage (erratum readiness 2026-05-14)** : la story 3.3 d'origine (schéma + adapter + Home UI + moteur de score + perf feed) était surdimensionnée. Découpée en **3.3a / 3.3b / 3.3c** ci-dessous. 3.3a et 3.3b sont indépendantes l'une de l'autre ; 3.3c les consomme (dépendance arrière intra-epic).

### Story 3.3a: Schéma `places` / `place_adn` & adapter data-source

As a développeur SPAWT,
I want les tables `places` / `place_adn` et l'adapter `data-source` en place,
So that les écrans consomment les lieux via la règle d'or sans jamais toucher Supabase directement.

**Acceptance Criteria:**

**Given** une migration
**When** appliquée
**Then** `places` et `place_adn` existent (1:1, joints via `select("*, place_adn(*)")`), avec filtre `is_published` côté client ET RLS serveur

**Given** `lib/data-source.ts`
**When** un écran demande des lieux
**Then** il passe toujours par l'adapter qui retourne `{ mode, data }` ; `data-source.supabase.ts` est chargé en `await import()` ; en l'absence d'env vars le mode est `fallback` sur `SEED_PLACES`

### Story 3.3b: Moteur de score composite `matching.ts`

As a spawter,
I want que les lieux soient classés selon mon Palais,
So that le feed me propose d'abord ce qui me correspond.

**Acceptance Criteria:**

**Given** le moteur pur `matching.ts` (sans I/O, total, cible #1 des tests unitaires)
**When** il calcule le score d'un lieu
**Then** il applique `0,15·cosine + 0,30·distance + 0,30·note_pondérée + 0,10·recency + 0,15·novelty`, affiché borné `[50%, 99%]` via `50 + score·49`

**Given** une liste de lieux
**When** elle est ordonnée
**Then** `matching.ts` ranke les Unes et le feuilleton de façon déterministe, sans effet de bord

### Story 3.3c: Home `HomeD` & feed personnalisé

As a spawter,
I want un Home éditorial qui me propose des lieux classés selon mon Palais,
So that je décide où manger en quelques minutes au lieu de 45.

**Acceptance Criteria:**

**Given** `HomeD` (consomme l'adapter de 3.3a et le moteur de 3.3b)
**When** il s'affiche
**Then** il présente un masthead daté, `ModeStories` (chips 44px « JE SORS POUR… », `radiogroup`), un `UneCarousel` swipeable de `UneCard`, un édito du Chat et un feuilleton de `PlaceCard`

**Given** un spawter en zone Abidjan
**When** le feed se charge
**Then** il retourne ≥ 10 lieux ordonnés par `matching.ts` (Story 3.3b), le time-to-first-feed est < 3s P95 sur 3G (NFR-PERF-01), et `feed_viewed` / `feed_card_impressed` / `feed_card_clicked` sont émis
**And** le `HomeContextuel` (drill-down par mode) est reporté V1.5 (décision D11)

### Story 3.4: Fiche lieu détaillée

As a spawter,
I want consulter la fiche complète d'un lieu,
So that j'ai toute l'information pour décider d'y aller.

**Acceptance Criteria:**

**Given** un tap sur une carte du feed
**When** la fiche `place/[id]` s'ouvre
**Then** elle s'affiche en < 2s (NFR-PERF-02) et présente : photo hero, nom (Klinsman), quartier, cuisine, fourchette de prix FCFA, note pondérée 1-5, horaires, adresse descriptive, boutons Appeler + WhatsApp, score de matching, signaux spéciaux

**Given** un lieu avec ≥ 5 avis publics
**When** la fiche est rendue
**Then** l'ADN est affiché en `AdnTags` (chips, pas radar)

**Given** un lieu avec < 5 avis publics OU `confidence_score < 0,3`
**When** la fiche est rendue
**Then** « ADN en construction » / « En construction » est affiché à la place d'un ADN non fiable ; les avis `is_seed` alimentent le calcul mais sont exclus du compteur public

**Given** la fiche affichée
**When** le spawter interagit
**Then** `place_viewed`, `place_call_tapped`, `place_whatsapp_tapped`, `adn_under_construction_seen` sont émis et l'écran a une seule action primaire (sticky CTA bas)

### Story 3.5: Recherche & filtres

As a spawter,
I want rechercher un lieu par texte et appliquer des filtres,
So that je trouve rapidement un spot précis.

**Acceptance Criteria:**

**Given** la `SearchBar` (arrondie `r 24`, placeholder « Cherche un spot, un plat, une zone… »)
**When** je saisis une requête
**Then** elle cherche sur nom, cuisine et quartier, et l'état vide affiche récents + suggestions du Chat + cuisines

**Given** `FilterChips` + `FilterSheet`
**When** j'applique des filtres (cuisine, budget 3 tranches, distance, note minimale)
**Then** ils se combinent en AND et le CTA « Voir N spots » est live

**Given** une recherche sur 3G
**When** les résultats s'affichent
**Then** ils apparaissent en < 1,5s
**And** `search_submitted` (`query`, `filters`, `results_count`) et `filter_applied` sont émis

### Story 3.6: Sauvegarde de lieux (favoris)

As a spawter,
I want sauvegarder un lieu dans ma liste personnelle,
So that je retrouve facilement les spots qui m'intéressent.

**Acceptance Criteria:**

**Given** la fiche lieu
**When** je tape le toggle de sauvegarde
**Then** l'ajout/retrait prend effet en < 500ms (local-first) et émet `place_saved` / `place_unsaved`

**Given** mon profil
**When** je consulte ma liste
**Then** les lieux sauvegardés sont présentés en `ListeCard`

**Given** le score composite
**When** un favori existe
**Then** il est utilisé comme signal de matching dans le calcul (FR-004)
**And** le libellé de la liste est « Mes spots » / « Ma liste » (favoris renommés — décision D5) ; « Tanière » (cercle privé) n'est pas ce concept et reste hors Sprint 1

### Story 3.7: Partage WhatsApp

As a spawter,
I want partager une fiche lieu sur WhatsApp,
So that je transmets une bonne adresse à un proche et fais grandir la Meute.

**Acceptance Criteria:**

**Given** la fiche lieu
**When** je tape « Partager »
**Then** le `ShareSheet` génère un deep link sortant dont le payload contient image + nom + note pondérée + lien, et le partage s'effectue en < 5s

**Given** un destinataire sans l'app
**When** il ouvre le deep link
**Then** il est redirigé vers le store approprié
**And** `share_initiated` et `share_completed` sont émis (`place_id`, `surface`)

## Epic 4: Le Spawt — Le Guet, avis structuré & apprentissage du Palais

Le spawter prouve sa présence physique via Le Guet (geofence 10m, timer 15min, snooze ×3, modes actif/passif/manuel), donne un avis structuré ; son Palais et l'ADN du lieu s'enrichissent. Brique data centrale et point d'activation produit. La table `spawt_checkin` est créée dans la story 4.1.

### Story 4.1: Le Guet — armement, geofence & GuetIndicator

As a spawter,
I want que le Chat détecte automatiquement mon arrivée dans un lieu,
So that ma présence est prouvée sans que j'aie rien à faire pendant le repas.

**Acceptance Criteria:**

**Given** une migration
**When** appliquée
**Then** `spawt_checkin` existe (champs `app/src/types/spawt.ts` : `arrived_at`, `notified_at`, `snooze_count`, `checked_in_at`, `left_at`, `check_in_type`, `geolocation_*`, `accuracy_meters`, `is_verified`, `flag_reason`, avis attaché, `is_seed`) avec RLS `spawter_id = auth.uid()` et les constantes `ANTIFRAUD_RULES`

**Given** le consentement géoloc donné (FR-040) et Le Guet armé
**When** un lieu de la base entre dans le rayon
**Then** une entrée dans le périmètre 10m (NFR-GEO-01) est détectée par moyenne des 3 dernières positions GPS sur 30s (NFR-GEO-03) et émet `guet_armed` puis `guet_geofence_triggered`

**Given** l'entrée détectée
**When** le spawter est en zone
**Then** le `GuetIndicator` apparaît (pastille verte pulsée + « Le Chat fait le guet chez {place_name}… », `accessibilityLiveRegion="polite"`)

**Given** le mode démo (Expo Go, Le Guet non armé)
**When** la fiche lieu est ouverte
**Then** un CTA manuel « Je spawt ici » remplace l'automatique, cadré comme « aperçu du geste » via `DataSourceBanner`

### Story 4.2: Notification Le Guet, confirmation du spawt & badge Premier Spawt

As a spawter,
I want être sollicité au bon moment pour confirmer ma visite en 1 tap,
So that je valide mon spawt sans effort à la fin du repas.

**Acceptance Criteria:**

**Given** 15 min de présence en zone
**When** le seuil est atteint
**Then** `guet_threshold_reached` est émis et une notification locale « Comment c'était chez {place_name} ? » (clé i18n `notif.guet.prompt`, copy « Le Guet » et non « VTC ») est envoyée < 30s du trigger quand réseau présent (NFR-PERF-04)

**Given** la notification
**When** je tape « snooze »
**Then** elle se reprogramme 15 min plus tard, répétable 3 fois maximum ; la fenêtre de notation reste active pendant la présence + 30 min après sortie

**Given** un tap sur la notification
**When** je confirme
**Then** un spawt `check_in_type: active` est persisté en < 500ms (NFR-PERF-03) ; une géoloc imprécise > 30m bascule en mode manuel et ajuste `is_verified` (NFR-GEO-02) ; une batterie < 10% force le mode manuel (NFR-GEO-04) ; aucune réponse mais présence prouvée → spawt `passive` poids 0,5x

**Given** le tout premier spawt vérifié
**When** il est confirmé
**Then** le badge `Premier Spawt` est attribué en < 5s et le verrou d'accès aux avis détaillés est levé
**And** `spawt_completed`, `spawt_snoozed`, `spawt_passive_recorded`, `spawt_first_completed` sont émis

### Story 4.3: Offline queue des spawts & résilience réseau

As a spawter,
I want que mes spawts soient enregistrés même sans réseau,
So that je ne perds jamais une visite à cause d'une coupure 3G.

**Acceptance Criteria:**

**Given** une perte de connectivité
**When** un spawt est détecté ou confirmé
**Then** il est enregistré localement (store + AsyncStorage) et synchronisé automatiquement avec Supabase sous 60s du retour réseau (NFR-AVAIL-02)

**Given** une coupure < 24h
**When** le réseau revient
**Then** aucun spawt n'est perdu

**Given** Profil → Paramètres
**When** je consulte la file de synchronisation
**Then** elle est inspectable et purgeable
**And** aucun message d'erreur agressif n'est affiché en cas de coupure (queue transparente)

### Story 4.4: Anti-fraude technique — 6 triggers SQL

As a équipe SPAWT (Stéphanie/Kidam),
I want les 6 règles anti-fraude appliquées côté serveur,
So that les spawts fictifs ne poisonnent pas durablement l'ADN et le Palais.

**Acceptance Criteria:**

**Given** des triggers SQL sur `spawt_checkin`
**When** un spawt est inséré
**Then** sont appliquées : rejet < 4h même lieu (NFR-FRAUD-01), flag > 5 spawts/jour (NFR-FRAUD-02), flag vitesse > 100 km/h entre 2 spawts (NFR-FRAUD-03), poids 0,5x si `is_verified = false` (NFR-FRAUD-04), flag 10+ patterns identiques en 7j glissants (NFR-FRAUD-05), flag `left_at - arrived_at < 5 min` ET `active` (NFR-FRAUD-06)

**Given** une règle déclenchée
**When** elle s'applique
**Then** `flag_reason` est posé sur la ligne et `antifraud_flag_raised` est émis

**Given** un spawter honnête
**When** il spawte normalement
**Then** l'anti-fraude est silencieuse (aucun workflow humain — Feature 17 reportée)
**And** la duplication client (`ANTIFRAUD_RULES`) reste purement informative

### Story 4.5: Avis structuré post-spawt

As a spawter,
I want donner un avis structuré après mon spawt,
So that j'enrichis le produit pour les autres spawters.

**Acceptance Criteria:**

**Given** le `SpawtSheet` / `ReviewForm` ouvert après confirmation du spawt
**When** je note
**Then** une note 1-5 étoiles est obligatoire (CTA désactivé tant que vide), des tags rapides multi-select (`chip-dark` toggle), un texte libre ≤ 500c et 0-3 photos optionnelles sont disponibles

**Given** des photos ajoutées
**When** elles sont uploadées
**Then** elles sont compressées à 80% qualité / 1 MB max et stockées dans le bucket `place-photos` (RLS écriture limitée au sous-dossier `<spawter_id>/<spawt_id>/`)

**Given** l'avis soumis
**When** il est enregistré
**Then** il est attaché au `SpawtCheckin`, soumis en < 2 min, et `review_started` / `review_submitted` / `review_photo_added` / `review_abandoned` sont émis
**And** un avis peut être différé (« Plus tard » → spawt sans avis, possible plus tard depuis la fiche spawt)

### Story 4.6: Apprentissage du Palais par décroissance exponentielle

As a spawter,
I want que mon Palais se mette à jour à chaque avis,
So that mon profil de goût reflète mon comportement réel et n'est jamais figé.

**Acceptance Criteria:**

**Given** `palais-engine.ts` (moteur pur, sans I/O)
**When** un avis est donné
**Then** le Palais se recalcule incrémentalement : `learningFactor = max(0,05, 1/(1 + n_spots × 0,05))`, `delta = signal × learningFactor`, `nouveau_score = clamp(ancien ± delta, -100, +100)`, signaux selon le mapping PRD §20.5

**Given** la mise à jour
**When** elle est appliquée
**Then** `dominant_axes` et `confidence_score` sont recalculés et stockés sur `user_palais` (politique overwrite — amendement 4.6), via les actions du store (pas de `set()` direct)

**Given** `confidence_score < 0,3`
**When** le Palais est affiché
**Then** « En construction » est montré (jamais un radar non fiable)
**And** `palais_updated` est émis (`confidence_score`, `dominant_axes`, `total_spawts`)

### Story 4.7: Mise à jour de l'ADN du Lieu

As a spawter,
I want que mon avis enrichisse l'ADN du lieu visité,
So that les profils de lieux se construisent organiquement par la communauté.

**Acceptance Criteria:**

**Given** un avis publié
**When** il est intégré
**Then** l'ADN se met à jour à partir des sous-critères + tags mappés vers les 5 axes ADN, et le `confidence_score` reflète la fiabilité selon le nombre total d'avis (seed + communauté)

**Given** des avis `is_seed = true`
**When** l'ADN est calculé
**Then** ils alimentent l'ADN mais sont exclus du compteur public d'avis

**Given** un lieu avec < 5 avis publics
**When** la fiche est rendue
**Then** « ADN en construction » est affiché
**And** les check-ins simples (sans avis) ne modifient pas l'ADN

### Story 4.8: Refactor date_of_birth dynamique (Epic 4 PASS 2 — retour user 2026-05-20 point #2)

As a spawter,
I want pouvoir saisir ma date de naissance précise plutôt qu'une tranche d'âge figée,
So that le Chat puisse me souhaiter mon anniversaire et que les KPIs démographiques restent calculables côté funnel.

**Acceptance Criteria:**

**Given** la table `spawters` (Story 2.4 + migration 0020)
**When** un spawter complète l'onboarding profile
**Then** `date_of_birth` est persisté ET `age_range` est calculé via helper pur `ageRangeFromDateOfBirth()` au moment du finalize

**Given** un âge < 13 ans calculé depuis la date saisie
**When** la validation du formulaire s'exécute
**Then** l'onboarding refuse de continuer avec message dédié

**Given** un row spawter pré-existant Sprint 1 alpha (`date_of_birth = null`)
**When** la story est livrée
**Then** la lecture ne casse pas (champ nullable, helper tolère null)

### Story 4.9: Place page refonte + reviews fetch (Epic 4 PASS 2 — retour user 2026-05-20 point #10)

As a spawter sur la fiche d'un lieu,
I want voir les avis des autres spawters et lire clairement la note + le budget,
So that je puisse décider d'aller au lieu sans ouvrir 3 onglets et comprendre la confiance communautaire.

**Acceptance Criteria:**

**Given** une fiche lieu avec au moins 1 avis seeded (`is_seed = true`) ou communauté
**When** la fiche est ouverte
**Then** la section « Ce qu'en dit la bande » affiche jusqu'à 5 reviews (avatar + nom + étoiles + texte + badge `Avis fondateur` si seed)

**Given** le header de la fiche
**When** la story est livrée
**Then** la taille typo du rating et du price tier est en `h2` (lisible à 1m)
**And** le heart toggle (favori) est différencié visuellement et textuellement du chip Coup de Cœur

**Given** le bouton WhatsApp
**When** il est rendu
**Then** son label est « Réserver via WhatsApp » avec icône explicite (calendar ou similaire)

### Story 4.10: Onglet Spawter géolocalisé (Epic 4 PASS 2 — retour user 2026-05-20 point #14)

As a spawter qui ouvre l'app pour faire un spawt rapide,
I want voir directement les 5 lieux les plus proches de moi et taper « Spawter ici » en 1 geste,
So that je n'aie pas à scroller le feed, ouvrir une fiche, descendre au sticky CTA pour valider mon passage.

**Acceptance Criteria:**

**Given** la permission géoloc accordée
**When** je tape le FAB central de la tab bar
**Then** l'écran Spawter affiche les 5 lieux publiés les plus proches dans un rayon de 2km, triés ascendant par distance

**Given** un lieu à moins de 100m
**When** je tape « Spawter ici »
**Then** un `SpawtCheckin` est créé avec `is_verified = true`, sync fire-and-forget Supabase + navigation vers la modal review

**Given** un lieu entre 100m et 2km
**When** je tape « Spawter ici »
**Then** un `SpawtCheckin` est créé avec `is_verified = false` (poids 0.5x — PRD §7.2), même flow review

**Given** la permission géoloc refusée
**When** l'écran s'ouvre
**Then** un message explicite + bouton Settings est affiché (jamais d'écran vide silencieux)

### Story 4.12: Fiche lieu v2 — carte, horaires par jour, galerie & tous les avis (Sprint Change Proposal v2 — 2026-06-02 §4.6)

As a spawter sur la fiche d'un lieu,
I want voir la carte du lieu, ses horaires jour par jour, une galerie photos et accéder à tous les avis,
So that je décide d'y aller sans deviner l'emplacement ni l'ouverture, et sans me limiter à 5 avis.

**Acceptance Criteria** (détail figé dans `sprint-change-proposal-2026-06-02.md` §4.6 + story file `4-12-*.md`) :

**Given** `place.location` (lat/lng)
**When** la fiche est rendue
**Then** une carte **statique** (image, pas de dep native) centrée sur le lieu s'affiche, tappable vers le deeplink `geo:` natif ; fallback adresse texte si pas de coords/réseau

**Given** `place.hours` (JSONB déjà peuplé) et `place.gallery_urls` (TEXT[] déjà peuplé)
**When** la fiche est rendue
**Then** les 7 jours d'horaires sont affichés (jour courant mis en évidence, « Fermé » si vide) et une galerie d'au moins 3 slots est rendue (placeholders si < 3) — **zéro migration**

**Given** un lieu avec plus de 5 avis
**When** je tape « Voir tous les avis (N) »
**Then** je navigue vers la nouvelle route `app/app/place/[id]/reviews.tsx` listant tous les avis (réutilise le rendu d'avis existant)

## Epic 5: Identité du spawter — profil, Palais radar & stades

Le spawter consulte son identité (carte spawter flip, radar Palais, collection de titres permanente, titre affiché choisi librement), voit son Palais évoluer et monte de stade lors d'un moment quasi-rituel non gamifié. Identité avant utilité — moat de rétention. `spawter_progression` est créée en 5.1, `collection_titres` en 5.2.

### Story 5.1: Progression par stades & recompute

As a spawter,
I want progresser automatiquement à travers les 5 stades selon mes spots uniques,
So that ma maturité dans la Meute reflète mon exploration réelle.

**Acceptance Criteria:**

**Given** une migration
**When** appliquée
**Then** `spawter_progression` existe (politique overwrite — amendement 4.6) avec RLS `spawter_id = auth.uid()`

**Given** un spawt vérifié
**When** le store recalcule
**Then** `unique_spots = Set(spawts.filter(is_verified).map(place_id)).size` puis `getStade(unique_spots)` applique les bornes Touriste 0-10 / Explorateur 11-20 / Détective 21-30 / Djidji 31-50 / Guide 50+ (un même lieu compte pour 1 spot)

**Given** l'invariant « la maturité ne recule jamais » (PRD §5.2)
**When** un recompute survient
**Then** aucun chemin (store ou SQL) ne peut faire reculer le `stade`
**And** `stade_unlocked` est émis à chaque seuil franchi (`from_stade`, `to_stade`, `unique_spots`)

### Story 5.2: Collection de titres & titre affiché

As a spawter,
I want conserver une collection permanente de titres et choisir celui que j'affiche,
So that mon identité m'appartient et n'est pas dictée par un algorithme.

**Acceptance Criteria:**

**Given** une migration
**When** appliquée
**Then** `collection_titres` existe en politique append (mémoire d'identité — amendement 4.6) avec RLS `spawter_id = auth.uid()`

**Given** une montée de stade ou une mue
**When** elle survient
**Then** un titre est ajouté à la collection permanente (jamais retiré)

**Given** ma collection
**When** je consulte mes titres
**Then** je peux choisir librement le titre affiché, distinct du titre actuel calculé automatiquement
**And** Sprint 1 = 1 seul badge `Premier Spawt`, les « Jalons » multiples sont reportés V1.5+ (décision D4), « paws » reste un compteur non-convertible (pas de +50% Gold) et « reconnaissances » reste non-public (décisions D2/D3, garde-fous Contrat à la Tribu)

### Story 5.3: Profil spawter & carte spawter flip

As a spawter,
I want consulter mon profil avec mon Palais et ma carte d'identité,
So that mon profil est un objet de fierté quotidien, pas un onglet caché.

**Acceptance Criteria:**

**Given** l'onglet Palais
**When** il s'ouvre
**Then** la `SpawterCard` affiche le recto `gr-night` (rang, n°, avatar, nom, titre, citation, stats héro) et le verso `bg-warm` (`PalaisRadar` 5 axes + 2 axes dominants) avec flip 3D au tap ; l'écran s'ouvre en < 1,5s

**Given** les 5 axes du Palais
**When** le radar est rendu
**Then** ils sont les axes canoniques (Racines/Horizons, Tanière/Nomade, Exigeant/Enthousiaste, Foule/Secret, Maquis/Table — drift D8) ; le radar montre 2 axes en accès gratuit et 5 axes complets pour les Spawter Gold

**Given** `confidence_score < 0,3`
**When** le radar est rendu
**Then** « En construction » est affiché plutôt qu'un radar non fiable

**Given** le profil
**When** il est rendu
**Then** il présente nom, avatar, quartier, stade actuel, titre actuel + titre affiché, nombre de spawts/avis, lieux sauvegardés, collection de titres, et des quick links (Mes spots, spawts, réglages)

### Story 5.4: Célébration de montée de stade

As a spawter,
I want vivre un moment marquant quand je monte de stade,
So that je ressens mon appartenance grandir sans être gamifié.

**Acceptance Criteria:**

**Given** un franchissement de seuil (11/21/31/51 spots uniques)
**When** il survient
**Then** l'écran `StadeCelebration` plein écran `gr-night` + `pattern-dots-gold` + halo s'affiche : gros `CatIcon`, ancien stade barré → nouveau en or, mot du Chat, barre de progression

**Given** la célébration
**When** elle est rendue
**Then** elle est sans son « ding » ni confettis — ton solennel quasi-rituel (anti-Duolingo, Experience Principle #5)

**Given** la montée de stade
**When** elle est célébrée
**Then** le ton de la voix du Chat change dans les 24h suivantes
**And** l'écran passe le Test Tantie Rose avant sign-off Alexandre

## Epic 6: Panel admin & opération de contenu

L'équipe SPAWT (`spawt_staff`) gère les lieux via un panel web (CRUD), pré-charge l'inventaire initial (50-100 lieux dont 20 Mission 1) et les avis fondateurs (`is_seed`), et consulte les métriques basiques. Codebase web séparée (React + Refine/AdminJS), auth distincte des spawters publics, actions critiques auditées. **Dépendances :** schéma de l'Epic 1 **+** migration `places` / `place_adn` (Story 3.3a, Epic 3) — les Stories 6.2 (CRUD lieux) et 6.3 (pré-chargement) opèrent sur ces tables. Epic 6 est donc séquencé **après l'Epic 3** ; par ailleurs autonome (aucune dépendance aux features mobiles user-facing).

### Story 6.1: Authentification & shell du panel admin

As a membre `spawt_staff`,
I want me connecter à un panel admin web sécurisé,
So that seule l'équipe interne accède aux outils d'administration.

**Acceptance Criteria:**

**Given** le dépôt admin greenfield (aucune codebase `spawt-admin/` existante)
**When** la première story de l'Epic 6 démarre
**Then** la codebase `spawt-admin/` est initialisée via `npm create refine-app@latest -- --preset refine-supabase spawt-admin` (Refine v5 + Vite + TS), et `src/utility/supabaseClient.ts` est recâblé sur les env vars `spawt-admin` — jamais le `service_role_key` côté client

**Given** le panel admin web
**When** un membre `spawt_staff` se connecte
**Then** l'authentification utilise des credentials distincts de ceux des spawters publics

**Given** un compte spawter public
**When** il tente d'accéder au panel
**Then** l'accès est refusé (restreint à `spawt_staff` — séparation amendement 4.1)

**Given** le shell du panel
**When** il est rendu
**Then** il expose une navigation vers les sections Lieux, Modération, Comptes, Métriques

### Story 6.2: CRUD des lieux

As a membre `spawt_staff`,
I want créer, lire, modifier et supprimer des lieux et leurs métadonnées,
So that l'inventaire de lieux est tenu à jour par l'équipe.

**Acceptance Criteria:**

**Given** la section Lieux
**When** je crée ou édite un lieu
**Then** je gère ses métadonnées (photo, nom, quartier, cuisine, fourchette de prix, horaires, adresse, géoloc, `is_published`) ainsi que son `place_adn`

**Given** un lieu
**When** je le supprime ou le dépublie
**Then** l'action prend effet et un lieu non publié n'apparaît plus dans le feed mobile

**Given** les actions de CRUD
**When** elles sont effectuées
**Then** elles sont tracées avec horodatage et auteur `spawt_staff_id`

### Story 6.3: Pré-chargement de l'inventaire initial + avis fondateurs

As a membre `spawt_staff` / Ally terrain,
I want pré-charger l'inventaire initial et 3 avis fondateurs par lieu,
So that aucun spawter n'arrive sur une carte vide au lancement.

**Acceptance Criteria:**

**Given** la Phase 0-4
**When** l'inventaire est pré-chargé
**Then** 50-100 lieux existent dont 20 onboardés en Mission 1 (5 Date night/Premium, 5 Dabali/Racines, 3 Boys/Barbecue, 3 Nouveaux, 2 Hype, 2 Sceptiques), chacun avec ses métadonnées minimales

**Given** chaque lieu pré-chargé
**When** les avis fondateurs sont saisis
**Then** 3 avis `is_seed = true` par lieu sont créés (150-300 avis seed au total) ; ils alimentent l'ADN mais sont exclus du compteur public

**Given** le panel admin
**When** un membre `spawt_staff` consulte les avis d'un lieu
**Then** « avis fondateur » est distingué visuellement de « avis communauté »

### Story 6.4: Modération des avis & gestion des comptes

As a membre `spawt_staff`,
I want modérer les avis et gérer les comptes spawter,
So that la qualité communautaire et le Contrat à la Tribu sont protégés.

**Acceptance Criteria:**

**Given** la file de modération
**When** je la consulte
**Then** elle est triée par ancienneté et permet les actions garder / supprimer / warning / ban sur un avis

**Given** un compte spawter
**When** je le modère
**Then** je peux appliquer warning ou ban

**Given** une action critique (ban)
**When** elle est appliquée
**Then** elle est auditée avec horodatage, auteur `spawt_staff_id` et motif
**And** le branchement de la file sur les signalements spawter (bouton « Signaler » mobile) est reporté Sprint 2 (FR-017) — en Sprint 1 la modération est proactive

### Story 6.5: Tableau de métriques basiques

As a membre `spawt_staff`,
I want consulter les métriques basiques du produit,
So that l'équipe suit l'activité sans attendre les dashboards analytics complets.

**Acceptance Criteria:**

**Given** la section Métriques
**When** je l'ouvre
**Then** elle affiche le nombre de spawters, les spawts/jour et les avis/jour

**Given** les métriques affichées
**When** elles sont calculées
**Then** elles le sont sur les données Supabase courantes (pas un dashboard analytics tiers — celui-ci arrive avec Madame Sun)

## Epic 7: Release ops & versioning (Sprint Change Proposal v2 — 2026-06-02)

Outillage de release pour l'alpha : un schéma de versioning clair, un journal des builds publiés côté testeur, et la surface in-app du build courant. Objectif : un testeur doit pouvoir **citer le build exact** (`v1.0.0 — build 2`) dans un bug report, et l'équipe doit pouvoir tracer quel APK correspond. Transverse infra + 1 primitif UI ; aucune dépendance produit ; **zéro migration**.

### Story 7.1: Versioning, RELEASES.md & BuildBadge in-app

As a testeur alpha de SPAWT (et l'équipe qui traite ses bug reports),
I want un schéma de version clair, un journal des builds publiés et le numéro de build visible dans l'app,
So that je puisse citer le build exact en bug report et que l'équipe sache de quel APK je parle.

**Acceptance Criteria** (détail figé dans `sprint-change-proposal-2026-06-02.md` §4.7 + story file `7-1-*.md`) :

**Given** la config EAS/Expo
**When** Story 7.1 est livrée
**Then** le schéma est acté : `version` figée `1.0.0` ; `versionCode`/`buildNumber` = entier incrémental N par APK ; format `v1.0.0 — build N (YYYY-MM-DD)` ; tag CI `build-android-YYYY-MM-DD-N` ; source runtime `Application.nativeBuildVersion` (expo-application) + `EXPO_PUBLIC_BUILD_DATE`

**Given** le repo
**When** Story 7.1 est livrée
**Then** un `RELEASES.md` racine (vue testeur, distinct de `CHANGELOG.md`) existe avec 2 entrées backfill (build 1 = `build-android-2026-05-28` commit b92fbf1 ; build 2 = `build-android-2026-06-01` commit 67851ec)

**Given** un testeur dans l'app
**When** il ouvre l'écran profil / « À propos »
**Then** un `BuildBadge` affiche `v1.0.0 — build N (date)`, copiable, avec fallback gracieux (`build —`) si les valeurs natives manquent (dev/Expo Go)
