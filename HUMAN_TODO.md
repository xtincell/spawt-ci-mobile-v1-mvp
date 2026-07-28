# SPAWT — Checklist humaine (la part de l'équipe)

Ce que la tech ne peut pas faire à votre place. Classé par urgence. Cochez et datez.

> **Nouveau (26/07/2026)** : les runbooks de soumission sont prêts —
> **`documentation/RUNBOOK_SOUMISSION_STORES.md`** (pas-à-pas Apple + Google + FCM),
> **`documentation/STORE_LISTING_FR.md`** (textes/screenshots prêts à coller),
> **`documentation/DATA_SAFETY_PRIVACY.md`** (réponses exactes aux formulaires
> de confidentialité). Les comptes Apple/Google arrivant, dérouler le runbook.

## 🔴 URGENT — secrets exposés le 28/07/2026 (incident agent)

Un message de commit a absorbé un dump d'environnement et a été poussé sur
GitHub pendant ~3 minutes. Le dépôt est **privé** et la branche a été réécrite
(force-push), mais l'objet orphelin reste atteignable par son empreinte
(`485dc2b`) jusqu'au ramassage GitHub. **Traiter ces clés comme compromises :**

- [ ] `SSH_PRIVATE_KEY_B64` — clé privée SSH en clair, le plus grave
- [ ] `CINETPAY_API_KEY` (`sk_live_…`) + `CINETPAY_API_PASSWORD` — production
- [ ] `OPENAI_API_KEY`
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET`, `META_OAUTH_CLIENT_SECRET`, `LINKEDIN_OAUTH_CLIENT_SECRET`
- [ ] `APIFY_TOKEN`, `BRAVE_API_KEY`, `PEXELS_API_KEY`, `OLLAMA_API_KEY`, `INTEGRATION_TOKEN_KEY`
- [ ] Demander à GitHub Support la purge de l'objet orphelin
- [ ] Vérifier l'onglet *Security → Secret scanning* du dépôt

`CRON_SECRET` a déjà été régénéré côté Coolify.

## 🔴 Anciens tokens Coolify à révoquer

Le token décrit comme « lecture seule » expose en réalité **toutes** les
variables d'environnement en clair via `/api/v1/services/{uuid}/envs` — clé
`service_role`, mots de passe Postgres, secret JWT, clé Brevo.

- [ ] Révoquer le token `22|sUhD…` et celui du 01/07
- [ ] Ne conserver que le token en écriture en cours

## 📍 Coordonnées GPS des 10 lieux — à relever sur le terrain

Les lieux de la Mission 1 sont en base avec des coordonnées posées **au niveau
du quartier** (précision ~200-400 m). Le rapport de mission ne relève pas de GPS
et aucun annuaire en ligne n'en publie de fiable.

C'est suffisant pour le feed, la recherche et les distances affichées. Ça ne
l'est **pas** pour Le Guet, dont le géofence fait 100 m : un spawt automatique
ne se déclencherait pas, ou se déclencherait au mauvais endroit.

- [ ] Relever la position réelle devant chaque établissement (app carto au choix)
- [ ] Corriger dans la console admin → Lieux → Éditer
- [ ] **Seulement ensuite**, activer `guet-geofence` sur ces lieux

Les 10 : Kaiten, Texas Grillz, Sam's, La Grande République, Bushman Café,
The Rooph, Madame Antika, Kajazoma, L'Impasse, Le Paon.

## 🔑 Comptes de la console admin (créés le 28/07)

Trois comptes `admin` actifs sur `https://admin.spawt.online` :
`xtincell@gmail.com`, `moka@spawt.online`, `stephanie@spawt.online`.
Les mots de passe ont été affichés une seule fois à la création — s'ils sont
perdus, en régénérer un avec `node scripts/create-staff-account.mjs --email … --role admin`.

- [ ] Consigner les trois mots de passe dans le gestionnaire de l'équipe
- [ ] Changer ceux qui ont transité par le chat

## ⚠️ Migration Coolify — PLAN PRÊT (voir MIGRATION_COOLIFY.md)

Le runbook complet (backend Supabase self-hosted, bascule des clients,
landings, décommission Vercel, system design cible) est dans
**`MIGRATION_COOLIFY.md`**. Service `spawt-supabase` créé sur Coolify,
NON démarré. Étape humaine bloquante : vérifier la RAM du VPS (§2.0 GO/NO-GO).

## (Historique) Migration base de données vers Coolify (annoncée 2026-07-01)

L'équipe indique que la base est désormais sur Coolify et que le projet
Supabase cloud est déprécié. **Tout le code (app, admin, auth OTP, RLS,
26 migrations, 4 Edge Functions) est construit sur Supabase** — l'impact
dépend entièrement de ce qui tourne sur Coolify :

- [ ] **Confirmer le scénario** :
  - **Supabase self-hosted sur Coolify** (service one-click) → aucun changement
    de code. À faire : pointer `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` (+ ceux de
    spawt-admin) vers l'instance, rejouer les migrations 0001→0034, redéployer
    les Edge Functions, reconfigurer les secrets (TERMII, MOCK_TERMII,
    ALLOWED_ORIGINS).
  - **PostgreSQL nu** → chantier majeur à planifier (remplacer Supabase Auth,
    PostgREST, RLS/auth.uid(), Edge Functions par une couche API custom).
    NE PAS entamer sans décision d'équipe formelle.
- [ ] **Fournir l'URL du dashboard Coolify** (le token API seul ne suffit pas ;
  l'IP répond 404 — le dashboard est servi par nom de domaine).
- [ ] **Révoquer/faire tourner le token API root** partagé en clair dans le chat
  du 2026-07-01 (hygiène : un token root expose toute l'infra).
- [ ] En attendant la confirmation, le projet Supabase cloud
  `ucymjsxmnzdxvvupgaof` reste la cible des env vars — ne pas le supprimer
  avant la migration effective des données.

## Bloquant pour les builds iOS et la soumission

→ Pas-à-pas complet : **`documentation/RUNBOOK_SOUMISSION_STORES.md`** (§2 Apple).

- [ ] **Compte Apple Developer Program** (99 USD/an) — sans lui : aucun build device
  iOS, pas de TestFlight. Compte annoncé pour aujourd'hui (26/07) : dès réception,
  récupérer le **Team ID**, créer l'app `com.upgraders.spawt` dans App Store Connect
  (→ **ascAppId**), créer la **clé API App Store Connect** (runbook §2.4).
- [ ] **Renseigner `app/eas.json`** : remplacer `REMPLACER_ASC_APP_ID` et
  `REMPLACER_APPLE_TEAM_ID` par les vraies valeurs (diff exact dans le runbook §2.5),
  puis commit.
- [ ] `eas credentials` (iOS) : laisser EAS générer certificat de distribution,
  provisioning profile et **clé push APNs** (runbook §2.6). Vérifier que le compte
  Expo `xtincell` est bien celui qui est lié au compte Apple.

## Bloquant pour la soumission Google Play + push Android

→ Pas-à-pas complet : **`documentation/RUNBOOK_SOUMISSION_STORES.md`** (§3 Google, §4 FCM).

- [ ] **Google Play Console** (25 USD, une fois). ⚠️ Compte **Organisation** recommandé
  (D-U-N-S) ; un compte Personnel impose un **test fermé 12 testeurs / 14 jours** avant
  la production → si Personnel, lancer la piste fermée avec la beta waitlist dès J0
  (runbook §3.1).
- [ ] **Service account JSON** → à ranger dans `app/secrets/play-service-account.json`
  (gitignoré, jamais commité) pour `eas submit -p android` (runbook §3.2).
- [ ] **Formulaire Data Safety + classification du contenu** : recopier
  `documentation/DATA_SAFETY_PRIVACY.md` (runbook §3.3). Nécessite l'URL publique de
  demande de suppression de compte (page web à créer — voir doc).
- [ ] **FCM (push Android)** : projet Firebase → `google-services.json` à commiter dans
  `app/` + clé `"googleServicesFile": "./google-services.json"` dans `app.json` (diff
  runbook §4) + **clé de service FCM V1 uploadée dans EAS** (`eas credentials`).
  Sans ça : aucune notif du Guet sur Android (l'app dégrade proprement).

## Bloquant pour un OTP réel (inscription par SMS)

- [ ] **Compte Termii** (provider SMS local) → récupérer `TERMII_API_KEY`.
- [ ] À la bascule SMS réel : secrets **`TERMII_API_KEY` + `MOCK_TERMII=false`**
  (+ `ALLOWED_ORIGINS`) sur le backend actif (Coolify). Côté app : rien à changer —
  l'OTP 6 chiffres est déjà unifié (version finale, voir « Fait » plus bas).
- [ ] Décider la stratégie « compte démo reviewer » pour Apple/Google : numéro
  whitelisté avec code fixe (recommandé, petite modif `otp-verify` à demander à la
  tech) — options détaillées dans le runbook §2.8a.

## Paiement web Spawter Gold (spawt.online/gold — hors app, conformité Apple 3.1.3)

- [ ] **Compte marchand CinetPay** : ouvrir le compte, passer la validation KYC,
  récupérer les clés **sandbox** puis **production** (`CINETPAY_API_KEY`,
  `CINETPAY_SITE_ID`, `CINETPAY_SECRET_KEY`).
- [ ] Poser ces clés en **secrets Coolify** du service concerné (sandbox d'abord,
  bascule prod après un paiement de test réussi de bout en bout).
- [ ] Rappel conformité : **aucun bouton d'achat ni lien vers spawt.online/gold dans
  l'app** (argumentaire 3.1.3 prêt dans le runbook §2.8b).

## Secrets & env de production (Coolify + EAS)

- [ ] Backend Coolify : `TERMII_API_KEY`, `MOCK_TERMII=false`,
  `CINETPAY_API_KEY` / `CINETPAY_SITE_ID` / `CINETPAY_SECRET_KEY`, `ALLOWED_ORIGINS`.
- [ ] Env EAS profil `production` : **`EXPO_PUBLIC_SUPABASE_URL=https://api.spawt.online`**
  + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon self-hosted) + `EXPO_PUBLIC_SENTRY_DSN`.
- [ ] Vérifier que le secret GitHub `EXPO_TOKEN` n'a pas expiré (la CI a déjà buildé).

## Bloquant pour la soumission aux stores (pas pour les builds)

- [ ] **Juriste** : politique de confidentialité + CGU + CGV conformes Loi ivoirienne
  2013-450 (ARTCI), à mettre EN LIGNE sur **`spawt.online/legal/confidentialite`**,
  **`/legal/cgu`**, **`/legal/cgv`** avant soumission (exigence Apple + Google).
  Points à faire valider en priorité : transfert des données hors CI (VPS) + page
  publique de suppression de compte — marqueurs `[À VALIDER PAR JURISTE]` dans
  `documentation/DATA_SAFETY_PRIVACY.md`.
- [ ] Déclaration ARTCI du service (Loi 2013-450).
- [ ] **Fiches stores** : textes prêts dans `documentation/STORE_LISTING_FR.md` —
  reste à produire les **screenshots** (plan + tailles dans le doc, §7) et à tout
  coller dans les consoles.
- [ ] **Exécuter les runbooks** :
  - `documentation/RUNBOOK_SOUMISSION_STORES.md` (soumission Apple + Google,
    checklist finale §6 : 20 lieux seedés, pages légales en ligne, Sentry, env prod) ;
  - runbook **`BASCULE_DATABASE_URL`** du quiz (bascule de la base du quiz La Meute
    vers la base dédiée — livré avec la version finale).

## Qualité / observabilité

- [ ] **Sentry** : créer le projet → donner le DSN → le mettre en secret EAS
  (`EXPO_PUBLIC_SENTRY_DSN`). Le code est prêt et silencieux tant que le DSN est absent.
- [ ] **Matrice 4 devices** : test physique (dont un Tecno/Infinix pour le kill
  background Android) — protocole dans `documentation/` + stories Epic 4.
- [ ] **Triple sign-off** Stéphanie / Kidam / Alexandre sur le Sprint 1 (exigé par le
  DoD BMAD).

## Décisions git

- [ ] Merger la PR de finalisation (branche `claude/app-finale-ios-android-f8ewrp`)
  puis décider du merge `spawt/v1-bmad` → `main`.

## Fait — version finale 07/2026 (pour mémoire, ne pas refaire)

- [x] **OTP 6 chiffres unifié** (commit `c84399b`) : `CELL_COUNT` repassé à 6 dans
  l'app (aligné pin Termii), code de test mock = **`123456`** (l'ancien `12345678`
  à 8 chiffres est mort). Plus rien à changer côté app pour la bascule SMS réel.
- [x] **Dépendances natives figées** (« enveloppe native finale », même commit) :
  l'enveloppe du build store est stabilisée — ne pas ajouter de module natif sans
  re-tester un build EAS complet.
- [x] Mock OTP **par défaut sans aucun secret** sur les 2 backends (MAJ consolidée
  07/2026) — `MOCK_TERMII` n'a plus besoin d'être posé pour le mode démo.
- [x] Suppression de compte in-app (migration 0029) + push tokens (migration 0034).
- [x] Version app passée à **1.1.0** (buildNumber/versionCode 8) — notes de version
  stores prêtes dans `STORE_LISTING_FR.md` §8.

## Déjà en place (pour mémoire, ne pas refaire)

- Supabase live : migrations appliquées + 4 Edge Functions ACTIVE.
- EAS Android : keystore managé, APK alpha livrés (tags `build-android-*`,
  journal `RELEASES.md`).
- Secret GitHub `EXPO_TOKEN` opérationnel (la CI a déjà buildé).
- CI iOS prête : tag `build-ios-YYYY-MM-DD-N` → triple gate → .ipa production
  (ne manquent que les credentials Apple).
