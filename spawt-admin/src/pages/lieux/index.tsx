// Story 6.2 — Liste des lieux + filtres + actions ligne.

import { useState } from "react";
import { useNavigate } from "react-router";
import { useTable, useUpdate, useInvalidate } from "@refinedev/core";
import { logAuditAction } from "../../lib/audit";

interface PlaceRow {
  id: string;
  name: string;
  neighborhood: string;
  cuisine: string[];
  price_tier: 1 | 2 | 3;
  is_published: boolean;
  updated_at: string;
  place_adn?: { weighted_rating: number; total_reviews: number; confidence_score: number } | null;
}

export const LieuxList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState<"all" | "yes" | "no">("all");

  const { tableQuery } = useTable<PlaceRow>({
    resource: "places",
    pagination: { pageSize: 25 },
    sorters: { initial: [{ field: "updated_at", order: "desc" }] },
    filters: {
      permanent: [
        ...(search ? [{ field: "name", operator: "contains" as const, value: search }] : []),
        ...(published !== "all"
          ? [{ field: "is_published", operator: "eq" as const, value: published === "yes" }]
          : []),
      ],
    },
    meta: { select: "*, place_adn(weighted_rating, total_reviews, confidence_score)" },
  });

  const { mutate: updatePlace } = useUpdate();
  const invalidate = useInvalidate();

  const rows = (tableQuery.data?.data ?? []) as PlaceRow[];

  async function togglePublish(row: PlaceRow) {
    const next = !row.is_published;
    if (!confirm(next ? "Publier ce lieu ?" : "Dépublier ce lieu ?")) return;
    updatePlace(
      { resource: "places", id: row.id, values: { is_published: next } },
      {
        onSuccess: async () => {
          await logAuditAction({
            action: "place_publish_toggle",
            entity_type: "place",
            entity_id: row.id,
            payload_before: { is_published: row.is_published },
            payload_after: { is_published: next },
          });
          invalidate({ resource: "places", invalidates: ["list"] });
        },
      },
    );
  }

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1>Lieux</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {/* L'import est là où l'opérateur le cherche : à côté de la création
              unitaire, pas enfoui dans un menu. Charger vingt lieux d'un coup
              est le cas normal après une mission terrain. */}
          <button type="button" onClick={() => navigate("/lieux/import")}>
            Importer un fichier
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate("/lieux/create")}>
            + Nouveau lieu
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <input placeholder="Rechercher un nom…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={published} onChange={(e) => setPublished(e.target.value as "all" | "yes" | "no")}>
          <option value="all">Tous</option>
          <option value="yes">Publiés</option>
          <option value="no">Brouillons</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nom</th>
            <th>Quartier</th>
            <th>Cuisine</th>
            <th>Tier</th>
            <th>Note</th>
            <th>Avis</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><strong>{row.name}</strong></td>
              <td>{row.neighborhood}</td>
              <td>{row.cuisine.join(", ")}</td>
              <td>{row.price_tier}</td>
              <td>{row.place_adn?.weighted_rating?.toFixed(2) ?? "—"}</td>
              <td>{row.place_adn?.total_reviews ?? 0}</td>
              <td>{row.is_published ? "Publié" : "Brouillon"}</td>
              <td style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => navigate(`/lieux/edit/${row.id}`)}>Éditer</button>
                <button type="button" onClick={() => togglePublish(row)}>
                  {row.is_published ? "Dépublier" : "Publier"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
