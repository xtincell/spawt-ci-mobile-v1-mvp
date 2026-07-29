// Story 6.4 — Liste des spawters avec filtres + actions warning/ban.

import { useState } from "react";
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

  const { tableQuery } = useTable<SpawterRow>({
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
      ],
    },
  });

  const rows = (tableQuery.data?.data ?? []) as SpawterRow[];

  return (
    <div>
      <h1>Comptes spawters</h1>
      <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
        <input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="banned">Bannis</option>
        </select>
        <select value={stade} onChange={(e) => setStade(e.target.value)}>
          <option value="all">Tous stades</option>
          {STADES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </select>
        <label>Warnings ≥ <input type="number" min={0} value={minWarnings}
          onChange={(e) => setMinWarnings(Math.max(0, Number(e.target.value)))} style={{ width: 60 }} /></label>
      </div>
      <table>
        <thead>
          <tr>
            <th>Display name</th>
            <th>Phone (masqué)</th>
            <th>Quartier</th>
            <th>Stade</th>
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
