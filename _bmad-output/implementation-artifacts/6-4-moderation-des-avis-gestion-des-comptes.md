# Story 6.4: Modération des avis & gestion des comptes

Status: ready-for-dev

<!-- 4e story Epic 6 — câble les resources Refine `spawt_checkin` (avis)
et `spawters` (comptes) sur les tables existantes. File de modération
proactive (signalement spawter FR-017 reporté Sprint 2). Actions :
keep/delete/warning sur avis ; warning/ban sur spawter. Ban = Edge
Function `moderate-spawter` qui pose `is_banned = true` + `signOut`
sessions actives + audit. Dépend de 6.1 (audit + auth), 6.2 (patterns
CRUD Refine). Migration `0019_alter_spawters_moderation.sql` ajoute
colonnes `is_banned`, `banned_at`, `banned_reason`, `warning_count`. -->

## Story

As a membre `spawt_staff` (role `admin` ou `moderator`),
I want consulter une file de modération proactive des avis et gérer les comptes spawter (warning, ban) avec audit horodaté et motif obligatoire,
so that la qualité communautaire et le Contrat à la Tribu sont protégés, chaque action de ban est tracée dans `admin_audit_log` avec spawt_staff_id + motif, et un spawter banni ne peut plus se connecter à l'app mobile.

## ⚠️ Brownfield context — read first

État courant Story 6.4 :

| Élément | Fichier / Table | État | Action |
|---|---|---|---|
| Table `spawt_checkin` (avis) | `0011_create_spawt_checkin.sql` Story 4.1 | ✅ Existe — colonnes `note_etoiles`, `tags`, `texte_avis`, `photos`, `is_seed`, `flag_reason` | **Consommer** — pas de modif schéma |
| Table `spawters` | `0001_create_spawters_spawt_staff.sql` Story 1.5 | ✅ Existe — pas de colonne `is_banned` | **Étendre** via migration `0019_alter_spawters_moderation.sql` |
| Triggers anti-fraude | `0012_antifraud_triggers.sql` Story 4.4 | ✅ — `flag_reason` posé serveur côté `spawt_checkin` | **Consommer** — la file admin trie par `flag_reason IS NOT NULL` priorité |
| Helper `audit.ts` admin | `spawt-admin/src/lib/audit.ts` Story 6.1 | ✅ — actions `review_*`, `spawter_*` déjà dans CHECK enum migration 0014 | **Consommer** |
| RLS staff sur `spawt_checkin` | (aucune côté staff) | ❌ Pas de policy staff | **Ajouter** policies `spawt_checkin_*_staff` dans migration 0016 |
| RLS staff sur `spawters` | `spawters_select_staff` Story 1.5 ligne 157-165 | ✅ SELECT staff existant | **Étendre** policies UPDATE staff (pour poser `is_banned`) |
| Signalement spawter FR-017 | (aucun) | ❌ — reporté Sprint 2 (PRD lignes 460-465) | **Documenter explicitement** — file proactive V1, signalements arrivent Sprint 2 |
| Edge Function `moderate-spawter` | (aucune) | ❌ | **Créer** — bypass complexe (UPDATE spawters + sign out sessions + audit) |
| Suppression avis | (aucune) | ❌ | **Soft-delete via colonne `deleted_at` ou hard DELETE ?** — décision Dev Notes §2 (recommandation = soft-delete `deleted_at TIMESTAMPTZ NULL`) |
| Resources `spawt_checkin` + `spawters` Refine | `spawt-admin/src/App.tsx` Story 6.1 | ✅ Déclarées (placeholders) | **Compléter** — pages list + show + actions |

**Décisions héritées non-revisitables** :

- **Séparation auth `spawt_staff` ≠ `spawters`** (PRD FR-027, amendement 4.1) — un ban d'un spawter n'affecte jamais un compte staff.
- **Sprint 1 = modération PROACTIVE** — équipe screening les avis nouveaux + flagged anti-fraude. Le bouton « Signaler » mobile (FR-017) est explicite report Sprint 2 (PRD lignes 460-465, epics ligne 1166).
- **Motif obligatoire pour ban** (PRD FR-023 acceptance, epics Story 6.4 AC #3 « auditée avec horodatage, auteur spawt_staff_id et motif »).
- **Sanctions canoniques** : Warning / BAN (PRD §19 Faux-Pas : Fake Review, Gatekeeping, Hater Toxique).
- **Ban d'un spawter = perte d'accès complète** — la session JWT existante doit être invalidée (sign out forcé).
- **Audit log append-only** (Story 6.1 migration 0014) — pas de UPDATE/DELETE possible sur les lignes d'audit.
- **Anti-leaderboard** (project-context, PRD §20.1) — la file de modération ne classe pas les spawters par « pires comportements », pas de score de fraude affiché par spawter.
- **Vocab UI** : « spawter » (jamais « user »), « avis » (jamais « review » en UI), « banni » (jamais « kické »).

## Acceptance Criteria

**AC #1 — Migration `0019_alter_spawters_moderation.sql` — colonnes de modération + policies staff**

**Given** la table `spawters` sans champ de ban
**When** Story 6.4 est livrée
**Then** `supabase/migrations/0019_alter_spawters_moderation.sql` (+ `.down.sql`) ajoute :

```sql
-- Story 6.4 — Colonnes de modération sur spawters + soft-delete sur spawt_checkin
-- + policies staff manquantes.

-- ━━━ spawters : colonnes de modération ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE spawters
  ADD COLUMN is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN banned_at TIMESTAMPTZ,
  ADD COLUMN banned_reason TEXT,
  ADD COLUMN warning_count INTEGER NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  ADD COLUMN last_warning_at TIMESTAMPTZ,
  ADD COLUMN last_warning_reason TEXT;

-- Cohérence : un compte banni doit avoir banned_at NOT NULL et banned_reason NOT NULL.
ALTER TABLE spawters
  ADD CONSTRAINT spawters_ban_coherence CHECK (
    (is_banned = false AND banned_at IS NULL AND banned_reason IS NULL)
    OR
    (is_banned = true AND banned_at IS NOT NULL AND banned_reason IS NOT NULL)
  );

-- Index pour file de modération (spawters bannis listés à part)
CREATE INDEX idx_spawters_is_banned ON spawters(is_banned, banned_at DESC) WHERE is_banned = true;

COMMENT ON COLUMN spawters.is_banned IS
  'true = compte banni, session JWT invalidée par Edge Function moderate-spawter. Voir Story 6.4.';
COMMENT ON COLUMN spawters.banned_reason IS
  'Motif obligatoire (UI form). Faux-Pas canoniques PRD §19 : Fake Review, Gatekeeping, Hater Toxique.';
COMMENT ON COLUMN spawters.warning_count IS
  'Compteur d''avertissements posés avant ban. Politique 3-strikes pas codifiée V1 (jugement humain staff).';

-- ━━━ spawt_checkin : soft-delete via deleted_at ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE spawt_checkin
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by_staff_id UUID REFERENCES spawt_staff(id) ON DELETE RESTRICT,
  ADD COLUMN deleted_reason TEXT;

ALTER TABLE spawt_checkin
  ADD CONSTRAINT spawt_checkin_delete_coherence CHECK (
    (deleted_at IS NULL AND deleted_by_staff_id IS NULL AND deleted_reason IS NULL)
    OR
    (deleted_at IS NOT NULL AND deleted_by_staff_id IS NOT NULL AND deleted_reason IS NOT NULL)
  );

-- Index pour file de modération (avis supprimés filtrés out)
CREATE INDEX idx_spawt_checkin_not_deleted ON spawt_checkin(created_at DESC) WHERE deleted_at IS NULL;

COMMENT ON COLUMN spawt_checkin.deleted_at IS
  'Soft-delete admin (Story 6.4). NULL = avis visible. NOT NULL = exclu de l''affichage public + recompute ADN.';

-- ━━━ Policies staff sur spawt_checkin ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Staff actif lit tous les avis (modération).
CREATE POLICY spawt_checkin_select_staff ON spawt_checkin
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- Staff actif update (soft-delete + warning emis sur le spawter ne touche pas l'avis).
-- WITH CHECK : staff ne peut modifier QUE les colonnes deleted_at, deleted_by_staff_id, deleted_reason
-- (les autres colonnes restent immuables — l'avis lui-même n'est pas réécrit par le staff).
-- ⚠️ Postgres ne supporte pas column-level CHECK dans une POLICY simple — on enforcera côté Edge Function
-- pour la sécurité forte, et côté client Refine pour l'UX.
CREATE POLICY spawt_checkin_soft_delete_staff ON spawt_checkin
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );

-- ━━━ Policies staff sur spawters (UPDATE pour ban/warning) ━━━━━━━━━━━━━━━━━━

-- Staff actif update (ban, warning) — mais l'opération canonique passe par Edge Function moderate-spawter
-- (qui ajoute le sign-out forcé). La policy permet le fallback / tests.
CREATE POLICY spawters_update_staff ON spawters
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spawt_staff s
      WHERE s.id = auth.uid() AND s.is_active = true
    )
  );
```

**And** `.down.sql` réversible :

```sql
DROP POLICY IF EXISTS spawters_update_staff ON spawters;
DROP POLICY IF EXISTS spawt_checkin_soft_delete_staff ON spawt_checkin;
DROP POLICY IF EXISTS spawt_checkin_select_staff ON spawt_checkin;
DROP INDEX IF EXISTS idx_spawt_checkin_not_deleted;
DROP INDEX IF EXISTS idx_spawters_is_banned;
ALTER TABLE spawt_checkin
  DROP CONSTRAINT IF EXISTS spawt_checkin_delete_coherence,
  DROP COLUMN IF EXISTS deleted_reason,
  DROP COLUMN IF EXISTS deleted_by_staff_id,
  DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE spawters
  DROP CONSTRAINT IF EXISTS spawters_ban_coherence,
  DROP COLUMN IF EXISTS last_warning_reason,
  DROP COLUMN IF EXISTS last_warning_at,
  DROP COLUMN IF EXISTS warning_count,
  DROP COLUMN IF EXISTS banned_reason,
  DROP COLUMN IF EXISTS banned_at,
  DROP COLUMN IF EXISTS is_banned;
```

---

**AC #2 — Edge Function `moderate-spawter` — ban atomique + sign-out forcé**

**Given** l'action critique « bannir un spawter »
**When** Story 6.4 est livrée
**Then** une Edge Function `supabase/functions/moderate-spawter/index.ts` (Deno) existe :

```ts
// supabase/functions/moderate-spawter/index.ts
// Story 6.4 — Ban / warning / unban d'un spawter avec atomicité + sign-out forcé.
//
// Auth : caller doit être spawt_staff actif (role admin ou moderator).
// Operation : UPDATE spawters + auth.admin.signOut(user_id) + INSERT admin_audit_log.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type ModerationAction = "ban" | "unban" | "warning";

interface ModerationRequest {
  spawter_id: string;
  action: ModerationAction;
  reason: string; // obligatoire pour ban/warning, optionnel pour unban (mais recommandé)
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const callerClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  // ━━━ Auth check ━━━
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ data: null, error: { code: "UNAUTHENTICATED" } }), { status: 401 });
  }
  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff || (staff.role !== "admin" && staff.role !== "moderator")) {
    return new Response(JSON.stringify({ data: null, error: { code: "FORBIDDEN" } }), { status: 403 });
  }

  const { spawter_id, action, reason } = await req.json() as ModerationRequest;

  // ━━━ Validation ━━━
  if (action !== "unban" && (!reason || reason.trim().length < 3)) {
    return new Response(
      JSON.stringify({ data: null, error: { code: "INVALID_REASON", message: "Motif requis (>= 3 chars)" } }),
      { status: 400 },
    );
  }

  const { data: target, error: targetErr } = await supabase
    .from("spawters")
    .select("id, is_banned, warning_count, display_name")
    .eq("id", spawter_id)
    .maybeSingle();
  if (targetErr || !target) {
    return new Response(JSON.stringify({ data: null, error: { code: "NOT_FOUND" } }), { status: 404 });
  }

  let auditAction: "spawter_ban" | "spawter_unban" | "spawter_warning";
  const beforeSnapshot = { is_banned: target.is_banned, warning_count: target.warning_count };

  if (action === "ban") {
    if (target.is_banned) {
      return new Response(JSON.stringify({ data: null, error: { code: "ALREADY_BANNED" } }), { status: 409 });
    }
    auditAction = "spawter_ban";
    await supabase
      .from("spawters")
      .update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason,
      })
      .eq("id", spawter_id);
    // Sign-out forcé : invalide toutes les sessions JWT du compte ciblé.
    await supabase.auth.admin.signOut(spawter_id, "global");
  } else if (action === "unban") {
    if (!target.is_banned) {
      return new Response(JSON.stringify({ data: null, error: { code: "NOT_BANNED" } }), { status: 409 });
    }
    auditAction = "spawter_unban";
    await supabase
      .from("spawters")
      .update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
      })
      .eq("id", spawter_id);
  } else { // warning
    auditAction = "spawter_warning";
    await supabase
      .from("spawters")
      .update({
        warning_count: target.warning_count + 1,
        last_warning_at: new Date().toISOString(),
        last_warning_reason: reason,
      })
      .eq("id", spawter_id);
    // Pas de sign-out sur warning — le spawter reste connecté, mais Sprint 2 affichera une bannière in-app.
  }

  // ━━━ Audit log ━━━
  const afterSnapshot = action === "ban"
    ? { is_banned: true, banned_reason: reason }
    : action === "unban"
      ? { is_banned: false }
      : { warning_count: target.warning_count + 1, last_warning_reason: reason };

  await supabase.from("admin_audit_log").insert({
    spawt_staff_id: user.id,
    action: auditAction,
    entity_type: "spawter",
    entity_id: spawter_id,
    payload_before: beforeSnapshot,
    payload_after: afterSnapshot,
    reason,
  });

  return new Response(
    JSON.stringify({ data: { spawter_id, action, applied: true }, error: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
```

**And** la fonction est déployée via `supabase functions deploy moderate-spawter`.

**And** `supabase.auth.admin.signOut(user_id, "global")` invalide bien **toutes** les sessions JWT du compte (vérifié dans la doc Supabase Auth).

---

**AC #3 — Page `/moderation` — file de modération proactive**

**Given** `spawt-admin/src/pages/moderation/index.tsx`
**When** Story 6.4 est livrée
**Then** la page expose une file triée :

```tsx
// spawt-admin/src/pages/moderation/index.tsx
import { useTable } from "@refinedev/core";
import { useState } from "react";

export const ModerationList = () => {
  const [filter, setFilter] = useState<"all" | "flagged" | "recent">("recent");

  const { tableQueryResult } = useTable({
    resource: "spawt_checkin",
    pagination: { pageSize: 50 },
    sorters: {
      initial: [
        // Priorité 1 : avis flagged anti-fraude (Story 4.4 trigger)
        // Priorité 2 : avis récents non-traités
        // Limitation Refine : un seul sorter à la fois → on utilise filter pour switch
        ...(filter === "flagged" ? [] : [{ field: "created_at", order: "desc" as const }]),
      ],
    },
    filters: {
      permanent: [
        { field: "note_etoiles", operator: "ne", value: null }, // ne montre que les avis (pas les check-ins simples)
        { field: "deleted_at", operator: "null", value: null },  // pas les supprimés
        ...(filter === "flagged" ? [{ field: "flag_reason", operator: "ne", value: null }] : []),
      ],
    },
    meta: {
      select: "*, places!inner(id, name, neighborhood), spawters!inner(id, display_name, stade, is_banned, warning_count)",
    },
  });

  return (
    <div>
      <h1>Modération</h1>
      <p className="banner-info">
        ⓘ Modération <strong>proactive</strong> V1 — le bouton « Signaler » côté mobile (FR-017)
        arrive Sprint 2. Cette file affiche les avis récents et les avis flagged anti-fraude.
      </p>
      <div className="filters">
        <button onClick={() => setFilter("recent")}>Tous les avis (récents)</button>
        <button onClick={() => setFilter("flagged")}>Flagged anti-fraude</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Spawter</th>
            <th>Stade</th>
            <th>Lieu</th>
            <th>Note</th>
            <th>Tags</th>
            <th>Texte</th>
            <th>Flag</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tableQueryResult.data?.data.map(row => <ReviewRow key={row.id} review={row} />)}
        </tbody>
      </table>
    </div>
  );
};
```

**And** chaque ligne expose 3 actions :

1. **« Garder »** — marque l'avis comme reviewed sans action (audit `review_keep`).
2. **« Supprimer »** — modal `<ReasonModal>` demande un motif → soft-delete (`UPDATE spawt_checkin SET deleted_at, deleted_by_staff_id, deleted_reason WHERE id = X`) → audit `review_delete`.
3. **« Warning au spawter »** — modal motif → appelle Edge Function `moderate-spawter` avec `action: "warning"` → audit `review_warning` (entity_type = `spawt_checkin`) + `spawter_warning` (entity_type = `spawter`).

**And** une 4e action « Voir le profil spawter » navigue vers `/comptes/show/:spawter_id`.

**And** le filtre `flagged` montre prioritairement les avis avec `flag_reason IS NOT NULL` (output des 6 triggers Story 4.4) — visualisation rapide de la fraude détectée.

---

**AC #4 — Page `/comptes` — liste spawters + actions warning/ban**

**Given** `spawt-admin/src/pages/comptes/index.tsx`
**When** Story 6.4 est livrée
**Then** la page expose :

1. **Liste paginée** des spawters avec colonnes : Display Name · Phone (masked `+225 XX… XX 12`) · Quartier · Stade · Spawts · Warnings · Status (Actif / Banni) · Actions.

2. **Filtres** :
   - Search par `display_name` (contains).
   - Filtre Status : Tous / Actifs / Bannis.
   - Filtre Stade : Tous / Touriste / Explorateur / Détective / Djidji / Guide.
   - Filtre `warning_count >= N`.

3. **Action ligne « Voir détails »** → `/comptes/show/:id` — page détail spawter avec :
   - Identité (nom, phone, quartier, pays, gender, age_range).
   - Stats : `total_spawts`, `unique_spots`, `warning_count`.
   - Historique des warnings (`last_warning_at`, `last_warning_reason`).
   - Status ban (`is_banned`, `banned_at`, `banned_reason`).
   - Bouton « Warning » → modal motif → Edge Function.
   - Bouton « Bannir » (rouge, double-confirm) → modal motif → Edge Function.
   - Bouton « Débannir » si `is_banned = true` → modal motif → Edge Function.
   - Sous-section « Avis du spawter » (`useList({ resource: "spawt_checkin", filters: spawter_id })`) avec lien vers `/moderation` pour modérer un avis spécifique.

4. **Gating UI par role** :
   - `admin` ET `moderator` : peuvent warning + ban + unban.
   - `operator` : lecture seule (boutons disabled + tooltip « Requiert role admin ou moderator »).
   - Lecture via `useGetIdentity()` Refine (Story 6.1).

---

**AC #5 — Modal `<ReasonModal>` réutilisable + motif obligatoire**

**Given** les 3 actions critiques (delete review, warning, ban)
**When** Story 6.4 est livrée
**Then** un composant partagé `<ReasonModal>` existe :

```tsx
// spawt-admin/src/components/ReasonModal.tsx
import { useState } from "react";

interface ReasonModalProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  destructive?: boolean;          // ban → double confirm
  fauxPasOptions?: string[];      // PRD §19 Faux-Pas — preset choices
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}

export const ReasonModal = ({ isOpen, title, confirmLabel, destructive, fauxPasOptions, onConfirm, onCancel }: ReasonModalProps) => {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (!isOpen) return null;

  const valid = reason.trim().length >= 3;
  const canSubmit = valid && (!destructive || confirmed);

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        {fauxPasOptions && (
          <div className="faux-pas-presets">
            {fauxPasOptions.map(option => (
              <button key={option} type="button" onClick={() => setReason(option)}>{option}</button>
            ))}
          </div>
        )}
        <label>
          Motif (obligatoire, ≥ 3 caractères)
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} maxLength={500} />
        </label>
        {destructive && (
          <label>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
            Je confirme cette action irréversible.
          </label>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>Annuler</button>
          <button
            type="button"
            disabled={!canSubmit}
            className={destructive ? "btn-destructive" : "btn-primary"}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
```

**And** les options preset PRD §19 Faux-Pas :

```ts
export const FAUX_PAS_REVIEW = [
  "Fake Review (avis fictif)",
  "Hater Toxique (insultes / propos discriminants)",
  "Spam / publicité",
  "Hors-sujet (n'a pas spawté ce lieu)",
];

export const FAUX_PAS_SPAWTER = [
  "Fake Reviews répétées",
  "Gatekeeping (revendique un lieu)",
  "Hater Toxique (récidive)",
  "Faux compte / usurpation",
];
```

**And** chaque modal pré-rempli le `reason` avec le Faux-Pas sélectionné mais permet édition libre.

---

**AC #6 — Recompute ADN après suppression d'un avis**

**Given** un avis supprimé via soft-delete (`deleted_at SET`)
**When** Story 6.4 est livrée
**Then** l'ADN du lieu doit être recalculé pour exclure cet avis :

**Option A — Trigger SQL** : `AFTER UPDATE OF deleted_at ON spawt_checkin WHEN NEW.deleted_at IS NOT NULL` recalcule `place_adn` (somme/avg sur les rows non-supprimées non-cancelled).

**Option B — Edge Function `recompute-place-adn`** : déjà reportée Sprint 2 (Story 4.7 Dev Notes §3, defer D-437). Côté Story 6.4, on **invoque** cette fonction post-soft-delete si elle existe ; sinon, on accepte le drift V1 (l'ADN reste stale jusqu'à la prochaine review).

**Décision V1 — Option C hybride** : la suppression d'un avis V1 ne déclenche pas de recompute serveur ; l'ADN dérive jusqu'au prochain avis posté (qui recalcule via `applyReviewToAdn` mobile, qui re-fetch les rows actuelles). **Acceptable alpha** (peu d'avis, peu de suppressions). Documenté Dev Notes §3.

**And** un commentaire dans `0019_*.sql` rappelle : « Le recompute ADN suite à un soft-delete n'est pas atomique V1 — defer D-641 trigger SQL Sprint 2. »

---

**AC #7 — Le spawter banni ne peut plus se connecter ni écrire**

**Given** un spawter avec `is_banned = true`
**When** il tente de se reconnecter via OTP (Edge Function `otp-send` Story 2.3)
**Then** :

1. La session JWT existante a déjà été invalidée par `auth.admin.signOut(spawter_id, "global")` (AC #2).
2. Lors du prochain login OTP, l'Edge Function `otp-send` doit **vérifier** `spawters.is_banned` :

```ts
// supabase/functions/otp-send/index.ts — extension Story 6.4
// (Cette modif est minimale et compatible Story 2.3 deployment.)
const { data: spawter } = await supabase.from("spawters")
  .select("is_banned, banned_reason")
  .eq("phone_e164", normalized_phone)
  .maybeSingle();
if (spawter?.is_banned) {
  return new Response(JSON.stringify({
    data: null,
    error: { code: "ACCOUNT_BANNED", message: "Compte suspendu. Contact équipe SPAWT." },
  }), { status: 403 });
}
```

**And** le mobile (app) affiche un message i18n `errors.account_banned` (string ajoutée à `fr.json` côté Story 2.3 follow-up — pas dans Story 6.4 directement, mais documenté en Dev Notes §5).

**Given** un spawter banni qui tenterait une écriture côté SDK (e.g. INSERT spawt_checkin)
**When** la requête arrive
**Then** la RLS `spawt_checkin_insert_own` accepte (car son `auth.uid()` est valide tant que JWT non-expiré). **Mitigation** : le sign-out forcé `auth.admin.signOut(spawter_id, "global")` invalide immédiatement le JWT — toute requête suivante retourne 401.

**Sprint 2 (D-645)** : ajouter un trigger SQL `BEFORE INSERT ON spawt_checkin` qui rejette si `spawters.is_banned = true` (défense en profondeur même si JWT non-invalidé pour cause de race condition).

---

**AC #8 — Tests + triple gate**

**Given** la suite de tests
**When** lancée
**Then** la couverture inclut :

1. **`moderation-list.test.tsx`** :
   - Mock `useTable` retournant 3 avis (2 flagged + 1 normal) → 3 lignes rendues.
   - Click sur « Supprimer » → modal `<ReasonModal>` ouvert.
   - Submit modal avec motif → `useUpdate({ resource: "spawt_checkin" })` appelé avec `deleted_at`, `deleted_reason` + `logAuditAction({ action: "review_delete" })` appelé.

2. **`comptes-show.test.tsx`** :
   - Render avec spawter `is_banned: false` → bouton « Bannir » visible + actif.
   - Render avec `is_banned: true` → bouton « Débannir » visible.
   - Click « Bannir » → modal double-confirm → submit appelle Edge Function `moderate-spawter` mockée.
   - Render avec `useGetIdentity({ role: "operator" })` → tous les boutons d'action disabled.

3. **`ReasonModal.test.tsx`** :
   - Motif < 3 chars → bouton submit disabled.
   - Mode `destructive=true` → checkbox confirmation requis avant submit.
   - Click sur un preset Faux-Pas → textarea pré-remplie.

4. **`moderate-spawter-edge.test.ts`** (Deno) :
   - Mock caller spawt_staff actif role admin + action `ban` + motif valide → UPDATE + sign-out + audit OK.
   - Mock caller role `operator` → 403.
   - Mock action `ban` sur spawter déjà banni → 409 `ALREADY_BANNED`.
   - Mock action `warning` sans motif → 400 `INVALID_REASON`.

5. **SQL test manuel** (`supabase/tests/0019_moderation.sql`) :
   - Insert spawter → UPDATE `is_banned = true, banned_at = NULL` → erreur CHECK `spawters_ban_coherence`.
   - Soft-delete spawt_checkin sans `deleted_reason` → erreur CHECK.

**Given** la triple gate `spawt-admin/`
**When** lancée
**Then** `cd spawt-admin && npx tsc --noEmit && npm run lint && npm test` vert.

**And** la triple gate mobile reste verte — Story 6.4 ne touche **pas** `app/`. La modif `otp-send/index.ts` (AC #7) est côté `supabase/functions/`, hors app/.

## Tasks / Subtasks

- [ ] **Task 1 — Migration `0019_alter_spawters_moderation.sql` + `.down.sql`** (AC: #1)
  - [ ] Ajouter colonnes `is_banned`, `banned_at`, `banned_reason`, `warning_count`, `last_warning_at`, `last_warning_reason` sur `spawters`.
  - [ ] Ajouter colonnes `deleted_at`, `deleted_by_staff_id`, `deleted_reason` sur `spawt_checkin`.
  - [ ] 2 CHECK constraints de cohérence.
  - [ ] 2 index partiels.
  - [ ] 3 nouvelles policies staff (`spawt_checkin_select_staff`, `spawt_checkin_soft_delete_staff`, `spawters_update_staff`).
  - [ ] `.down.sql` réversible avec `DROP IF EXISTS`.

- [ ] **Task 2 — Edge Function `moderate-spawter`** (AC: #2, #7)
  - [ ] Créer `supabase/functions/moderate-spawter/index.ts` selon AC #2.
  - [ ] Tests Deno `index_test.ts` (4 cas AC #8).
  - [ ] Déployer (`supabase functions deploy moderate-spawter`).

- [ ] **Task 3 — Extension Edge Function `otp-send` pour rejet ban** (AC: #7)
  - [ ] Éditer `supabase/functions/otp-send/index.ts` (Story 2.3) : ajouter check `is_banned`.
  - [ ] Tests Deno étendus (cas spawter banni → 403).
  - [ ] **Coordination Story 2.3** : revue Stéphanie avant merge — minimiser surface de regression.
  - [ ] Ajouter string i18n `errors.account_banned` côté `app/src/i18n/fr.json` (handoff Story 2.3 follow-up, pas dans Story 6.4 directement).

- [ ] **Task 4 — Page `/moderation` — file proactive** (AC: #3)
  - [ ] Réécrire `spawt-admin/src/pages/moderation/index.tsx` selon AC #3.
  - [ ] Créer composant `ReviewRow` (1 ligne avec 4 actions).
  - [ ] Banner explicite « Modération proactive V1 — signalements Sprint 2 ».
  - [ ] CSS dans `spawt-admin/src/styles/moderation.css`.

- [ ] **Task 5 — Pages `/comptes` (list + show)** (AC: #4)
  - [ ] Réécrire `spawt-admin/src/pages/comptes/index.tsx` (list paginée + filtres).
  - [ ] Créer `spawt-admin/src/pages/comptes/show.tsx` (détail + actions warning/ban/unban).
  - [ ] Helper `maskPhoneE164` (renvoie `+225 XX… XX 12`).
  - [ ] Gating UI par role via `useGetIdentity()`.

- [ ] **Task 6 — Composant `ReasonModal` réutilisable** (AC: #5)
  - [ ] Créer `spawt-admin/src/components/ReasonModal.tsx`.
  - [ ] Créer constants `FAUX_PAS_REVIEW`, `FAUX_PAS_SPAWTER` dans `spawt-admin/src/constants/moderation.ts`.
  - [ ] CSS dans `spawt-admin/src/styles/modal.css`.

- [ ] **Task 7 — Câblage actions + audit log** (AC: #3, #4, #6)
  - [ ] `ReviewRow` action « Supprimer » → `<ReasonModal>` → `useUpdate({ resource: "spawt_checkin" })` + `logAuditAction({ action: "review_delete" })`.
  - [ ] `ReviewRow` action « Garder » → audit `review_keep` (pas de mutation DB, juste trace).
  - [ ] `ReviewRow` action « Warning » → Edge Function + audit `review_warning`.
  - [ ] `ComptesShow` actions Warning/Ban/Unban → Edge Function `moderate-spawter`.
  - [ ] Note V1 : pas de recompute ADN post-soft-delete (Dev Notes §3, defer D-641).

- [ ] **Task 8 — Tests + triple gate** (AC: #8)
  - [ ] `moderation-list.test.tsx`.
  - [ ] `comptes-show.test.tsx`.
  - [ ] `ReasonModal.test.tsx`.
  - [ ] `moderate-spawter-edge.test.ts` (Deno).
  - [ ] SQL test `supabase/tests/0019_moderation.sql` (CHECK constraints).
  - [ ] Triple gate `spawt-admin/` verte + mobile non-régressé.
  - [ ] CHANGELOG : `feat(spawt-admin): modération avis + gestion comptes (Story 6.4)`.

## Dev Notes

### 1. Pourquoi pas signalement spawter FR-017 en V1

PRD ligne 460-465 + epics ligne 1166 figent : « le branchement de la file sur les signalements spawter (bouton "Signaler" mobile) est reporté Sprint 2 (FR-017) — en Sprint 1 la modération est proactive ».

**Implications Story 6.4** :
- Pas d'écran « File des signalements » V1 — la file affiche **tous** les avis récents + les flagged anti-fraude.
- Pas de colonne `reported_count` sur `spawt_checkin`. Sprint 2 ajoutera une table `review_reports` + workflow.
- Le staff scrolle proactivement la file. Volume alpha 5 spawters × 20-30 spawts/mois = ~50 avis/mois → modération proactive faisable.

**Sprint 2** : Story 6.4b ajoutera `review_reports` + UI dédiée + push notification staff sur seuil de signalements.

### 2. Pourquoi soft-delete avis (pas DELETE physique)

| Option | Verdict |
|---|---|
| **Soft-delete via `deleted_at`** | ✅ **Retenu V1.** Préserve la traçabilité (compliance, contestation spawter, jurisprudence Faux-Pas). Permet de revenir en arrière. |
| **Hard DELETE** | ❌ Trop irréversible. Le spawter pourrait contester sa sanction ; impossible de reconstituer l'avis original. |
| **DELETE + audit log payload_before complet** | ⚠️ Acceptable mais le payload audit n'inclut pas les photos (URLs) — perte fichiers. Mieux : soft-delete + audit. |

**Décision V1 : soft-delete** avec `deleted_at`, `deleted_by_staff_id`, `deleted_reason` (CHECK cohérent).

**Affichage mobile** : tous les fetchs côté `app/` doivent filtrer `WHERE deleted_at IS NULL`. **Action à coordonner** : Stéphanie vérifie au merge que `app/src/lib/data-source.supabase.ts` ajoute ce filtre. Le filtre côté RLS (`spawt_checkin_select_own`) ne couvre **pas** ce cas → le filtre est côté requête uniquement. Documenté dans le commentaire du `0019_*.sql`.

**Sprint 2 (D-642)** : étendre la RLS `spawt_checkin_select_own` pour exclure les rows soft-deleted (`AND deleted_at IS NULL` ajouté à USING).

### 3. Recompute ADN post-soft-delete — defer V1

L'ADN d'un lieu (`place_adn.weighted_rating`, `total_reviews`, `confidence_score`, 5 axes) est calculé sur les avis. Si on supprime un avis, l'ADN devrait être recalculé.

**Trade-off V1** :
- ✅ Story 4.7 V1 = compute client local, persistance reportée Sprint 2 → l'ADN serveur est de toute façon **stale** dans la plupart des cas.
- ✅ Volume alpha → impact négligeable (< 5% des avis seront supprimés).
- ❌ Drift visible : un avis supprimé reste dans le compteur `total_reviews` jusqu'au prochain avis posté.

**Décision V1** : pas de recompute auto. Le drift est accepté. **Defer D-641** : trigger SQL `AFTER UPDATE OF deleted_at ON spawt_checkin` qui invoque `recompute-place-adn` (Edge Function Story 4.7 Sprint 2).

### 4. Pourquoi pas un `BEFORE UPDATE` trigger sur `spawt_checkin` qui rejette tout sauf les colonnes `deleted_*`

L'idéal serait : staff peut UPDATE **uniquement** `deleted_at`, `deleted_by_staff_id`, `deleted_reason`. Un staff (ou un attacker via staff JWT compromis) ne devrait pas pouvoir modifier `note_etoiles` ou `texte_avis` (immutabilité de l'avis).

**Limite Postgres** : impossible de column-level CHECK dans une POLICY simple. **Options** :

| Option | Verdict |
|---|---|
| **Edge Function `moderate-review`** dédiée (pas dans Story 6.4 V1) | ⏭️ Sprint 2 — surcoût pour Story 6.4 V1, accepté trust staff. |
| **Trigger SQL `BEFORE UPDATE` qui rejette si toute autre colonne change** | ⚠️ Possible mais lourd. |
| **Trust staff V1 + audit log** | ✅ **Retenu V1.** Le staff est 3-5 personnes trustées. Un drift est visible dans `admin_audit_log.payload_before/after`. |

**Décision V1** : trust + audit. **Defer D-643** Edge Function `moderate-review` pour atomicité.

### 5. Pourquoi pas une notification mobile au spawter quand il reçoit un warning

V1 = pas de canal push → l'app n'a pas de chemin standard pour informer un spawter d'un warning. **Trade-off** :

- ✅ Le `warning_count` est lisible côté spawter SI on l'expose dans le profil (Story 6.4 ne le fait pas — feature additive Sprint 2).
- ⚠️ Un spawter peut accumuler 3 warnings sans le savoir, puis être banni → frustration UX.

**Décision V1** : warnings invisibles côté spawter. Story Sprint 2 (D-644) ajoutera une bannière in-app post-login si `warning_count > N` ou `last_warning_at < 30j`.

### 6. Sign-out forcé `auth.admin.signOut(user_id, "global")`

Supabase Auth admin API expose `signOut(uid, scope)` où `scope = "global"` invalide **toutes** les sessions JWT (refresh tokens) du user. Cohérent doc Supabase 2025.

**Vérification** : Stéphanie teste manuellement post-deploy en bannissant un spawter test → vérifier que le token JWT existant retourne 401 à la prochaine requête `from("spawters").select(...).eq("id", auth.uid())`.

**Limite** : si le JWT est en cache mémoire RN (Zustand store), il reste utilisable jusqu'à expiration (~1h par défaut). Le SDK Supabase auto-refresh va alors retourner 401 → l'app détecte et redirige login. Le délai max d'effet est < 1h.

### 7. Gating UI par role — V1 minimal

| Role | Modération avis | Comptes (CRUD) | Métriques |
|---|---|---|---|
| `admin` | ✅ Tout | ✅ Tout | ✅ |
| `moderator` | ✅ Tout | ✅ Warning + ban (pas suppression compte) | ✅ |
| `operator` | ❌ Read-only | ❌ Read-only | ✅ |

**V1** : gating client uniquement (`useGetIdentity().role`). La défense en profondeur (Edge Function rejette `operator` au ban) est déjà dans `moderate-spawter` (AC #2 ligne `role !== "admin" && role !== "moderator"`).

### 8. Sign-off

- **Stéphanie** (tech) : revue migration `0016` (CHECK constraints, policies), Edge Function `moderate-spawter` (atomicité, sign-out), extension `otp-send` (rejet banni — coordination Story 2.3).
- **Kidam** (analytics) : confirmer que les actions audit log alimentent un futur dashboard modération (Sprint 2 — pas dans Story 6.5 V1).
- **Alexandre** (brand) : revue UI sobre des modals (pas de drift gamification), libellés FR pro (« banni », « avertissement », « Faux-Pas »), absence de dramatisation visuelle.

### 9. Defers identifiés

- **D-641** — Trigger SQL `AFTER UPDATE OF deleted_at` qui invoque recompute ADN (Sprint 2 avec Edge Function `recompute-place-adn` Story 4.7).
- **D-642** — Étendre RLS `spawt_checkin_select_own` pour exclure soft-deleted (`AND deleted_at IS NULL`).
- **D-643** — Edge Function `moderate-review` pour atomicité + colonne-level enforcement (Sprint 2).
- **D-644** — Bannière in-app post-warning côté mobile (Sprint 2).
- **D-645** — Trigger SQL `BEFORE INSERT ON spawt_checkin` qui rejette si `spawters.is_banned = true` (défense en profondeur, Sprint 2).
- **D-646** — Table `review_reports` + workflow signalement FR-017 (Sprint 2 — Story 6.4b).
- **D-647** — Système 3-strikes automatique (`warning_count >= 3 → auto-ban`) (Sprint 2 si decision policy équipe).
- **D-648** — Export CSV de l'audit log pour compliance ARTCI (Sprint 2).
- **D-649** — Page « Spawters bannis » dédiée (côté `/comptes` avec filtre Status = Bannis V1, mais Sprint 2 = page dédiée).

### 10. Risk

- **Risque #1** : Sign-out forcé ne s'applique pas immédiatement si JWT en cache RN → drift < 1h. Mitigation = communication équipe support (« attendre 1h avant suivi banni »).
- **Risque #2** : Staff trompé par UI → ban accidentel d'un compte légitime. Mitigation = modal double-confirm + audit log permettant unban.
- **Risque #3** : Drift ADN post-soft-delete d'un avis pivot (5★ d'un seed). Mitigation = recompute manuel via panel CRUD Story 6.2 (édition ADN admin override).
- **Risque #4** : Extension `otp-send` pour check `is_banned` casse Story 2.3 si non-rétrocompatible. Mitigation = test rétroactif Story 2.3 + flag `is_banned` default false en migration (déjà DEFAULT false par construction).
- **Risque #5** : Vagues de bans suite à incident → indisponibilité Edge Function `moderate-spawter` (rate limit Supabase). Mitigation = batching côté admin V1 = pas implémenté (volume < 10 bans/jour alpha), Sprint 2 si nécessaire.

### Project Structure Notes

- **1 nouvelle migration SQL** : `supabase/migrations/0019_alter_spawters_moderation.sql` + `.down.sql`.
- **1 nouvelle Edge Function** : `supabase/functions/moderate-spawter/{index.ts, index_test.ts, import_map.json}`.
- **1 modif Edge Function existante** : `supabase/functions/otp-send/index.ts` (extension check `is_banned`).
- **Nouveaux fichiers `spawt-admin/src/`** :
  - `pages/moderation/index.tsx`
  - `pages/comptes/index.tsx`, `show.tsx`
  - `components/ReasonModal.tsx`, `ReviewRow.tsx`
  - `constants/moderation.ts` (FAUX_PAS_*)
  - `lib/maskPhone.ts`
  - `styles/moderation.css`, `modal.css`, `comptes.css`
  - Tests (4 fichiers)
- **1 fichier SQL test** : `supabase/tests/0019_moderation.sql` (CHECK constraints).
- **Modif `app/src/i18n/fr.json`** : ajout `errors.account_banned` (handoff coordination Story 2.3).
- **CHANGELOG** : 1 entry `feat(spawt-admin): modération + gestion comptes (Story 6.4)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 1147-1167 — Story 6.4 user story + BDD AC + report FR-017.
- [Source: _bmad-output/planning-artifacts/PRD.md] FR-023 (lignes 499-502), FR-017 reporté (lignes 460-465), §19 Glossaire Faux-Pas (Fake Review, Gatekeeping, Hater Toxique).
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 315-325 (auth staff), 327-330 (conformité ARTCI / audit).
- [Source: _bmad-output/project-context.md] §Vocabulaire SPAWT, §Anti-leaderboard structurel.
- [Source: supabase/migrations/0001_create_spawters_spawt_staff.sql] — schéma spawters cible + policies existantes.
- [Source: supabase/migrations/0011_create_spawt_checkin.sql] — schéma spawt_checkin (colonne `flag_reason`, RLS existantes).
- [Source: supabase/migrations/0012_antifraud_triggers.sql] — `flag_reason` posé serveur (Story 4.4) — input file modération.
- [Source: supabase/migrations/0017_create_admin_audit_log.sql] Story 6.1 — actions `review_*`, `spawter_*` dans CHECK enum.
- [Source: _bmad-output/implementation-artifacts/4-4-anti-fraude-technique-6-triggers-sql.md] §AC #4 — émission `antifraud_flag_raised` + flag_reason consommé.
- [Source: _bmad-output/implementation-artifacts/6-1-...md] — pattern Edge Function + audit log helper.
- [Source: _bmad-output/implementation-artifacts/6-2-...md] — pattern CRUD Refine + audit log.
- [Source: Supabase Auth Admin API] https://supabase.com/docs/reference/javascript/auth-admin-signout — `signOut(uid, "global")`.

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev agent)_

### Debug Log References

_(à remplir par le dev agent)_

### Completion Notes List

_(à remplir par le dev agent)_

### File List

_(à remplir par le dev agent)_
