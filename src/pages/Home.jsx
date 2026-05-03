import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import restaurants, { calcMatchScore } from "../data/restaurants";
import ChatBubble from "../components/ChatBubble";
import SpotCard from "../components/SpotCard";
import CatSilhouette from "../components/CatSilhouette";
import AxisBar from "../components/AxisBar";
import { COLORS as C } from "../theme";

function getAutoMode() {
  const h = new Date().getHours();
  const d = new Date().getDay();
  if (h >= 11 && h < 14) return "rapide";
  if ((d === 5 || d === 6) && h >= 18) return "crew";
  return "explore";
}

function getChatLine(spotsCount) {
  const h = new Date().getHours();
  const d = new Date().getDay();
  if (h < 9) return "Le chat baille. Petit-dej ?";
  if (h >= 11 && h < 14) return "Il est midi passe. Tu as faim. Moi aussi.";
  if (d === 5 && h >= 18) return "Vendredi soir. Ton crew attend.";
  if (d === 0) return "Dimanche. Prends ton temps.";
  if (spotsCount === 0) return "Ton premier spot t'attend. Vas-y.";
  if (spotsCount < 5) return `${spotsCount} spots. Continue a explorer.`;
  if (spotsCount < 15) return `${spotsCount} spots. Ton Palais se dessine.`;
  return `${spotsCount} spots. Tu sais ce que tu veux.`;
}

const MODES = [
  { id: "rapide", label: "Rapide", icon: "\u26A1" },
  { id: "crew", label: "Crew", icon: "\uD83D\uDC65" },
  { id: "explore", label: "Explore", icon: "\uD83D\uDDFA" },
];

// ── MODE RAPIDE ──────────────────────────────
function ModeRapide({ spots, onTap, onSpawtDirect, isSpotMarked, toggleMarkSpot }) {
  const [idx, setIdx] = useState(0);
  if (spots.length === 0) return <div style={{ padding: 40, textAlign: "center", color: C.grey400, fontFamily: "var(--body)" }}>Aucun spot a recommander.</div>;
  const current = spots[idx % spots.length];

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey400 }}>{(idx % spots.length) + 1} / {spots.length}</span>
      </div>
      <div style={{ maxWidth: 320, margin: "0 auto" }}>
        <SpotCard
          spot={{ ...current.spot, communityRating: current.spot.noteCommunautaire }}
          matchScore={current.match}
          isMarked={isSpotMarked(current.spot.id)}
          onToggleMark={toggleMarkSpot}
          onClick={() => onTap(current.spot.id)}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
        <button onClick={() => setIdx(i => i + 1)} style={{
          width: 56, height: 56, borderRadius: "50%",
          border: `2px solid ${C.grey200}`, background: C.white,
          fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{"\u2715"}</button>
        <button onClick={() => onSpawtDirect(current.spot.id)} style={{
          width: 64, height: 64, borderRadius: "50%",
          border: "none", background: C.gold, color: C.black,
          fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 16px ${C.goldGlow}`,
        }}>{"\uD83D\uDC3E"}</button>
        <button onClick={() => {
          const url = `https://wa.me/?text=${encodeURIComponent(`Regarde ce spot: ${current.spot.name} \u2014 ${current.spot.quartier}`)}`;
          window.open(url, "_blank");
        }} style={{
          width: 56, height: 56, borderRadius: "50%",
          border: `2px solid ${C.grey200}`, background: C.white,
          fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>{"\uD83D\uDCE4"}</button>
      </div>
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey300 }}>Passer &middot; Spawter &middot; Partager</span>
      </div>
    </div>
  );
}

// ── MODE CREW ────────────────────────────────
function ModeCrew() {
  return (
    <div style={{ padding: "24px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{"\uD83D\uDC65"}</div>
      <div style={{ fontFamily: "var(--display)", fontSize: 22, color: C.warmBlack, marginBottom: 8 }}>Mode Crew</div>
      <div style={{ fontFamily: "var(--body)", fontSize: 14, color: C.grey400, lineHeight: 1.6, maxWidth: 280, margin: "0 auto 24px" }}>
        Cree un crew, votez pour un spot et partagez sur WhatsApp.
      </div>
      <div style={{ padding: "16px 20px", borderRadius: 16, background: C.grey50, border: `1px solid ${C.grey100}`, maxWidth: 300, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--body)", fontSize: 13, color: C.grey500, fontStyle: "italic" }}>Bientot disponible &mdash; MVP en cours</div>
      </div>
    </div>
  );
}

// ── MODE EXPLORE ─────────────────────────────
function ModeExplore({ spots, onTap, palais, isSpotMarked, toggleMarkSpot }) {
  const hero = spots[0];
  const picks = spots.slice(1, 5);
  const newSpots = spots.filter(s => s.spot.nbSpawts < 30).slice(0, 3);

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Hero Spot */}
      {hero && (
        <div onClick={() => onTap(hero.spot.id)} style={{
          borderRadius: 20, overflow: "hidden", marginBottom: 24,
          background: C.black, cursor: "pointer", position: "relative",
        }}>
          {hero.spot.image && (
            <img src={hero.spot.image} alt={hero.spot.name} style={{
              width: "100%", height: 220, objectFit: "cover", display: "block",
              opacity: 0.5,
            }} />
          )}
          <div style={{
            position: hero.spot.image ? "absolute" : "relative",
            top: 0, left: 0, right: 0, bottom: 0,
            padding: "28px 24px", color: C.white,
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
          }}>
            <div style={{ fontSize: 11, fontFamily: "var(--body)", fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
              {"\u2B50"} Spot de la semaine
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: 28, marginBottom: 4, lineHeight: 1.15 }}>{hero.spot.name}</div>
            <div style={{ fontFamily: "var(--body)", fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
              {hero.spot.type} &middot; {hero.spot.quartier}
            </div>
            <span style={{
              display: "inline-block", alignSelf: "flex-start",
              background: C.gold, color: C.black, borderRadius: 20,
              padding: "4px 14px", fontFamily: "var(--body)", fontSize: 12, fontWeight: 700,
            }}>
              {hero.match}% match
            </span>
          </div>
        </div>
      )}

      {/* Pour toi */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 20, color: C.warmBlack, marginBottom: 14 }}>Pour toi</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {picks.map(s => (
            <SpotCard key={s.spot.id}
              spot={{ ...s.spot, communityRating: s.spot.noteCommunautaire }}
              matchScore={s.match}
              isMarked={isSpotMarked(s.spot.id)}
              onToggleMark={toggleMarkSpot}
              onClick={() => onTap(s.spot.id)}
            />
          ))}
        </div>
      </div>

      {/* Nouveautes */}
      {newSpots.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 20, color: C.warmBlack, marginBottom: 14 }}>Nouveautes</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }} className="ns">
            {newSpots.map(s => (
              <div key={s.spot.id} style={{ minWidth: 200, flexShrink: 0 }}>
                <SpotCard
                  spot={{ ...s.spot, communityRating: s.spot.noteCommunautaire }}
                  matchScore={s.match}
                  isMarked={isSpotMarked(s.spot.id)}
                  onToggleMark={toggleMarkSpot}
                  onClick={() => onTap(s.spot.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Palais */}
      <div style={{ borderRadius: 16, background: C.black, padding: "20px 16px", marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 18, color: C.white, marginBottom: 12, textAlign: "center" }}>
          Ton Palais
        </div>
        {Object.entries({
          racinesHorizons: ["Racines", "Horizons"],
          taniereNomade: ["Taniere", "Nomade"],
          exigeantEnthousiaste: ["Exigeant", "Enthousiaste"],
          fouleSecret: ["Foule", "Secret"],
          gargoteTable: ["Gargote", "Table"],
        }).map(([key, [left, right]]) => (
          <AxisBar key={key} left={left} right={right} value={palais[key] || 0} dark />
        ))}
      </div>
    </div>
  );
}

// ── MAIN HOME ────────────────────────────────
export default function Home({ onSpawtDirect }) {
  const { user, isSpotMarked, toggleMarkSpot } = useUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState(getAutoMode);

  const rankedSpots = useMemo(() => {
    return restaurants
      .map(r => ({ spot: r, match: calcMatchScore(user.palais, r.adn) }))
      .sort((a, b) => b.match - a.match);
  }, [user.palais]);

  const goSpot = (id) => navigate(`/spot/${id}`);

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: 24, color: C.warmBlack }}>Spawt</div>
            <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.gold }}>
              {user.displayedTitle} &middot; {user.spotsCount} spawts
              {(user.markedSpots || []).length > 0 && (
                <span style={{ color: C.grey400 }}> &middot; {"\uD83D\uDCCC"}{(user.markedSpots || []).length} cibles</span>
              )}
            </div>
          </div>
          <CatSilhouette size={32} color={C.gold} />
        </div>
      </div>

      {/* Chat */}
      <div style={{ padding: "12px 20px 0" }}>
        <ChatBubble text={getChatLine(user.spotsCount)} />
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, padding: "16px 20px", overflowX: "auto" }} className="ns">
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button key={m.id} onClick={() => setMode(m.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 24,
              border: active ? "none" : `1px solid ${C.grey200}`,
              background: active ? C.black : C.white,
              color: active ? C.gold : C.grey600,
              fontFamily: "var(--body)", fontSize: 13, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {mode === "rapide" && <ModeRapide spots={rankedSpots} onTap={goSpot} onSpawtDirect={onSpawtDirect} isSpotMarked={isSpotMarked} toggleMarkSpot={toggleMarkSpot} />}
      {mode === "crew" && <ModeCrew />}
      {mode === "explore" && <ModeExplore spots={rankedSpots} onTap={goSpot} palais={user.palais} isSpotMarked={isSpotMarked} toggleMarkSpot={toggleMarkSpot} />}
    </div>
  );
}
