import React from "react";
// @ts-ignore — react-test-renderer ships JS only.
import TestRenderer from "react-test-renderer";
import { usePlaces } from "../use-places";
import { listPlaces, type PlaceWithAdn } from "../data-source";

jest.mock("../data-source", () => ({ listPlaces: jest.fn() }));
const read = listPlaces as jest.MockedFunction<typeof listPlaces>;
let state!: ReturnType<typeof usePlaces>;
function Probe() { state = usePlaces(); return null; }
function pending<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const places = [{ id: "place-1", name: "Spot" }] as PlaceWithAdn[];
beforeEach(() => jest.resetAllMocks());

it("keeps readable places when refresh fails and clears the error after retry", async () => {
  read.mockResolvedValueOnce(places).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
  let tree!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { tree = TestRenderer.create(<Probe />); });
  expect(state.places).toEqual(places);
  await TestRenderer.act(async () => { await state.reload(); });
  expect(state).toMatchObject({ places, failed: true, loading: false });
  await TestRenderer.act(async () => { await state.reload(); });
  expect(state).toMatchObject({ places: [], failed: false, loading: false });
  TestRenderer.act(() => tree.unmount());
});

it("finishes loading and exposes a first-read error instead of an empty success", async () => {
  read.mockRejectedValueOnce(new Error("unavailable"));
  let tree!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { tree = TestRenderer.create(<Probe />); });
  expect(state).toMatchObject({ places: [], failed: true, loading: false });
  TestRenderer.act(() => tree.unmount());
});

it("ignores an older read finishing after a newer refresh", async () => {
  const first = pending<PlaceWithAdn[]>();
  read.mockReturnValueOnce(first.promise).mockResolvedValueOnce(places);
  let tree!: ReturnType<typeof TestRenderer.create>;
  await TestRenderer.act(async () => { tree = TestRenderer.create(<Probe />); });
  await TestRenderer.act(async () => { await state.reload(); });
  await TestRenderer.act(async () => { first.resolve([]); });
  expect(state).toMatchObject({ places, failed: false, loading: false });
  TestRenderer.act(() => tree.unmount());
});
