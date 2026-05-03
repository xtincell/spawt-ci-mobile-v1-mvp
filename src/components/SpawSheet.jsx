import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import restaurants, { calcMatchScore, findNearbySpots } from "../data/restaurants";
import CatSilhouette from "./CatSilhouette";
import { COLORS as C } from "../theme";

// Inject keyframes once
const injectStyles = (() => {
  if (typeof document === "undefined") return false;
  const id = "spawsheet-keyframes";
  if (document.getElementById(id)) return true;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes spawSheetSlideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes spawSheetFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes spawSheetSlideDown {
      from { transform: translateY(0); }
      to   { transform: translateY(100%); }
    }
    @keyframes spawSheetFadeOut {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes spawSuccessPop {
      0%   { transform: scale(0.5); opacity: 0; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes spawConfettiDrift {
      0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(-60px) rotate(180deg); opacity: 0; }
    }
    @keyframes spawPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
  return true;
})();

/* ── Spot suggestion card (compact) ── */
function SpotSuggestion({ spot, match, label, sublabel, onSelect, spawtCount }) {
  return (
    <div
      onClick={() => onSelect(spot)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 14,
        background: C.white, border: `1px solid ${C.grey100}`,
        cursor: "pointer",
        marginBottom: 8,
        transition: "all 0.15s ease",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12, overflow: "hidden",
        flexShrink: 0, background: C.grey100,
      }}>
        {spot.image ? (
          <img src={spot.image} alt={spot.name} style={{
            width: "100%", height: "100%", objectFit: "cover",
          }} />
        ) : (
          <div style={{
            width: "100%", height: "100%", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 24, background: C.warmBlack,
          }}>{spot.emoji}</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 14, fontWeight: 700, color: C.warmBlack,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{spot.name}</div>
        <div style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 11, color: C.grey400, marginTop: 1,
        }}>{spot.type} &middot; {spot.quartier}</div>
        {sublabel && (
          <div style={{
            fontFamily: 'var(--body, "Manrope", sans-serif)',
            fontSize: 10, color: C.gold, marginTop: 2, fontWeight: 600,
          }}>{sublabel}</div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        {match && <div style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 12, fontWeight: 700, color: C.gold,
        }}>{match}%</div>}
        {label && <div style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 10, color: C.grey300, marginTop: 1,
        }}>{label}</div>}
        {spawtCount > 0 && <span style={{
          padding: "3px 8px", borderRadius: 20,
          background: C.goldGlow, color: C.gold,
          fontFamily: 'var(--body)', fontSize: 10, fontWeight: 700,
        }}>{spawtCount} spawt{spawtCount > 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}

/* ── Section header ── */
function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 8, marginTop: 16 }}>
      <div style={{
        fontFamily: 'var(--body, "Manrope", sans-serif)',
        fontSize: 13, fontWeight: 700, color: C.warmBlack,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>{icon}</span> {title}
      </div>
      {subtitle && (
        <div style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 11, color: C.grey400, marginTop: 2,
        }}>{subtitle}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   STEP 1 — DETECTION
   Search-first, smart list, GPS auto-skip
   ══════════════════════════════════════════════ */
function DetectionStep({ onSelectSpot, onClose, onDeclareOnSite, onNearbyDetected }) {
  const { user, getOnSiteStatus, isSpotMarked, toggleMarkSpot, clearOnSite } = useUser();
  const [search, setSearch] = useState("");
  const [geoStatus, setGeoStatus] = useState("pending"); // pending | loading | found | denied | unavailable
  const [nearbySpots, setNearbySpots] = useState([]);
  const geoAttempted = useRef(false);
  const autoSkipped = useRef(false);

  // Count user's spawts per spot for badges
  const spawtCountForSpot = (spotId) => user.spawts.filter(s => s.spotId === spotId).length;

  // Try geoloc on mount
  useEffect(() => {
    if (geoAttempted.current) return;
    geoAttempted.current = true;

    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }

    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearby = findNearbySpots(pos.coords.latitude, pos.coords.longitude, 0.8);
        if (nearby.length > 0) {
          setNearbySpots(nearby.slice(0, 3));
          setGeoStatus("found");

          // Report nearby spots for certification
          const certifiedIds = nearby.filter(n => n.distance < 0.15).map(n => n.spot.id);
          if (certifiedIds.length > 0 && onNearbyDetected) {
            onNearbyDetected(certifiedIds);
          }

          // Auto-skip: if ONE spot within 150m → go direct to rating
          if (!autoSkipped.current && nearby.length >= 1 && nearby[0].distance < 0.15) {
            autoSkipped.current = true;
            onSelectSpot(nearby[0].spot);
          }
        } else {
          setGeoStatus("unavailable");
        }
      },
      () => setGeoStatus("denied"),
      { timeout: 5000, maximumAge: 60000 }
    );
  }, [onSelectSpot, user.spawts]);

  // On-site status
  const onSiteStatus = getOnSiteStatus();
  const onSiteSpot = onSiteStatus ? restaurants.find(r => r.id === onSiteStatus.spotId) : null;

  // Marked spots
  const markedSpots = (user.markedSpots || [])
    .map(id => restaurants.find(r => r.id === id))
    .filter(Boolean);

  // Recent spawts (unique spots, last 7 days)
  const recentSpotIds = [...new Set(
    user.spawts
      .filter(s => Date.now() - new Date(s.date).getTime() < 7 * 86400000)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(s => s.spotId)
  )].slice(0, 3);
  const recentSpots = recentSpotIds.map(id => restaurants.find(r => r.id === id)).filter(Boolean);

  // Build unified smart list: nearby → marked → recent → all (deduplicated)
  const smartList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchFilter = (spot) => {
      if (!q) return true;
      return spot.name.toLowerCase().includes(q) ||
        spot.quartier.toLowerCase().includes(q) ||
        spot.type.toLowerCase().includes(q);
    };

    const seen = new Set();
    const items = [];

    // 1. Nearby (GPS)
    if (geoStatus === "found") {
      nearbySpots.forEach(({ spot, distance }) => {
        if (!matchFilter(spot)) return;
        if (seen.has(spot.id)) return;
        seen.add(spot.id);
        const cnt = spawtCountForSpot(spot.id);
        items.push({
          spot, distance,
          match: calcMatchScore(user.palais, spot.adn),
          tag: `\uD83D\uDCCD ${Math.round(distance * 1000)}m`,
          spawtCount: cnt,
        });
      });
    }

    // 2. Marked / "A tester"
    markedSpots.forEach(spot => {
      if (!matchFilter(spot)) return;
      if (seen.has(spot.id)) return;
      seen.add(spot.id);
      const cnt = spawtCountForSpot(spot.id);
      items.push({
        spot,
        match: calcMatchScore(user.palais, spot.adn),
        tag: "\uD83D\uDCCC \u00C0 tester",
        spawtCount: cnt,
      });
    });

    // 3. Recent
    recentSpots.forEach(spot => {
      if (!matchFilter(spot)) return;
      if (seen.has(spot.id)) return;
      seen.add(spot.id);
      const cnt = spawtCountForSpot(spot.id);
      items.push({
        spot,
        match: calcMatchScore(user.palais, spot.adn),
        tag: "\uD83D\uDD50 R\u00E9cent",
        spawtCount: cnt,
      });
    });

    // 4. All remaining spots, sorted by match
    const rest = restaurants
      .filter(r => !seen.has(r.id) && matchFilter(r))
      .map(r => ({
        spot: r,
        match: calcMatchScore(user.palais, r.adn),
        tag: null,
        spawtCount: spawtCountForSpot(r.id),
      }))
      .sort((a, b) => b.match - a.match);

    return [...items, ...rest];
  }, [user.palais, user.spawts, search, geoStatus, nearbySpots, markedSpots, recentSpots]);

  return (
    <div style={{ padding: "0 20px", overflowY: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>

      {/* ── On-Site Timer banner (priority: user has been here 20+ min) ── */}
      {onSiteSpot && onSiteStatus.readyToRate && (
        <div style={{
          padding: "14px 16px", borderRadius: 16,
          background: `linear-gradient(135deg, ${C.warmBlack}, #2A2520)`,
          border: `1px solid ${C.gold}`,
          marginBottom: 12,
        }}>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 11, color: C.gold,
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ animation: "spawPulse 1.5s ease infinite" }}>&#9201;</span>
            Sur place depuis {onSiteStatus.minutes} min
          </div>
          <div style={{
            fontFamily: 'var(--display)', fontSize: 18, color: C.white, marginBottom: 4,
          }}>Comment c'etait chez {onSiteSpot.name} ?</div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => onSelectSpot(onSiteSpot)} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none",
              background: C.gold, color: C.black,
              fontFamily: 'var(--body)', fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>&#128062; Noter maintenant</button>
            <button onClick={clearOnSite} style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.08)", border: "none",
              fontFamily: 'var(--body)', fontSize: 12, color: C.grey400, cursor: "pointer",
            }}>Pas encore</button>
          </div>
        </div>
      )}

      {/* ── SEARCH BAR — always first, always visible ── */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, color: C.grey300,
        }}>{"\uD83D\uDD0D"}</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Chercher un spot par nom, quartier..."
          autoFocus
          style={{
            width: "100%", padding: "12px 12px 12px 36px",
            borderRadius: 14, border: `1px solid ${C.grey200}`,
            background: C.grey50, fontFamily: 'var(--body, "Manrope", sans-serif)',
            fontSize: 14, color: C.warmBlack, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* ── GPS loading indicator (inline, subtle) ── */}
      {geoStatus === "loading" && (
        <div style={{
          padding: "6px 0", textAlign: "center",
          fontFamily: 'var(--body)', fontSize: 11, color: C.grey300,
        }}>
          <span style={{ animation: "spawPulse 1s ease infinite" }}>{"\uD83D\uDCCD"}</span> D\u00E9tection GPS...
        </div>
      )}

      {/* ── Unified smart list ── */}
      {smartList.length === 0 ? (
        <div style={{
          padding: "32px 0", textAlign: "center",
          fontFamily: 'var(--body)', fontSize: 13, color: C.grey400,
        }}>Aucun spot trouv\u00E9 pour \u00AB {search} \u00BB</div>
      ) : (
        smartList.slice(0, 12).map(({ spot, match, tag, spawtCount }) => (
          <SpotSuggestion
            key={spot.id}
            spot={spot}
            match={match}
            sublabel={tag || undefined}
            onSelect={onSelectSpot}
            spawtCount={spawtCount}
          />
        ))
      )}

      {/* ── "Je suis sur place" — compact inline link, not a giant block ── */}
      {!onSiteSpot && (
        <div style={{
          marginTop: 8, marginBottom: 4, textAlign: "center",
        }}>
          <button onClick={onDeclareOnSite} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: 'var(--body)', fontSize: 12, color: C.grey400,
            padding: "8px 16px", display: "inline-flex",
            alignItems: "center", gap: 6,
          }}>
            <span>{"\u23F1"}</span>
            <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
              {geoStatus === "denied" || geoStatus === "unavailable"
                ? "GPS indisponible ? D\u00E9clare ton arriv\u00E9e"
                : "Tu restes sur place ? Lance le chrono"
              }
            </span>
          </button>
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   STEP 1b — DECLARE ON SITE
   User picks a spot to "check in" for the timer
   ══════════════════════════════════════════════ */
function DeclareOnSiteStep({ onConfirm, onBack }) {
  const { user } = useUser();
  const [search, setSearch] = useState("");

  const spots = useMemo(() => {
    let list = restaurants
      .map(r => ({ spot: r, match: calcMatchScore(user.palais, r.adn) }))
      .sort((a, b) => b.match - a.match);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(({ spot }) =>
        spot.name.toLowerCase().includes(q) ||
        spot.quartier.toLowerCase().includes(q) ||
        spot.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [user.palais, search]);

  // Marked spots first
  const markedSpots = (user.markedSpots || [])
    .map(id => restaurants.find(r => r.id === id))
    .filter(Boolean);

  return (
    <div style={{ padding: "0 20px", flex: 1, overflowY: "auto" }}>
      <div style={{
        padding: "12px 0 16px",
        borderBottom: `1px solid ${C.grey100}`, marginBottom: 12,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 18, color: C.grey400, padding: "4px 8px 4px 0",
        }}>&#8592;</button>
        <div>
          <div style={{
            fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 18, color: C.warmBlack,
          }}>Tu es ou ?</div>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 11, color: C.grey400,
          }}>On te rappellera de noter apres ton repas</div>
        </div>
      </div>

      {markedSpots.length > 0 && (
        <>
          <SectionHeader icon="&#128204;" title="Tes spots cibles" />
          {markedSpots.map(spot => (
            <SpotSuggestion
              key={spot.id}
              spot={spot}
              match={calcMatchScore(user.palais, spot.adn)}
              sublabel="&#128204; Cible"
              onSelect={onConfirm}
            />
          ))}
        </>
      )}

      <div style={{ position: "relative", marginTop: 12, marginBottom: 8 }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          fontSize: 14, color: C.grey300,
        }}>&#128269;</span>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Ou chercher un spot..."
          style={{
            width: "100%", padding: "10px 12px 10px 36px",
            borderRadius: 12, border: `1px solid ${C.grey200}`,
            background: C.grey50, fontFamily: 'var(--body)', fontSize: 13,
            color: C.warmBlack, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {spots.slice(0, 10).map(({ spot, match }) => (
        <SpotSuggestion key={spot.id} spot={spot} match={match} onSelect={onConfirm} />
      ))}

      <div style={{ height: 24 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   STEP 2 — RATING
   Stars (required) + Plats (optional) + Comment
   ══════════════════════════════════════════════ */
function RatingStep({ spot, onSubmit, onBack, getCommunityMenu }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [selectedPlats, setSelectedPlats] = useState([]);
  const [platRatings, setPlatRatings] = useState({});
  const [customPlat, setCustomPlat] = useState("");
  const [showPlatInput, setShowPlatInput] = useState(false);

  const togglePlat = (plat) => {
    const key = plat.id || plat.nom;
    if (selectedPlats.find(p => (p.id || p.nom) === key)) {
      setSelectedPlats(prev => prev.filter(p => (p.id || p.nom) !== key));
      setPlatRatings(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setSelectedPlats(prev => [...prev, plat]);
    }
  };

  const addCustomPlat = () => {
    if (!customPlat.trim()) return;
    const plat = { id: `custom-${Date.now()}`, nom: customPlat.trim() };
    setSelectedPlats(prev => [...prev, plat]);
    setCustomPlat("");
    setShowPlatInput(false);
  };

  // Merge seed specialites with community-contributed dishes
  const allDishes = useMemo(() => {
    const seedDishes = spot.specialites || [];
    if (!getCommunityMenu) return seedDishes;
    const communityDishes = getCommunityMenu(spot.id);
    const seedNames = new Set(seedDishes.map(s => s.nom.toLowerCase()));
    const extras = communityDishes
      .filter(d => !seedNames.has(d.nom.toLowerCase()))
      .map(d => ({ id: `community-${d.nom}`, nom: d.nom, _community: true }));
    return [...seedDishes, ...extras];
  }, [spot, getCommunityMenu]);

  const canSubmit = rating > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const platsData = selectedPlats
      .map(p => ({ platId: p.id, nom: p.nom, rating: platRatings[p.id || p.nom] || null }))
      .filter(p => p.rating);

    onSubmit(rating, comment, platsData.length > 0 ? platsData : undefined);
  };

  return (
    <div style={{ padding: "0 20px 24px", overflowY: "auto", flex: 1 }}>
      {/* Spot header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 0 16px",
        borderBottom: `1px solid ${C.grey100}`, marginBottom: 20,
      }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 18, color: C.grey400, padding: "4px 8px 4px 0",
        }}>&#8592;</button>
        <div style={{
          width: 44, height: 44, borderRadius: 12, overflow: "hidden",
          flexShrink: 0, background: C.grey100,
        }}>
          {spot.image ? (
            <img src={spot.image} alt={spot.name} style={{
              width: "100%", height: "100%", objectFit: "cover",
            }} />
          ) : (
            <div style={{
              width: "100%", height: "100%", display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 22, background: C.warmBlack,
            }}>{spot.emoji}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 15, fontWeight: 700, color: C.warmBlack,
          }}>{spot.name}</div>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 11, color: C.grey400,
          }}>{spot.type} &middot; {spot.quartier}</div>
        </div>
      </div>

      {/* LEVEL 2 — Star rating (REQUIRED) */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 20, color: C.warmBlack, marginBottom: 4,
        }}>Comment c'etait ?</div>
        <div style={{
          fontFamily: 'var(--body)', fontSize: 11, color: C.grey400, marginBottom: 14,
        }}>Obligatoire pour spawter</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 40, color: n <= rating ? C.gold : C.grey200,
              padding: 2,
              transition: "transform 0.15s ease, color 0.15s ease",
              transform: n <= rating ? "scale(1.15)" : "scale(1)",
            }}>&#9733;</button>
          ))}
        </div>
        {rating > 0 && (
          <div style={{
            fontFamily: 'var(--body)', fontSize: 12, color: C.gold, marginTop: 8, fontWeight: 600,
          }}>
            {rating === 1 ? "Bof..." : rating === 2 ? "Moyen" : rating === 3 ? "Correct" : rating === 4 ? "Tres bien !" : "Exceptionnel !"}
          </div>
        )}
      </div>

      {/* LEVEL 3 — Dish selection (OPTIONAL) */}
      {rating > 0 && (
        <div style={{
          borderRadius: 14, background: C.grey50, padding: "14px 16px",
          border: `1px solid ${C.grey100}`, marginBottom: 16,
        }}>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 13, fontWeight: 600, color: C.grey600, marginBottom: 4,
          }}>Qu'est-ce que t'as mange ?</div>
          <div style={{
            fontFamily: 'var(--body)', fontSize: 11, color: C.grey400, marginBottom: 10,
          }}>Optionnel &middot; Ton Palais evolue plus vite (+40% XP)</div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {allDishes.map(plat => {
              const isSelected = selectedPlats.find(p => (p.id || p.nom) === (plat.id || plat.nom));
              return (
                <button key={plat.id || plat.nom} onClick={() => togglePlat(plat)} style={{
                  padding: "6px 12px", borderRadius: 20,
                  background: isSelected ? C.gold : C.white,
                  color: isSelected ? C.black : C.grey600,
                  border: `1px solid ${isSelected ? C.gold : C.grey200}`,
                  fontFamily: 'var(--body)', fontSize: 12, cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontWeight: isSelected ? 700 : 400,
                }}>
                  {plat.nom}
                  {plat._community && <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>&middot; Communaut\u00E9</span>}
                </button>
              );
            })}

            {!showPlatInput ? (
              <button onClick={() => setShowPlatInput(true)} style={{
                padding: "6px 12px", borderRadius: 20,
                background: C.white, color: C.grey400,
                border: `1px dashed ${C.grey200}`,
                fontFamily: 'var(--body)', fontSize: 12, cursor: "pointer",
              }}>+ Autre</button>
            ) : (
              <div style={{ display: "flex", gap: 4, width: "100%", marginTop: 4 }}>
                <input value={customPlat} onChange={e => setCustomPlat(e.target.value)}
                  placeholder="Nom du plat..."
                  onKeyDown={e => e.key === "Enter" && addCustomPlat()}
                  style={{
                    flex: 1, padding: "6px 10px", borderRadius: 10,
                    border: `1px solid ${C.grey200}`, background: C.white,
                    fontFamily: 'var(--body)', fontSize: 12, outline: "none",
                  }} />
                <button onClick={addCustomPlat} style={{
                  padding: "6px 10px", borderRadius: 10,
                  background: C.gold, color: C.black, border: "none",
                  fontFamily: 'var(--body)', fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>OK</button>
              </div>
            )}
          </div>

          {/* Mini ratings per dish */}
          {selectedPlats.map(plat => {
            const key = plat.id || plat.nom;
            return (
              <div key={key} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                borderTop: `1px solid ${C.grey100}`,
              }}>
                <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: C.grey600, flex: 1 }}>
                  {plat.nom}
                </span>
                <div style={{ display: "flex", gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n}
                      onClick={() => setPlatRatings(prev => ({ ...prev, [key]: n }))}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 18, color: n <= (platRatings[key] || 0) ? C.gold : C.grey200, padding: 1,
                      }}>&#9733;</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comment (collapsed by default) */}
      {rating > 0 && (
        <>
          {!showComment ? (
            <button onClick={() => setShowComment(true)} style={{
              width: "100%", padding: "10px", borderRadius: 12,
              background: "none", border: `1px dashed ${C.grey200}`,
              fontFamily: 'var(--body)', fontSize: 12, color: C.grey400,
              cursor: "pointer", marginBottom: 16, textAlign: "left",
            }}>&#128172; Ajouter un commentaire... (optionnel)</button>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Raconte ton experience..."
                rows={2}
                autoFocus
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 12,
                  border: `1px solid ${C.grey200}`, background: C.grey50,
                  fontFamily: 'var(--body)', fontSize: 13, color: C.grey600,
                  resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: "100%", padding: "15px 0", borderRadius: 14,
          border: "none",
          background: canSubmit ? C.gold : C.grey200,
          color: canSubmit ? C.black : C.grey400,
          fontFamily: 'var(--body)', fontSize: 15, fontWeight: 700,
          cursor: canSubmit ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.2s ease",
        }}
      >
        &#128062; Spawter
        {selectedPlats.length > 0 && <span style={{
          fontSize: 11, opacity: 0.7,
        }}>({selectedPlats.length} plat{selectedPlats.length > 1 ? "s" : ""})</span>}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN SPAWSHEET
   ══════════════════════════════════════════════ */
export default function SpawSheet({ open, onClose, preSelectedSpotId }) {
  const navigate = useNavigate();
  const { user, spawtSpot, setOnSite, clearOnSite, getOnSiteStatus, getCommunityMenu } = useUser();
  const [closing, setClosing] = useState(false);
  const [successSpot, setSuccessSpot] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showDeclareOnSite, setShowDeclareOnSite] = useState(false);
  const [lastCertified, setLastCertified] = useState(false);

  // Track GPS-nearby spots for certification
  const certifiedSpotIdsRef = useRef(new Set());

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      setSuccessSpot(null);
      setSelectedSpot(null);
      setShowDeclareOnSite(false);
      setLastCertified(false);
      onClose();
    }, 250);
  }, [onClose]);

  const handleSelectSpot = useCallback((spot) => {
    setSelectedSpot(spot);
    setShowDeclareOnSite(false);
  }, []);

  const handleBackToDetect = useCallback(() => {
    setSelectedSpot(null);
  }, []);

  const handleNearbyDetected = useCallback((spotIds) => {
    spotIds.forEach(id => certifiedSpotIdsRef.current.add(id));
  }, []);

  const handleSubmitReview = useCallback((rating, comment, plats) => {
    if (!selectedSpot) return;

    // Determine if spawt is certified (GPS nearby or on-site timer)
    const onSiteStatus = getOnSiteStatus();
    const isCertifiedGPS = certifiedSpotIdsRef.current.has(selectedSpot.id);
    const isCertifiedOnSite = onSiteStatus &&
      onSiteStatus.spotId === selectedSpot.id &&
      onSiteStatus.readyToRate;
    const certified = isCertifiedGPS || isCertifiedOnSite;

    spawtSpot(selectedSpot.id, selectedSpot.adn, { rating, review: comment, plats, certified });
    setLastCertified(certified);
    setSuccessSpot(selectedSpot);

    setTimeout(() => {
      handleClose();
    }, 2500);
  }, [selectedSpot, spawtSpot, handleClose, getOnSiteStatus]);

  const handleDeclareOnSite = useCallback(() => {
    setShowDeclareOnSite(true);
  }, []);

  const handleConfirmOnSite = useCallback((spot) => {
    setOnSite(spot.id);
    setShowDeclareOnSite(false);
    // Show a brief confirmation then close
    setSuccessSpot({ ...spot, _onSiteOnly: true });
    setTimeout(() => handleClose(), 2000);
  }, [setOnSite, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      // If a spot was pre-selected (e.g. from ModeRapide 🐾 button), skip detect → go straight to rate
      if (preSelectedSpotId) {
        const spot = restaurants.find(r => r.id === preSelectedSpotId);
        setSelectedSpot(spot || null);
      } else {
        setSelectedSpot(null);
      }
      setSuccessSpot(null);
      setClosing(false);
      setShowDeclareOnSite(false);
      setLastCertified(false);
      certifiedSpotIdsRef.current = new Set();
    }
  }, [open, preSelectedSpotId]);

  if (!open) return null;

  // Determine step
  const step = successSpot
    ? "success"
    : selectedSpot
      ? "rate"
      : showDeclareOnSite
        ? "declare"
        : "detect";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end",
      alignItems: "center",
    }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)",
          animation: closing ? "spawSheetFadeOut 0.25s ease forwards" : "spawSheetFadeIn 0.25s ease forwards",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "relative",
        width: "100%", maxWidth: 430,
        maxHeight: "88vh",
        background: C.white,
        borderRadius: "24px 24px 0 0",
        animation: closing ? "spawSheetSlideDown 0.25s ease forwards" : "spawSheetSlideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Handle */}
        <div style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: C.grey200 }} />
        </div>

        {/* ── SUCCESS ── */}
        {step === "success" && (
          <div style={{
            padding: "48px 24px 60px",
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 16, minHeight: 280,
          }}>
            <div style={{ animation: "spawSuccessPop 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards" }}>
              <CatSilhouette size={56} color={C.gold} />
            </div>

            {successSpot._onSiteOnly ? (
              /* On-site declaration success */
              <>
                <div style={{
                  fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 22, color: C.warmBlack,
                  textAlign: "center", animation: "spawSuccessPop 0.5s ease 0.15s forwards", opacity: 0,
                }}>
                  Sur place !
                </div>
                <div style={{
                  fontFamily: 'var(--body)', fontSize: 14, color: C.grey500, textAlign: "center",
                  animation: "spawSuccessPop 0.4s ease 0.3s forwards", opacity: 0,
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: C.warmBlack }}>{successSpot.name}</strong>
                  <br />On te rappelle de noter apres ton repas &#9201;
                </div>
              </>
            ) : (
              /* Regular spawt success */
              <>
                <div style={{
                  fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 24, color: C.warmBlack,
                  textAlign: "center", animation: "spawSuccessPop 0.5s ease 0.15s forwards", opacity: 0,
                }}>
                  Spawte !
                </div>
                <div style={{
                  fontFamily: 'var(--body)', fontSize: 15, color: C.grey500, textAlign: "center",
                  animation: "spawSuccessPop 0.4s ease 0.3s forwards", opacity: 0,
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: C.warmBlack }}>{successSpot.name}</strong>
                  <br />Ton Palais evolue &#128062;
                </div>
                {lastCertified && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 12px", borderRadius: 20,
                    background: C.greenGlow, color: C.green,
                    fontFamily: 'var(--body)', fontSize: 11, fontWeight: 700,
                    animation: "spawSuccessPop 0.4s ease 0.35s forwards", opacity: 0,
                  }}>&#10003; Spawt certifi\u00E9</div>
                )}
                <div style={{
                  display: "flex", gap: 8, marginTop: 8,
                  animation: "spawSuccessPop 0.4s ease 0.45s forwards", opacity: 0,
                }}>
                  {["🐾", "\u2728", "\uD83C\uDF89", "\u2B50", "\uD83D\uDCAB"].map((e, i) => (
                    <span key={i} style={{
                      fontSize: 20,
                      animation: `spawConfettiDrift 1.2s ease ${0.5 + i * 0.15}s forwards`,
                      opacity: 0,
                    }}>{e}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RATING STEP ── */}
        {step === "rate" && (
          <>
            <div style={{
              padding: "8px 20px 4px", display: "flex", alignItems: "center",
              justifyContent: "space-between", flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 22, color: C.warmBlack,
              }}>Ton avis</div>
              <button onClick={handleClose} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: C.grey50, border: "none",
                fontSize: 16, color: C.grey400, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>&#10005;</button>
            </div>
            <RatingStep
              spot={selectedSpot}
              onSubmit={handleSubmitReview}
              onBack={handleBackToDetect}
              getCommunityMenu={getCommunityMenu}
            />
          </>
        )}

        {/* ── DECLARE ON-SITE ── */}
        {step === "declare" && (
          <>
            <div style={{
              padding: "8px 20px 4px", display: "flex", alignItems: "center",
              justifyContent: "space-between", flexShrink: 0,
            }}>
              <div style={{
                fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 22, color: C.warmBlack,
              }}>&#9201; Sur place</div>
              <button onClick={handleClose} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: C.grey50, border: "none",
                fontSize: 16, color: C.grey400, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>&#10005;</button>
            </div>
            <DeclareOnSiteStep
              onConfirm={handleConfirmOnSite}
              onBack={() => setShowDeclareOnSite(false)}
            />
          </>
        )}

        {/* ── DETECTION STEP ── */}
        {step === "detect" && (
          <>
            <div style={{
              padding: "8px 20px 4px", display: "flex", alignItems: "center",
              justifyContent: "space-between", flexShrink: 0,
            }}>
              <div>
                <div style={{
                  fontFamily: 'var(--display)', fontStyle: "italic", fontSize: 22, color: C.warmBlack,
                }}>Ou as-tu mange ?</div>
                <div style={{
                  fontFamily: 'var(--body)', fontSize: 12, color: C.grey400, marginTop: 2,
                }}>Note ton experience</div>
              </div>
              <button onClick={handleClose} style={{
                width: 32, height: 32, borderRadius: "50%",
                background: C.grey50, border: "none",
                fontSize: 16, color: C.grey400, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>&#10005;</button>
            </div>
            <DetectionStep
              onSelectSpot={handleSelectSpot}
              onClose={handleClose}
              onDeclareOnSite={handleDeclareOnSite}
              onNearbyDetected={handleNearbyDetected}
            />
          </>
        )}
      </div>
    </div>
  );
}
