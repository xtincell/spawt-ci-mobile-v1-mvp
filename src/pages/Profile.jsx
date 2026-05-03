import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import { ARCHETYPES, STAGES } from "../data/archetypes";
import PalaisRadar from "../components/PalaisRadar";
import BadgeGrid from "../components/BadgeGrid";
import CatSilhouette from "../components/CatSilhouette";
import ChatBubble from "../components/ChatBubble";
import SpotCard from "../components/SpotCard";
import restaurants, { calcMatchScore } from "../data/restaurants";
import { COLORS as C } from "../theme";

function getChatVoice(spotsCount, stade) {
  if (spotsCount === 0) return "Ton Palais est vierge. Tout commence ici.";
  if (stade === "chaton") return "Chaton. Curieux mais encore fragile. Continue d'explorer.";
  if (stade === "chat") return "Chat confirme. Ton Palais se stabilise. Je te reconnais.";
  if (stade === "matou") return "Matou. Tu commences a avoir de l'autorite.";
  if (stade === "djidji") return "Djidji. Tu es une reference.";
  return "Guide. Tu incarnes le gout. Ta trace restera.";
}

function ProgressBar({ current, min, max, label }) {
  const pct = max === Infinity ? 100 : Math.min(100, ((current - min) / (max - min)) * 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--body)", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{label}</span>
        <span style={{ fontFamily: "var(--body)", fontSize: 11, color: C.gold }}>{current} spawts</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
        <div style={{
          height: "100%", borderRadius: 2,
          background: `linear-gradient(90deg, ${C.gold}, #E0C27E)`,
          width: `${pct}%`, transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

const TABS = [
  { id: "historique", label: "Historique", icon: "🕐" },
  { id: "atester", label: "A tester", icon: "📌" },
];

export default function Profile() {
  const { user, changeDisplayedTitle, resetUser, palaisLabel, stage, stageIndex, toggleMarkSpot, isSpotMarked } = useUser();
  const [showTitles, setShowTitles] = useState(false);
  const [activeTab, setActiveTab] = useState("historique");
  const navigate = useNavigate();

  const archetype = ARCHETYPES.find(a => a.id === user.archetype) || ARCHETYPES[0];

  const history = [...user.spawts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(s => ({ ...s, spot: restaurants.find(r => r.id === s.spotId) }));

  const markedSpots = (user.markedSpots || [])
    .map(id => restaurants.find(r => r.id === id))
    .filter(Boolean)
    .map(r => ({ spot: r, match: calcMatchScore(user.palais, r.adn) }));

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Identity Card */}
      <div style={{
        background: C.black,
        borderRadius: "0 0 28px 28px",
        padding: "28px 20px 24px", color: C.white,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: C.gold, display: "flex",
            alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 3px ${C.goldGlow}`,
          }}>
            <CatSilhouette size={32} color={C.black} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--display)", fontSize: 22 }}>{user.name}</div>
            <div style={{ fontFamily: "var(--body)", fontSize: 12, opacity: 0.5 }}>
              {user.username} &middot; Membre {user.memberSince}
            </div>
          </div>
        </div>

        {/* Title + Stage */}
        <div onClick={() => setShowTitles(!showTitles)} style={{
          borderRadius: 14, background: "rgba(255,255,255,0.05)",
          padding: "12px 16px", marginBottom: 12, cursor: "pointer",
          border: `1px solid rgba(200,164,78,0.15)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--body)", fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                {stage.icon} {stage.label}
              </div>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, color: C.gold }}>{user.displayedTitle}</div>
            </div>
            <span style={{ fontSize: 16, opacity: 0.3, color: C.gold }}>{showTitles ? "\u25B2" : "\u25BC"}</span>
          </div>
          <div style={{ fontFamily: "var(--body)", fontSize: 12, fontStyle: "italic", opacity: 0.4, marginTop: 4 }}>
            {archetype.spirit}
          </div>
        </div>

        <ProgressBar current={user.spotsCount} min={stage.min} max={stage.max}
          label={stageIndex < STAGES.length - 1 ? `Prochain : ${STAGES[stageIndex + 1].label}` : "Stade max"} />

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {[
            { label: "Spawts", value: user.spotsCount },
            { label: "Badges", value: user.badges.length },
            { label: "Cibles", value: (user.markedSpots || []).length },
            { label: "\u2665", value: `${user.coupsDeCoeur.used}/${user.coupsDeCoeur.available}` },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 20, color: C.gold }}>{s.value}</div>
              <div style={{ fontFamily: "var(--body)", fontSize: 10, opacity: 0.4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Title collection */}
      {showTitles && user.titleCollection.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 16, color: C.warmBlack, marginBottom: 10 }}>Collection de titres</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {user.titleCollection.map((t, i) => {
              const isActive = t.name === user.displayedTitle;
              return (
                <button key={i} onClick={() => changeDisplayedTitle(t.name)} style={{
                  padding: "6px 14px", borderRadius: 20,
                  background: isActive ? C.black : C.grey50,
                  color: isActive ? C.gold : C.grey600,
                  border: isActive ? "none" : `1px solid ${C.grey100}`,
                  fontFamily: "var(--body)", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>
                  {t.name}
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.5 }}>{t.earnedAt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat */}
      <div style={{ padding: "16px 20px 0" }}>
        <ChatBubble text={getChatVoice(user.spotsCount, user.stade)} />
      </div>

      {/* Palais Radar */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ borderRadius: 16, background: C.black, padding: "16px 14px", marginBottom: 24 }}>
          <PalaisRadar palais={user.palais} dark />
          <div style={{ textAlign: "center", fontFamily: "var(--body)", fontSize: 12, color: C.gold, marginTop: 4 }}>
            {palaisLabel}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ padding: "0 20px", marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontSize: 20, color: C.warmBlack, marginBottom: 12 }}>Badges</div>
        <BadgeGrid badges={user.badges} />
      </div>

      {/* Tabs: Historique / A tester */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id;
            const count = tab.id === "atester" ? markedSpots.length : history.length;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: "10px 12px", borderRadius: 12,
                background: active ? C.black : C.grey50,
                color: active ? C.gold : C.grey500,
                border: active ? "none" : `1px solid ${C.grey100}`,
                fontFamily: "var(--body)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6,
              }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span style={{
                    background: active ? C.gold : C.grey200,
                    color: active ? C.black : C.grey500,
                    fontSize: 10, fontWeight: 700,
                    padding: "1px 6px", borderRadius: 10,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab: Historique */}
        {activeTab === "historique" && (
          <div style={{ marginBottom: 24 }}>
            {history.length === 0 ? (
              <div style={{ fontFamily: "var(--body)", fontSize: 13, color: C.grey300, fontStyle: "italic", padding: "16px 0" }}>
                Aucun spawt encore. Ton aventure commence bientot.
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} onClick={() => h.spot && navigate(`/spot/${h.spot.id}`)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                  borderBottom: i < history.length - 1 ? `1px solid ${C.grey100}` : "none",
                  cursor: h.spot ? "pointer" : "default",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, overflow: "hidden",
                    background: C.black, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {h.spot?.image ? (
                      <img src={h.spot.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (h.spot?.emoji || "🐾")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--body)", fontSize: 13, fontWeight: 600, color: C.warmBlack }}>{h.spot?.name || "Spot inconnu"}</div>
                    <div style={{ fontFamily: "var(--body)", fontSize: 11, color: C.grey400 }}>
                      {h.spot?.quartier} &middot; {new Date(h.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      {h.plats && h.plats.length > 0 && (
                        <span style={{ color: C.gold }}> &middot; {h.plats.length} plat{h.plats.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  {h.rating && <span style={{ fontFamily: "var(--body)", fontSize: 12, color: C.gold }}>{"★".repeat(h.rating)}</span>}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: A tester */}
        {activeTab === "atester" && (
          <div style={{ marginBottom: 24 }}>
            {markedSpots.length === 0 ? (
              <div style={{
                padding: "32px 16px", textAlign: "center",
                borderRadius: 16, background: C.grey50, border: `1px solid ${C.grey100}`,
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📌</div>
                <div style={{ fontFamily: "var(--body)", fontSize: 14, color: C.grey500, marginBottom: 6 }}>
                  Aucun spot cible
                </div>
                <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey300, lineHeight: 1.5 }}>
                  Marque des spots avec 📌 pour les retrouver ici. Tu pourras les spawter d'un tap apres ton repas.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "var(--body)", fontSize: 12, color: C.grey400, marginBottom: 12 }}>
                  Tes spots cibles. T'y es alle ? Spawte d'un tap.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {markedSpots.map(({ spot, match }) => (
                    <SpotCard
                      key={spot.id}
                      spot={{ ...spot, communityRating: spot.noteCommunautaire }}
                      matchScore={match}
                      isMarked={true}
                      onToggleMark={toggleMarkSpot}
                      onClick={() => navigate(`/spot/${spot.id}`)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Dev reset */}
      <div style={{ padding: "0 20px 32px", textAlign: "center" }}>
        <button onClick={resetUser} style={{
          padding: "8px 20px", borderRadius: 10,
          background: "none", border: `1px solid ${C.grey200}`,
          fontFamily: "var(--body)", fontSize: 11, color: C.grey400, cursor: "pointer",
        }}>&#128260; Reset (dev)</button>
      </div>
    </div>
  );
}
