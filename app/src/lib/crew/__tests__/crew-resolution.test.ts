// Mode Crew — tests de la résolution déterministe (crew-resolution.ts).
// Couvre la cascade : majorité → égalité départagée par le score de matching
// de l'hôte → nouvelle égalité départagée par le premier proposé.

import {
  resolveCrewWinner,
  type CrewProposalTally,
  type HostTiebreak,
} from "../crew-resolution";
import type { MatchingContext, PlaceWithSignals } from "../../matching";
import type { Place, PlaceAdn } from "../../../types/place";
import type { UserPalais } from "../../../types/palais";

const REF_LAT = 5.358;
const REF_LNG = -3.97;
const NOW = new Date("2026-07-26T12:00:00Z");

function makePalais(overrides: Partial<UserPalais> = {}): UserPalais {
  return {
    spawter_id: "host-1",
    axe_racines_horizons: 0,
    axe_taniere_nomade: 0,
    axe_exigeant_enthousiaste: 0,
    axe_foule_secret: 0,
    axe_maquis_table: 0,
    confidence_score: 1,
    dominant_axes: null,
    archetype_id: null,
    stade: "touriste",
    total_spawts: 0,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makeAdn(place_id: string, overrides: Partial<PlaceAdn> = {}): PlaceAdn {
  return {
    place_id,
    axe_local_international: 0,
    axe_informel_etabli: 0,
    axe_budget_premium: 0,
    axe_populaire_prive: 0,
    axe_decontracte_habille: 0,
    confidence_score: 0.8,
    total_reviews: 10,
    sample_size: 10,
    weighted_rating: 4,
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makePlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: `Spot ${id}`,
    cuisine: ["ivoirienne"],
    location: {
      lat: REF_LAT,
      lng: REF_LNG,
      descriptive_address: "Test",
      neighborhood: "Cocody",
      city: "Abidjan",
    },
    price: { tier: 2 },
    hours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    phone: null,
    whatsapp: null,
    cover_photo_url: null,
    gallery_urls: [],
    menu_urls: [],
    signals: [],
    is_published: true,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makeCandidate(
  place_id: string,
  adnOverrides: Partial<PlaceAdn> = {},
): PlaceWithSignals {
  return {
    place: makePlace(place_id),
    adn: makeAdn(place_id, adnOverrides),
    last_spawt_at: null,
  };
}

function makeCtx(overrides: Partial<MatchingContext> = {}): MatchingContext {
  return {
    spawter_palais: makePalais(),
    spawter_lat: REF_LAT,
    spawter_lng: REF_LNG,
    visited_place_ids: new Set(),
    saved_place_ids: new Set(),
    now: NOW,
    ...overrides,
  };
}

function tally(proposal_id: string, place_id: string, votes: number): CrewProposalTally {
  return { proposal_id, place_id, votes };
}

describe("resolveCrewWinner — majorité simple", () => {
  it("retourne null sans proposition (on ne tranche pas dans le vide)", () => {
    expect(resolveCrewWinner([])).toBeNull();
  });

  it("le max de voix gagne, decided_by=majority", () => {
    const result = resolveCrewWinner([
      tally("pr1", "pl1", 1),
      tally("pr2", "pl2", 3),
      tally("pr3", "pl3", 2),
    ]);
    expect(result).toEqual({
      proposal_id: "pr2",
      place_id: "pl2",
      votes: 3,
      decided_by: "majority",
    });
  });

  it("une seule proposition à 0 voix gagne quand même (majorité triviale)", () => {
    const result = resolveCrewWinner([tally("pr1", "pl1", 0)]);
    expect(result?.proposal_id).toBe("pr1");
    expect(result?.decided_by).toBe("majority");
  });
});

describe("resolveCrewWinner — égalité départagée par le Palais de l'hôte", () => {
  it("l'ex æquo au meilleur score de matching hôte gagne", () => {
    // pl2 a une note pondérée bien meilleure → composante note du score plus
    // haute → départage en sa faveur, malgré un index plus élevé.
    const host: HostTiebreak = {
      ctx: makeCtx(),
      candidates: new Map([
        ["pl1", makeCandidate("pl1", { weighted_rating: 2 })],
        ["pl2", makeCandidate("pl2", { weighted_rating: 5 })],
      ]),
    };
    const result = resolveCrewWinner(
      [tally("pr1", "pl1", 2), tally("pr2", "pl2", 2)],
      host,
    );
    expect(result?.place_id).toBe("pl2");
    expect(result?.decided_by).toBe("host_palais");
  });

  it("un candidat absent de la map score 0 — l'autre gagne au Palais", () => {
    const host: HostTiebreak = {
      ctx: makeCtx(),
      candidates: new Map([["pl1", makeCandidate("pl1")]]),
    };
    const result = resolveCrewWinner(
      [tally("pr1", "pl-missing", 1), tally("pr2", "pl1", 1)],
      host,
    );
    expect(result?.place_id).toBe("pl1");
    expect(result?.decided_by).toBe("host_palais");
  });

  it("ne s'applique qu'aux ex æquo — un perdant au vote avec un meilleur ADN ne remonte pas", () => {
    const host: HostTiebreak = {
      ctx: makeCtx(),
      candidates: new Map([
        ["pl1", makeCandidate("pl1", { weighted_rating: 1 })],
        ["pl2", makeCandidate("pl2", { weighted_rating: 5 })],
      ]),
    };
    const result = resolveCrewWinner(
      [tally("pr1", "pl1", 3), tally("pr2", "pl2", 1)],
      host,
    );
    expect(result?.place_id).toBe("pl1");
    expect(result?.decided_by).toBe("majority");
  });
});

describe("resolveCrewWinner — ultime départage : premier proposé", () => {
  it("sans contexte hôte, l'égalité revient au premier proposé", () => {
    const result = resolveCrewWinner([
      tally("pr1", "pl1", 2),
      tally("pr2", "pl2", 2),
    ]);
    expect(result?.proposal_id).toBe("pr1");
    expect(result?.decided_by).toBe("first_proposed");
  });

  it("scores hôte identiques → premier proposé parmi les ex æquo", () => {
    // Deux ADN rigoureusement identiques → même score → règle 3.
    const host: HostTiebreak = {
      ctx: makeCtx(),
      candidates: new Map([
        ["pl1", makeCandidate("pl1")],
        ["pl2", makeCandidate("pl2")],
      ]),
    };
    const result = resolveCrewWinner(
      [tally("pr1", "pl1", 1), tally("pr2", "pl2", 1)],
      host,
    );
    expect(result?.proposal_id).toBe("pr1");
    expect(result?.decided_by).toBe("first_proposed");
  });

  it("cascade complète : le premier proposé PARMI les ex æquo au score, pas parmi tous", () => {
    // pr1/pr2/pr3 à égalité de voix. pr1 score plus bas ; pr2 et pr3 à
    // égalité de score max → premier proposé parmi {pr2, pr3} = pr2.
    const host: HostTiebreak = {
      ctx: makeCtx(),
      candidates: new Map([
        ["pl1", makeCandidate("pl1", { weighted_rating: 1 })],
        ["pl2", makeCandidate("pl2", { weighted_rating: 5 })],
        ["pl3", makeCandidate("pl3", { weighted_rating: 5 })],
      ]),
    };
    const result = resolveCrewWinner(
      [tally("pr1", "pl1", 1), tally("pr2", "pl2", 1), tally("pr3", "pl3", 1)],
      host,
    );
    expect(result?.proposal_id).toBe("pr2");
    expect(result?.decided_by).toBe("first_proposed");
  });

  it("est déterministe : mêmes entrées → même sortie (pas de hasard)", () => {
    const input = [tally("pr1", "pl1", 2), tally("pr2", "pl2", 2)];
    const a = resolveCrewWinner(input);
    const b = resolveCrewWinner(input);
    expect(a).toEqual(b);
  });

  it("ne mute pas les entrées", () => {
    const input = [tally("pr1", "pl1", 1), tally("pr2", "pl2", 3)];
    const snapshot = JSON.parse(JSON.stringify(input)) as CrewProposalTally[];
    resolveCrewWinner(input);
    expect(input).toEqual(snapshot);
  });
});
