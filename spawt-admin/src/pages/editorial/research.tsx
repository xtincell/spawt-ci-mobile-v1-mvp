import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";
import { usePlaces } from "../../lib/usePlaces";
import { editorialError, parseResearchJsonl } from "./logic";

type RecordRow = { record_id: string; source_id: string; place_name: string | null; record_type: string; source_url: string | null; published_at: string | null; place_id: string | null; review_status: string; facts: Record<string, unknown> };
export function ResearchQueue() {
  const { places } = usePlaces();
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState("place");
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const lock = useRef(false);
  const stop = useRef(false);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [target, setTarget] = useState("");
  useEffect(() => {
    let current = true; setLoading(true); setError(""); setRows([]); setSelected(null);
    let q = supabaseClient.from("research_records").select("record_id,source_id,place_name,record_type,source_url,published_at,place_id,review_status,facts").order("record_id").range(page * 50, page * 50 + 49);
    if (kind !== "all") q = q.eq("record_type", kind);
    if (status !== "all") q = q.eq("review_status", status);
    void Promise.resolve(q).then(r => { if (!current) return; if (r.error) setError(editorialError(r.error)); else setRows(r.data ?? []); setLoading(false); }).catch(e => { if (current) { setError(editorialError(e)); setLoading(false); } });
    return () => { current = false; };
  }, [page, kind, status, attempt]);
  useEffect(() => () => { stop.current = true; }, []);
  async function read(file: File) {
    setError(""); setPending([]);
    try {
      if (file.size > 65000000) throw new Error("Fichier trop volumineux : limite 65 Mo.");
      const data = parseResearchJsonl(await file.text());
      setPending(data); setProgress(`${data.length.toLocaleString("fr-FR")} lignes analysées. Rien n’a encore été écrit.`);
    } catch (e) { setError(editorialError(e)); }
  }
  async function importRecords() {
    if (lock.current) return; lock.current = true; stop.current = false; setBusy(true); setError("");
    let done = 0;
    try {
      for (let start = 0; start < pending.length && !stop.current; start += 100) {
        const batch = pending.slice(start, start + 100);
        const r = await supabaseClient.rpc("import_research_records", { p_records: batch });
        if (r.error) throw r.error; done += batch.length;
        setProgress(`${done.toLocaleString("fr-FR")} / ${pending.length.toLocaleString("fr-FR")} lignes traitées (création ou actualisation).`);
      }
      setProgress(`${done.toLocaleString("fr-FR")} lignes traitées. ${stop.current ? "Import arrêté entre deux lots ; la reprise est idempotente." : "Import terminé dans la base de recherche interne."}`);
      if (!stop.current) setPending([]);
      setAttempt(n => n + 1);
    } catch (e) { setError(`${editorialError(e)} ${done} lignes ont déjà été traitées ; relancer le fichier ne duplique pas les sources.`); }
    finally { lock.current = false; setBusy(false); }
  }
  async function link(nextStatus: string) {
    if (!selected || lock.current) return; lock.current = true; setBusy(true); setError("");
    try {
      const r = await supabaseClient.rpc("link_research_record", { p_record_id: selected.record_id, p_place_id: nextStatus === "linked" ? target : null, p_status: nextStatus });
      if (r.error) throw r.error; setAttempt(n => n + 1); setProgress("Rapprochement enregistré. La fiche du lieu n’a pas été écrasée.");
    } catch (e) { setError(editorialError(e)); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="editorial-workspace" style={{ maxWidth: 1100 }}><h1>Recherche et rapprochement des lieux</h1>
    <p>Importer le corpus minimisé, examiner les sources et les rattacher à une fiche. Aucune note externe ne devient un avis SPAWT ; aucun rapprochement ne remplace automatiquement le contenu éditorial.</p>
    <p><a href="https://spawt-etude-marche-abidjan.sunsetbream2.chatgpt.site" target="_blank" rel="noreferrer">Consulter l’étude et le classeur ↗</a></p>
    <fieldset disabled={busy}><legend>Importer un export JSONL de recherche</legend><input aria-label="Fichier de recherche JSONL" type="file" accept=".jsonl,.ndjson" onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); }} /><p>Seuls les identifiants, faits sourcés, dates et codes de thèmes autorisés sont retenus. Textes d’avis et auteurs sont écartés.</p><button disabled={!pending.length} onClick={() => void importRecords()}>Importer {pending.length.toLocaleString("fr-FR")} lignes dans la recherche</button></fieldset>
    {busy && <button onClick={() => { stop.current = true; }}>Arrêter après le lot en cours</button>}
    {progress && <p role="status">{progress}</p>}{error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
    <div style={{ display: "flex", gap: 12, margin: "20px 0" }}><label>Type<select disabled={busy} value={kind} onChange={e => { setKind(e.target.value); setPage(0); }}><option value="place">Lieux</option><option value="review">Avis codés</option><option value="article">Articles</option><option value="discussion">Discussions</option><option value="all">Tous</option></select></label><label>État<select disabled={busy} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="pending">À examiner</option><option value="linked">Rattachés</option><option value="rejected">Écartés</option><option value="all">Tous</option></select></label><button onClick={() => setAttempt(n => n + 1)}>Actualiser</button></div>
    {loading ? <p role="status">Chargement…</p> : <><div style={{ overflowX: "auto" }}><table><thead><tr><th>Lieu / référence</th><th>Source</th><th>État</th><th>Action</th></tr></thead><tbody>{rows.map(r => <tr key={r.record_id}><td>{r.place_name || r.record_id}</td><td>{r.source_id}</td><td>{r.review_status}</td><td><button disabled={busy} onClick={() => { setSelected(r); setTarget(r.place_id ?? ""); }}>Examiner</button>{r.place_id && <Link to={`/lieux/editorial/${r.place_id}`}>Rédaction</Link>}</td></tr>)}</tbody></table></div>{!rows.length && <p>Aucune ligne dans cette vue. Importer un corpus ou modifier les filtres.</p>}</>}
    <div style={{ display: "flex", gap: 16, marginTop: 16 }}><button disabled={!page || busy} onClick={() => setPage(n => n - 1)}>Précédent</button><span>Page {page + 1}</span><button disabled={rows.length < 50 || busy} onClick={() => setPage(n => n + 1)}>Suivant</button></div>
    {selected && <section><h2>{selected.place_name || "Référence de recherche"}</h2>{selected.source_url && /^https?:\/\//i.test(selected.source_url) && <a href={selected.source_url} target="_blank" rel="noreferrer">Ouvrir la source</a>}<dl>{Object.entries(selected.facts).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v === null ? "Non renseigné" : typeof v === "object" ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
      <label>Fiche existante vérifiée<select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value="">Choisir un lieu</option>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button disabled={!target || busy} onClick={() => void link("linked")}>Rattacher cette source</button><button disabled={busy} onClick={() => void link("rejected")}>Écarter cette référence</button><p><Link to="/lieux/create">Créer une fiche après vérification</Link> — les valeurs inconnues doivent être recherchées, pas déduites d’une note.</p></section>}
  </div>;
}
