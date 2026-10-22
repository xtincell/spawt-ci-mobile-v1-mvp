import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { supabaseClient } from "../../utility/supabaseClient";
interface Activity { spawter_id: string; installation_id: string; display_name: string; last_seen_at: string; is_active: boolean; platform: string; app_version: string | null; app_build: string | null; push_status: string; pending_writes: number; push_devices: number }
const status: Record<string,string> = { unknown: "Non renseignées", registered: "Enregistrées", denied: "Non autorisées", unavailable: "Service indisponible sur l’appareil", registration_failed: "Enregistrement à réessayer", web: "Aperçu web : sans push mobile" };
export function ActiviteList() {
  const [rows, setRows] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(false);
  const [page, setPage] = useState(0);
  const [loadedAt, setLoadedAt] = useState("");
  const navigate = useNavigate();
  const load = useCallback(async () => {
    let query = supabaseClient.from("admin_app_activity").select("*").order("last_seen_at", { ascending: false }).range(page*50,page*50+49);
    if (online) query=query.eq("is_active",true);
    const { data, error } = await query;
    if (error) setError(error.message); else { setError(""); setRows(data ?? []); setLoadedAt(new Date().toLocaleTimeString("fr-FR")); }
  }, [online,page]);
  useEffect(() => { void load(); const timer=setInterval(() => { void load(); },30000); return () => clearInterval(timer); }, [load]);
  return <div><h1>Activité dans l’app</h1>
    <p>« En cours » signifie que l’app a signalé une activité au premier plan depuis moins de 90 secondes. Une session ouverte ne signifie pas que la personne regarde l’app. Ce suivi nécessite le build 34 ou suivant.</p>
    <p>Les appareils plus anciens restent accessibles dans <Link to="/comptes">Comptes</Link>. Les écritures en attente peuvent comprendre des avis conservés sur le téléphone.</p>
    <label><input type="checkbox" checked={online} onChange={e => { setOnline(e.target.checked); setPage(0); }} /> En cours uniquement</label> <button onClick={() => void load()}>Actualiser</button>
    <p role="status">{loadedAt ? `Dernière lecture : ${loadedAt}` : "Chargement…"}</p>{error ? <p role="alert">{error}</p> : null}
    {!error && loadedAt && rows.length===0 ? <p>Aucune activité remontée pour ce filtre.</p> : null}
    <table><thead><tr><th>Compte</th><th>Activité</th><th>Version</th><th>Notifications</th><th>Écritures en attente</th><th>Action</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.spawter_id}:${row.installation_id}`}>
      <td><Link to={`/comptes/show/${row.spawter_id}`}>{row.display_name}</Link></td><td>{row.is_active ? "En cours" : "Dernière activité"}<br />{new Date(row.last_seen_at).toLocaleString("fr-FR")}</td>
      <td>{row.platform} · {row.app_version ?? "—"} · build {row.app_build ?? "—"}</td><td>{status[row.push_status] ?? row.push_status}<br />{row.push_devices} appareil(s) enregistré(s) sur le compte</td>
      <td>{row.pending_writes}</td><td><button onClick={() => navigate("/push", { state: { spawter_id: row.spawter_id } })}>Préparer une notification</button></td>
    </tr>)}</tbody></table><button disabled={page===0} onClick={() => setPage(p=>p-1)}>Précédent</button> <button disabled={rows.length<50} onClick={() => setPage(p=>p+1)}>Suivant</button>
  </div>;
}
