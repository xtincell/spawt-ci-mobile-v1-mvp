# Plan de finalisation MVP — SPAWT iOS & Android

Date : 2026-07-01 · Auteur : Claude (mandat carte blanche) · Statut : EN COURS
⚠️ 2026-07-01 : migration DB vers Coolify annoncée par l'équipe en cours de
chantier — voir HUMAN_TODO.md §URGENT. Les migrations/le code restent valides
dans le scénario Supabase self-hosted (le plus probable).
Branche : `claude/ios-android-final-version-5vad3n` (base `spawt/v1-bmad`)

## Objectif

**MVP tech-complet** : les 12 features Sprint 1 réellement fonctionnelles de bout en bout (pas seulement "en review"), plus le câblage des mécaniques laissées débranchées, plus tout ce qu'il faut pour produire un APK/AAB Android et un IPA iOS prêts à installer. La part humaine (comptes, secrets, juriste, sign-offs) est isolée dans `HUMAN_TODO.md` et ne bloque pas le travail tech.

## Décisions de périmètre (carte blanche, contestables par l'équipe)

**Dans le MVP :**
1. Le Guet câblé bout-en-bout (armement → géofence → timer → notif → confirmation/passif), flag activé pour beta. *La promesse centrale du produit ne peut pas rester débranchée dans un "MVP".*
2. Géolocalisation réelle (fin des `DEMO_LAT`/`DEMO_LNG`).
3. Favoris persistés Supabase (sync multi-device) avec fallback offline.
4. Recalcul ADN du lieu côté serveur (trigger SQL) — sinon la donnée communautaire ne s'accumule pas.
5. Bouton "Signaler" côté app (la modération admin existe mais aucun signalement ne peut lui parvenir).
6. Icône + splash + adaptive icon depuis le brandbook.
7. Sentry (gated par env) + enregistrement du token push (préparation, notifs locales restent le canal).
8. EAS complet : profil iOS device, squelettes submit, CI iOS (tag `build-ios-*`).

**Hors MVP (confirmé, déjà acté en Sprint 1) :**
- Carte interactive native (stub assumé, V1.5), Mode Crew/Rapide/Explore, Coup de Cœur mécanique complète, paiement CinetPay + paywall géographique (Sprint 2 — nécessite compte CinetPay), push serveur/campagnes, badges 30+, multi-villes, tables subscriptions/invoices.

## Chantiers (tâches session #1-#10)

| # | Chantier | Statut |
|---|---|---|
| 1 | Fondations : CLAUDE.md, skills spawt-*, ce plan, HUMAN_TODO | fait |
| 2 | Icône + splash iOS/Android (brandbook) | fait |
| 3 | Le Guet bout-en-bout (orchestrateur + 10 tests) | fait |
| 4 | Géolocalisation réelle (useSpawterPosition) | fait |
| 5 | Favoris Supabase (migration 0024) | fait |
| 6 | ADN serveur (migration 0025 + trigger + tests SQL) | fait |
| 7 | Signaler un avis (migration 0026 + UI app) | fait |
| 8 | Sentry env-gated (push token → V1.5, décision documentée) | fait |
| 9 | EAS iOS : tag CI build-ios-*, profil device, submit squelettes | fait |
| 10 | Sweep final (gates, review adversariale, docs, PR) | en cours |
| 11 | Portail admin : page Signalements + readiness | en cours |

Ordre d'exécution : 2 et 9 (indépendants, débloquent les builds) peuvent avancer en parallèle de 3-4 (cœur produit) ; 5-6-7-8 ensuite ; 10 ferme.

## Definition of Done (tech)

- Triple gate verte (`typecheck`, `lint:vocab`, `i18n:check`, `jest`) + vitest admin.
- Chaque migration a son `.down.sql` et ses tests SQL si logique.
- Un tag `build-android-*` produit un APK installable ; un tag `build-ios-*` passe la CI (le build device iOS réel attend les credentials Apple — humain).
- `armGuet()` appelé, testé (jest orchestrateur), démontrable en APK.
- Aucun hex hors tokens.ts, aucun mot du vocabulaire interdit.
- CHANGELOG.md + RELEASES.md + sprint-status.yaml (header) à jour.
- Review adversariale finale du diff complet.

## Suivi

Mettre à jour la colonne Statut de ce fichier à chaque chantier terminé. Journal détaillé : header de `sprint-status.yaml`. En cas de reprise par un autre modèle/session : lire `CLAUDE.md` puis les skills `spawt-*`, puis ce plan, puis `TaskList`.


## PHASE 2 — Version finale Android (mandat étendu 2026-07-02 : « pas juste le MVP »)

Périmètre : le produit complet du PRD (MVP 19 features + post-MVP V1.5/V2 réalisables
sans dépendance externe bloquante). Même méthode : chantier par chantier, triple gate,
builds de validation réguliers (5, 6, 7…), retours testeurs du build 4 prioritaires.

| # | Chantier (tâches session #12-#21) | Statut |
|---|---|---|
| 12 | Carte interactive native (fin du stub) | à faire |
| 13 | Coup de Cœur — quota par stade, migration + RPC | à faire |
| 14 | Paywall géographique 3 km (nudge, sans paiement) | à faire |
| 15 | Onglet Meute — fil d'activité communautaire | à faire |
| 16 | Paramètres & compte (suppression ARTCI — exigence Play Store) | à faire |
| 17 | Mode Rapide (swipe) + Mode Explore (magazine) | à faire |
| 18 | Mode Crew (vote temps réel, Supabase Realtime) | à faire |
| 19 | Identité complète : 13 archétypes, badges thématiques, share card | à faire |
| 20 | Monétisation sandbox-ready : IPaymentProvider + CinetPay + Gold | à faire |
| 21 | Durcissement continu + builds de validation | continu |

Ordre : 12→16 (socle visible + conformité store), puis 17→19 (expérience),
puis 20 (monétisation mock), 18 en dernier des features (complexité realtime).
Hors périmètre code (humain) : compte CinetPay réel, Termii, Play Console,
juriste, contenu éditorial curaté, multi-villes, ML.
