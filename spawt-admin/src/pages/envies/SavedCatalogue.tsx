import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility/supabaseClient";
import "./saved-catalogue.css";

type PlaceRow = { place_id: string; name: string; city: string; neighborhood: string | null; published: boolean; save_count: number };
type DishRow = Omit<PlaceRow, "name"> & {
  menu_item_id: string; name: string; place_name: string; dish_type: string | null;
  rating_count: number; average_rating: number | null;
};
interface Catalogue {
  cities: {code: string; name: string}[];
  dish_types: string[];
  summary: { place_saves: number; unique_places: number; place_savers: number; dish_saves: number; unique_dishes: number; dish_savers: number; rating_count: number };
  places: PlaceRow[];
  dishes: DishRow[];
}

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
function typeLabel(type: string) {
  if (type === "non_classe") return "Non classé";
  if (type === "oeufs") return "Œufs";
  return (type.charAt(0).toLocaleUpperCase("fr-FR") + type.slice(1)).replace(/[_-]/g," ");
}
function locality(row: Pick<PlaceRow,"neighborhood"|"city">) {
  return [row.neighborhood, row.city].filter(Boolean).join(" · ");
}
const singular = (n: number, one: string, many: string) => number.format(n) + " " + (n < 2 ? one : many);

export function SavedCatalogue() {
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [order, setOrder] = useState("saves");
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{ city: string; type: string; time: Date; data: Catalogue } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError(false);
    async function read() {
      try {
        const result = await supabaseClient.rpc("admin_saved_catalogue", {
          p_city_code: city || null, p_dish_type: type || null,
        }).abortSignal(controller.signal);
        if (result.error || !result.data) throw new Error();
        if (active) setSnapshot({city, type, time: new Date(), data: result.data});
      } catch { if (active) setError(true); }
    }
    void read();
    return () => { active = false; controller.abort(); };
  }, [city, type, refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRefresh(t => t + 1);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const data = snapshot?.city === city && snapshot.type === type ? snapshot.data : null;
  const dishes = data ? [...data.dishes].sort((a,b) => {
    if (order === "rating") {
      const difference = (b.average_rating ?? -1) - (a.average_rating ?? -1) || b.rating_count - a.rating_count;
      if (difference) return difference;
    }
    return b.save_count - a.save_count || a.name.localeCompare(b.name, "fr") || a.place_name.localeCompare(b.place_name,"fr");
  }) : [];
  return <section className="saved-catalogue" aria-labelledby="saved-title">
    <header className="saved-header">
      <div><h1 id="saved-title">Spawts enregistrés et plats favoris</h1>
        <p>Comparez les lieux enregistrés par la Bande, les plats gardés en favoris et les notes de dégustation.</p></div>
      <button type="button" onClick={() => setRefresh(t => t+1)}>Actualiser les favoris</button>
    </header>
    <div className="saved-scope">
      <label>Ville<select value={city} onChange={e => { setCity(e.target.value); setType(""); }}>
        <option value="">Toutes les villes</option>
        {snapshot?.data.cities.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select></label>
          <label>Type de plat<select value={type} onChange={e=>setType(e.target.value)}>
            <option value="">Tous les types</option>{(snapshot?.data.dish_types ?? []).map(k=><option key={k} value={k}>{typeLabel(k)}</option>)}
          </select></label>
          <label>Classer par<select value={order} onChange={e=>setOrder(e.target.value)}>
            <option value="saves">Nombre de favoris</option><option value="rating">Note moyenne</option>
          </select></label>
      {data && snapshot && <small>Actualisé à {snapshot.time.toLocaleTimeString("fr-FR", {hour:"2-digit",minute:"2-digit"})}</small>}
    </div>
    {error && <p role="alert">Les favoris n’ont pas pu être actualisés.{data ? " Les dernières valeurs reçues restent affichées." : ""}</p>}
    {!data && !error && <p role="status">Chargement des favoris…</p>}
    {data && <>
      <section className="saved-block" aria-labelledby="saved-places-title">
        <div className="saved-block-title"><div><h2 id="saved-places-title">Spawts enregistrés</h2>
          <p>{singular(data.summary.place_savers,"membre","membres")} · {singular(data.summary.unique_places,"adresse conservée","adresses conservées")}</p></div>
          <strong>{number.format(data.summary.place_saves)} <small>enregistrements</small></strong></div>
        {data.places.length ? <div className="saved-table"><table aria-label="Spawts enregistrés">
          <thead><tr><th scope="col">Lieu</th><th scope="col">Quartier et ville</th><th scope="col" className="quantity">Enregistrements</th></tr></thead>
          <tbody>{data.places.map(p => <tr key={p.place_id}><th scope="row"><a href={"/lieux/edit/" + p.place_id}>{p.name}</a>{!p.published && <small>Retiré du catalogue</small>}</th>
            <td>{locality(p)}</td><td className="quantity">{number.format(p.save_count)}</td></tr>)}</tbody>
        </table></div> : <p className="saved-empty">Aucun lieu enregistré dans cette sélection.</p>}
      </section>
      <section className="saved-block" aria-labelledby="saved-dish-title">
        <div className="saved-block-title"><div><h2 id="saved-dish-title">Plats favoris et notes</h2>
          <p>{singular(data.summary.dish_savers,"membre","membres")} avec un favori · {singular(data.summary.rating_count,"note donnée","notes données")}</p></div>
          <strong>{number.format(data.summary.dish_saves)} <small>favoris plats</small></strong></div>
        {dishes.length ? <div className="saved-table"><table aria-label="Comparaison des plats">
          <thead><tr><th scope="col">Plat</th><th scope="col">Adresse</th><th scope="col" className="quantity">Favoris</th>
            <th scope="col" className="quantity">Moyenne / 5</th><th scope="col" className="quantity">Notes</th></tr></thead>
          <tbody>{dishes.map(d=><tr key={d.menu_item_id}><th scope="row">{d.name}<small>{typeLabel(d.dish_type ?? "non_classe")}{d.published ? "" : " · Retiré du catalogue"}</small></th>
            <td><a href={"/lieux/edit/"+d.place_id}>{d.place_name}</a><small>{locality(d)}</small></td>
            <td className="quantity">{number.format(d.save_count)}</td>
            <td className="quantity">{d.average_rating === null ? <span aria-label="Aucune note">—</span> : number.format(d.average_rating)}</td>
            <td className="quantity">{number.format(d.rating_count)}</td></tr>)}</tbody>
        </table></div> : <p className="saved-empty">Aucun plat pour ces filtres.</p>}
      </section>
      <p className="saved-method">Un membre compte une fois par lieu ou par plat conservé. Retirer un favori le retire du total. La moyenne utilise uniquement les notes données au plat.</p>
    </>}
  </section>;
}
