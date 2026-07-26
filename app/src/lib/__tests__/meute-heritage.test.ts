// finding P0 — application de l'héritage quiz « La Meute » (helper pur).

import { applyMeuteHeritage } from "../meute-heritage";
import { ARCHETYPES } from "../../data/archetypes";
import type { Spawter } from "../../types/spawter";
import type { UserPalais } from "../../types/palais";

const spawter = (over: Partial<Spawter> = {}): Spawter =>
  ({ id: "s1", quiz_archetype: "gardien", pionnier_seq: null, ...over } as Spawter);
const palais = (over: Partial<UserPalais> = {}): UserPalais =>
  ({ spawter_id: "s1", archetype_id: "gardien", ...over } as UserPalais);

describe("applyMeuteHeritage", () => {
  it("claim frais → écrase l'archétype local, pose pionnier_seq, miroir palais + titre", () => {
    const res = applyMeuteHeritage(spawter(), palais(), {
      claimed: true,
      archetype: "murmure",
      pionnier_seq: 42,
    });
    expect(res).not.toBeNull();
    expect(res?.spawter.quiz_archetype).toBe("murmure"); // 'gardien' calculé écrasé
    expect(res?.spawter.pionnier_seq).toBe(42);
    expect(res?.palais?.archetype_id).toBe("murmure");
    expect(res?.titleKey).toBe(ARCHETYPES.murmure.titleKey);
  });

  it("already_claimed (claimed=false mais archétype présent) → adopte quand même (réinstallation)", () => {
    const res = applyMeuteHeritage(spawter({ quiz_archetype: "gardien" }), palais(), {
      claimed: false,
      archetype: "murmure",
      pionnier_seq: 7,
    });
    expect(res?.spawter.quiz_archetype).toBe("murmure");
    expect(res?.spawter.pionnier_seq).toBe(7);
  });

  it("non-Pionnier (archétype null) → null, archétype local conservé", () => {
    expect(
      applyMeuteHeritage(spawter(), palais(), { claimed: false, archetype: null, pionnier_seq: null }),
    ).toBeNull();
  });

  it("claim null ou archétype invalide → null", () => {
    expect(applyMeuteHeritage(spawter(), palais(), null)).toBeNull();
    expect(
      applyMeuteHeritage(spawter(), palais(), { claimed: true, archetype: "pas-un-archetype", pionnier_seq: 1 }),
    ).toBeNull();
  });

  it("déjà appliqué (même archétype ET même seq) → no-op null", () => {
    expect(
      applyMeuteHeritage(
        spawter({ quiz_archetype: "murmure", pionnier_seq: 42 }),
        palais({ archetype_id: "murmure" }),
        { claimed: false, archetype: "murmure", pionnier_seq: 42 },
      ),
    ).toBeNull();
  });

  it("conserve le pionnier_seq local si le claim n'en fournit pas", () => {
    const res = applyMeuteHeritage(
      spawter({ quiz_archetype: "gardien", pionnier_seq: 99 }),
      palais(),
      { claimed: true, archetype: "lame", pionnier_seq: null },
    );
    expect(res?.spawter.quiz_archetype).toBe("lame");
    expect(res?.spawter.pionnier_seq).toBe(99);
  });

  it("palais null → adopte le spawter, palais reste null", () => {
    const res = applyMeuteHeritage(spawter(), null, {
      claimed: true,
      archetype: "lame",
      pionnier_seq: 3,
    });
    expect(res?.spawter.quiz_archetype).toBe("lame");
    expect(res?.palais).toBeNull();
  });
});
