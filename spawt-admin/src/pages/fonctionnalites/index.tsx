// MAJ consolidée 07/2026 — Page Fonctionnalités : toggles des feature flags
// produit. Flags GLOBAUX uniquement (spawter_id IS NULL), une ligne par
// flag_code, 4 interrupteurs (internal/alpha/beta/prod).
//
// - Query directe Supabase, même voie que metriques/index.tsx (pas de
//   dataProvider Refine : on fait des UPDATE ciblés par id / INSERT).
// - Feedback optimiste + rollback ciblé si erreur (logic.ts, testé).
// - RLS (migration 0004, DECISION D4) : INSERT/UPDATE réservés au staff
//   admin. Un staff non-admin voit la page (SELECT staff actif) mais ses
//   bascules échouent → message « Réservé aux admins ».

import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import {
  SCOPES,
  applyToggle,
  confirmInsert,
  groupGlobalFlags,
  planToggle,
  rollbackToggle,
  toggleErrorMessage,
  type FeatureFlagRow,
  type FlagScope,
} from "./logic";

const FLAG_COLUMNS = "id, flag_code, scope, enabled, spawter_id, expires_at";

export const FonctionnalitesList = () => {
  const [rows, setRows] = useState<FeatureFlagRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabaseClient
        .from("feature_flags")
        .select(FLAG_COLUMNS)
        .is("spawter_id", null)
        .order("flag_code", { ascending: true });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setLoadError(null);
      setRows((data ?? []) as FeatureFlagRow[]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onToggle(flagCode: string, scope: FlagScope) {
    if (!rows) return;
    const key = `${flagCode}:${scope}`;
    if (pending.has(key)) return;
    const plan = planToggle(rows, flagCode, scope);
    const tempId = `temp:${key}`;

    setActionError(null);
    setPending((p) => new Set(p).add(key));
    // Optimiste : l'interrupteur bouge tout de suite ; rollback ciblé si erreur.
    setRows((cur) => (cur ? applyToggle(cur, plan, tempId) : cur));

    try {
      if (plan.kind === "update") {
        const { data, error } = await supabaseClient
          .from("feature_flags")
          .update({ enabled: plan.enabled })
          .eq("id", plan.id)
          .select("id");
        const msg = toggleErrorMessage(error, data?.length ?? 0);
        if (msg) throw new Error(msg);
      } else {
        const { data, error } = await supabaseClient
          .from("feature_flags")
          .insert({
            flag_code: plan.flag_code,
            scope: plan.scope,
            enabled: plan.enabled,
            spawter_id: null,
          })
          .select(FLAG_COLUMNS)
          .single();
        const msg = toggleErrorMessage(error, data ? 1 : 0);
        if (msg) throw new Error(msg);
        setRows((cur) => (cur ? confirmInsert(cur, tempId, data as FeatureFlagRow) : cur));
      }
    } catch (err) {
      setRows((cur) => (cur ? rollbackToggle(cur, plan, tempId) : cur));
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  if (loadError) {
    return (
      <div>
        <h1>Fonctionnalités</h1>
        <p style={{ color: "var(--danger)" }}>Erreur : {loadError}</p>
        <button type="button" onClick={() => void load()}>Réessayer</button>
      </div>
    );
  }
  if (!rows) return <p>Chargement…</p>;

  const groups = groupGlobalFlags(rows);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Fonctionnalités</h1>
        <button type="button" onClick={() => void load()} disabled={refreshing}>
          {refreshing ? "Actualisation…" : "Actualiser"}
        </button>
      </div>
      <p style={{ color: "var(--ink-mute)", fontSize: 12, maxWidth: 720 }}>
        Ces interrupteurs changent l&apos;app en direct (au prochain lancement/refresh des
        spawters), sans redéploiement. Scope actuel de l&apos;app : <strong>prod</strong>.
      </p>

      {actionError ? (
        <p
          role="alert"
          style={{
            background: "var(--bg-warm)",
            color: "var(--danger)",
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {actionError}
        </p>
      ) : null}

      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Fonctionnalité</th>
            {SCOPES.map((scope) => (
              <th key={scope} style={{ textAlign: "center", width: 96 }}>
                {scope}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.flagCode}>
              <td>
                <div>{group.label}</div>
                {group.known ? (
                  <div style={{ fontSize: 11, color: "var(--ink-mute)", fontFamily: "monospace" }}>
                    {group.flagCode}
                  </div>
                ) : null}
              </td>
              {SCOPES.map((scope) => {
                const cell = group.cells[scope];
                const enabled = cell?.enabled ?? false;
                const isPending = pending.has(`${group.flagCode}:${scope}`);
                return (
                  <td key={scope} style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${group.label} — ${scope}`}
                      title={
                        cell?.expires_at
                          ? `Expire le ${new Date(cell.expires_at).toLocaleString("fr-FR")}`
                          : cell
                            ? undefined
                            : "Aucune row pour ce scope — activer la crée"
                      }
                      className={`flag-switch${enabled ? " on" : ""}`}
                      disabled={isPending}
                      onClick={() => void onToggle(group.flagCode, scope)}
                    >
                      <span className="flag-switch-knob" />
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
