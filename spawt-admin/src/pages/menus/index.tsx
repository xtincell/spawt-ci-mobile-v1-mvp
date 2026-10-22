import { useEffect, useState } from "react";
import { supabaseClient as db } from "../../utility/supabaseClient";
interface Dish {
 id: string; place_id: string; name: string; aliases: string[]; accompaniments: string[]; price_xof: number | null;
 description: string; photo_url: string | null; source_url: string; observed_on: string; is_published: boolean; updated_at: string;
}
interface Place { id: string; name: string; }
const blank = () => ({ place_id: "", name: "", aliases: "", accompaniments: "", price: "", description: "", photo_url: "", source_url: "", observed_on: new Date().toISOString().slice(0, 10), is_published: false });
const split = (s: string) => s.split(",").map(v => v.trim()).filter(Boolean);
export function MenusPage() {
 const [rows, setRows] = useState<Dish[]>([]); const [places, setPlaces] = useState<Place[]>([]);
 const [form, setForm] = useState(blank); const [editing, setEditing] = useState<Dish | null>(null);
 const [failed, setFailed] = useState(""); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState("");
 async function load() {
  setFailed("");
  const [menu, catalogue] = await Promise.all([db.from("menu_items").select("*").order("updated_at", { ascending: false }).limit(1000), db.from("places").select("id,name").order("name").limit(1000)]);
  if (menu.error || catalogue.error) { setFailed("Les menus n’ont pas pu être chargés. Vérifier la connexion et la migration 0086."); return; }
  setRows(menu.data ?? []); setPlaces(catalogue.data ?? []);
 }
 useEffect(() => { void load(); }, []);
 async function save(event: React.FormEvent) {
  event.preventDefault(); if (busy) return;
  if (form.price && (!/^\d+$/.test(form.price) || Number(form.price) > 2147483647)) { setFailed("Le prix doit être un montant entier positif en F CFA, ou rester vide."); return; }
  if (form.observed_on > new Date().toISOString().slice(0, 10)) { setFailed("La date d’observation ne peut pas être future."); return; }
  setBusy(true); setFailed("");
  const values = { place_id: form.place_id, name: form.name.trim(), aliases: split(form.aliases), accompaniments: split(form.accompaniments), price_xof: form.price ? Number(form.price) : null, description: form.description.trim(), photo_url: form.photo_url.trim() || null, source_url: form.source_url.trim(), observed_on: form.observed_on, is_published: form.is_published };
  const result = editing ? await db.from("menu_items").update(values).eq("id", editing.id).eq("updated_at", editing.updated_at).select("id") : await db.from("menu_items").insert(values).select("id");
  if (result.error || result.data?.length !== 1) setFailed(result.error?.message ?? "Ce plat a changé depuis son ouverture. Rechargez-le avant de modifier.");
  else { setEditing(null); setForm(blank()); await load(); }
  setBusy(false);
 }
 function edit(row: Dish) { setEditing(row); setForm({ ...row, aliases: row.aliases.join(", "), accompaniments: row.accompaniments.join(", "), price: row.price_xof?.toString() ?? "", photo_url: row.photo_url ?? "" }); }
 return <main><h1>Menus et plats</h1><p>Documenter un plat, son prix et sa source, puis le publier pour la recherche et les envies dans l’app. Les photos reçues restent modérées dans <a href="/contributions">Contributions</a>.</p>
  {failed ? <p role="alert">{failed}</p> : null}<button onClick={() => void load()} disabled={busy}>Actualiser</button>
  <form onSubmit={event => void save(event)} className="panel" style={{ display: "grid", gap: 12, maxWidth: 760 }}>
   <h2>{editing ? "Modifier le plat" : "Ajouter un plat"}</h2>
   <label>Lieu<select required value={form.place_id} onChange={e => setForm({ ...form, place_id: e.target.value })}><option value="">Choisir un lieu</option>{places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>Nom du plat<input required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
   <label>Variantes de nom, séparées par des virgules<input value={form.aliases} onChange={e => setForm({ ...form, aliases: e.target.value })} /></label>
   <label>Accompagnements, séparés par des virgules<input value={form.accompaniments} onChange={e => setForm({ ...form, accompaniments: e.target.value })} /></label>
   <label>Prix en F CFA — laisser vide si inconnu<input inputMode="numeric" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label>
   <label>Description<textarea maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
   <label>Source vérifiée : lien de menu ou référence de contribution<input required maxLength={2000} value={form.source_url} onChange={e => setForm({ ...form, source_url: e.target.value })} /></label>
   <label>Date du relevé<input required type="date" value={form.observed_on} onChange={e => setForm({ ...form, observed_on: e.target.value })} /></label>
   <label>Photo du plat autorisée — URL HTTPS facultative<input type="url" value={form.photo_url} onChange={e => setForm({ ...form, photo_url: e.target.value })} /></label>
   <label><input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} /> Publier dans le menu et la recherche</label>
   <p>La publication décrit un menu relevé à cette date. Elle ne confirme pas le stock du jour. Dépublier conserve les envies déjà enregistrées.</p>
   <div><button type="submit" disabled={busy}>Enregistrer</button> <button type="button" onClick={() => { setEditing(null); setForm(blank()); }}>Nouveau brouillon</button></div>
  </form>
  <label>Filtrer les plats<input value={filter} onChange={e => setFilter(e.target.value)} /></label>
  <table><thead><tr><th>Plat</th><th>Lieu</th><th>Prix</th><th>Relevé</th><th>État</th><th>Action</th></tr></thead><tbody>{rows.filter(r => `${r.name} ${places.find(p => p.id === r.place_id)?.name ?? ""}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(row => <tr key={row.id}><td>{row.name}</td><td>{places.find(p => p.id === row.place_id)?.name}</td><td>{row.price_xof === null ? "À confirmer" : `${row.price_xof.toLocaleString("fr-FR")} F CFA`}</td><td>{row.observed_on}</td><td>{row.is_published ? "Publié" : "Brouillon / retiré"}</td><td><button onClick={() => edit(row)}>Modifier</button></td></tr>)}</tbody></table>
 </main>;
}
