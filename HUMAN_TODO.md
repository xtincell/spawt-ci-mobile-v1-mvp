# SPAWT — Checklist humaine (la part de l'équipe)

Ce que la tech ne peut pas faire à votre place. Classé par urgence. Cochez et datez.

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
    spawt-admin) vers l'instance, rejouer les migrations 0001→0026, redéployer
    les 4 Edge Functions, reconfigurer les secrets (TERMII, MOCK_TERMII,
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

## Bloquant pour les builds iOS

- [ ] **Compte Apple Developer Program** (99 USD/an) — sans lui : aucun build device iOS, pas de TestFlight. Une fois créé : Team ID + créer l'app `com.upgraders.spawt` dans App Store Connect (ascAppId) + clé API App Store Connect pour EAS submit. Renseigner dans `app/eas.json` (`submit.production.ios`).
- [ ] Vérifier que le compte Expo `xtincell` a accès aux credentials iOS (EAS gérera certificats/profils automatiquement une fois le compte Apple lié : `eas credentials`).

## Bloquant pour un OTP réel (inscription par SMS)

- [ ] **Compte Termii** (provider SMS local) → récupérer `TERMII_API_KEY`.
- [ ] Configurer les secrets Supabase (projet `ucymjsxmnzdxvvupgaof`) : `TERMII_API_KEY`, `MOCK_TERMII=false` (ou `true` pour beta fermée sans SMS réels), `ALLOWED_ORIGINS`.
- [ ] En attendant : mode démo OTP = code `123456` (fonctionne déjà).

## Bloquant pour la soumission aux stores (pas pour les builds)

- [ ] **Juriste** : CGU/CGV + politique de confidentialité conformes Loi ivoirienne 2013-450 (ARTCI) — marquées `[pending juriste]` dans le PRD. Héberger la politique à une URL publique (exigence Apple + Google).
- [ ] **Google Play Console** : compte développeur + service account JSON pour `eas submit` (piste interne d'abord) + formulaire Data Safety (l'app collecte : téléphone, position, photos).
- [ ] **Fiches stores** : screenshots, descriptions FR, classification d'âge.
- [ ] Déclaration ARTCI du service (Loi 2013-450).

## Qualité / observabilité

- [ ] **Sentry** : créer le projet → donner le DSN → le mettre en secret EAS (`EXPO_PUBLIC_SENTRY_DSN`). Le code est prêt et silencieux tant que le DSN est absent.
- [ ] **Matrice 4 devices** : test physique (dont un Tecno/Infinix pour le kill background Android) — protocole dans `documentation/` + stories Epic 4.
- [ ] **Triple sign-off** Stéphanie / Kidam / Alexandre sur le Sprint 1 (exigé par le DoD BMAD).

## Décisions git

- [ ] Merger la PR de finalisation MVP (branche `claude/ios-android-final-version-5vad3n`) puis décider du merge `spawt/v1-bmad` → `main`.

## Déjà en place (pour mémoire, ne pas refaire)

- Supabase live : migrations 0001→0023 + 4 Edge Functions ACTIVE.
- EAS Android : keystore managé, 3 APK alpha livrés (tags `build-android-*`).
- Secret GitHub `EXPO_TOKEN` opérationnel (la CI a déjà buildé).
