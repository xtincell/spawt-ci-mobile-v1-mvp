import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import restaurants, { calcMatchScore } from "../data/restaurants";
import AxisBar from "../components/AxisBar";
import CatSilhouette from "../components/CatSilhouette";
import { COLORS as C } from "../theme";

const AXES_META = [
  { key: "racinesHorizons", left: "Racines", right: "Horizons" },
  { key: "taniereNomade", left: "Taniere", right: "Nomade" },
  { key: "exigeantEnthousiaste", left: "Exigeant", right: "Enthousiaste" },
  { key: "fouleSecret", left: "Foule", right: "Secret" },
  { key: "gargoteTable", left: "Gargote", right: "Table" },
];

// Normalize specialite to {id, nom} — handles both string and object formats
function normalizePlat(s, i) {
  if (typeof s === "string") return { id: `seed-${i}`, nom: s };
  return { id: s.id || `seed-${i}`, nom: s.nom || String(s) };
}

function StarInput({ rating, onChange, size = 28 }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: size, color: n <= rating ? C.gold : C.grey200, padding: 2,
        }}>&#9733;</button>
      ))}
    </div>
  );
}

function StarDisplay({ rating = 0, size = 12 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, fontSize: size, color: C.gold }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ opacity: n <= Math.round(rating) ? 1 : 0.3 }}>&#9733;</span>
      ))}
    </span>
  );
}

function BudgetDots({ budget, max = 5 }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < budget ? C.gold : C.grey200 }} />
      ))}
    </span>
  );
}

// ── ADN dual axis — spot (gold) + user palais (green) ──
function AxisBarDual({ left, right, spotValue, userValue }) {
  const spotNorm = Math.max(0, Math.min(1, (spotValue + 50) / 100));
  const userNorm = Math.max(0, Math.min(1, (userValue + 50) / 100));

  const isLeft = spotNorm < 0.5;
  const fillLeft = isLeft ? `${spotNorm * 100}%` : "50%";
  const fillWidth = isLeft ? `${(0.5 - spotNorm) * 100}%` : `${(spotNorm - 0.5) * 100}%`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{
        fontFamily: "var(--body)", fontSize: 11, fontWeight: 600,
        color: C.grey300, minWidth: 72, textAlign: "right", lineHeight: 1.2,
      }}>{left}</span>
      <div style={{
        flex: 1, height: 6, borderRadius: 3, background: C.grey600,
        position: "relative", overflow: "visible",
      }}>
        {/* Center line */}
        <div style={{
          position: "absolute", left: "50%", top: -2,
          width: 1, height: 10, background: C.grey400,
          transform: "translateX(-0.5px)",
        }} />
        {/* Fill from center to spot value */}
        <div style={{
          position: "absolute", top: 0, left: fillLeft, width: fillWidth,
          height: "100%", borderRadius: 3,
          background: `linear-gradient(${isLeft ? "270deg" : "90deg"}, ${C.gold}, rgba(200,164,78,0.15))`,
        }} />
        {/* Spot dot (gold, larger) */}
        <div style={{
          position: "absolute", top: "50%", left: `${spotNorm * 100}%`,
          width: 12, height: 12, borderRadius: "50%", background: C.gold,
          border: `2px solid ${C.warmBlack}`, transform: "translate(-50%, -50%)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)", zIndex: 2,
        }} />
        {/* User palais dot (green, smaller) */}
        <div style={{
          position: "absolute", top: "50%", left: `${userNorm * 100}%`,
          width: 8, height: 8, borderRadius: "50%", background: C.green,
          border: `1.5px solid ${C.warmBlack}`, transform: "translate(-50%, -50%)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)", zIndex: 3,
          transition: "left 0.4s ease",
        }} />
      </div>
      <span style={{
        fontFamily: "var(--body)", fontSize: 11, fontWeight: 600,
        color: C.grey300, minWidth: 72, textAlign: "left", lineHeight: 1.2,
      }}>{right}</span>
    </div>
  );
}

// ── DishItem — expandable dish card ──
function DishItem({ dish }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = dish.reviews && dish.reviews.length > 0;

  return (
    <div style={{
      borderRadius: 12, background: C.white,
      border: `1px solid ${C.grey100}`, marginBottom: 8, overflow: "hidden",
    }}>
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        style={{
          width: "100%", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none",
          cursor: hasDetails ? "pointer" : "default", textAlign: "left",
        }}
      >
        <span style={{
          fontFamily: "var(--body)", fontSize: 13, fontWeight: 600,
          color: C.warmBlack, flex: 1,
        }}>
          {dish.nom}
          {dish._community && (
            <span style={{
              marginLeft: 6, fontSize: 9, color: C.green,
              background: "rgba(45,122,80,0.1)", padding: "1px 6px",
              borderRadius: 8, fontWeight: 700, verticalAlign: "middle",
              fontFamily: "var(--body)",
            }}>Communauté</span>
          )}
        </span>
        {dish.avgRating > 0 && <StarDisplay rating={dish.avgRating} size={11} />}
        {dish.count > 0 && (
          <span style={{ fontFamily: "var(--body)", fontSize: 10, color: C.grey300 }}>({dish.count})</span>
        )}
        {hasDetails && (
          <span style={{
            fontSize: 10, color: C.grey300,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease", display: "inline-block",
          }}>▼</span>
        )}
      </button>

      {expanded && hasDetails && (
        <div style={{ padding: "0 14px 10px", borderTop: `1px solid ${C.grey100}` }}>
          {dish.reviews.map((r, i) => (
            <div key={i} style={{
              padding: "8px 0",
              borderBottom: i < dish.reviews.length - 1 ? `1px solid ${C.grey50}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <StarDisplay rating={r.rating} size={10} />
                <span style={{ fontFamily: "var(--body)", fontSize: 10, color: C.grey300 }}>{r.date}</span>
                {r.certified && (
                  <span style={{ fontSize: 9, color: C.green, fontFamily: "var(--body)" }}>✓ certifié</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════
// SpotDetail — main page
// ═════════════════════════════════════════

export default function SpotDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    user, spawtSpot, editSpawt, useCoupDeCoeur,
    toggleMarkSpot, isSpotMarked, getCommunityMenu,
    getOnSiteStatus,
  } = useUser();

  const spot = restaurants.find(r => r.id === Number(id));
  const [showSpawt, setShowSpawt] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [spawted, setSpawted] = useState(false);
  const [coeurUsed, setCoeurUsed] = useState(false);
  const [lastAction, setLastAction] = useState(null); // 'spawt' | 'edit'

  // Plats selection state
  const [selectedPlats, setSelectedPlats] = useState([]);
  const [platRatings, setPlatRatings] = useState({});
  const [customPlat, setCustomPlat] = useState("");
  const [showPlatInput, setShowPlatInput] = useState(false);

  // Edit mode
  const [editingSpawt, setEditingSpawt] = useState(null);

  // Auto-reset success banner after 3s
  useEffect(() => {
    if (!spawted) return;
    const timer = setTimeout(() => { setSpawted(false); setLastAction(null); }, 3000);
    return () => clearTimeout(timer);
  }, [spawted]);

  if (!spot) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🐾</div>
        <div style={{ fontFamily: "var(--body)", color: C.grey400 }}>Spot introuvable.</div>
        <button onClick={() => navigate("/")} style={{
          marginTop: 16, padding: "10px 24px", borderRadius: 12,
          background: C.gold, color: C.black, border: "none",
          fontFamily: "var(--body)", fontWeight: 600, cursor: "pointer",
        }}>Retour</button>
      </div>
    );
  }

  const match = calcMatchScore(user.palais, spot.adn);
  const marked = isSpotMarked(spot.id);

  // User's spawts for this spot
  const mySpawts = user.spawts.filter(s => s.spotId === spot.id);

  // Normalized seed specialites
  const seedDishes = (spot.specialites || []).map(normalizePlat);

  // ── Aggregated dishes for "La Carte" ──
  const aggregatedDishes = useMemo(() => {
    const dishMap = {};

    // 1. Seed dishes (always shown)
    for (const d of seedDishes) {
      dishMap[d.nom.toLowerCase()] = { nom: d.nom, avgRating: 0, count: 0, reviews: [], _community: false };
    }

    // 2. User's own spawt dish ratings
    for (const s of mySpawts) {
      if (!s.plats) continue;
      for (const p of s.plats) {
        const key = p.nom.toLowerCase();
        if (!dishMap[key]) {
          dishMap[key] = { nom: p.nom, avgRating: 0, count: 0, reviews: [], _community: false };
        }
        if (p.rating) {
          dishMap[key].reviews.push({
            rating: p.rating,
            date: new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
            certified: !!s.certified,
          });
        }
      }
    }

    // 3. Community menu
    const communityMenu = getCommunityMenu ? getCommunityMenu(spot.id) : [];
    for (const cm of communityMenu) {
      const key = cm.nom.toLowerCase();
      if (!dishMap[key]) {
        dishMap[key] = { nom: cm.nom, avgRating: cm.avgRating, count: cm.count, reviews: [], _community: true };
      } else {
        // Merge community counts
        if (cm.count > dishMap[key].count && dishMap[key].reviews.length === 0) {
          dishMap[key].avgRating = cm.avgRating;
          dishMap[key].count = cm.count;
        }
        if (!seedDishes.find(sd => sd.nom.toLowerCase() === key)) {
          dishMap[key]._community = true;
        }
      }
    }

    // Compute averages from reviews
    return Object.values(dishMap).map(d => {
      if (d.reviews.length > 0) {
        const rated = d.reviews.filter(r => r.rating);
        if (rated.length > 0) {
          d.avgRating = Math.round((rated.reduce((sum, r) => sum + r.rating, 0) / rated.length) * 10) / 10;
          d.count = Math.max(d.count, rated.length);
        }
      }
      return d;
    });
  }, [spot.id, spot.specialites, user.spawts, getCommunityMenu]);

  // ── Dishes for the spawt form (seed + community) ──
  const formDishes = useMemo(() => {
    const communityMenu = getCommunityMenu ? getCommunityMenu(spot.id) : [];
    const seedNames = new Set(seedDishes.map(s => s.nom.toLowerCase()));
    const extras = communityMenu
      .filter(d => !seedNames.has(d.nom.toLowerCase()))
      .map(d => ({ id: `community-${d.nom}`, nom: d.nom, _community: true }));
    return [...seedDishes, ...extras];
  }, [spot.id, spot.specialites, getCommunityMenu]);

  // ── Handlers ──

  const togglePlat = (plat) => {
    const platKey = plat.id || plat.nom;
    if (selectedPlats.find(p => (p.id || p.nom) === platKey)) {
      setSelectedPlats(prev => prev.filter(p => (p.id || p.nom) !== platKey));
      setPlatRatings(prev => { const n = { ...prev }; delete n[platKey]; return n; });
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

  const handleSpawt = () => {
    if (spawted || reviewRating === 0) return;

    const platsData = selectedPlats.map(p => ({
      platId: p.id,
      nom: p.nom,
      rating: platRatings[p.id || p.nom] || null,
    })).filter(p => p.rating);

    // Check certification via onSite timer
    const onSiteStatus = getOnSiteStatus ? getOnSiteStatus() : null;
    const certified = !!(onSiteStatus && onSiteStatus.spotId === spot.id && onSiteStatus.readyToRate);

    if (editingSpawt) {
      editSpawt(editingSpawt.id, {
        rating: reviewRating,
        review: reviewText || undefined,
        plats: platsData.length > 0 ? platsData : undefined,
      });
      setLastAction("edit");
    } else {
      spawtSpot(spot.id, spot.adn, {
        rating: reviewRating,
        review: reviewText,
        plats: platsData.length > 0 ? platsData : undefined,
        certified,
      });
      setLastAction("spawt");
    }

    setEditingSpawt(null);
    setSpawted(true);
    setShowSpawt(false);
    setReviewRating(0);
    setReviewText("");
    setSelectedPlats([]);
    setPlatRatings({});
  };

  const startEdit = (spawt) => {
    setEditingSpawt(spawt);
    setReviewRating(spawt.rating || 0);
    setReviewText(spawt.review || "");
    if (spawt.plats) {
      setSelectedPlats(spawt.plats.map(p => ({ id: p.platId || p.nom, nom: p.nom })));
      const ratings = {};
      spawt.plats.forEach(p => { if (p.rating) ratings[p.platId || p.nom] = p.rating; });
      setPlatRatings(ratings);
    } else {
      setSelectedPlats([]);
      setPlatRatings({});
    }
    setShowSpawt(true);
  };

  const cancelForm = () => {
    setShowSpawt(false);
    setEditingSpawt(null);
    setReviewRating(0);
    setReviewText("");
    setSelectedPlats([]);
    setPlatRatings({});
    setShowPlatInput(false);
  };

  const handleCoeur = () => {
    if (coeurUsed || user.coupsDeCoeur.used >= user.coupsDeCoeur.available) return;
    useCoupDeCoeur(spot.id);
    setCoeurUsed(true);
  };

  const openNewSpawt = () => {
    if (spawted) return;
    if (showSpawt) {
      cancelForm();
    } else {
      setEditingSpawt(null);
      setShowSpawt(true);
    }
  };

  // ═════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Back */}
      <div style={{ padding: "12px 16px", position: "absolute", zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{
          background: "rgba(0,0,0,0.4)", border: "none", cursor: "pointer",
          fontFamily: "var(--body)", fontSize: 14, color: C.white,
          display: "flex", alignItems: "center", gap: 6,
          borderRadius: 20, padding: "6px 14px",
        }}>&#8592; Retour</button>
      </div>

      {/* Hero with image */}
      <div style={{ position: "relative", background: C.black }}>
        {spot.image ? (
          <img src={spot.image} alt={spot.name} style={{
            width: "100%", height: 260, objectFit: "cover", display: "block", opacity: 0.6,
          }} />
        ) : (
          <div style={{
            width: "100%", height: 260, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${C.black}, ${C.warmBlack})`, fontSize: 72,
          }}>{spot.emoji}</div>
        )}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "60px 20px 24px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
          color: C.white,
        }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 30, marginBottom: 4, lineHeight: 1.15 }}>{spot.name}</div>
          <div style={{ fontFamily: "var(--body)", fontSize: 14, opacity: 0.7, marginBottom: 10 }}>
            {spot.type} &middot; {spot.quartier}
          </div>
          <span style={{
            display: "inline-block", background: C.gold, color: C.black,
            borderRadius: 20, padding: "5px 16px",
            fontFamily: "var(--body)", fontSize: 13, fontWeight: 700,
          }}>{match}% match avec ton Palais</span>
        </div>
      </div>

      <div style={{ padding: "16px 20px 0" }}>
        {/* Info */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey500 }}>Budget</span>
            <BudgetDots budget={spot.budget} />
          </div>
          <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey500 }}>&#128336; {spot.horaires}</div>
          <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.gold }}>&#11088; {spot.noteCommunautaire} ({spot.nbSpawts} spawts)</div>
        </div>

        {/* ── La Carte — aggregated dish section ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: "var(--display)", fontSize: 18, color: C.warmBlack, marginBottom: 10,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            La Carte
            {aggregatedDishes.some(d => d._community) && (
              <span style={{
                fontSize: 9, color: C.green, background: "rgba(45,122,80,0.1)",
                padding: "2px 8px", borderRadius: 10, fontWeight: 700,
                fontFamily: "var(--body)", verticalAlign: "middle",
              }}>+communauté</span>
            )}
          </div>
          {aggregatedDishes.length > 0 ? (
            aggregatedDishes.map((dish, i) => <DishItem key={dish.nom + i} dish={dish} />)
          ) : (
            <div style={{
              fontFamily: "var(--body)", fontSize: 12, color: C.grey300,
              padding: 16, textAlign: "center",
            }}>Aucun plat répertorié.</div>
          )}
        </div>

        {/* ── ADN du Lieu — with user palais comparison ── */}
        <div style={{
          borderRadius: 16, background: C.black, padding: "16px 14px",
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: 24,
        }}>
          <div style={{
            fontFamily: "var(--display)", fontSize: 16, color: C.gold,
            marginBottom: 12, textAlign: "center",
          }}>
            ADN du Lieu
          </div>
          {AXES_META.map(({ key, left, right }) => (
            <AxisBarDual
              key={key}
              left={left}
              right={right}
              spotValue={spot.adn[key]}
              userValue={user.palais[key]}
            />
          ))}
          {/* Legend */}
          <div style={{
            display: "flex", justifyContent: "center", gap: 16, marginTop: 4, paddingTop: 6,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--body)", fontSize: 9, color: C.grey300 }}>Ce lieu</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--body)", fontSize: 9, color: C.grey300 }}>Ton Palais</span>
            </span>
          </div>
        </div>

        {/* ── Mes spawts — user history for this spot ── */}
        {mySpawts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 18, color: C.warmBlack, marginBottom: 10 }}>
              Mes spawts{" "}
              <span style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey300 }}>({mySpawts.length})</span>
            </div>
            {mySpawts.slice().reverse().map((s) => (
              <div key={s.id || s.date} style={{
                padding: "12px 14px", borderRadius: 12,
                background: C.white, border: `1px solid ${C.grey100}`, marginBottom: 8,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {s.rating && <StarDisplay rating={s.rating} size={12} />}
                    {s.certified && (
                      <span style={{
                        fontSize: 9, color: C.green, background: "rgba(45,122,80,0.1)",
                        padding: "1px 6px", borderRadius: 8, fontWeight: 700,
                        fontFamily: "var(--body)",
                      }}>Certifié ✓</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--body)", fontSize: 10, color: C.grey300 }}>
                      {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <button onClick={() => startEdit(s)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 14, padding: 2, color: C.grey400,
                    }} aria-label="Modifier ce spawt">&#9998;</button>
                  </div>
                </div>
                {s.review && (
                  <div style={{
                    fontFamily: "var(--body)", fontSize: 12, color: C.grey600,
                    lineHeight: 1.4, marginBottom: 4,
                  }}>{s.review}</div>
                )}
                {s.plats && s.plats.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {s.plats.map((p, pi) => (
                      <span key={pi} style={{
                        padding: "2px 8px", borderRadius: 10,
                        background: C.goldGlow, fontFamily: "var(--body)",
                        fontSize: 10, color: C.gold, fontWeight: 600,
                      }}>{p.nom}{p.rating ? ` ★${p.rating}` : ""}</span>
                    ))}
                  </div>
                )}
                {s.lastEditedAt && (
                  <div style={{ fontFamily: "var(--body)", fontSize: 9, color: C.grey300, marginTop: 4 }}>
                    Modifié le {new Date(s.lastEditedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Avis de la communauté */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 18, color: C.warmBlack, marginBottom: 12 }}>Avis de la communauté</div>
          {spot.avis.map((a, i) => (
            <div key={i} style={{
              padding: "12px 14px", borderRadius: 12,
              background: C.white, border: `1px solid ${C.grey100}`, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "var(--body)", fontSize: 13, fontWeight: 700, color: C.warmBlack }}>{a.auteur}</span>
                <span style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey300 }}>{a.date}</span>
              </div>
              <div style={{ fontFamily: "var(--body)", fontSize: 13, color: C.grey600, lineHeight: 1.5, marginBottom: 4 }}>{a.texte}</div>
              <span style={{
                fontFamily: "var(--body)", fontSize: 10, color: C.gold,
                background: C.goldGlow, padding: "2px 8px", borderRadius: 10,
              }}>{a.fiabilite}</span>
            </div>
          ))}
        </div>

        {/* ── Actions row ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={openNewSpawt}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 14, border: "none",
              cursor: spawted ? "default" : "pointer",
              background: spawted ? C.grey200 : C.gold,
              color: spawted ? C.grey400 : C.black,
              fontFamily: "var(--body)", fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >&#128062; {spawted ? "Spawté !" : "Spawter"}</button>

          {/* Bookmark button */}
          <button onClick={() => toggleMarkSpot(spot.id)}
            style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              border: marked ? "none" : `2px solid ${C.gold}`,
              background: marked ? C.gold : C.white,
              color: marked ? C.black : C.gold,
              fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease",
            }}>&#128204;</button>

          <button onClick={handleCoeur}
            disabled={coeurUsed || user.coupsDeCoeur.used >= user.coupsDeCoeur.available}
            style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              border: coeurUsed ? "none" : `2px solid ${C.gold}`,
              background: coeurUsed ? C.gold : C.white,
              color: coeurUsed ? C.white : C.gold,
              fontSize: 22, cursor: coeurUsed ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>&hearts;</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 20 }}>
          <span style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey300 }}>
            {marked ? "&#128204; Ciblé" : "Cibler"}
          </span>
          <span style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey300 }}>
            Coups de coeur : {user.coupsDeCoeur.used} / {user.coupsDeCoeur.available}
          </span>
        </div>

        {/* ── Spawt form with dish rating ── */}
        {showSpawt && (
          <div style={{
            borderRadius: 16, background: C.grey50, padding: 20,
            border: `1px solid ${C.grey100}`, marginBottom: 24,
          }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 18, color: C.warmBlack, marginBottom: 4 }}>
              {editingSpawt ? "Modifier ton avis" : "Ton avis"}
            </div>
            <div style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey400, marginBottom: 14 }}>
              {editingSpawt ? "Modifie ta note ou tes plats" : "Note obligatoire pour spawter"}
            </div>

            {/* Star rating */}
            <StarInput rating={reviewRating} onChange={setReviewRating} />

            {/* Dish selection — merged seed + community */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: "var(--body)", fontSize: 13, fontWeight: 600, color: C.grey600, marginBottom: 8,
              }}>
                Qu'est-ce que t'as mangé ? <span style={{ fontWeight: 400, color: C.grey300 }}>(optionnel, +XP)</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {formDishes.map(plat => {
                  const isSelected = selectedPlats.find(p => (p.id || p.nom) === (plat.id || plat.nom));
                  return (
                    <button key={plat.id} onClick={() => togglePlat(plat)} style={{
                      padding: "6px 12px", borderRadius: 20,
                      background: isSelected ? C.gold : C.white,
                      color: isSelected ? C.black : C.grey600,
                      border: `1px solid ${isSelected ? C.gold : C.grey200}`,
                      fontFamily: "var(--body)", fontSize: 12, cursor: "pointer",
                      transition: "all 0.15s ease",
                      fontWeight: isSelected ? 700 : 400,
                    }}>
                      {plat.nom}
                      {plat._community && (
                        <span style={{ marginLeft: 4, fontSize: 9, opacity: 0.7 }}>🍽</span>
                      )}
                    </button>
                  );
                })}
                {!showPlatInput ? (
                  <button onClick={() => setShowPlatInput(true)} style={{
                    padding: "6px 12px", borderRadius: 20,
                    background: C.white, color: C.grey400,
                    border: `1px dashed ${C.grey200}`,
                    fontFamily: "var(--body)", fontSize: 12, cursor: "pointer",
                  }}>+ Autre plat</button>
                ) : (
                  <div style={{ display: "flex", gap: 4, width: "100%", marginTop: 4 }}>
                    <input value={customPlat} onChange={e => setCustomPlat(e.target.value)}
                      placeholder="Nom du plat..."
                      onKeyDown={e => e.key === "Enter" && addCustomPlat()}
                      style={{
                        flex: 1, padding: "6px 10px", borderRadius: 10,
                        border: `1px solid ${C.grey200}`, background: C.white,
                        fontFamily: "var(--body)", fontSize: 12, outline: "none",
                      }} />
                    <button onClick={addCustomPlat} style={{
                      padding: "6px 10px", borderRadius: 10,
                      background: C.gold, color: C.black, border: "none",
                      fontFamily: "var(--body)", fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>OK</button>
                  </div>
                )}
              </div>

              {/* Mini ratings for selected dishes */}
              {selectedPlats.map(plat => {
                const key = plat.id || plat.nom;
                return (
                  <div key={key} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    borderBottom: `1px solid ${C.grey100}`,
                  }}>
                    <span style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey600, flex: 1 }}>{plat.nom}</span>
                    <div style={{ display: "flex", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setPlatRatings(prev => ({ ...prev, [key]: n }))} style={{
                          background: "none", border: "none", cursor: "pointer",
                          fontSize: 16, color: n <= (platRatings[key] || 0) ? C.gold : C.grey200, padding: 1,
                        }}>&#9733;</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comment */}
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
              placeholder="Raconte ton expérience... (optionnel)"
              rows={2} style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${C.grey200}`, background: C.white,
                fontFamily: "var(--body)", fontSize: 13, color: C.grey600,
                resize: "vertical", outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={cancelForm} style={{
                flex: 1, padding: "10px 0", borderRadius: 10,
                border: `1px solid ${C.grey200}`, background: C.white,
                fontFamily: "var(--body)", fontSize: 13, color: C.grey500, cursor: "pointer",
              }}>Annuler</button>
              <button onClick={handleSpawt} disabled={reviewRating === 0} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                background: reviewRating > 0 ? C.gold : C.grey200,
                color: reviewRating > 0 ? C.black : C.grey400,
                fontFamily: "var(--body)", fontSize: 13, fontWeight: 700,
                cursor: reviewRating > 0 ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>&#128062; {editingSpawt ? "Modifier" : `Spawter${selectedPlats.length > 0 ? ` (${selectedPlats.length} plats)` : ""}`}</button>
            </div>
          </div>
        )}

        {/* Spawt feedback banner (auto-hides after 3s) */}
        {spawted && (
          <div style={{
            borderRadius: 16, background: C.goldGlow, padding: "16px 20px",
            border: `1px solid ${C.gold}`, textAlign: "center", marginBottom: 20,
          }}>
            <CatSilhouette size={28} color={C.gold} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontFamily: "var(--body)", fontSize: 14, color: C.warmBlack, fontWeight: 600 }}>
              {lastAction === "edit" ? "Avis modifié ! 🐾" : "Spot spawté ! Ton Palais évolue 🐾"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
