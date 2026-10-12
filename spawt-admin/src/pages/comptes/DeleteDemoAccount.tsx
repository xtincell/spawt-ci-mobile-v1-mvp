import { useState } from "react";
import { useInvalidate } from "@refinedev/core";
import { useNavigate } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";

const DELETE_ERRORS: Record<string, string> = {
  demo_admin_required: "Seul un admin actif peut supprimer un compte démo.",
  demo_self_delete_forbidden: "Tu ne peux pas supprimer ta propre session depuis cet écran.",
  demo_staff_delete_forbidden: "Ce compte appartient à l’équipe et ne peut pas être supprimé ici.",
  demo_not_found: "Ce compte a déjà été supprimé ou n’existe plus.",
  demo_only: "Seuls les comptes marqués Démo alpha peuvent être supprimés.",
  demo_seed_delete_forbidden: "Ce compte porte des avis fondateurs et ne peut pas être supprimé ici.",
  demo_confirmation_mismatch: "Le nom saisi ne correspond plus au compte. Actualise sa fiche avant de réessayer.",
};

/** La RPC revérifie le rôle staff, le marqueur démo et le nom côté serveur. */
export function DeleteDemoAccount({ id, displayName }: { id: string; displayName: string }) {
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy || confirmation !== displayName) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabaseClient.rpc("admin_delete_demo_spawter", {
        p_spawter_id: id,
        p_confirmation: confirmation,
      });
      if (rpcError) throw new Error(DELETE_ERRORS[rpcError.message] ?? rpcError.message);
      if (!data || data.ok !== true) throw new Error("La suppression n'a pas été confirmée par le serveur.");
      await invalidate({ resource: "spawters", invalidates: ["list", "detail"] });
      navigate("/comptes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "La suppression a échoué. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: 24, padding: 16, border: "1px solid var(--danger)", borderRadius: 8 }}>
      <h2>Compte de démonstration alpha</h2>
      <p>Ce compte a été marqué pour les tests. Sa suppression retire aussi son accès à SPAWT et ses données liées, de façon définitive.</p>
      {!open ? (
        <button type="button" className="btn-destructive" onClick={() => { setOpen(true); setError(null); setConfirmation(""); }}>
          Supprimer ce compte démo
        </button>
      ) : (
        <form aria-label="Confirmer la suppression du compte démo" onSubmit={(event) => { event.preventDefault(); void remove(); }}>
          <p>Cette action est irréversible. Recopie exactement <strong>{displayName}</strong> pour confirmer.</p>
          <label>
            Nom du compte à supprimer
            <input autoFocus autoComplete="off" value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} style={{ display: "block", margin: "8px 0", width: "100%", maxWidth: 420 }} />
          </label>
          {error ? <p role="alert" style={{ color: "var(--danger)" }}>Suppression impossible : {error}</p> : null}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" className="btn-destructive" disabled={busy || confirmation !== displayName}>
              {busy ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)}>Annuler</button>
          </div>
        </form>
      )}
    </section>
  );
}
