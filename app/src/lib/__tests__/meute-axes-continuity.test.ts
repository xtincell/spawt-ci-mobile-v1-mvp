import { hasMeuteCalibration, initialMeutePalais, parseMeuteHeritage, parseQuizAxes } from "../meute-heritage";
import { palaisToQuizAxes, computeArchetype } from "../archetype-engine";
import { useOnboardingDraft } from "../../store/onboarding-draft";

const axes = { R: -1, T: 0, E: 1, F: 2, M: -2 };
const pending = { claimed: false, code: "spawter_pending", archetype: "murmure", pionnier_seq: 42, axes };
function draft() {
  return { ...useOnboardingDraft.getState().draft, meute_heritage: pending, use_meute_axes: true };
}
beforeEach(() => useOnboardingDraft.getState().reset());

it.each(["spawter_pending", "already_claimed", "claimed"])("conserve le vecteur dans le retour %s", (code) => {
  expect(parseMeuteHeritage({ ...pending, claimed: code === "claimed", code })).toEqual({ ...pending, claimed: code === "claimed", code });
});
it.each([
  null, [], {}, { R: -1, T: 0, E: 1, F: 2 }, { ...axes, F: "2" },
  { ...axes, F: NaN }, { ...axes, F: Infinity }, { ...axes, M: -2.01 },
])("refuse un vecteur absent, incomplet ou non borné : %j", (value) => {
  expect(parseQuizAxes(value)).toBeNull();
  expect(hasMeuteCalibration({ ...draft(), meute_heritage: { ...pending, axes: value as typeof axes } })).toBe(false);
});
it("refuse un archétype inconnu et un rang invalide sans bloquer la calibration", () => {
  expect(parseMeuteHeritage({ ...pending, archetype: "inconnu" })).toBeNull();
  expect(parseMeuteHeritage({ ...pending, pionnier_seq: -1 })?.pionnier_seq).toBeNull();
  expect(parseMeuteHeritage({ ...pending, pionnier_seq: 1.5 })?.pionnier_seq).toBeNull();
});
it("le choix de recalibrer désactive l'héritage, y compris pour une réponse neutre ou un saut", () => {
  useOnboardingDraft.getState().setField("meute_heritage", pending);
  expect(hasMeuteCalibration(useOnboardingDraft.getState().draft)).toBe(true);
  useOnboardingDraft.getState().setCalibration("foule_secret", null);
  expect(hasMeuteCalibration(useOnboardingDraft.getState().draft)).toBe(false);
  expect(useOnboardingDraft.getState().draft.meute_heritage?.pionnier_seq).toBe(42);
  useOnboardingDraft.getState().reset();
  expect(useOnboardingDraft.getState().draft.meute_heritage).toBeNull();
  expect(useOnboardingDraft.getState().draft.use_meute_axes).toBe(true);
});
it("conversion sans perte ni inversion pour les 3125 vecteurs entiers du quiz", () => {
  const values = [-2, -1, 0, 1, 2];
  let examined = 0;
  for (const R of values) for (const T of values) for (const E of values) for (const F of values) for (const M of values) {
    const vector = { R, T, E, F, M };
    const result = initialMeutePalais({ ...draft(), meute_heritage: { ...pending, axes: vector, archetype: computeArchetype(vector).key } });
    expect(palaisToQuizAxes(result.axes)).toEqual(vector);
    expect(result.archetype).toBe(computeArchetype(vector).key);
    expect(result.confidence).toBeLessThan(0.3);
    examined++;
  }
  expect(examined).toBe(3125);
});
