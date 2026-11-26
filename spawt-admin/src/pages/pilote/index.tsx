import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { supabaseClient } from "../../utility/supabaseClient";
import "./pilote.css";

type Origin = { origin: string; arrivals: number; download_clicks: number; download_receipts?: number; onboarded?: number; first_opens: number; acquired_installs: number; reopens: number; viewers: number; savers: number; active_people: number; spawters: number };
type Report = { download_receipts?: number; onboarding_campaigns?: {origin:string;campaign:string;n:number}[]; checked_at: string; onboarded: number; active: number; viewers: number; savers: number; origins: Origin[]; recent: { at_utc: string; origin: string; place: string; person_ref: string }[] };
const labels: Record<string, string> = {facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", other: "Autre", unknown: "Inconnu"};
const originLabel = (key: string) => labels[key] ?? "Inconnu";
const format = new Intl.NumberFormat("fr-FR");
const dateTime = new Intl.DateTimeFormat("fr-FR", {dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Abidjan"});
const day = (iso: string) => iso.slice(0,10);
function range(mode: string, now: Date) {
  const t = now.getTime();
  if (mode === "pilot") return ["2026-11-28T00:00:00Z","2026-12-05T00:00:00Z"];
  const today = day(now.toISOString());
  const duration = mode === "today" ? 0 : 6;
  const start = new Date(Date.parse(today + "T00:00:00Z") - duration * 86_400_000);
  return [start.toISOString(),new Date(t).toISOString()];
}

export function PilotPage() {
  const { data: identity, isLoading } = useGetIdentity<{role: string}>();
  const [mode,setMode] = useState("seven");
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState<{ key: string; data: Report | null } | null>(null);
  const admin = identity?.role === "admin";
  const key = mode + ":" + revision;
  useEffect(() => {
    if (!admin) return;
    let live = true;
    const [p_start,p_end] = range(mode,new Date());
    void (async () => {
      try {
        const {data,error} = await supabaseClient.rpc("admin_pilot_funnel",{p_start,p_end});
        if (live) setResult({key,data: error ? null : data as Report | null});
      } catch {
        if (live) setResult({key,data:null});
      }
    })();
    return () => { live = false; };
  },[admin,key,mode]);
  if (isLoading) return <p role="status">Vérification de l’accès…</p>;
  if (!admin) return <p role="alert">Cette page est réservée aux administrateurs.</p>;
  const ready = result?.key === key;
  const data = ready ? result?.data : null;
  const total = (field: "download_clicks" | "acquired_installs" | "first_opens" | "arrivals") => data?.origins.reduce((n,r)=>n+r[field],0) ?? 0;
  return <main className="editorial-workspace pilot">
    <header><h1>Funnel d’activation</h1><p>Du clic de téléchargement au premier favori confirmé. Les comptes internes et de démonstration sont exclus lorsqu’ils sont identifiables.</p></header>
    <div className="pilot-controls">
      <label>Période, heure d’Abidjan <select value={mode} onChange={e=>setMode(e.target.value)}>
        <option value="seven">7 derniers jours</option><option value="today">Aujourd’hui</option><option value="pilot">Pilote · 28 nov. au 4 déc. 2026</option>
      </select></label><button onClick={()=>setRevision(n=>n+1)}>Actualiser</button>
    </div>
    {!ready && <p role="status">Chargement des indicateurs…</p>}
    {ready && !data && <p role="alert">Indicateurs indisponibles. Aucun total n’est remplacé par zéro.</p>}
    {data && <>
      <p>Actualisé le {dateTime.format(new Date(data.checked_at))} · Abidjan</p>
      <dl className="pilot-kpis">
        {([["Arrivées sur le site",total("arrivals")],["Clics Télécharger",total("download_clicks")],["APK reçus dans le navigateur",data.download_receipts ?? null],["Premières ouvertures",total("first_opens")],["Installations attribuées",total("acquired_installs")],["Onboardings reçus",data.onboarded],["Personnes ayant ouvert une fiche",data.viewers],["Personnes ayant ajouté un favori",data.savers],["Personnes activées",data.active]] as const).map(([label,value])=><div className="panel" key={label}><dt>{label}</dt><dd>{value === null ? "Non mesuré" : format.format(value)}</dd></div>)}
      </dl>
      <p>Un APK reçu = transfert complet observé par la page, avant enregistrement du fichier. Les téléchargements directs et navigateurs non instrumentés ne sont pas mesurés. Onboarding reçu = fin signalée par l’app, avec un Palais présent en base. Actif = fiche ouverte puis même lieu ajouté en favori pendant la période, une fois par personne.</p>
      <section><h2>Par origine</h2><p>« Inconnu » couvre les parcours sans raccord à une campagne, y compris les anciens onboardings sans preuve d’installation.</p>
        <div className="pilot-table"><table><thead><tr>{["Origine","Arrivées","Clics APK","APK reçus","1res ouvertures","Installations attribuées","Réouvertures","Onboardings","Personnes ayant vu une fiche","Personnes ayant ajouté un favori","Actifs","Spawters"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>
        {data.origins.map(r=><tr key={r.origin}><th scope="row">{originLabel(r.origin)}</th>{[r.arrivals,r.download_clicks,r.download_receipts,r.first_opens,r.acquired_installs,r.reopens,r.onboarded,r.viewers,r.savers,r.active_people,r.spawters].map((n,i)=><td key={i}>{n === undefined ? "Non mesuré" : format.format(n)}</td>)}</tr>)}
        </tbody></table></div>
      </section>
      <section><h2>Onboardings par campagne</h2>
        {data.onboarding_campaigns?.length ? <ul>{data.onboarding_campaigns.map(c=><li key={c.campaign+c.origin}>{c.campaign} · {originLabel(c.origin)} : {format.format(c.n)}</li>)}</ul> : <p>{data.onboarding_campaigns ? "Aucun onboarding relié à une campagne sur cette période." : "Ventilation non disponible."}</p>}
      </section>
      <section><h2>Derniers ajouts confirmés</h2><p>50 maximum. La référence est pseudonyme ; ni nom, ni numéro, ni e-mail.</p>
        {data.recent.length === 0 ? <p>Aucun ajout reçu sur cette période.</p> : <div className="pilot-table"><table><thead><tr>{["Heure à Abidjan","Lieu","Origine","Référence"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>
          {data.recent.map((r,i)=><tr key={r.person_ref+r.at_utc+i}><td>{dateTime.format(new Date(r.at_utc))}</td><td>{r.place}</td><td>{originLabel(r.origin)}</td><td>{r.person_ref}</td></tr>)}
        </tbody></table></div>}
      </section>
    </>}
  </main>;
}
