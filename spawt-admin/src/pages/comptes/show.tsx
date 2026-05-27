// Story 6.4 — Détail spawter avec actions warning/ban.

import { useState } from "react";
import { useParams } from "react-router";
import { useOne, useGetIdentity, useInvalidate } from "@refinedev/core";
import { ReasonModal, FAUX_PAS_SPAWTER } from "../../components/ReasonModal";
import { moderateSpawter } from "../../lib/moderate-spawter";
import { maskPhone } from "./index";

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
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!id) return <p>ID manquant</p>;
  if (query.isLoading) return <p>Chargement…</p>;
  const spawter = query.data?.data as Record<string, unknown> | undefined;
  if (!spawter) return <p>Spawter introuvable</p>;

  async function onConfirm(reason: string) {
    if (!modalKind || !id || submitting) return;
    // CR Chunk B Edge#34 — disable submit pour éviter le double-ban (warning_count++
    // double, ALREADY_BANNED 409 sur 2e click rapide).
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const action = modalKind === "warning" ? "warning" : modalKind === "ban" ? "ban" : "unban";
      const res = await moderateSpawter(id, action, reason);
      if (!res.ok) {
        setErrorMsg(`Erreur : ${res.error?.code ?? "inconnue"}`);
        return;
      }
      invalidate({ resource: "spawters", invalidates: ["detail", "list"] });
      setModalKind(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>{String(spawter.display_name)}</h1>
      <p>
        {/* CR Chunk B m2 — masquage cohérent avec la liste. Admin n'a pas
           besoin du téléphone clair en V1. Sprint 2 = bouton "Révéler" + audit. */}
        Phone : {maskPhone(String(spawter.phone_e164))} · Quartier : {String(spawter.neighborhood ?? "—")} ·
        Stade : <strong>{String(spawter.stade)}</strong>
      </p>
      {errorMsg ? (
        <p style={{ background: "#3a1c1c", color: "#fff", padding: 10, borderRadius: 6 }}>{errorMsg}</p>
      ) : null}
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
        <button type="button" disabled={!canModerate || submitting} onClick={() => setModalKind("warning")}>
          Warning
        </button>
        {!spawter.is_banned ? (
          <button type="button" className="btn-destructive" disabled={!canModerate || submitting} onClick={() => setModalKind("ban")}>
            Bannir
          </button>
        ) : (
          <button type="button" disabled={!canModerate || submitting} onClick={() => setModalKind("unban")}>
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
