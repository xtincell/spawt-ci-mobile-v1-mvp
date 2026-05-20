# Story 6.1: Authentification & shell du panel admin

Status: ready-for-dev

<!-- PREMIÈRE story de l'Epic 6 — bootstrap de la codebase greenfield
`spawt-admin/` (Refine v5 + Vite + React 18 + TS). Initialise le panel,
recâble l'auth sur `spawt_staff` (table existante migration 0001), pose
le shell de navigation (Lieux / Modération / Comptes / Métriques) et
prépare le déploiement Cloudflare Pages. Dépend de Story 1.5 (table
`spawt_staff` + RLS déjà créées). Bloque 6.2, 6.3, 6.4, 6.5. Aucune
migration SQL — uniquement frontend admin. -->

## Story

As a membre `spawt_staff`,
I want me connecter à un panel admin web sécurisé avec un shell de navigation prêt à recevoir les sections métier,
so that l'équipe interne dispose d'une codebase greenfield isolée du mobile, branchée sur Supabase via `spawt_staff` (jamais `service_role` côté client), avec une auth distincte des spawters publics et un déploiement Cloudflare Pages reproductible.

## ⚠️ Brownfield context — read first

État courant Story 6.1 :

| Élément | Fichier | État | Action |
|---|---|---|---|
| Codebase `spawt-admin/` | (racine repo) | ❌ N'existe pas | **Créer** via `npm create refine-app@latest -- --preset refine-supabase spawt-admin` |
| Table `spawt_staff` | `supabase/migrations/0001_create_spawters_spawt_staff.sql` | ✅ Existe — colonnes `id`, `email`, `display_name`, `role`, `is_active`, `created_at`, `updated_at` + RLS `spawt_staff_select_own` + `spawt_staff_select_admin` | **Consommer** — pas de migration nouvelle |
| RLS `spawters_select_staff` | `0001_create_spawters_spawt_staff.sql` ligne 157-165 | ✅ Existe — un staff actif lit tous les spawters | **Consommer** Story 6.4 |
| Auth Supabase | `supabase/migrations/0009_align_otp_phone_check.sql` | ✅ Auth `phone` configurée pour les spawters (Story 2.3) | **Coexister** — `spawt_staff` utilise email+password (provider Supabase Auth distinct du flow OTP spawter) |
| Env vars `spawt-admin/.env` | (aucun) | ❌ | **Créer** — `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (jamais `SUPABASE_SERVICE_ROLE_KEY`) |
| Refine preset `refine-supabase` | npm | ✅ Disponible — versions `@refinedev/core@5.0.12`, `@refinedev/supabase@6.0.2`, `@refinedev/cli@2.16.52`, `@refinedev/react-router@2.0.4` | **Installer** via la commande create-refine-app |
| Cloudflare Pages config | (aucun) | ❌ | **Documenter** dans `spawt-admin/README.md` + ajouter un `wrangler.toml` ou `_redirects` selon la convention Cloudflare Pages |
| Conventions `app/` (i18next, Zustand, expo-router) | `app/src/...` | ⚠️ **Ne PAS appliquer** côté `spawt-admin/` | **Isoler** — Refine fournit son propre router (`@refinedev/react-router`), son propre auth/data-provider, son propre toolkit i18n (si besoin). Pas de cross-imports |
| Triple gate mobile | `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check` | ✅ — Story 4-7 PASS 1 verte | **Préserver** — Story 6.1 ajoute une triple gate **séparée** côté `spawt-admin/` (cf. Dev Notes §5) |
| Strings UI panel | (aucun) | — | **Français professionnel** — pas de Test Tantie Rose (outil interne), mais vocab SPAWT respecté (`spawter`, `place`, `palais`, `spawt_checkin`, `spawt_staff`) |

**Décisions héritées non-revisitables** :

- **Codebase web séparée** (architecture §Infrastructure & Deployment l392-394 + epics §Epic 6) — `spawt-admin/` ne communique jamais runtime avec `app/`. Seul point commun = projet Supabase (schéma partagé).
- **Refine v5 + Vite + React 18 + TS** retenu Step 3 architecture l176-208. AdminJS et Vite-minimal écartés.
- **Auth `spawt_staff` distincte des `spawters`** (amendement team §4.1, PRD FR-027) — jamais de connexion croisée. Un humain qui est à la fois spawter et staff a 2 comptes `auth.users` distincts.
- **`service_role_key` JAMAIS côté client admin** (architecture §Authentication & Security l322-325). Toute opération privilégiée passe par une Edge Function Supabase.
- **Déploiement Cloudflare Pages** retenu (architecture l392-394) — free tier généreux, edge global, latence correcte depuis Abidjan, build Vite supporté.
- **Vocab SPAWT** (project-context §Vocabulaire SPAWT) — `spawter`, `place`, `spawt_checkin`, `palais`, `place_adn`, `spawt_staff`. Le panel parle métier, pas technique.
- **Pas de design extravagant** (memory `feedback_made_in_abidjan.md` + UX canonique) — l'admin est un outil interne sobre. Refine headless suffit ; pas de drift brand.
- **4 sections obligatoires dans le shell** : Lieux (Story 6.2), Modération (Story 6.4), Comptes (Story 6.4), Métriques (Story 6.5). Pré-chargement (Story 6.3) est un script Node, pas une section UI.

## Acceptance Criteria

**AC #1 — Initialisation codebase `spawt-admin/` via le preset Refine officiel**

**Given** la racine du dépôt `Spawt mobile CI/`
**When** Story 6.1 est livrée
**Then** la commande **exacte** suivante a été exécutée :

```bash
npm create refine-app@latest -- --preset refine-supabase spawt-admin
```

**And** le dossier `spawt-admin/` existe avec la structure standard Refine :

```
spawt-admin/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── .env.example                  # template — pas d'anon key réelle
├── .env                          # ⚠️ ignoré par .gitignore racine
├── README.md                     # workflow dev + Cloudflare Pages
├── src/
│   ├── App.tsx                   # <Refine> + dataProvider + authProvider
│   ├── main.tsx                  # entry Vite
│   ├── utility/supabaseClient.ts # recâblé sur VITE_SUPABASE_URL / _ANON_KEY
│   ├── providers/                # authProvider.ts (custom — spawt_staff)
│   ├── pages/                    # placeholders 4 sections — Story 6.1 livre les routes vides
│   │   ├── login/index.tsx
│   │   ├── lieux/index.tsx       # placeholder « À venir Story 6.2 »
│   │   ├── moderation/index.tsx  # placeholder « À venir Story 6.4 »
│   │   ├── comptes/index.tsx     # placeholder « À venir Story 6.4 »
│   │   └── metriques/index.tsx   # placeholder « À venir Story 6.5 »
│   ├── components/               # Layout, Sidebar (réutilise les défauts Refine)
│   └── types/                    # spawt-staff.ts (z.infer de spawt_staff_schema)
└── public/                       # favicon, logo placeholder
```

**And** `spawt-admin/package.json` pin **exactement** :

```json
{
  "dependencies": {
    "@refinedev/core": "5.0.12",
    "@refinedev/supabase": "6.0.2",
    "@refinedev/cli": "2.16.52",
    "@refinedev/react-router": "2.0.4",
    "@supabase/supabase-js": "^2.45.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

**And** `.gitignore` racine inclut `spawt-admin/node_modules/`, `spawt-admin/dist/`, `spawt-admin/.env`, `spawt-admin/.vite/`.

---

**AC #2 — Recâblage `src/utility/supabaseClient.ts` sur env vars `VITE_*` (jamais service_role)**

**Given** le client Supabase auto-généré par le preset Refine
**When** Story 6.1 est livrée
**Then** `spawt-admin/src/utility/supabaseClient.ts` est réécrit :

```ts
// Aligne sur les conventions Supabase JS V2.
// IMPORTANT : ne jamais inliner SUPABASE_SERVICE_ROLE_KEY côté client.
// Toute opération privilégiée passe par une Edge Function Supabase.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // En mode dev, fail-fast lisible. En prod Cloudflare, build casse côté CI.
  throw new Error(
    "[spawt-admin] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
    "Voir spawt-admin/.env.example.",
  );
}

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: window.localStorage,
    flowType: "pkce",
  },
});
```

**And** `spawt-admin/.env.example` contient :

```bash
# spawt-admin — variables Vite (préfixe VITE_ obligatoire pour l'expose côté client)
# ⚠️ JAMAIS de SUPABASE_SERVICE_ROLE_KEY ici — toute op privilégiée = Edge Function.
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publique-RLS-protégée>
```

**And** un grep ciblé `grep -rn "SERVICE_ROLE\|service_role" spawt-admin/src/` retourne **0 ligne**.

---

**AC #3 — `authProvider` Refine pointant sur `spawt_staff` + rejet des spawters publics**

**Given** `spawt-admin/src/providers/authProvider.ts`
**When** Story 6.1 est livrée
**Then** le fichier exporte un `AuthBindings` Refine qui :

1. **`login({ email, password })`** appelle `supabaseClient.auth.signInWithPassword({ email, password })`.
2. **Après sign-in**, vérifie qu'une ligne `spawt_staff` existe pour l'`auth.uid()` courant ET `is_active = true` :

```ts
const { data: staff, error } = await supabaseClient
  .from("spawt_staff")
  .select("id, role, is_active")
  .eq("id", session.user.id)
  .eq("is_active", true)
  .maybeSingle();

if (error || !staff) {
  await supabaseClient.auth.signOut();
  return {
    success: false,
    error: {
      name: "AuthRejection",
      message: "Compte non autorisé pour le panel admin SPAWT.",
    },
  };
}
```

3. **`logout`** appelle `supabaseClient.auth.signOut()`.
4. **`check`** retourne `{ authenticated: false, redirectTo: "/login" }` si pas de session OU si la ligne `spawt_staff` a disparu / `is_active = false` (re-vérification au boot).
5. **`getPermissions`** retourne le `role` (`admin` / `moderator` / `operator`) — consommé par les sections plus tard (Story 6.4 ban réservé `admin` ou `moderator`).
6. **`getIdentity`** retourne `{ id, email, display_name, role }` — affiché dans le header du shell.

**And** la séparation `spawters` / `spawt_staff` est testée :

```ts
// Given un compte auth.users avec une ligne spawters (un spawter public)
// When il tente login sur le panel
// Then authProvider.login retourne success: false + signOut auto
```

**And** un commentaire dans `authProvider.ts` rappelle : « La RLS `spawt_staff_select_own` (migration 0001 l170-172) bloque déjà la lecture à un non-staff — la double vérification (`.maybeSingle()` + signout) est défense en profondeur côté UX (message clair plutôt que page vide). »

---

**AC #4 — `App.tsx` configuré avec `<Refine>` + dataProvider Supabase + 4 resources placeholder**

**Given** `spawt-admin/src/App.tsx`
**When** Story 6.1 est livrée
**Then** l'app monte `<Refine>` avec :

```tsx
import { Refine } from "@refinedev/core";
import { dataProvider, liveProvider } from "@refinedev/supabase";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { supabaseClient } from "./utility/supabaseClient";
import { authProvider } from "./providers/authProvider";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/login";
import { LieuxList } from "./pages/lieux";
import { ModerationList } from "./pages/moderation";
import { ComptesList } from "./pages/comptes";
import { MetriquesDashboard } from "./pages/metriques";

export const App = () => (
  <BrowserRouter>
    <Refine
      dataProvider={dataProvider(supabaseClient)}
      liveProvider={liveProvider(supabaseClient)}
      authProvider={authProvider}
      routerProvider={routerProvider}
      resources={[
        { name: "places",        list: "/lieux",      meta: { label: "Lieux" } },
        { name: "spawt_checkin", list: "/moderation", meta: { label: "Modération" } },
        { name: "spawters",      list: "/comptes",    meta: { label: "Comptes" } },
        { name: "metriques",     list: "/metriques",  meta: { label: "Métriques" } },
      ]}
      options={{
        syncWithLocation: true,
        warnWhenUnsavedChanges: true,
        useNewQueryKeys: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/lieux" element={<LieuxList />} />
          <Route path="/moderation" element={<ModerationList />} />
          <Route path="/comptes" element={<ComptesList />} />
          <Route path="/metriques" element={<MetriquesDashboard />} />
        </Route>
      </Routes>
    </Refine>
  </BrowserRouter>
);
```

**And** chaque page placeholder (`LieuxList`, `ModerationList`, `ComptesList`, `MetriquesDashboard`) affiche un message minimal :

```tsx
export const LieuxList = () => (
  <div>
    <h1>Lieux</h1>
    <p>Section CRUD à venir — Story 6.2.</p>
  </div>
);
```

**And** la racine `/` redirige vers `/lieux` si authentifié, sinon `/login`.

---

**AC #5 — Shell `<Layout>` avec sidebar 4 sections + header identité staff**

**Given** `spawt-admin/src/components/Layout.tsx`
**When** Story 6.1 est livrée
**Then** le shell expose :

1. **Sidebar verticale gauche** (sobre, pas de drift brand) avec :
   - Logo SPAWT minimal (texte « SPAWT admin » suffit V1).
   - 4 liens : « Lieux », « Modération », « Comptes », « Métriques ».
   - Indicateur visuel de la route active (`useLocation().pathname` ou helper Refine).
2. **Header haut** avec :
   - `display_name` du staff connecté (via `useGetIdentity()` Refine).
   - Badge du `role` (admin / moderator / operator).
   - Bouton « Déconnexion » qui appelle `useLogout()`.
3. **Contenu principal** = `<Outlet />` React Router rendrant la page de la section.

**And** le composant utilise les primitives Refine ou des éléments HTML standards stylés sobrement (CSS inline ou un seul `.css` partagé) — **pas** de framework UI lourd (Ant Design / MUI / Tailwind) V1. Choix tranché en Dev Notes §3.

**And** le rendu est responsive uniquement desktop (≥ 1024px) — V1 = laptop équipe. Mobile non supporté (warning visible si viewport < 1024px).

---

**AC #6 — Déploiement Cloudflare Pages — config + protection d'accès**

**Given** la cible déploiement
**When** Story 6.1 est livrée
**Then** `spawt-admin/README.md` documente le workflow :

1. **Build** : `cd spawt-admin && npm install && npm run build` → output `spawt-admin/dist/`.
2. **Config Cloudflare Pages** :
   - Framework preset : `Vite`.
   - Build command : `npm run build`.
   - Build output : `dist`.
   - Root directory : `spawt-admin`.
   - Node version : `20.x` (cohérent EAS Build + Expo SDK 55).
   - Env vars (côté Cloudflare dashboard, jamais commit) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. **Preview branch deploys** activé sur toutes les PR (Cloudflare default).
4. **Protection d'accès supplémentaire** — V1 = **Cloudflare Access** (free tier : Email OTP, 50 users gratuit) limité à une allowlist d'emails `spawt_staff`. Alternative documentée : mot de passe Pages (Cloudflare Pages > Access policies > Service token). Tranché en Dev Notes §4.

**And** un fichier `spawt-admin/public/_headers` pose les en-têtes de sécurité minimaux :

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), camera=(), microphone=()
```

**And** un fichier `spawt-admin/public/_redirects` redirige `/* /index.html 200` (SPA fallback Vite + React Router).

---

**AC #7 — Tests + triple gate spawt-admin**

**Given** la suite de tests `spawt-admin/`
**When** `cd spawt-admin && npm test` est lancé
**Then** la couverture inclut :

1. **`authProvider.test.ts`** :
   - Mock `supabaseClient.auth.signInWithPassword` retourne `{ data: { session }, error: null }`.
   - Mock `.from("spawt_staff").select(...)` retourne `{ data: { id, role, is_active: true } }` → `login` retourne `{ success: true }`.
   - Mock `.from("spawt_staff")` retourne `{ data: null }` (spawter public) → `login` retourne `{ success: false }` + `supabase.auth.signOut` appelé.
   - Mock `.from("spawt_staff")` retourne `{ data: { is_active: false } }` → idem rejet.

2. **`Layout.test.tsx`** :
   - Render avec `useGetIdentity` mockée retournant `{ display_name: "Test Staff", role: "admin" }` → 4 liens sidebar visibles + badge `admin` + bouton « Déconnexion ».

3. **Render placeholder pages** : chaque section monte sans erreur.

**Given** la triple gate `spawt-admin/`
**When** lancée
**Then** `cd spawt-admin && npx tsc --noEmit && npm run lint && npm test` vert.
**And** `cd spawt-admin && npm run build` produit `dist/` sans erreur.

**Note** : la triple gate **mobile** (`cd app && tsc + lint:vocab + i18n:check`) reste verte (Story 6.1 ne touche **pas** `app/`). Validation séparée — Dev Notes §5.

---

**AC #8 — Tracking analytics admin — table `admin_audit_log` préparée (schéma seulement, peuplement Story 6.2)**

**Given** l'absence d'event admin dans `documentation/analytics/events.md`
**When** Story 6.1 est livrée
**Then** une migration `supabase/migrations/0017_create_admin_audit_log.sql` (+ `.down.sql`) crée la table `admin_audit_log` :

```sql
-- Story 6.1 — Audit log des actions spawt_staff dans le panel admin
-- PRD FR-023 + amendement 4.1 (séparation B2C/staff) + architecture §3 l243-244
-- (actions critiques auditées avec horodatage + auteur spawt_staff_id).

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spawt_staff_id UUID NOT NULL REFERENCES spawt_staff(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN (
    'login',
    'place_create', 'place_update', 'place_delete', 'place_publish_toggle',
    'place_adn_update',
    'review_keep', 'review_delete', 'review_warning',
    'spawter_warning', 'spawter_ban', 'spawter_unban',
    'seed_inventory_run'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('place','place_adn','spawt_checkin','spawter','session','seed_batch')),
  entity_id UUID,                       -- nullable : login / seed batch n'ont pas d'entity_id ciblée
  payload_before JSONB,                 -- snapshot avant action (nullable pour create / login)
  payload_after JSONB,                  -- snapshot après action (nullable pour delete / login)
  reason TEXT,                          -- motif obligatoire pour ban / delete (vérifié côté app)
  ip_address INET,                      -- nullable — Cloudflare CF-Connecting-IP optionnel
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_staff_created ON admin_audit_log(spawt_staff_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action, created_at DESC);

-- RLS — un staff lit ses propres actions ; un admin lit tout.
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_log_select_own ON admin_audit_log
  FOR SELECT TO authenticated
  USING (spawt_staff_id = auth.uid());

CREATE POLICY admin_audit_log_select_admin ON admin_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.role = 'admin' AND s.is_active = true
    )
  );

-- INSERT autorisé pour tout staff actif (un staff log ses propres actions).
CREATE POLICY admin_audit_log_insert_own ON admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    spawt_staff_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Pas d'UPDATE/DELETE — append-only (audit trail immuable).
```

**And** `0017_create_admin_audit_log.down.sql` réversible :

```sql
DROP POLICY IF EXISTS admin_audit_log_insert_own ON admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_select_admin ON admin_audit_log;
DROP POLICY IF EXISTS admin_audit_log_select_own ON admin_audit_log;
DROP INDEX IF EXISTS idx_admin_audit_log_action;
DROP INDEX IF EXISTS idx_admin_audit_log_entity;
DROP INDEX IF EXISTS idx_admin_audit_log_staff_created;
DROP TABLE IF EXISTS admin_audit_log;
```

**And** un helper `spawt-admin/src/lib/audit.ts` expose :

```ts
import { supabaseClient } from "../utility/supabaseClient";

export type AdminAction =
  | "login"
  | "place_create" | "place_update" | "place_delete" | "place_publish_toggle"
  | "place_adn_update"
  | "review_keep" | "review_delete" | "review_warning"
  | "spawter_warning" | "spawter_ban" | "spawter_unban"
  | "seed_inventory_run";

export type AdminEntityType = "place" | "place_adn" | "spawt_checkin" | "spawter" | "session" | "seed_batch";

export interface AuditEntry {
  action: AdminAction;
  entity_type: AdminEntityType;
  entity_id?: string;
  payload_before?: unknown;
  payload_after?: unknown;
  reason?: string;
}

export async function logAuditAction(entry: AuditEntry): Promise<void> {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return; // pas d'erreur, juste no-op (le login lui-même appellera APRES auth)
  const { error } = await supabaseClient.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id ?? null,
    payload_before: entry.payload_before ?? null,
    payload_after: entry.payload_after ?? null,
    reason: entry.reason ?? null,
    user_agent: navigator.userAgent.slice(0, 500),
  });
  if (error) {
    // Log côté console — pas de re-throw pour ne pas casser l'UX.
    // L'audit fail est rare (RLS satisfaite par construction) ; le drift se voit en supervision.
    // eslint-disable-next-line no-console
    console.warn("[audit] insert failed", error);
  }
}
```

**And** `authProvider.login` appelle `logAuditAction({ action: "login", entity_type: "session" })` **après** la vérification spawt_staff réussie.

## Tasks / Subtasks

- [ ] **Task 1 — Bootstrap codebase via create-refine-app** (AC: #1)
  - [ ] À la racine du repo : `npm create refine-app@latest -- --preset refine-supabase spawt-admin`.
  - [ ] Répondre aux prompts CLI : TypeScript = oui, no UI framework, no i18n (pour V1), no testing par défaut (on ajoutera vitest Task 7).
  - [ ] Pin les versions exactes dans `spawt-admin/package.json` (AC #1 deps block).
  - [ ] Ajouter `spawt-admin/node_modules/`, `spawt-admin/dist/`, `spawt-admin/.env`, `spawt-admin/.vite/` à `.gitignore` racine.
  - [ ] Lancer `cd spawt-admin && npm install` → 0 erreur.

- [ ] **Task 2 — Recâbler `supabaseClient.ts` + créer `.env.example`** (AC: #2)
  - [ ] Réécrire `spawt-admin/src/utility/supabaseClient.ts` selon AC #2.
  - [ ] Créer `spawt-admin/.env.example` avec les 2 variables `VITE_*` + commentaire.
  - [ ] Créer un `spawt-admin/.env` **local** (non-commit) pointant sur le projet Supabase dev — sera renseigné par Stéphanie.
  - [ ] Lancer un grep `grep -rn "SERVICE_ROLE" spawt-admin/src/ || echo OK` → doit retourner `OK`.

- [ ] **Task 3 — `authProvider` custom spawt_staff** (AC: #3)
  - [ ] Créer `spawt-admin/src/providers/authProvider.ts` selon AC #3.
  - [ ] Documenter en commentaire la défense en profondeur (RLS + check applicatif).
  - [ ] Exporter le type `AuthBindings` Refine compatible.

- [ ] **Task 4 — `App.tsx` + resources + 4 pages placeholder** (AC: #4)
  - [ ] Réécrire `spawt-admin/src/App.tsx` selon AC #4.
  - [ ] Créer les 4 placeholders dans `spawt-admin/src/pages/{lieux,moderation,comptes,metriques}/index.tsx`.
  - [ ] Créer `spawt-admin/src/pages/login/index.tsx` (form email/password + `useLogin()` Refine).
  - [ ] Vérifier `cd spawt-admin && npm run dev` lance Vite sans erreur sur `http://localhost:5173`.

- [ ] **Task 5 — Layout shell** (AC: #5)
  - [ ] Créer `spawt-admin/src/components/Layout.tsx` (sidebar + header + outlet).
  - [ ] Créer `spawt-admin/src/components/Sidebar.tsx` (4 liens, indicateur actif).
  - [ ] Créer `spawt-admin/src/styles/layout.css` (CSS minimal, sobre).
  - [ ] Warning viewport < 1024px (overlay simple).

- [ ] **Task 6 — Config Cloudflare Pages + protection** (AC: #6)
  - [ ] Créer `spawt-admin/public/_headers` (sécurité).
  - [ ] Créer `spawt-admin/public/_redirects` (SPA fallback).
  - [ ] Documenter dans `spawt-admin/README.md` : build, env vars Cloudflare, preview deploys, Cloudflare Access setup.
  - [ ] **Hors story** : la création du projet Cloudflare Pages live = handoff Stéphanie (Stéphanie a le compte).

- [ ] **Task 7 — Migration `0017_create_admin_audit_log.sql` + helper TS** (AC: #8)
  - [ ] Créer `supabase/migrations/0017_create_admin_audit_log.sql` selon AC #8.
  - [ ] Créer `supabase/migrations/0017_create_admin_audit_log.down.sql` réversible.
  - [ ] Créer `spawt-admin/src/lib/audit.ts` (helper `logAuditAction`).
  - [ ] Câbler `authProvider.login` → `logAuditAction({ action: "login", entity_type: "session" })`.

- [ ] **Task 8 — Tests + triple gate spawt-admin** (AC: #7)
  - [ ] Installer `vitest` + `@testing-library/react` côté `spawt-admin/` (devDependencies).
  - [ ] Configurer `vitest.config.ts` (jsdom env + alias).
  - [ ] Créer `spawt-admin/src/providers/__tests__/authProvider.test.ts` (3 scénarios AC #7).
  - [ ] Créer `spawt-admin/src/components/__tests__/Layout.test.tsx` (1 scénario AC #7).
  - [ ] Lancer `cd spawt-admin && npx tsc --noEmit && npm run lint && npm test` vert.
  - [ ] Vérifier `cd app && npx tsc --noEmit && npm run lint:vocab && npm run i18n:check` reste vert (non-régression).

- [ ] **Task 9 — Documentation + CHANGELOG**
  - [ ] `spawt-admin/README.md` : workflow dev, Cloudflare, env vars, link vers story 6.1.
  - [ ] CHANGELOG.md racine : entry `feat(spawt-admin): bootstrap codebase Refine v5 (Story 6.1)`.
  - [ ] Sign-off : Stéphanie (tech / Cloudflare) ✓ ; Kidam (séparation auth respectée) ✓ ; Alexandre (vocab respecté, sidebar sobre) ✓.

## Dev Notes

### 1. Pourquoi un dossier `pages/` plutôt qu'un dossier `resources/` (convention Refine)

Le preset Refine fournit `src/pages/` par défaut. Architecture l712 mentionne `resources/` — c'est une variante. **Choix V1 : `pages/`** pour s'aligner sur le preset officiel (moins de friction pour le dev qui suit la doc Refine). Story 6.2 peut renommer si Stéphanie le préfère ; pour l'instant, on s'aligne sur le starter.

### 2. Pourquoi `email + password` pour `spawt_staff` (pas OTP)

Les `spawters` utilisent OTP (Termii, story 2.3) — flow mobile. Les `spawt_staff` opèrent depuis un laptop équipe ; le password classique Supabase Auth (`signInWithPassword`) est cohérent avec un panel web pro. **Trade-off** :

- ✅ Workflow standard, pas de provider externe (Termii pas branché côté web V1).
- ✅ Supabase Auth gère le password reset par email natif.
- ❌ Pas de 2FA V1 — couvert par Cloudflare Access (Email OTP) **en plus** de password Supabase.

**Sprint 2** : si Stéphanie veut TOTP, ajouter `supabase.auth.mfa.enroll(...)` côté login.

### 3. Pourquoi pas de framework UI (Ant Design / MUI) côté `spawt-admin/`

Le preset Refine est headless. Les 3 options évaluées :

| Option | Verdict |
|---|---|
| **Ant Design (`@refinedev/antd`)** | ❌ Bundle lourd (~600 KB), drift visuel possible vers un look « generic enterprise », inadéquat pour SPAWT. |
| **MUI (`@refinedev/mui`)** | ❌ Même drift, intègre Material Design qui contredit l'ambiance SPAWT (mais comme c'est interne, ça serait acceptable — la vraie raison de l'écarter est le bundle). |
| **Headless + HTML/CSS natif** | ✅ **Retenu V1.** Sobre, contrôle total, bundle < 200 KB. L'outil est interne, pas user-facing — pas de pression UX/brand. |

**Conséquence** : Story 6.2 (CRUD) implémente ses formulaires en HTML natif + Refine hooks (`useForm`, `useTable`). Pas de `<DataGrid>` AntD/MUI ; on construit un `<table>` simple. C'est volontairement low-tech.

### 4. Protection d'accès Cloudflare — Access vs Password

| Option | Verdict |
|---|---|
| **Cloudflare Access (Email OTP, free 50 users)** | ✅ **Recommandé V1.** Allowlist d'emails `spawt_staff`, OTP par email à chaque session, audit trail Cloudflare natif. Pas de password Cloudflare à partager. |
| **Cloudflare Pages > Service token (mot de passe global)** | ⚠️ Acceptable fallback. Un seul password partagé → moins sécurisé, pas d'audit individuel. |
| **IP allowlist (Cloudflare Access policy)** | ❌ Équipe SPAWT mobile (Abidjan, hors-bureau) → IPs résidentielles dynamiques, contrainte forte. |

**Décision V1 : Cloudflare Access avec Email OTP**. Le staff entre son email pro → reçoit un code → puis arrive sur le login Supabase. **Double barrière** = Cloudflare Access + Supabase Auth + RLS `spawt_staff`. Documenté `spawt-admin/README.md`.

### 5. Triple gate `spawt-admin/` ≠ triple gate mobile

| Audit mobile (`cd app && ...`) | Audit spawt-admin (`cd spawt-admin && ...`) |
|---|---|
| `npx tsc --noEmit` | `npx tsc --noEmit` |
| `npm run lint:vocab` (vocab SPAWT) | `npm run lint` (eslint-config-refine) |
| `npm run i18n:check` (fr.json) | — (V1 = strings inline en français, pas d'i18n) |
| `npm test` (jest) | `npm test` (vitest) |

**Lint vocab côté admin** : pas appliqué V1. Trade-off — Story 6.x post-Sprint 2 pourra porter `lint-vocab.mjs` côté `spawt-admin/` si Alexandre constate du drift. Pour V1, **revue manuelle au PR**.

**i18n check côté admin** : pas appliqué V1. Strings inline en français pro (« Lieux », « Modération », « Comptes », « Métriques », « Déconnexion », etc.). Le panel n'est pas multilingue.

### 6. Pourquoi une migration `0017_create_admin_audit_log` dans Story 6.1 et pas Story 6.2

Story 6.2 (CRUD lieux) est la **première** à émettre des audit events (`place_create` / `place_update`). Mais l'event `login` est émis **dès Story 6.1** par `authProvider.login`. Donc la table doit exister Story 6.1.

**Alternative écartée** : ne pas auditer `login` V1. Mais Stéphanie a flaggé en review que **toute session sur le panel doit être traçable** (cohérent PRD FR-023 « actions critiques auditées »). On audite donc dès l'auth.

### 7. Pourquoi pas Refine `accessControlProvider`

Refine fournit un `accessControlProvider` (RBAC). On pourrait câbler les actions par `role` (admin peut tout, moderator ne peut pas créer de lieu, etc.). **Trade-off V1** :

- ✅ Plus propre architecturalement.
- ❌ V1 = équipe SPAWT 3-5 personnes, tous trustés. Le RBAC granulaire ajoute friction sans valeur.

**Décision V1** : pas de `accessControlProvider`. Story 6.4 utilisera `useGetIdentity().role` dans les composants ban/warning pour gating manuel. Sprint 2 si l'équipe staff dépasse 10 personnes.

### 8. Compatibilité runtime `app/` ↔ `spawt-admin/`

**Aucune.** Architecture l740-742 : codebases isolées. **Tests** :

- Pas d'import croisé : `grep -rn "from \"\\.\\./\\.\\./app/" spawt-admin/src/ || echo OK` → `OK`.
- Pas d'import inverse : `grep -rn "from \"\\.\\./\\.\\./spawt-admin/" app/src/ || echo OK` → `OK`.

Les types `Place`, `Spawter`, etc. sont **dupliqués** côté `spawt-admin/src/types/`. Trade-off accepté : drift = revue manuelle. Sprint 2 : extract dans un package monorepo `@spawt/types` partagé si Stéphanie demande.

### 9. Pas de Sentry V1 côté `spawt-admin/`

Architecture l398 : Sentry pour le mobile (`crash-free > 99%`). Côté admin V1 = pas critique (3-5 utilisateurs, debug via console + Cloudflare logs). Sprint 2 si l'équipe scale.

### 10. Sign-off

- **Stéphanie** (tech) : revue auth provider + RLS + audit log shape + setup Cloudflare. Confirmation de l'accès au compte Cloudflare pour le déploiement.
- **Kidam** (analytics) : pas concerné directement V1 — confirmation que le panel admin n'envoie **pas** d'event analytics PostHog (séparation app/admin propre, KPIs admin via `admin_audit_log` agrégé Story 6.5).
- **Alexandre** (brand) : revue sobre du shell (pas de drift visuel vers un look enterprise / Made in Abidjan), validation des libellés français pro.

### 11. Defers identifiés

- **D-601** — Cloudflare Access provisioning live (handoff Stéphanie hors story).
- **D-602** — Vrais comptes `spawt_staff` créés via Supabase Admin UI ou Edge Function (hors Sprint 1 dev, opération équipe).
- **D-603** — Refine `accessControlProvider` granulaire (Sprint 2 si équipe scale).
- **D-604** — Port `lint-vocab` côté `spawt-admin/` (Sprint 2 si drift constaté).
- **D-605** — Sentry / monitoring panel (Sprint 2).
- **D-606** — 2FA TOTP staff (Sprint 2 si demande Stéphanie).
- **D-607** — Migration de Vite vers Next.js / autre meta-framework (jamais — surcoût injustifié).

### 12. Risk

- **Risque #1** : Un spawter public obtient un cookie/session sur `spawt-admin.pages.dev`. Mitigation = défense en profondeur : Cloudflare Access (1ère barrière) + auth Supabase + vérif applicative `spawt_staff` + RLS (4 barrières indépendantes).
- **Risque #2** : Drift entre les types `Spawter` / `Place` côté `app/` et `spawt-admin/`. Mitigation V1 = revue manuelle au PR ; long-terme = monorepo (Sprint 2).
- **Risque #3** : Versions Refine bougent (5.x → 6.x ?) entre l'init et un upgrade — bump major peut casser le `authProvider`. Mitigation = pin exact des 4 packages Refine dans `package.json` + audit explicite avant tout upgrade.
- **Risque #4** : Le `display_name` du staff n'est pas affiché correctement si la ligne `spawt_staff` est créée sans `display_name` (NOT NULL au schéma 0001 → impossible — vérifié).

### Project Structure Notes

- **Nouveau dossier `spawt-admin/`** (greenfield, ~50 fichiers initiaux post-`create-refine-app`).
- **Nouvelle migration SQL** : `supabase/migrations/0017_create_admin_audit_log.sql` + `.down.sql` (table + 3 policies + 3 index).
- **Aucun fichier modifié dans `app/`** — séparation runtime stricte préservée.
- **`.gitignore` racine** : 4 lignes ajoutées (`spawt-admin/node_modules/`, etc.).
- **CHANGELOG.md** : 1 entry `feat(spawt-admin)`.
- **Pas de modif `sprint-status.yaml`** — c'est le job d'Alexandre après validation.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 1083-1106 — Story 6.1 user story + BDD AC.
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 170-248 (Refine starter), 392-394 (Cloudflare Pages), 315-325 (auth staff + service_role), 503-504 + 706-713 (spawt-admin folder), 740-742 (boundary spawt-admin ↔ app).
- [Source: _bmad-output/planning-artifacts/PRD.md] §3.1 Feature 19 (panel admin), FR-023 (lignes 497-502), FR-027 (séparation spawters/spawt_staff lignes 521-526).
- [Source: _bmad-output/project-context.md] §Vocabulaire SPAWT (`spawter`, `place`, `spawt_staff` figés), §Security & privacy (pas de service_role côté client).
- [Source: supabase/migrations/0001_create_spawters_spawt_staff.sql] — schéma `spawt_staff` + RLS existant.
- [Source: documentation/analytics/events.md] — taxonomie events (pas d'event admin V1, audit via table dédiée).
- [Source: _bmad-output/implementation-artifacts/1-5-schema-supabase-entites-spawter-staff-rls.md] — pattern story schema + RLS de référence.
- [Refine v5 docs] https://refine.dev/docs/ — `authProvider`, `dataProvider`, `<Refine>` config.
- [Cloudflare Pages docs] https://developers.cloudflare.com/pages/ — Vite preset + Access + headers/redirects.

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev agent)_

### Debug Log References

_(à remplir par le dev agent)_

### Completion Notes List

_(à remplir par le dev agent)_

### File List

_(à remplir par le dev agent)_
