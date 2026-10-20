import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";
interface Feedback { id: string; spawter_id: string; kind: string; message: string; context: string; diagnostics: Record<string, unknown>; status: string; staff_reply: string; created_at: string }
const statuses: Record<string,string> = { received: "Reçu", reviewing: "En cours", resolved: "Résolu" };
const kinds: Record<string,string> = { bug: "Souci", content: "Contenu", idea: "Idée" };
export function RetoursList() {
  const [rows, setRows] = useState<Feedback[]>([]); const [error, setError] = useState("");
  const [page, setPage] = useState(0); const [filter, setFilter] = useState(""); const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    let query = supabaseClient.from("app_feedback").select("*").order("created_at", { ascending: false }).range(page*25, page*25+24);
    if (filter) query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) setError("Les retours n’ont pas pu être chargés."); else { setError(""); setRows(data ?? []); setLoaded(true); }
  }, [page, filter]);
  useEffect(() => { void load(); }, [load]);
  return <div><h1>Retours de l’app</h1><p>Messages privés envoyés depuis l’app. La réponse et le statut sont visibles par leur auteur dans « Aide et retours ». Enregistrer ne déclenche aucune notification.</p>
    <label>Statut <select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}><option value="">Tous</option>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label> <button onClick={() => void load()}>Actualiser</button>
    {error ? <p role="alert">{error}</p> : null}{loaded && !error && rows.length===0 ? <p>Aucun retour pour ce filtre.</p> : null}
    {rows.map(row => <FeedbackCard key={row.id} row={row} onSaved={load} />)}
    <button disabled={page===0} onClick={() => setPage(p=>p-1)}>Précédent</button> <button disabled={rows.length<25} onClick={() => setPage(p=>p+1)}>Suivant</button>
  </div>;
}
function FeedbackCard({ row, onSaved }: { row: Feedback; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState(row.status); const [reply, setReply] = useState(row.staff_reply); const [busy, setBusy] = useState(false); const [result, setResult] = useState("");
  const save = async () => {
    setBusy(true); setResult("");
    try {
      const { data, error } = await supabaseClient.from("app_feedback").update({ status, staff_reply: reply }).eq("id", row.id).select("id").single();
      if (error || !data) throw new Error("save_failed");
      setResult("Enregistré — visible dans l’app."); await onSaved();
    } catch { setResult("Échec d’enregistrement. Le texte est conservé ici."); } finally { setBusy(false); }
  };
  return <section aria-label={`Retour ${row.id.slice(0,8)}`} style={{ border: "1px solid var(--border)", padding: 20, marginBlock: 20 }}>
    <h2>{kinds[row.kind] ?? row.kind} · {row.id.slice(0,8)}</h2><p>{new Date(row.created_at).toLocaleString("fr-FR")} · <Link to={`/comptes/show/${row.spawter_id}`}>Voir le compte</Link></p>
    <p style={{ whiteSpace: "pre-wrap" }}>{row.message}</p><details><summary>Contrôles joints par l’auteur</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(row.diagnostics,null,2)}</pre></details>
    <label>Statut <select value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label style={{ display: "block" }}>Réponse visible par l’auteur<textarea aria-label="Réponse visible par l’auteur" value={reply} maxLength={4000} disabled={busy} onChange={e=>setReply(e.target.value)} style={{ display: "block", width: "100%", minHeight: 90 }} /></label>
    <button disabled={busy} onClick={()=>void save()}>Enregistrer la réponse</button>{result ? <p role="status">{result}</p> : null}
  </section>;
}
