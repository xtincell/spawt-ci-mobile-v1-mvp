// Story 6.4 — Liste des spawters avec filtres + actions warning/ban.

import { useState } from "react";
import { ListFeedback, ListPagination } from "../../components/ListFeedback";
import { useNavigate } from "react-router";
import { useTable } from "@refinedev/core";

interface SpawterRow {
  id: string;
  display_name: string;
  phone_e164: string;
  neighborhood: string | null;
  stade: string;
  total_spawts: number;
  warning_count: number;
  is_banned: boolean;
  is_demo: boolean;
  is_seed: boolean;
  is_internal: boolean;
}

const STADES = ["touriste", "explorateur", "detective", "djidji", "guide"];

// CR Chunk B m2 — masquage E.164 strict. Garde l'indicatif pays (+225) pour
// contextualiser le compte côté admin, masque TOUT le reste sauf les 2 derniers
// chiffres. Ne préserve plus les chiffres opérateur (qui permettaient à un staff
// de deviner Orange/MTN/Moov).
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone;
  // E.164 attendu : +225XXXXXXXXXX
  const match = phone.match(/^(\+\d{1,3})(.+)$/);
  if (!match) {
    return `••• ${phone.slice(-2)}`;
  }
  const [, prefix, rest] = match;
  if (rest.length <= 2) return `${prefix}${rest}`;
  return `${prefix} •• •• ${rest.slice(-2)}`;
}

export const ComptesList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "banned">("all");
  const [stade, setStade] = useState<"all" | string>("all");
  const [minWarnings, setMinWarnings] = useState(0);
  const [kind, setKind] = useState<"all" | "demo" | "seed" | "internal">("all");

  const { tableQuery, currentPage, setCurrentPage, pageCount } = useTable<SpawterRow>({
    resource: "spawters",
    pagination: { pageSize: 50 },
    sorters: { initial: [{ field: "updated_at", order: "desc" }] },
    filters: {
      permanent: [
        ...(search ? [{ field: "display_name", operator: "contains" as const, value: search }] : []),
        ...(status === "active" ? [{ field: "is_banned", operator: "eq" as const, value: false }] : []),
        ...(status === "banned" ? [{ field: "is_banned", operator: "eq" as const, value: true }] : []),
        ...(stade !== "all" ? [{ field: "stade", operator: "eq" as const, value: stade }] : []),
        ...(minWarnings > 0 ? [{ field: "warning_count", operator: "gte" as const, value: minWarnings }] : []),
        ...(kind !== "all" ? [{ field: `is_${kind}`, operator: "eq" as const, value: true }] : []),
      ],
    },
    // Exiger le marqueur : une base non migrée doit rendre une erreur visible,
    // jamais faire passer les comptes de test pour des comptes ordinaires.
    meta: { select: "*, is_demo" },
  });

  const rows = (tableQuery.isError ? [] : tableQuery.data?.data ?? []) as SpawterRow[];

  return (
    <div>
      <h1>Comptes spawters</h1>
      <p>Les comptes « Démo alpha » sont identifiés explicitement pour les tests. Les comptes fondateurs et les accès internes restent distincts.</p>
      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <input placeholder="Rechercher…" value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setCurrentPage(1); }}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="banned">Bannis</option>
        </select>
        <select value={stade} onChange={(e) => { setStade(e.target.value); setCurrentPage(1); }}>
          <option value="all">Tous stades</option>
          {STADES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <select aria-label="Type de compte" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setCurrentPage(1); }}>
          <option value="all">Tous les types</option>
          <option value="demo">Démo alpha</option>
          <option value="seed">Comptes fondateurs</option>
          <option value="internal">Accès internes</option>
        </select>
        <label>Warnings ≥ <input type="number" min={0} value={minWarnings}
          onChange={(e) => { setMinWarnings(Math.max(0, Number(e.target.value))); setCurrentPage(1); }} style={{ width: 60 }} /></label>
      </div>
      <ListFeedback query={tableQuery} empty={rows.length === 0} />
      <ListPagination currentPage={currentPage} pageCount={pageCount} onPageChange={setCurrentPage} disabled={tableQuery.isFetching} />
      <table>
        <thead>
          <tr>
            <th>Display name</th>
            <th>Phone (masqué)</th>
            <th>Quartier</th>
            <th>Stade</th>
            <th>Type</th>
            <th>Spawts</th>
            <th>Warnings</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.display_name}</td>
              <td>{maskPhone(row.phone_e164)}</td>
              <td>{row.neighborhood ?? "—"}</td>
              <td>{row.stade}</td>
              <td>
                {row.is_demo ? <strong>Démo alpha</strong> : row.is_seed ? "Fondateur" : "Spawter"}
                {row.is_internal ? <span className="role-badge">Interne</span> : null}
              </td>
              <td>{row.total_spawts}</td>
              <td>{row.warning_count}</td>
              <td>{row.is_banned ? "Banni" : "Actif"}</td>
              <td>
                <button type="button" onClick={() => navigate(`/comptes/show/${row.id}`)}>Voir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
