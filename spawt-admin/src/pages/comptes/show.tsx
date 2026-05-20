// Story 6.4 — Détail spawter avec actions warning/ban.

import { useState } from "react";
import { useParams } from "react-router";
import { useOne, useGetIdentity, useInvalidate } from "@refinedev/core";
import { ReasonModal, FAUX_PAS_SPAWTER } from "../../components/ReasonModal";
import { moderateSpawter } from "../../lib/moderate-spawter";

export const CompteShow = () => {
  const { id } = useParams<{ id: string }>();
  const invalidate = useInvalidate();
  const { data: identity } = useGetIdentity<{ role: "admin" | "moderator" | "operator" }>();
  const canModerate = identity?.role === "admin" || identity?.role === "moderator";

  const { query } = useOne({
    resource: "spawters",
    id: id ?? "",
    queryOptions: { enabled: !!id },
  });

  const [modalKind, setModalKind] = useState<"warning" | "ban" | "unban" | null>(null);

  if (!id) return <p>ID manquant</p>;
  if (query.isLoading) return <p>Chargement…</p>;
  const spawter = query.data?.data as Record<string, unknown> | undefined;
  if (!spawter) return <p>Spawter introuvable</p>;

  async function onConfirm(reason: string) {
    if (!modalKind || !id) return;
    const action = modalKind === "warning" ? "warning" : modalKind === "ban" ? "ban" : "unban";
    const res = await moderateSpawter(id, action, reason);
    if (!res.ok) {
      alert(`Erreur : ${res.error?.code ?? "inconnue"}`);
      return;
    }
    invalidate({ resource: "spawters", invalidates: ["detail", "list"] });
    setModalKind(null);
  }

  return (
    <div>
      <h1>{String(spawter.display_name)}</h1>
      <p>
        Phone : {String(spawter.phone_e164)} · Quartier : {String(spawter.neighborhood ?? "—")} ·
        Stade : <strong>{String(spawter.stade)}</strong>
      </p>
      <p>
        Spawts : <strong>{Number(spawter.total_spawts)}</strong> · Unique spots :{" "}
        <strong>{Number(spawter.unique_spots)}</strong> · Warnings :{" "}
        <strong>{Number(spawter.warning_count)}</strong>
      </p>
      {spawter.last_warning_at ? (
        <p>Dernier warning : {String(spawter.last_warning_at)} — « {String(spawter.last_warning_reason)} »</p>
      ) : null}
      {spawter.is_banned ? (
        <p style={{ background: "var(--danger)", color: "white", padding: 8, borderRadius: 6 }}>
          BANNI le {String(spawter.banned_at)} — Motif : {String(spawter.banned_reason)}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button type="button" disabled={!canModerate} onClick={() => setModalKind("warning")}>
          Warning
        </button>
        {!spawter.is_banned ? (
          <button type="button" className="btn-destructive" disabled={!canModerate} onClick={() => setModalKind("ban")}>
            Bannir
          </button>
        ) : (
          <button type="button" disabled={!canModerate} onClick={() => setModalKind("unban")}>
            Débannir
          </button>
        )}
      </div>

      {modalKind ? (
        <ReasonModal
          isOpen
          title={modalKind === "ban" ? "Bannir ce spawter" : modalKind === "unban" ? "Débannir" : "Avertir ce spawter"}
          confirmLabel={modalKind === "ban" ? "Bannir" : modalKind === "unban" ? "Débannir" : "Envoyer warning"}
          destructive={modalKind === "ban"}
          fauxPasOptions={modalKind === "unban" ? undefined : FAUX_PAS_SPAWTER}
          onCancel={() => setModalKind(null)}
          onConfirm={onConfirm}
        />
      ) : null}
    </div>
  );
};
