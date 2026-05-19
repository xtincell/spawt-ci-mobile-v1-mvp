# Deployment Guide

> Sprint 1 : démo via Expo Go (option A — déjà documenté). Cette doc cadre les **chaînes de livraison cibles** à mettre en place pour ouvrir l'alpha (amendement Claude 5.8) puis la prod.

---

## 1. Mobile — Expo / EAS

### 1.1 Profils

[`app/eas.json`](../app/eas.json) :

| Profil | Android | iOS | Distribution |
|---|---|---|---|
| `development` | APK + dev client | — | interne |
| `preview` | APK | simulator | interne (alpha / QA) |
| `production` | App Bundle (AAB) | (à compléter) | Play Store / App Store |

### 1.2 Build cloud

```bash
# APK sideloadable Android (Galaxy S23 sans store)
npx eas-cli build --profile preview --platform android

# IPA / TestFlight (requiert Apple Developer 99 $/an)
npx eas-cli build --profile preview --platform ios
```

EAS Build offre **30 builds gratuits / mois** sur plan free.

### 1.3 OTA (Expo Updates)

Non encore configuré. À activer pour pousser des correctifs JS sans rebuild natif.

---

## 2. Backend — Supabase

### 2.1 Provisionnement (à faire Phase 0 Sprint 1)

1. Créer un projet Supabase (free tier OK pour alpha — 500 MB, 2 GB transfert).
2. Récupérer `Project URL` + `anon key` + `service_role key` (le service_role ne quitte **jamais** le mobile).
3. Configurer les tables via migrations versionnées (`supabase/migrations/*.sql`) — pas encore livrées. Cf. [data-models-mobile-app §7](./data-models-mobile-app.md#7-tables-supabase-attendues-à-créer-sprint-1-phase-0).
4. Activer RLS sur **toutes** les tables avec données spawter — clés : `auth.uid() = spawter_id`.

### 2.2 Branches Supabase

Supabase supporte des branches preview par feature flag. À considérer Phase 1.3 (anti-fraude L1) pour tester les triggers SQL sans casser la base alpha.

### 2.3 Edge Functions attendues

- `cinetpay-webhook` (Phase 2 V1.5) — confirme paiement → upsert `subscriptions`
- `otp-send` (Phase 1.1) — bridge Twilio / Termii si on ne passe pas par le SDK direct

Non livrées en Sprint 1.

---

## 3. Variables d'env

| Variable | Cible | Source |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | client mobile | dashboard Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | client mobile | dashboard Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** (Edge Functions, scripts admin) | dashboard Supabase |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Edge Function `otp-send` (Phase 1.1) | dashboard Twilio |
| `CINETPAY_API_KEY` | Edge Function `cinetpay-webhook` (Phase 2) | dashboard CinetPay |

⚠️ Toute variable préfixée `EXPO_PUBLIC_*` est **inlinée dans le bundle JS** lu par les spawters. **Jamais de secret.**

---

## 4. CI/CD (à mettre en place)

Aucun pipeline CI actuellement. Reco minimale :

```yaml
# .github/workflows/mobile-ci.yml (à créer)
on: [pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: ./app } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install --legacy-peer-deps
      - run: npx tsc --noEmit
      - run: npm run lint:vocab
      - run: npm run i18n:check
      - run: npm test
```

EAS Build peut être déclenché via webhook sur merge `main`.

---

## 5. Web prototype

Pas de cible de prod pour le prototype. S'il faut le rendre accessible (revue brand), serve `dist/` derrière un Vercel/Netlify gratuit. Aucune valeur runtime à protéger.

---

## 6. Conformité (Stéphanie / amendement Claude 5.2)

Avant ouverture beta publique (PRD Phase 4) :

- [ ] CGU / CGV rédigées par juriste conforme droit ivoirien
- [ ] Politique de confidentialité publiée (URL accessible depuis Profil → Paramètres)
- [ ] Endpoint `DELETE /me` actif (soft-delete `spawters`, anonymisation J+30)
- [ ] Export self-service JSON depuis Profil → Paramètres
- [ ] Wording consent ARTCI explicite à l'onboarding (déjà partiellement en place — vérifier post-rédaction CGU)

---

## 7. Observability (à brancher)

| Outil | Usage | Statut |
|---|---|---|
| Sentry | crashes mobile + web (alerte oncall) | non installé |
| PostHog **ou** Mixpanel | analytics events ([`documentation/analytics/events.md`](../documentation/analytics/events.md)) | non installé — décision Kidam pending |
| Supabase Logs | requêtes + erreurs DB | disponible côté dashboard |

Décision provider analytics = blocage avant Phase 1.1 (Madame Sun / Kidam).
