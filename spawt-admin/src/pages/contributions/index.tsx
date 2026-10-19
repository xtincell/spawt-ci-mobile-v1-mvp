import { useCallback, useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router";
import { supabaseClient as db } from "../../utility/supabaseClient";
import { CONTRIBUTION_BUCKET, type ContributionKind, type PlaceContribution } from "../../../../shared/place-contributions";

const kinds = { menu: "Menu et prix", location: "Position du lieu" };
const statuses = { pending: "À vérifier", approved: "Validée", rejected: "Non retenue" };
interface Place { id: string; name: string; updated_at: string; lat: number | null; lng: number | null; price_tier: number | null; avg_ticket_xof: number | null; menu_urls: string[] }
export function ContributionsList() {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const [rows, setRows] = useState<PlaceContribution[]>([]); const [filter, setFilter] = useState("pending"); const [page, setPage] = useState(0);
  const [error, setError] = useState(""); const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await db.from("place_contributions").select("*").eq("status", filter).order("created_at", { ascending: false }).range(page * 20, page * 20 + 19);
    if (error) setError("Les contributions n’ont pas pu être chargées."); else { setRows(data ?? []); setError(""); setLoaded(true); }
  }, [page, filter]);
  useEffect(() => { void load(); }, [load]);
  return <div><h1>Contributions aux lieux</h1><p>Les preuves sont privées jusqu’à validation. Accepter met à jour la fiche publique et attribue une seule fois les Paws annoncés au dépôt. Aucune visite ni note n’est créée.</p>
    <label>Statut <select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> <button onClick={() => void load()}>Actualiser</button>
    {error ? <p role="alert">{error}</p> : null}{loaded && !error && !rows.length ? <p>Aucune contribution pour ce filtre.</p> : null}
    {rows.map(row => <ContributionCard key={`${row.id}:${row.status}`} row={row} saved={load} />)}
    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Précédent</button> <button disabled={rows.length < 20} onClick={() => setPage(p => p + 1)}>Suivant</button>
    {identity?.role === "admin" ? <RewardRules /> : null}
  </div>;
}
function ContributionCard({ row, saved }: { row: PlaceContribution; saved: () => Promise<void> }) {
  const [place, setPlace] = useState<Place | null>(null); const [photos, setPhotos] = useState<string[]>([]); const [error, setError] = useState("");
  const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [replace, setReplace] = useState(false);
  const [lat, setLat] = useState(String(row.proposal.lat ?? "")); const [lng, setLng] = useState(String(row.proposal.lng ?? ""));
  const [price, setPrice] = useState(String(row.proposal.avg_ticket_xof ?? "")); const [tier, setTier] = useState(String(row.proposal.price_tier ?? ""));
  const load = useCallback(async () => {
    setPlace(null); setPhotos([]); setError("");
    try {
      const { data, error } = await db.from("places").select("id,name,updated_at,lat,lng,price_tier,avg_ticket_xof,menu_urls").eq("id", row.place_id).single();
      if (error || !data) throw error;
      if (row.kind === "menu") {
        const signed = await db.storage.from(CONTRIBUTION_BUCKET).createSignedUrls(row.proposal.photo_paths ?? [], 3600);
        if (signed.error || signed.data?.some(p => p.error || !p.signedUrl)) throw signed.error ?? new Error("photo_missing");
        setPhotos((signed.data ?? []).flatMap(p => p.signedUrl ? [p.signedUrl] : []));
      }
      setPlace(data);
    } catch { setError("La fiche ou ses preuves n’ont pas pu être chargées. Actualisez avant de décider."); }
  }, [row]);
  useEffect(() => { void load(); }, [load]);
  const decide = async (decision: "approved" | "rejected") => {
    if (busy || !place) return; setBusy(true); setError("");
    try {
      const values = row.kind === "location" ? { lat: Number(lat), lng: Number(lng) } : { ...(price ? { avg_ticket_xof: Number(price) } : {}), ...(tier ? { price_tier: Number(tier) } : {}), replace_menu: replace };
      if (decision === "approved" && (row.kind === "location" ? !lat.trim() || !lng.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) : price && (!/^\d+$/.test(price) || Number(price) < 1 || Number(price) > 1000000))) throw new Error("invalid_values");
      const { data, error } = await db.rpc("moderate_place_contribution", { p_id: row.id, p_decision: decision, p_note: note.trim(), p_expected_place_updated_at: place.updated_at, p_values: values });
      if (error || data?.status !== decision) throw error ?? new Error("missing_receipt");
      await saved();
    } catch (e) {
      const conflict = e && typeof e === "object" && "code" in e && e.code === "40001";
      setError(conflict ? "La fiche a changé pendant l’examen. Rechargez les données et comparez à nouveau avant de valider." : "Décision non confirmée. Vérifiez les valeurs et le motif ; votre saisie est conservée.");
    } finally { setBusy(false); }
  };
  return <section aria-label={`Contribution ${row.id.slice(0, 8)}`} style={{ border: "1px solid var(--border)", padding: 20, marginBlock: 20 }}>
    <h2>{kinds[row.kind]} · {place?.name ?? row.place_id}</h2><p>{statuses[row.status]} · {row.id.slice(0, 8)} · {new Date(row.created_at).toLocaleString("fr-FR")}</p>
    <p><Link to={`/comptes/show/${row.spawter_id}`}>Voir le spawter</Link> · <Link to={`/lieux/edit/${row.place_id}`}>Ouvrir la fiche</Link> · {row.offered_reward_paws} Paws annoncés</p>
    <p style={{ whiteSpace: "pre-wrap" }}>{row.comment}</p>
    {row.kind === "location" ? <p>Relevé proposé : {row.proposal.lat}, {row.proposal.lng} · précision ±{row.proposal.accuracy_meters} m · {new Date(row.proposal.observed_at ?? "").toLocaleString("fr-FR")}. Position actuelle : {place?.lat ?? "inconnue"}, {place?.lng ?? "inconnue"}. Vérifiez que le relevé correspond bien au lieu.</p> : <><p>Budget actuel : {place?.avg_ticket_xof ?? "inconnu"} F CFA · gamme {place?.price_tier ?? "inconnue"}. {place?.menu_urls.length ?? 0} page(s) de menu actuellement publiées. Vérifiez la date, la lisibilité et l’absence de données personnelles.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>{photos.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo du menu proposée" style={{ width: 240, height: 320, objectFit: "contain" }} /></a>)}</div></>}
    {row.status === "pending" ? <fieldset disabled={busy}><legend>Décision de l’équipe</legend>
      {row.kind === "location" ? <><label>Latitude retenue <input aria-label="Latitude retenue" value={lat} onChange={e => setLat(e.target.value)} /></label> <label>Longitude retenue <input aria-label="Longitude retenue" value={lng} onChange={e => setLng(e.target.value)} /></label></> : <><label>Budget retenu en F CFA <input aria-label="Budget retenu en F CFA" type="number" min="1" max="1000000" step="1" value={price} onChange={e => setPrice(e.target.value)} /></label> <label>Gamme retenue <select value={tier} onChange={e => setTier(e.target.value)}><option value="">Conserver la gamme actuelle</option><option value="1">Petit budget</option><option value="2">Budget moyen</option><option value="3">Budget élevé</option></select></label><p>Montant vide : budget actuel conservé.</p><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Remplacer les anciennes photos du menu (sinon ajouter les nouvelles)</label></>}
      <label style={{ display: "block" }}>Message au spawter<textarea aria-label="Message au spawter" value={note} maxLength={1000} onChange={e => setNote(e.target.value)} style={{ display: "block", width: "100%", minHeight: 70 }} /></label>
      <button disabled={!place || busy} onClick={() => void decide("approved")}>Valider et attribuer {row.offered_reward_paws} Paws</button> <button disabled={!place || busy || note.trim().length < 5} onClick={() => void decide("rejected")}>Ne pas retenir (motif requis)</button>
    </fieldset> : <><p>{row.review_note} · {row.reward_paws} Paws attribués</p><details><summary>Champs avant et après validation</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify({ avant: row.before_values, après: row.after_values }, null, 2)}</pre></details></>}
    {error ? <p role="alert">{error}</p> : null}<button disabled={busy} onClick={() => void load()}>Recharger la fiche et les preuves</button>
  </section>;
}
function RewardRules() {
  const [rules, setRules] = useState<{ kind: ContributionKind; reward_paws: number }[]>([]); const [kind, setKind] = useState<ContributionKind>("menu");
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [result, setResult] = useState(""); const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ id: string; kind: ContributionKind; before_paws: number; after_paws: number; reason: string; created_at: string }[]>([]);
  const load = async () => {
    const [r, h] = await Promise.all([db.from("place_contribution_rules").select("*"), db.from("place_contribution_rule_history").select("*").order("created_at", { ascending: false }).limit(20)]);
    if (r.error || h.error) setResult("Le barème n’a pas pu être chargé."); else { setRules(r.data ?? []); setHistory(h.data ?? []); }
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    setBusy(true); const { error } = await db.rpc("set_place_contribution_reward", { p_kind: kind, p_paws: Number(amount), p_reason: reason.trim() });
    setResult(error ? "Le barème n’a pas été enregistré." : "Barème enregistré pour les prochains dépôts. Les récompenses déjà annoncées sont conservées.");
    if (!error) { setReason(""); await load(); } setBusy(false);
  };
  return <section><h2>Récompenses des contributions</h2><p>{rules.map(r => `${kinds[r.kind]} : ${r.reward_paws} Paws`).join(" · ")}</p><fieldset disabled={busy}>
    <label>Contribution <select value={kind} onChange={e => setKind(e.target.value as ContributionKind)}>{Object.entries(kinds).map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label> <label>Paws <input type="number" min="0" max="100" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Motif du changement <input value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>
    <button disabled={!/^\d+$/.test(amount) || Number(amount) > 100 || reason.trim().length < 5} onClick={() => void save()}>Enregistrer le barème</button>
  </fieldset>{result ? <p role="status">{result}</p> : null}<details><summary>Historique du barème</summary>{history.map(h => <p key={h.id}>{new Date(h.created_at).toLocaleString("fr-FR")} · {kinds[h.kind]} : {h.before_paws} → {h.after_paws} · {h.reason}</p>)}</details></section>;
}
