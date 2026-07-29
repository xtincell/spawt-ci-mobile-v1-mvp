# Migration totale vers Coolify (VPS powerupgraders.com)

Préparée le 2026-07-02. Instance : https://coolify.powerupgraders.com (v4.1.2,
serveur 76.13.128.23). Objectif : tout héberger sur le VPS — backend SPAWT,
portail admin, landings, la totale.

## 1. État des lieux — qui vit déjà où

| Propriété | État | Domaine |
|---|---|---|
| Upgraders & La Fusée (landing) | ✅ déjà sur Coolify | powerupgraders.com |
| Portfolio Xtincell | ✅ déjà sur Coolify | xtincell/folio.powerupgraders.com |
| Galahad (landing + cockpit) | ✅ déjà sur Coolify | galahad/cockpit.powerupgraders.com |
| Atlas, Neo-Kinara, Matanga, Hermes, Honcho | ✅ déjà sur Coolify | *.powerupgraders.com / sslip |
| SPAWT quizz | ✅ déjà sur Coolify | quizz.spawt.online |
| SPAWT portail admin | ✅ déployé (Phase 1) | admin.spawt.online |
| SPAWT prototype web (landing potentielle) | ✅ sur Coolify (app `spawt`) | sslip uniquement — voir §4 |
| Vercel `lafusee-app` / `folio-spark` | 🗑️ doublons obsolètes | à décommissionner (§5) |
| **SPAWT backend (BDD + auth + API)** | ⚠️ **Supabase cloud** `ucymjsxmnzdxvvupgaof` | **LE morceau à migrer — §2** |

Service préparé : **`spawt-supabase`** (Supabase self-hosted one-click,
uuid `k4b877n1twp09syxgjg4jc2a`, projet `spawt`) — **créé mais PAS démarré**.

## 2. Migration du backend SPAWT (la pièce maîtresse)

Le code (app, admin, Edge Functions, RLS, 29 migrations) est 100% Supabase —
un Supabase self-hosted le fait tourner À L'IDENTIQUE. Le Postgres nu
`spawt-postgres-shared` du VPS ne suffit PAS (pas d'auth GoTrue, pas de
PostgREST, pas d'edge runtime) ; il reste utilisable pour le quizz.

### 2.0 GO/NO-GO — vérifier la RAM d'abord (ÉTAPE HUMAINE)
La stack Supabase self-hosted ≈ 10 conteneurs, **2,5–4 Go de RAM** en plus de
l'existant. Sur le VPS (terminal Hostinger) :
```bash
free -h && docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}" | sort -k2 -h | tail -15
```
- ≥ 4 Go libres → GO.
- Sinon → upgrade du VPS Hostinger avant de démarrer le service (ou NO-GO).

### 2.1 Démarrer et exposer
1. Coolify → projet spawt → service `spawt-supabase` → **Start** (ou API :
   `POST /api/v1/services/k4b877n1twp09syxgjg4jc2a/start`).
2. Poser le domaine du gateway Kong : `https://api.spawt.online`
   (ajouter l'enregistrement DNS A → 76.13.128.23, comme admin/quizz).
3. Récupérer dans les variables du service : `SERVICE_PASSWORD_POSTGRES`,
   `ANON_KEY`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, URL du studio.

### 2.2 Schéma + données
```bash
# Depuis une machine avec accès aux deux bases (le VPS lui-même est idéal)
# 1. Dump du cloud (schéma public + auth users)
pg_dump "postgresql://postgres:<MDP_CLOUD>@db.ucymjsxmnzdxvvupgaof.supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges -Fc -f spawt_public.dump
pg_dump "postgresql://postgres:<MDP_CLOUD>@db.ucymjsxmnzdxvvupgaof.supabase.co:5432/postgres" \
  --schema=auth --data-only --table='auth.users' --table='auth.identities' -Fc -f spawt_auth.dump

# 2. Restore dans le self-hosted (port interne du conteneur supabase-db)
pg_restore -d "postgresql://postgres:<MDP_SELFHOSTED>@localhost:5432/postgres" --no-owner spawt_public.dump
pg_restore -d "postgresql://postgres:<MDP_SELFHOSTED>@localhost:5432/postgres" --data-only spawt_auth.dump
```
Alternative propre (base vide) : rejouer `supabase/migrations/0001→0029` dans
l'ordre via psql, puis les seeds (`supabase/seed/*.sql`), puis dumper/restaurer
uniquement les DONNÉES. Les migrations sont du Postgres standard — testées.

### 2.3 Edge Functions
Le service Coolify monte un volume `functions/` pour l'edge-runtime :
copier `supabase/functions/{otp-send,otp-verify,moderate-spawter,seed-inventory}`
dans ce volume (ou `docker cp`), puis redémarrer le conteneur edge-functions.
Secrets (env du service) : `TERMII_API_KEY`, `MOCK_TERMII`, `ALLOWED_ORIGINS`.

### 2.4 Storage
Recréer le bucket `place-photos` (migration 0013 le fait) ; copier les objets
existants si des photos ont déjà été uploadées (S3 sync ou script).

### 2.5 Bascule des clients
| Client | Où changer |
|---|---|
| App mobile | env EAS `preview`/`production` : `EXPO_PUBLIC_SUPABASE_URL=https://api.spawt.online`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon self-hosted>` → nouveau build OU OTA (`eas update`) |
| Portail admin | Coolify → app spawt-admin → env `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` → redéployer |
| Skills/docs | CLAUDE.md §État déployé + skill spawt-release |

### 2.6 Validation puis décommission
- Smoke tests : OTP (mock), login admin, feed, spawt manuel, avis → trigger ADN,
  signalement → page admin, Coup de Cœur.
- **Garder le projet Supabase cloud EN PAUSE 30 jours** (rollback gratuit),
  puis le supprimer.

## 3. Rollback
Tant que le cloud n'est pas supprimé : re-pointer les env vars (OTA + redeploy
admin) suffit à revenir en arrière en < 30 min.

## 4. Landing SPAWT (optionnel, recommandé)
L'app Coolify `spawt` sert le prototype web (référence visuelle, gelé). Pour
une vraie landing : pointer `spawt.online` (apex) dessus en attendant la
landing V1.5 du PRD. DNS A + domaine dans l'app Coolify.

## 5. Décommission Vercel
`lafusee-app` et `folio-spark` (Vercel) sont des doublons des apps Coolify —
vérifier qu'aucun domaine public ne pointe encore dessus, puis supprimer les
projets Vercel. Le `vercel.json` à la racine de CE repo devient caduc après
la migration (déploiement admin = Coolify) — le supprimer à ce moment-là.


## 7. System design — architecture cible (post-migration)

```
                                   DNS (spawt.online, powerupgraders.com → 76.13.128.23)
                                                        │
┌── CLIENTS ──────────────────────┐            ┌────────▼─────────────────────────────────────┐
│                                 │            │  VPS Hostinger — Coolify v4 (Docker)         │
│  📱 App SPAWT (Android/iOS)     │   HTTPS    │  ┌─────────────────────────────────────────┐ │
│     Expo RN — build EAS         ├───────────►│  │ Traefik (proxy Coolify, 80/443, LE TLS) │ │
│     supabase-js                 │            │  └───┬──────────┬──────────┬───────────────┘ │
│                                 │            │      │          │          │                 │
│  🖥️ Portail admin (staff)       │            │  admin.spawt.  api.spawt.  quizz.spawt.      │
│     admin.spawt.online          │            │  online        online      online + landings │
│                                 │            │      │          │          │  (*.power-      │
│  🌐 Landings / sites            │            │  ┌───▼────┐ ┌───▼────────┐ │   upgraders.com)│
│     powerupgraders.com etc.     │            │  │ nginx  │ │ Kong (GW)  │ │                 │
└─────────────────────────────────┘            │  │ statique│ │ Supabase   │ └─► apps nginx/  │
                                               │  │ (admin)│ │ self-hosted│      node diverses│
   CI/CD                                       │  └────────┘ └─┬──────────┘                   │
┌─────────────────────────────────┐            │               │ stack spawt-supabase :       │
│ GitHub xtincell/* ──push──►     │            │   ┌───────────┼─────────────────────────┐    │
│  • GitHub App Coolify           │            │   │ GoTrue(auth) PostgREST  Realtime    │    │
│    → auto-deploy admin/landings │            │   │ Storage      edge-runtime (4 fn)    │    │
│  • GitHub Actions eas-build.yml │            │   │ Studio       supabase-db (Postgres) │    │
│    → APK/AAB/IPA via EAS cloud  │            │   └─────────────────────────────────────┘    │
└─────────────────────────────────┘            │                                              │
                                               │  Autres : spawt-postgres-shared (quizz),     │
   OBSERVABILITÉ                               │  lafusee-postgres, hermes, honcho…           │
   Sentry (crash app, DSN env) ·               └──────────────────────────────────────────────┘
   analytics user_signals (in-DB) ·
   Coolify logs/metrics par service
```

Décisions structurantes :
- **Un seul point d'entrée data** : Kong (`api.spawt.online`) expose auth/REST/
  realtime/storage/functions — les clients ne parlent JAMAIS à Postgres direct.
- **La sécurité reste dans la base** : RLS + triggers (0001→0029) inchangés —
  aucune confiance dans le client, identique au cloud.
- **Stateless partout sauf la stack Supabase** : admin et landings sont des
  statiques nginx reconstruits à chaque push (rollback = redeploy commit N-1).
- **Builds mobiles hors VPS** : EAS cloud (Expo) garde les credentials de
  signature ; le VPS n'a jamais les keystores.
- **Séparation des bases** : spawt-supabase (produit) ≠ spawt-postgres-shared
  (quizz) ≠ lafusee-postgres — pas de couplage entre produits.
- **SPOF assumé V1** : un seul VPS. Mitigations : backups Coolify quotidiens à
  activer (service spawt-supabase → Backups → S3 ou local), cloud Supabase en
  pause 30 j comme filet, IaC implicite via ce runbook.

## 6. Sécurité (à faire après la migration)
- Révoquer les tokens API Coolify partagés dans le chat (« ClaudeFuture »,
  « claude future past ») et en régénérer un dédié CI si besoin.
- Rotation du mot de passe Coolify + clé SSH partagés en clair.
- Les secrets du service Supabase self-hosted (JWT_SECRET, SERVICE_ROLE_KEY)
  ne doivent JAMAIS quitter Coolify.
