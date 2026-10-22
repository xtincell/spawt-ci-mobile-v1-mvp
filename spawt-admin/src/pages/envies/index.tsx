import { useEffect, useState } from "react";
import { supabaseClient as db } from "../../utility/supabaseClient";
interface Metrics { active_24h: number; active_72h: number; return_cohort: number; returned_72h: number; saved_then_chose_7d: number; saved_then_visited_7d: number; active_intents_7d: number; savers_7d: number; choosers_7d: number; places: { place_id: string; name: string; active_intents: number }[]; }
export function EnviesPage() {
 const [data, setData] = useState<Metrics | null>(null); const [failed, setFailed] = useState(false);
 async function load() { const result = await db.rpc("admin_outing_metrics"); setFailed(Boolean(result.error)); if (!result.error) setData(result.data); }
 useEffect(() => { void load(); const timer = setInterval(() => void load(), 30_000); return () => clearInterval(timer); }, []);
 return <main className="editorial-workspace"><h1>Envies de sortie</h1><p>Personnes distinctes ayant enregistré, proposé ou choisi une sortie au cours des sept derniers jours. Les migrations des favoris et les comptes internes sont exclus.</p>
  <button onClick={() => void load()}>Actualiser</button>{failed ? <p role="alert">Les indicateurs ne sont pas disponibles. Aucune valeur n’est remplacée par un faux zéro.</p> : null}
  {data ? <><section className="panel"><h2>{data.active_intents_7d} envies actives</h2><p>{data.savers_7d} personnes ont enregistré une envie · {data.choosers_7d} ont choisi une sortie.</p><p>Une ouverture ou une proximité détectée ne compte pas comme une envie. Une intention ne constitue pas une visite attribuée.</p></section>
   <section className="panel"><h2>Ouvertures et suites données</h2><p>{data.active_24h} comptes actifs sur 24 h · {data.active_72h} sur 72 h.</p><p>{data.return_cohort ? `${data.returned_72h} / ${data.return_cohort} retours entre 24 et 72 h` : "Retours à 72 h : cohorte encore insuffisante"}.</p><p>Cohorte : première ouverture observée entre J−10 et J−3. Mesure à partir de cette mise à jour, sans historique reconstitué.</p><p>{data.saved_then_chose_7d} personnes ont choisi un lieu après l’avoir enregistré ; {data.saved_then_visited_7d} y ont ensuite déclaré une visite. Fenêtre d’enregistrement : 7 jours. La visite déclarée ne prouve pas une attribution commerciale.</p></section>
   <table><thead><tr><th>Lieu</th><th>Personnes ayant exprimé une envie</th></tr></thead><tbody>{data.places.map(p => <tr key={p.place_id}><td><a href={`/lieux/edit/${p.place_id}`}>{p.name}</a></td><td>{p.active_intents}</td></tr>)}</tbody></table></> : null}
 </main>;
}
