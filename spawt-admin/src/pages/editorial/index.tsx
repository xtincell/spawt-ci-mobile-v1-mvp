import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";
import { EDITORIAL_FIELDS, editorialError, missingProfileFields, type EditorialDocument } from "./logic";

type Note = { id: string; body: string; author_id: string; created_at: string };
type Review = { id: string; author_id: string; body: string; visited_on: string; note_cuisine: number | null; note_cadre: number | null; note_service: number | null; revision: number; is_published: boolean };
const blankReview = (): Review => ({ id: crypto.randomUUID(), author_id: "", body: "", visited_on: "", note_cuisine: null, note_cadre: null, note_service: null, revision: 0, is_published: false });

export function PlaceEditorial() {
  const { id } = useParams<{ id: string }>();
  const [place, setPlace] = useState<Record<string, unknown> | null>(null);
  const [doc, setDoc] = useState<EditorialDocument>({ sections: [] });
  const [revision, setRevision] = useState(0);
  const [sources, setSources] = useState<{ record_id: string; source_id: string; source_url: string | null; published_at: string | null; facts: Record<string, unknown> }[]>([]);
  const [history, setHistory] = useState<{ id: number; entity_table: string; actor_id: string; created_at: string; before_value: unknown; after_value: unknown }[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [staffId, setStaffId] = useState("");
  const [review, setReview] = useState<Review>(blankReview);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [team, setTeam] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let current = true; setNote(""); setReview(blankReview()); setEditingNote(null); setLoading(true); setError(""); setPlace(null); setDirty(false);
    Promise.all([
      supabaseClient.from("places").select("*").eq("id", id).single(),
      supabaseClient.from("place_editorial_profiles").select("*").eq("place_id", id).maybeSingle(),
      supabaseClient.from("place_editorial_notes").select("*").eq("place_id", id).order("created_at", { ascending: false }),
      supabaseClient.from("place_editorial_reviews").select("*").eq("place_id", id).order("updated_at", { ascending: false }),
      supabaseClient.from("editorial_team").select("id,display_name"),
      supabaseClient.rpc("current_staff"),
      supabaseClient.from("research_records").select("record_id,source_id,source_url,published_at,facts").eq("place_id", id).order("published_at", { ascending: false }).limit(50),
      supabaseClient.from("editorial_history").select("*").eq("entity_key", id).order("created_at", { ascending: false }).limit(30),
    ]).then(results => {
      if (!current) return;
      const failure = results.find(r => r.error)?.error;
      if (failure) throw failure;
      setPlace(results[0].data); setDoc(results[1].data?.document ?? { sections: [] }); setRevision(results[1].data?.revision ?? 0);
      setNotes(results[2].data ?? []); setReviews(results[3].data ?? []);
      setTeam(Object.fromEntries((results[4].data ?? []).map((s: { id: string; display_name: string }) => [s.id, s.display_name])));
      const staff = Array.isArray(results[5].data) ? results[5].data[0] : results[5].data;
      setSources(results[6].data ?? []); setHistory(results[7].data ?? []);
      setIsAdmin(staff?.role === "admin"); setStaffId(staff?.id ?? "");
    }).catch(e => { if (current) setError(editorialError(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id, attempt]);
  async function action(work: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (e) { setError(editorialError(e)); } finally { lock.current = false; setBusy(false); }
  }
  function change(key: string, value: unknown) { setDoc(d => ({ ...d, [key]: value })); setDirty(true); }
  if (loading) return <p role="status">Chargement de l’espace éditorial…</p>;
  if (!place) return <div><p role="alert">{error || "Lieu introuvable."}</p><button onClick={() => setAttempt(n => n + 1)}>Réessayer</button></div>;
  const missing = missingProfileFields(place, doc);
  return <div style={{ maxWidth: 920, display: "grid", gap: 18 }}>
    <h1>{String(place.name)} — rédaction</h1>
    <p><Link to={`/lieux/edit/${id}`}>Fiche pratique, photos, horaires et ADN</Link> · <Link to="/explore">Carnets éditoriaux</Link></p>
    <p>Les notes d’équipe sont internes. Les textes et avis ne deviennent publics qu’après publication. Les avis de recherche restent séparés.</p>
    {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}{message && <p role="status">{message}</p>}
    <fieldset disabled={busy}><legend>Profil identitaire — brouillon partagé, version {revision}</legend>
      {EDITORIAL_FIELDS.map(([key, label]) => <label key={key} style={{ display: "block", marginBottom: 12 }}>{label}<textarea aria-label={label} value={String(doc[key] ?? "")} onChange={e => change(key, e.target.value)} rows={3} maxLength={5000} style={{ width: "100%" }} /></label>)}
      <label>Vérifié le<input type="date" value={String(doc.verified_on ?? "")} onChange={e => change("verified_on", e.target.value)} /></label>
      <label>Dernière publication observée<input type="datetime-local" value={String(doc.last_activity_at ?? "")} onChange={e => change("last_activity_at", e.target.value)} /></label>
      <label>Activité du lieu<select value={String(doc.operating_status ?? "unknown")} onChange={e => change("operating_status", e.target.value)}><option value="unknown">À vérifier</option><option value="open">Ouverture confirmée</option><option value="temporarily_closed">Fermeture temporaire signalée</option><option value="permanently_closed">Fermeture définitive signalée</option></select></label>
      <label>Droits des photos<select value={String(doc.photo_rights ?? "unknown")} onChange={e => change("photo_rights", e.target.value)}><option value="unknown">À vérifier</option><option value="confirmed">Droits confirmés</option></select></label>
      <h2>Rubriques éditoriales</h2><p>Ces titres et textes viennent du serveur. Leur modification ne nécessite pas de compilation.</p>
      {(doc.sections ?? []).map((s, i) => <div key={i} style={{ marginBottom: 12 }}><label>Titre de la rubrique {i + 1}<input maxLength={120} value={s.title} onChange={e => change("sections", doc.sections?.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /></label><label>Texte de la rubrique {i + 1}<textarea rows={3} maxLength={5000} value={s.body} onChange={e => change("sections", doc.sections?.map((x, j) => j === i ? { ...x, body: e.target.value } : x))} /></label><button type="button" onClick={() => change("sections", doc.sections?.filter((_, j) => j !== i))}>Retirer la rubrique {i + 1}</button></div>)}
      <button disabled={(doc.sections?.length ?? 0) >= 12} onClick={() => change("sections", [...(doc.sections ?? []), { title: "", body: "" }])}>Ajouter une rubrique</button>
      <button onClick={() => void action(async () => {
        const r = await supabaseClient.rpc("save_place_editorial_profile", { p_place_id: id, p_document: doc, p_expected_revision: revision });
        if (r.error) throw r.error; setRevision(r.data.revision); setDirty(false); setMessage("Brouillon enregistré. La version publique reste inchangée.");
      })}>Enregistrer le brouillon</button>
      <p>{missing.length ? `À compléter : ${missing.join(" · ")}` : "Les champs requis sont renseignés. Vérifie leur exactitude avant publication."}</p>
      <button disabled={!isAdmin || !!missing.length || !revision || dirty} onClick={() => void action(async () => {
        const r = await supabaseClient.rpc("publish_place_editorial_profile", { p_place_id: id, p_expected_revision: revision, p_publish: true });
        if (r.error) throw r.error; setMessage("Profil éditorial publié sur le serveur. Le lieu conserve son propre statut de publication.");
      })}>Publier le profil enregistré</button>
      <button disabled={!isAdmin || !revision || dirty} onClick={() => void action(async () => {
        const r = await supabaseClient.rpc("publish_place_editorial_profile", { p_place_id: id, p_expected_revision: revision, p_publish: false });
        if (r.error) throw r.error; setMessage("Profil éditorial retiré de la lecture publique. Le brouillon est conservé.");
      })}>Retirer le profil public</button>
      {!isAdmin && <p>La publication est réservée aux admins de l’équipe.</p>}
    </fieldset>
    <fieldset disabled={busy}><legend>Notes internes de l’équipe</legend><label>Nouvelle note<textarea value={note} maxLength={10000} onChange={e => setNote(e.target.value)} rows={4} style={{ width: "100%" }} /></label><button disabled={!note.trim()} onClick={() => void action(async () => {
      const r = await supabaseClient.from("place_editorial_notes").insert({ place_id: id, body: note.trim() }).select("*").single();
      if (r.error) throw r.error; setNotes(n => [r.data, ...n]); setNote(""); setMessage("Note ajoutée. Elle reste privée à l’équipe.");
    })}>Ajouter la note</button>{notes.map(n => <article key={n.id}><b>{team[n.author_id] ?? "Équipe SPAWT"} · {new Date(n.created_at).toLocaleDateString("fr-FR")}</b><p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>{(isAdmin || n.author_id === staffId) && <button onClick={() => { setEditingNote(n); setEditedBody(n.body); }}>Modifier la note</button>}</article>)}
      {editingNote && <div><label>Modifier la note interne<textarea value={editedBody} maxLength={10000} onChange={e => setEditedBody(e.target.value)} /></label><button disabled={!editedBody.trim()} onClick={() => void action(async () => {
        const r = await supabaseClient.rpc("edit_editorial_note", { p_id: editingNote.id, p_body: editedBody, p_expected_body: editingNote.body });
        if (r.error) throw r.error; setNotes(list => list.map(n => n.id === r.data.id ? r.data : n)); setEditingNote(null); setMessage("Note modifiée ; la version précédente reste dans l’historique.");
      })}>Enregistrer la note modifiée</button><button onClick={() => setEditingNote(null)}>Annuler</button></div>}
    </fieldset>
    <details><summary>Sources rattachées ({sources.length}, 50 dernières au maximum)</summary><p>Des indices à vérifier, pas des faits automatiquement validés. La date d’une publication ne prouve pas une visite ni une ouverture actuelle.</p>{sources.map(s => <article key={s.record_id}><b>{s.source_id} · {s.published_at ?? "Date inconnue"}</b>{s.source_url && /^https?:\/\//i.test(s.source_url) && <p><a href={s.source_url} target="_blank" rel="noreferrer">Consulter la source</a></p>}<pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(s.facts, null, 2)}</pre></article>)}<Link to="/recherche">Gérer les rapprochements</Link></details>
    <details><summary>Historique chargé à l’ouverture (30 dernières opérations)</summary>{history.map(h => <details key={h.id}><summary>{team[h.actor_id] ?? "Équipe"} · {new Date(h.created_at).toLocaleString("fr-FR")} · {h.entity_table}</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ avant: h.before_value, après: h.after_value }, null, 2)}</pre></details>)}</details>
    <fieldset disabled={busy}><legend>Avis éditorial de terrain</legend><p>Une observation vécue, attribuée à ton compte d’équipe. Aucun avis externe ne doit être recopié ici. Ces avis restent distincts des visites et compteurs communautaires.</p>
      <label>Date de visite<input type="date" value={review.visited_on} onChange={e => setReview(r => ({ ...r, visited_on: e.target.value }))} /></label>
      <label>Commentaire<textarea value={review.body} onChange={e => setReview(r => ({ ...r, body: e.target.value }))} maxLength={10000} rows={4} style={{ width: "100%" }} /></label>
      {([['note_cuisine','Cuisine'],['note_cadre','Cadre'],['note_service','Service']] as const).map(([key,label]) => <label key={key}>{label}<select value={review[key] ?? ""} onChange={e => setReview(r => ({ ...r, [key]: e.target.value ? Number(e.target.value) : null }))}><option value="">Non évalué</option>{[1,2,3,4,5].map(n => <option key={n} value={n}>{n}/5</option>)}</select></label>)}
      <label><input type="checkbox" disabled={!isAdmin} checked={review.is_published} onChange={e => setReview(r => ({ ...r, is_published: e.target.checked }))} />Publier cet avis éditorial</label>
      <button disabled={!review.body.trim() || !review.visited_on} onClick={() => void action(async () => {
        const r = await supabaseClient.rpc("save_editorial_review", { p_id: review.id, p_place_id: id, p_body: review.body, p_visited_on: review.visited_on, p_cuisine: review.note_cuisine, p_cadre: review.note_cadre, p_service: review.note_service, p_expected_revision: review.revision, p_publish: review.is_published });
        if (r.error) throw r.error; setReviews(list => [r.data, ...list.filter(x => x.id !== r.data.id)]); setReview(blankReview()); setMessage("Avis éditorial enregistré.");
      })}>Enregistrer l’avis</button><button onClick={() => setReview(blankReview())}>Nouvel avis</button>
      {reviews.map(r => <article key={r.id}><b>{team[r.author_id] ?? "Équipe SPAWT"} · {r.visited_on} · {r.is_published ? "Publié" : "Brouillon"}</b><p>{r.body}</p><button onClick={() => setReview(r)}>Ouvrir cet avis</button></article>)}
    </fieldset>
  </div>;
}
