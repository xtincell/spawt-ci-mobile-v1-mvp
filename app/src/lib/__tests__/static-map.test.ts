// Story 4.12 — AC #1 + AC #5 : buildStaticMapUrl + deeplinks.

import {
  buildStaticMapUrl,
  geoUrl,
  appleMapsUrl,
} from "../static-map";

describe("buildStaticMapUrl — Story 4.12 AC #1", () => {
  it("construit une URL Mapbox quand un token est fourni", () => {
    const url = buildStaticMapUrl(
      5.35,
      -4.0,
      {},
      { provider: "mapbox", mapboxToken: "tok123" },
    );
    expect(url).toContain("api.mapbox.com");
    expect(url).toContain("access_token=tok123");
    // Mapbox attend lng,lat (ordre inversé).
    expect(url).toContain("-4,5.35");
  });

  it("construit une URL Google quand provider=google", () => {
    const url = buildStaticMapUrl(
      5.35,
      -4.0,
      {},
      { provider: "google", googleKey: "gkey" },
    );
    expect(url).toContain("maps.googleapis.com");
    expect(url).toContain("key=gkey");
    expect(url).toContain("center=5.35,-4");
  });

  it("retourne null sans clé API (fallback adresse texte)", () => {
    const url = buildStaticMapUrl(
      5.35,
      -4.0,
      {},
      { provider: null, mapboxToken: "", googleKey: "" },
    );
    expect(url).toBeNull();
  });

  it("retourne null pour des coords nulles (lieu sans géoloc)", () => {
    const url = buildStaticMapUrl(
      0,
      0,
      {},
      { provider: "mapbox", mapboxToken: "tok" },
    );
    expect(url).toBeNull();
  });

  it("retourne null pour des coords non finies", () => {
    const url = buildStaticMapUrl(
      Number.NaN,
      4,
      {},
      { provider: "mapbox", mapboxToken: "tok" },
    );
    expect(url).toBeNull();
  });
});

describe("deeplinks carte — Story 4.12", () => {
  it("geoUrl encode lat/lng + label", () => {
    expect(geoUrl(5.35, -4.0, "Chez Tantie")).toBe(
      "geo:5.35,-4?q=5.35,-4(Chez%20Tantie)",
    );
  });

  it("appleMapsUrl encode lat/lng + label", () => {
    expect(appleMapsUrl(5.35, -4.0, "Chez Tantie")).toBe(
      "https://maps.apple.com/?ll=5.35,-4&q=Chez%20Tantie",
    );
  });
});
