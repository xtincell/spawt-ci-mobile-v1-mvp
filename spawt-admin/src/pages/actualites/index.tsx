import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";

type Announcement = { id: string; title: string; body: string; kind: string; city_code: string | null; deep_link: string | null; is_published: boolean; starts_at: string; ends_at: string | null; updated_at: string };
const blank = () => ({ title: "", body: "", kind: "info", city_code: "abidjan", deep_link: "", is_published: false, starts_at: new Date().toISOString().slice(0,16), ends_at: "" });
const toUtc = (value: string) => new Date(value + "Z").toISOString();
export function ActualitesList() {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const { data, error } = await supabaseClient.from("app_announcements").select("*").order("created_at", { ascending: false }).range(page * 50, page * 50 + 49);
    if (error) setError(error.message); else setRows(data ?? []);
  }, [page]);
  useEffect(() => { void load(); }, [load]);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { ...form, title: form.title.trim(), body: form.body.trim(), city_code: form.city_code || null, deep_link: form.deep_link.trim() || null, starts_at: toUtc(form.starts_at), ends_at: form.ends_at ? toUtc(form.ends_at) : null };
      const query = editing ? supabaseClient.from("app_announcements").update(payload).eq("id", editing.id).eq("updated_at", editing.updated_at) : supabaseClient.from("app_announcements").insert(payload);
      const { data, error } = await query.select("id").single();
      if (error || !data) throw new Error(error?.code === "PGRST116" ? "Cette publication a changé. Recharge-la avant de modifier." : error?.message ?? "Enregistrement impossible.");
      setForm(blank()); setEditing(null); setMessage("Publication enregistrée. Les dates déterminent sa visibilité dans l’app."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  function edit(row: Announcement) {
    setEditing(row); setError(""); setMessage("");
    setForm({ title: row.title, body: row.body, kind: row.kind, city_code: row.city_code ?? "", deep_link: row.deep_link ?? "", is_published: row.is_published, starts_at: row.starts_at.slice(0,16), ends_at: row.ends_at?.slice(0,16) ?? "" });
  }
  async function remove(row: Announcement) {
    if (!window.confirm(`Supprimer « ${row.title} » ? Le contenu disparaîtra de l’app.`)) return;
    const { data, error } = await supabaseClient.from("app_announcements").delete().eq("id", row.id).eq("updated_at", row.updated_at).select("id");
    if (error || !data?.length) setError(error?.message ?? "Cette publication a changé. Recharge-la avant de supprimer."); else { if (editing?.id === row.id) { setEditing(null); setForm(blank()); } await load(); }
  }
  return <div>
    <h1>Actualités & informations</h1>
    <p>Le fil du Chat est visible dans l’app. Un brouillon reste privé ; une publication peut être programmée et retirée. Les promotions restent clairement identifiées.</p>
    <p>Pour une offre attachée à un lieu, utilise <Link to="/promotions">Promotions</Link>. Les notifications se préparent séparément, depuis une publication enregistrée.</p>
    {error ? <p role="alert">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    <form onSubmit={save} style={{ display: "grid", gap: 12, maxWidth: 760, padding: 20, background: "var(--bg-card)" }}>
      <h2>{editing ? "Modifier la publication" : "Nouvelle publication"}</h2>
      <label>Titre<input required maxLength={178} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label>Texte<textarea required rows={6} maxLength={10000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
      <label>Type<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="info">Information</option><option value="news">Actualité</option><option value="promo">Promotion</option></select></label>
      <label>Ville<select value={form.city_code} onChange={e => setForm({ ...form, city_code: e.target.value })}><option value="abidjan">Abidjan</option><option value="">Toutes les villes</option></select></label>
      <label>Destination facultative dans l’app<input placeholder="/place/identifiant ou /explore/nom-du-carnet" value={form.deep_link} onChange={e => setForm({ ...form, deep_link: e.target.value })} /></label>
      <label>Début — heure d’Abidjan (UTC)<input required type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
      <label>Fin facultative — heure d’Abidjan (UTC)<input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
      <label><input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} /> Publier dans la période indiquée</label>
      <div><button disabled={busy} type="submit">Enregistrer</button> {editing ? <button type="button" onClick={() => { setEditing(null); setForm(blank()); }}>Annuler</button> : null}</div>
    </form>
    <table><thead><tr><th>Titre</th><th>État</th><th>Période (UTC)</th><th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>
      <td>{row.title}</td><td>{!row.is_published ? "Brouillon" : new Date(row.starts_at) > new Date() ? "Programmée" : row.ends_at && new Date(row.ends_at) <= new Date() ? "Terminée" : "Publiée"}</td>
      <td>{row.starts_at.slice(0,16).replace("T", " ")} {row.ends_at ? `→ ${row.ends_at.slice(0,16).replace("T", " ")}` : ""}</td>
      <td><button onClick={() => edit(row)}>Modifier</button> <button onClick={() => void remove(row)}>Supprimer</button> <button disabled={!row.is_published || new Date(row.starts_at)>new Date() || Boolean(row.ends_at && new Date(row.ends_at)<=new Date())} onClick={() => navigate("/push", { state: { title: row.title, body: row.body.slice(0,2048), deep_link: `/actualites/${row.id}` } })}>Préparer une notification</button></td>
    </tr>)}</tbody></table>
    <button disabled={page===0} onClick={() => setPage(p=>p-1)}>Précédent</button> <button disabled={rows.length<50} onClick={() => setPage(p=>p+1)}>Suivant</button>
  </div>;
}
