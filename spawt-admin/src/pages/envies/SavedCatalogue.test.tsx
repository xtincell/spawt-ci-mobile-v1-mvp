import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SavedCatalogue } from "./SavedCatalogue";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../utility/supabaseClient", () => ({ supabaseClient: { rpc } }));
const base = { published: true, city: "Abidjan", neighborhood: "Marcory", dish_type: "burger" };
const dishes = [
  { ...base, menu_item_id: "a", name: "Burger maison", place_name: "La Terrasse", place_id:"lieu-a", save_count: 8, rating_count: 2, average_rating: 3.5 },
  { ...base, menu_item_id: "b", name: "Burger du marché", place_name: "Le Comptoir", place_id:"lieu-b", save_count: 1, rating_count: 3, average_rating: 4.67 },
  { ...base, menu_item_id: "c", name: "Burger de veau", place_name: "Le Kiosque", place_id:"lieu-c", save_count: 0, rating_count: 0, average_rating: null },
];
const payload = { cities:[{code:"ABJ",name:"Abidjan"}], dish_types:["burger","non_classe"], dishes,
  summary:{place_saves:3,unique_places:1,place_savers:3,dish_saves:9,unique_dishes:2,dish_savers:6,rating_count:5},
  places:[{ ...base,place_id:"lieu-a",name:"La Terrasse",save_count:3 }] };
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(() => ({ abortSignal: () => Promise.resolve({ data:payload,error:null }) }));
});
afterEach(cleanup);

it("permet de comparer les burgers d’une ville par favoris ou par note et garde le volume des avis", async () => {
  render(<SavedCatalogue />);
  await screen.findByRole("table",{name:"Comparaison des plats"});
  fireEvent.change(screen.getByLabelText("Ville"),{target:{value:"ABJ"}});
  await screen.findByText("Burger maison");
  fireEvent.change(screen.getByLabelText("Type de plat"),{target:{value:"burger"}});
  const table = within(await screen.findByRole("table",{name:"Comparaison des plats"}));
  expect(rpc).toHaveBeenLastCalledWith("admin_saved_catalogue",{p_city_code:"ABJ",p_dish_type:"burger"});
  expect(table.getAllByRole("row")[1]).toHaveTextContent("Burger maison");
  fireEvent.change(screen.getByLabelText("Classer par"),{target:{value:"rating"}});
  const rows = table.getAllByRole("row");
  expect(rows[1]).toHaveTextContent("Burger du marché");
  expect(within(rows[1]).getAllByRole("cell").map(c=>c.textContent)).toEqual(["Le ComptoirMarcory · Abidjan","1","4,67","3"]);
  expect(within(rows[3]).getByLabelText("Aucune note")).toBeVisible();
  expect(within(screen.getByRole("table",{name:"Spawts enregistrés"})).getByRole("cell",{name:"3"})).toBeVisible();
});

it("distingue une erreur de lecture d’un total nul et propose une nouvelle lecture", async () => {
  rpc.mockImplementationOnce(() => ({abortSignal:() => Promise.resolve({error:{message:"indisponible"},data:null})}));
  render(<SavedCatalogue />);
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Actualiser les favoris"}));
  expect(await screen.findByRole("table",{name:"Spawts enregistrés"})).toBeVisible();
});
