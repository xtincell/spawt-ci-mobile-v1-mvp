import { useEffect, useState } from "react";
import { supabaseClient as db } from "../../utility/supabaseClient";
interface Place { id: string; name: string; lat: number | null; lng: number | null }
export function GuetPage() {
 const [places, setPlaces] = useState<Place[]>([]); const [checked, setChecked] = useState(new Set<string>());
 const [id, setId] = useState(""); const [source, setSource] = useState(""); const [accuracy, setAccuracy] = useState("");
 const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
 async function load() {
  const [p,c] = await Promise.all([db.from("places").select("id,name,lat,lng").eq("is_published",true).order("name").limit(1000),db.from("public_guet_places").select("id").limit(1000)]);
  if (p.error || c.error) { setMessage("Les coordonnées ne sont pas disponibles."); return; }
  setPlaces(p.data ?? []); setChecked(new Set((c.data ?? []).map(x => x.id)));
 }
 useEffect(() => { void load(); }, []);
 const place = places.find(p => p.id === id);
 async function validate(e: React.FormEvent) {
  e.preventDefault(); if (busy || !place || place.lat == null || place.lng == null) return;
  setBusy(true); setMessage("");
  try {
   const { error } = await db.rpc("validate_place_location", { p_place_id: id, p_source: source.trim(), p_accuracy: Number(accuracy), p_expected_lat: place.lat, p_expected_lng: place.lng });
   if (error) throw error;
   await load(); setMessage("Coordonnées validées et journalisées. Le Guet reste soumis à sa réception sur téléphone et à son interrupteur de publication.");
  } catch { setMessage("La validation n’a pas été confirmée. Réessaie après avoir vérifié les coordonnées."); }
  finally { setBusy(false); }
 }
 return <main className="editorial-workspace"><h1>Le Guet — coordonnées</h1><p>Seules les coordonnées contrôlées peuvent déclencher un rappel. Une localisation de quartier ou une estimation ne suffit pas. Les contributions GPS approuvées alimentent aussi cette liste.</p>
  <p>{checked.size} lieux éligibles sur {places.length} publiés. Une modification ultérieure des coordonnées retire automatiquement l’éligibilité jusqu’à un nouveau contrôle.</p>
  <form onSubmit={e => void validate(e)} className="panel" style={{ display: "grid", gap: 12, maxWidth: 700 }}>
   <label>Lieu<select aria-label="Lieu" required value={id} onChange={e => setId(e.target.value)}><option value="">Choisir un lieu</option>{places.map(p => <option key={p.id} value={p.id}>{p.name}{checked.has(p.id) ? " — contrôlé" : ""}</option>)}</select></label>
   {place ? <p>Latitude : {place.lat ?? "inconnue"} · Longitude : {place.lng ?? "inconnue"}. <a href={`/lieux/edit/${place.id}`}>Corriger la fiche</a></p> : null}
   <label>Preuve du contrôle sur place<input required maxLength={2000} value={source} onChange={e => setSource(e.target.value)} /></label>
   <label>Précision du relevé, en mètres<input required type="number" min="0" max="100" step="any" value={accuracy} onChange={e => setAccuracy(e.target.value)} /></label>
   <button disabled={busy || !place || place.lat == null || place.lng == null}>Valider les coordonnées affichées</button>
  </form><p role="status">{message}</p><a href="/fonctionnalites">Interrupteurs de publication</a>
 </main>;
}
