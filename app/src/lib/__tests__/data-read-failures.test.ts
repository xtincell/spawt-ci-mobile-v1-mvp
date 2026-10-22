let mockResponse: { data: unknown; error: unknown } = { data: [], error: null };
jest.mock("../supabase", () => ({ supabase: { from: () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "maybeSingle", "abortSignal"]) builder[method] = () => builder;
  builder.then = (resolve: (value: unknown) => void) => Promise.resolve(mockResponse).then(resolve);
  return builder;
} } }));
import { getPlaceFromSupabase, listPlacesFromSupabase, listSpawtsFromSupabase, listTitresFromSupabase } from "../data-source.supabase";
import { DataReadError } from "../data-read-error";

beforeEach(() => { mockResponse = { data: [], error: null }; });

it.each([
  ["places", () => listPlacesFromSupabase()],
  ["place", () => getPlaceFromSupabase("spot")],
  ["spawts", () => listSpawtsFromSupabase("compte")],
  ["collection_titres", () => listTitresFromSupabase("compte")],
] as const)("%s ne transforme pas une panne en absence", async (source, read) => {
  mockResponse = { data: null, error: { code: "401", message: "private transport body" } };
  await expect(read()).rejects.toEqual(new DataReadError(source));
});

it("une liste réellement vide reste une liste vide", async () => {
  await expect(listPlacesFromSupabase()).resolves.toEqual([]);
});

it("un lieu absent reste distinct d'une panne", async () => {
  mockResponse = { data: null, error: null };
  await expect(getPlaceFromSupabase("absent")).resolves.toBeNull();
});

it("un inventaire entièrement invalide est signalé", async () => {
  mockResponse = { data: [null, { id: "invalid" }], error: null };
  await expect(listPlacesFromSupabase()).rejects.toEqual(new DataReadError("places", "invalid_data"));
});

it("une fiche invalide n'est pas déclarée introuvable", async () => {
  mockResponse = { data: { id: "invalid" }, error: null };
  await expect(getPlaceFromSupabase("invalid")).rejects.toEqual(new DataReadError("place", "invalid_data"));
});
