import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import restaurants, { calcMatchScore } from "../data/restaurants";
import SpotCard from "../components/SpotCard";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { COLORS as C } from "../theme";

const BUDGET_FILTERS = [
  { label: "Tous", value: 0 },
  { label: "€", value: 1 },
  { label: "€€", value: 2 },
  { label: "€€€", value: 3 },
  { label: "€€€€", value: 4 },
];

const CATEGORY_FILTERS = [
  { label: "Tous", value: "" },
  { label: "Date Night", value: "date-night" },
  { label: "Dabali", value: "dabali" },
  { label: "Boys", value: "boys" },
  { label: "Nouveau", value: "nouveau" },
  { label: "Hype", value: "hype" },
];

// Custom marker SVG as data URL
function createMarkerElement(spot, match) {
  const el = document.createElement("div");
  el.style.cursor = "pointer";
  el.style.width = "36px";
  el.style.height = "44px";
  el.style.position = "relative";
  el.innerHTML = `
    <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="${C.gold}"/>
      <circle cx="18" cy="16" r="10" fill="${C.black}"/>
      <text x="18" y="20" text-anchor="middle" font-size="12" fill="${C.gold}" font-family="sans-serif" font-weight="700">${match}%</text>
    </svg>
  `;
  return el;
}

function SpotMap({ results, onTap }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm-tiles",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-3.99, 5.34], // Abidjan center
      zoom: 12.5,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when results change
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add new markers
    results.forEach(({ spot, match }) => {
      if (!spot.coords) return;

      const el = createMarkerElement(spot, match);

      const popup = new maplibregl.Popup({
        offset: [0, -44],
        closeButton: false,
        maxWidth: "220px",
      }).setHTML(`
        <div style="padding:8px;font-family:Manrope,sans-serif;">
          <div style="font-weight:700;font-size:14px;color:${C.warmBlack};margin-bottom:2px;">${spot.name}</div>
          <div style="font-size:11px;color:${C.grey500};margin-bottom:4px;">${spot.type} · ${spot.quartier}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="background:${C.gold};color:${C.black};font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;">${match}% match</span>
            <span style="font-size:11px;color:${C.gold};">⭐ ${spot.noteCommunautaire}</span>
          </div>
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spot.coords.lng, spot.coords.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      el.addEventListener("click", () => {
        // Close popup after brief delay so user sees it, then navigate
        setTimeout(() => onTap(spot.id), 600);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have markers
    if (results.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      results.forEach(({ spot }) => {
        if (spot.coords) bounds.extend([spot.coords.lng, spot.coords.lat]);
      });
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }, [results, onTap]);

  return (
    <div ref={mapContainer} style={{
      width: "100%",
      height: "calc(100vh - 280px)",
      minHeight: 300,
      borderRadius: 16,
      overflow: "hidden",
      border: `1px solid ${C.grey100}`,
    }} />
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const { user, isSpotMarked, toggleMarkSpot } = useUser();
  const [search, setSearch] = useState("");
  const [budgetFilter, setBudgetFilter] = useState(0);
  const [catFilter, setCatFilter] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" or "map"

  const results = useMemo(() => {
    let filtered = restaurants;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          r.quartier.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q)
      );
    }

    if (budgetFilter > 0) {
      filtered = filtered.filter(r => r.budget <= budgetFilter);
    }

    if (catFilter) {
      filtered = filtered.filter(r => r.categorie === catFilter);
    }

    return filtered
      .map(r => ({
        spot: r,
        match: calcMatchScore(user.palais, r.adn),
      }))
      .sort((a, b) => b.match - a.match);
  }, [search, budgetFilter, catFilter, user.palais]);

  const goSpot = (id) => navigate(`/spot/${id}`);

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 24, color: C.warmBlack }}>
            Découvrir
          </div>
          {/* View toggle */}
          <div style={{ display: "flex", gap: 4, background: C.grey50, borderRadius: 10, padding: 3 }}>
            <button onClick={() => setViewMode("list")} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: viewMode === "list" ? C.black : "transparent",
              color: viewMode === "list" ? C.gold : C.grey400,
              fontFamily: "var(--body)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>☰</button>
            <button onClick={() => setViewMode("map")} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: viewMode === "map" ? C.black : "transparent",
              color: viewMode === "map" ? C.gold : C.grey400,
              fontFamily: "var(--body)", fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>🗺</button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            fontSize: 16, color: C.grey300,
          }}>
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, quartier, cuisine..."
            style={{
              width: "100%", padding: "12px 14px 12px 40px",
              borderRadius: 14, border: `1px solid ${C.grey200}`,
              background: C.white, fontFamily: "var(--body)", fontSize: 14,
              color: C.warmBlack, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Budget filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }} className="ns">
          {BUDGET_FILTERS.map(f => {
            const active = budgetFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setBudgetFilter(f.value)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: active ? "none" : `1px solid ${C.grey200}`,
                  background: active ? C.warmBlack : C.white,
                  color: active ? C.gold : C.grey500,
                  fontFamily: "var(--body)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }} className="ns">
          {CATEGORY_FILTERS.map(f => {
            const active = catFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setCatFilter(f.value)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: active ? "none" : `1px solid ${C.grey200}`,
                  background: active ? C.warmBlack : C.white,
                  color: active ? C.gold : C.grey500,
                  fontFamily: "var(--body)", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey400, marginBottom: 12 }}>
          {results.length} résultat{results.length !== 1 ? "s" : ""}
        </div>

        {viewMode === "map" ? (
          <SpotMap results={results} onTap={goSpot} />
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
            <div style={{ fontFamily: "var(--body)", fontSize: 14, color: C.grey400 }}>
              Aucun spot trouvé. Essaie d'autres filtres.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {results.map(r => (
              <SpotCard
                key={r.spot.id}
                spot={{ ...r.spot, communityRating: r.spot.noteCommunautaire }}
                matchScore={r.match}
                isMarked={isSpotMarked(r.spot.id)}
                onToggleMark={toggleMarkSpot}
                onClick={() => goSpot(r.spot.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
