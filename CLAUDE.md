# SPAWT — Guide agent (lire en premier)

App de découverte culinaire communautaire pour les foodies d'Abidjan.
Mission en cours : **finaliser un MVP tech-complet buildable iOS + Android** (plan : `_bmad-output/planning-artifacts/mvp-finalisation-plan.md`, part humaine : `HUMAN_TODO.md`).

## Structure du repo (4 projets distincts)

| Dossier | Quoi | Stack |
|---|---|---|
| `app/` | **L'app mobile — le produit** | Expo SDK 55, RN 0.83, expo-router, TypeScript, Zustand |
| `spawt-admin/` | Panel admin équipe | Refine v5 + Vite + React 18, Cloudflare Pages |
| `supabase/` | Backend | 23+ migrations SQL (chacune avec `.down.sql`), 4 Edge Functions Deno |
| `src/` + racine Vite | **Prototype web GELÉ** — référence visuelle uniquement | Ne jamais développer dedans |

## Sources de vérité (ordre de préséance)

1. **Le code** (`app/`, `supabase/`, `spawt-admin/`)
2. `_bmad-output/implementation-artifacts/sprint-status.yaml` — état réel des stories (header = journal)
3. `_bmad-output/planning-artifacts/` — PRD.md (avec errata), epics.md, ux-design-specification.md
4. `documentation/` — PRD source docx, cahier des charges Sprint 1, brandbook UX
5. `docs/` — ⚠️ **SNAPSHOT FIGÉ du 2026-05-13, PÉRIMÉ** : ne jamais s'y fier pour "est-ce que X est implémenté" (il dit que les migrations/OTP n'existent pas ; ils existent). OK pour l'orientation générale.

## Commandes (depuis `app/`)

```bash
npm run typecheck && npm run lint:vocab && npm run i18n:check && npm test   # "triple gate" — DOIT être verte avant tout commit
```
Admin : `cd spawt-admin && npm test` (vitest). Tests SQL : `supabase/tests/`.

## Règles non négociables

- **Vocabulaire** (enforced par `lint:vocab`) : jamais "restaurant", "check-in", "leaderboard", "user", "gamif*", "VTC/Uber/Bolt" dans le code/UI. Dire : lieu/spot, spawt, Spawter, la Meute, Le Guet, Djidji.
- **Couleurs/typos** : source unique `app/src/theme/tokens.ts`. **Aucun hex ailleurs.** Palette canonique = brandbook (`documentation/ux/spawt-tokens.css`) : noir `#0A0A0A`, or `#C8A44E`, vert chat `#2D6B4F`, blanc cassé `#FAFAF8`. ⚠️ Les valeurs du PRD §15 (`#D4AF37`, `#50C878`, Instrument Serif/Manrope) sont **périmées** (erratum PRD v1.0.3 du 2026-05-14).
- **Polices** : Klinsman (display) + Gotham (body). Piège : les `.otf` Klinsman embarquent les noms PostScript `KlinsmanTypefaceLight/Regular/Bold` — toujours référencer ces noms-là, pas les noms de fichiers.
- **i18n** : toute string UI passe par `app/src/i18n/` (vérifié par `i18n:check`).
- **Migrations** : numérotées `NNNN_description.sql` + `.down.sql` apparié + tests dans `supabase/tests/` pour la logique (cf. `0012_antifraud_triggers`). Trous 0015-0016 = réservés, normaux.
- **Textes produit** : ton du Chat SPAWT (complice, jamais corporate), français ivoirien assumé.

## État déployé (2026-07-28 — mesuré, pas déclaré)

⚠️ **Le projet Supabase cloud `ucymjsxmnzdxvvupgaof` est SUPPRIMÉ** (NXDOMAIN). Toute
doc qui le mentionne comme actif est périmée. « La base » = le PostgreSQL qui vit
**dans Coolify sur le VPS** (service `spawt-supabase`, uuid `k4b877n1twp09syxgjg4jc2a`).

- **Backend** : `https://api.spawt.online` → Kong du stack self-hosted. PostgreSQL 15.8,
  base `postgres`. Le domaine se pose via `PATCH /api/v1/services/{uuid}` champ `urls`
  (format `https://hôte:portConteneur`) — **pas** par la variable `SERVICE_FQDN_*`, que
  Coolify régénère depuis la colonne `fqdn`.
- **Schéma** : migrations 0001→0064 appliquées, suivies dans `public.schema_migrations`.
  Deux migrateurs équivalents : `supabase/migrator/migrate.sh` (conteneur Docker) et
  `supabase/migrator/migrate-http.mjs` (via `/pg/query`, **sans SSH** — c'est le chemin
  praticable, `supabase-db` ne publie aucun port).
- **Base unifiée** : les 5 tables du quiz La Meute vivent dans le schéma `public` de
  cette base, possédées par le rôle `quiz` (RLS deny-all côté PostgREST). 20 pionniers.
  L'app `spawt-quiz` y pointe. Voir `spawt-meute-quiz/BASCULE_DATABASE_URL.md`.
- **Edge Functions** : les 9 déployées (`otp-send`, `otp-verify`, `moderate-spawter`,
  `seed-inventory`, `push-send`, `wrapped-stats`, `payment-checkout`, `payment-webhook`,
  `payment-cron`) via `scripts/deploy-edge-functions.mjs`. Contrôle : chaque route doit
  répondre **405** en GET ; un **500 InvalidWorkerCreation** = fichier absent.
  **OTP : mock sur OPT-IN EXPLICITE** (`MOCK_TERMII=true`) — sans lui ni `TERMII_API_KEY`,
  échec fermé `edge_misconfigured`. `TERMII_API_KEY` n'est pas encore posée.
- **Contenu** : 10 lieux réels du rapport Mission 1 (`supabase/seed/places_mission1.sql`)
  + 30 avis fondateurs (`founder_reviews_mission1.sql`), marqués `is_seed` avec un lot,
  retirables par `purge_seed_reviews(lot)`. ⚠️ **GPS au niveau du quartier** (±200-400 m) :
  suffisant pour le feed, **insuffisant pour le géofence 100 m du Guet**.
- **Portail** : `https://portail.spawt.online` (app Coolify `spawt-portail-apercu`,
  repo `project_spawt_mobile_ci`, Dockerfile). **Rideau d'avant-lancement** :
  `VITE_PREVIEW_GATE=true` → écran « Bientôt » pour tout le monde, portail réel
  pour un `spawt_staff` actif connecté (RPC `current_staff()`, 0062). Au
  lancement : retirer la variable et **rebuild**. `spawt.online` continue de
  servir sa page « Bientôt » statique.
- **Page « Bientôt »** : dans le dépôt (`project_spawt_mobile_ci/bientot/`), déployée par
  Coolify sur `https://bientot.spawt.online` (app `spawt-bientot`, uuid
  `o10w9ckby0y44wewkg6p6upl`). Elle porte les **vrais** assets de marque : Klinsman +
  Gotham en `@font-face` (nécessite `font-src 'self'` dans la CSP — sans quoi le
  navigateur retombe sur les polices système **en silence**) et le logo `moka.png`.
- ⚠️ **L'apex `spawt.online` sert encore l'ANCIENNE page** (audit du 2026-07-29, mesuré) :
  - Un **seul** Traefik écoute `:443` sur 76.13.128.23 — un hôte inconnu du zone
    retombe sur son certificat auto-signé. L'apex y passe donc forcément.
  - **Aucune** des 17 applications ni des 6 services Coolify ne mentionne l'apex :
    ni `fqdn`, ni `custom_labels` (base64), ni compose. La route est posée **à la main**
    dans la conf dynamique du proxy, hors de ce que l'API expose.
  - L'API Coolify n'offre **ni** endpoint de conf dynamique, **ni** exécution de commande
    (404 sur `proxy`, `proxy/dynamic`, `dynamic-configurations`, `execute`, `command`).
    Le dashboard Traefik n'est pas publié. **La bascule exige un accès à l'hôte.**
  - Ne PAS ajouter `spawt.online` aux domaines de `spawt-bientot` sans retirer d'abord
    l'ancienne route : deux routeurs, même règle `Host()`, même priorité par défaut
    (Traefik la calcule sur la longueur de la règle) → départage non garanti, et
    contention ACME possible sur la seule URL publique. Ordre : **retirer, puis ajouter**.
  - La bascule doit couvrir `spawt.online` **et** `www.spawt.online` : les deux servent
    aujourd'hui les mêmes octets.
  - L'ancienne page contient `var ADMIN_WORD = "@ntigoumin225"` en clair. Portée réelle
    faible (elle ne masque qu'un panneau « coulisses » dont le contenu — liens quiz et
    console — est déjà dans la source publique), mais à ne pas réutiliser ailleurs.
- **Comptes internes** (0060) : `spawters.is_internal` déverrouille la section
  « Mode interne » des réglages de l'app — bascule gratuit ↔ Gold simulé,
  aperçu local du paywall géo (rayon gratuit 3 km). Non auto-attribuable
  (2 triggers) ; octroi par `scripts/grant-internal.mjs --add <+E164>` (avant la
  première connexion) ou par la page Comptes de la console (RPC auditée).
- **Console admin** : `https://admin.spawt.online`, build statique nixpacks + nginx
  (fallback SPA déjà configuré). ⚠️ Les variables `VITE_*` sont **figées au build** —
  les changer impose un **rebuild**, pas un redéploiement. Premier compte :
  `scripts/create-staff-account.mjs`.
- **Paiement à validation manuelle** (0063/0064) : **CinetPay est secondaire**. Le payeur
  déclare son versement (Wave, Orange Money, MoMo, Moov, espèces, virement) depuis
  `portail/gold/paiement-manuel`, l'équipe valide dans la page **Paiements** de la console.
  `approve_payment_request()` fait tout en UNE transaction : abonnement + facture
  numérotée + rôle B2B + audit. Idempotente (`provider_tx_id = manuel:<id>`, UNIQUE).
  ⚠️ Le prix vient de la table `plans`, jamais du montant déclaré. `plans` DOIT rester
  aligné sur `_shared/payment/types.ts` — les deux avaient divergé de 3 000 F sur
  l'annuel. Coordonnées de versement : table `payment_instructions`, **toutes inactives
  tant que les numéros ne sont pas renseignés**.
- **Feature flags** : 16 en base ; `paywall-geo` désormais actif sur `internal`/`alpha`
  (l'équipe peut le voir), **fermé sur `beta`/`prod`** tant que `payment_instructions`
  n'a pas de numéro actif. Pilotables depuis la page Fonctionnalités de l'admin.
- **Page « Mode d'emploi »** de la console (`/runbook`) : le runbook des développeurs,
  derrière l'auth staff. Contenu dans `spawt-admin/src/pages/runbook/content.ts` —
  **aucun secret**, la page est servie à tout compte staff y compris `operator`.
- EAS : projet `15ac2301-e901-4caa-a8c8-864c6621bcd0`, owner `xtincell`, keystore managé.
  `app/eas.json` porte enfin un bloc `env` sur les profils distribuables.
- CI : `.github/workflows/eas-build.yml` (tag `build-android-*` → quadruple gate +
  conformité + **`check-eas-env`** → APK preview ; `build-android-prod-*` → `.aab`).
  Secret requis : `EXPO_TOKEN`.
- Git : branche de travail `claude/app-finale-ios-android-f8ewrp` (PR #3). `main` est en
  retard. Les apps Coolify `spawt-quiz` et `spawt-admin` pointent sur cette branche.

## Pièges connus

- `armGuet()` (géofencing) n'était appelé nulle part → câblage = chantier MVP en cours (voir skill `spawt-guet`).
- Expo Go ne supporte pas le geofencing background — tester via dev build/APK.
- Feature flag `guet-geofence` : activé seulement `internal`/`alpha` (`supabase/seed/feature_flags_guet.sql`).
- Coordonnées GPS codées en dur (`DEMO_LAT`/`DEMO_LNG`) dans recherche/feed — chantier MVP.
- Favoris = AsyncStorage uniquement ; ADN du lieu = recalcul local-only — chantiers MVP.
- Commit `9f6b325` a retiré le plugin `expo-application` pour débloquer CI (BuildBadge partiellement dégradé).
- **Le mode démo est un OPT-IN, plus un repli.** `app/src/lib/data-source.ts` : live si
  `EXPO_PUBLIC_SUPABASE_URL`+`_ANON_KEY`, démo si `EXPO_PUBLIC_DEMO_MODE=true`, sinon
  écran « Configuration manquante ». Le repli silencieux d'avant a fait passer tous les
  APK livrés pour un produit vide alors que seule la config de build manquait.
- **Coolify, deux pièges vérifiés** : (1) pour un « file storage » créé par l'API, le
  `fs_path` fourni est IGNORÉ — il est déduit du `mount_path`, et aucun bind-mount n'est
  ajouté au compose ; (2) un service ne voit les autres ressources du serveur que si
  *Connect to predefined docker network* est activé.
- **RLS : ne JAMAIS révoquer `EXECUTE` d'un prédicat de policy à `authenticated`.**
  Une expression de policy est évaluée avec les privilèges de l'APPELANT. La
  migration 0058 l'a fait sur `is_active_staff`/`is_admin_staff`/`is_b2b_of`/
  `is_b2b_gold_of`/`crew_session_is_joinable` → **41 policies sur 18 tables**
  inévaluables pour tout compte connecté (plus de push, badges, pattes,
  abonnements, suggestions, Crew…). Réparé en 0061. Aucun test unitaire ne peut
  l'attraper : ils tournent hors base ou en `service_role`, qui contourne la RLS.
- **Lire `spawt_staff` côté client** : passer par `current_staff()` (0062), pas
  par un `select`. Un admin lit TOUTE l'équipe (`spawt_staff_select_admin`), donc
  un `maybeSingle()` échoue sur le cas nominal.
- **Compteurs d'avis** : ne jamais les écrire à la main. `place_adn.total_reviews` est
  recalculé depuis les lignes réelles (`recompute_place_adn_full`, 0054/0055). Les avis
  fondateurs alimentent la note, la confiance et les axes, mais **jamais** le compteur
  public — FR-032.

## Skills projet (`.claude/skills/spawt-*`)

`spawt-context` (produit & architecture), `spawt-dev` (workflow dev), `spawt-release` (builds EAS/CI/versioning), `spawt-guet` (architecture du Guet). Les lire avant de toucher au domaine correspondant.
