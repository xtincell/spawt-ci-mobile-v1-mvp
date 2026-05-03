import { useNavigate, useLocation } from "react-router-dom";
import { COLORS as C } from "../theme";

const NAV_ITEMS = [
  { path: "/", label: "Accueil", icon: "⌂" },
  { path: "/discover", label: "Chercher", icon: "⌕" },
  { path: null, label: "Spawt", icon: "🐾", central: true },
  { path: null, label: "Crews", icon: "👥", disabled: true },
  { path: "/profile", label: "Moi", icon: "◉" },
];

export default function BottomNav({ onSpawtTap }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%",
      transform: "translateX(-50%)", width: "100%", maxWidth: 430,
      background: C.white, borderTop: `1px solid ${C.grey200}`,
      display: "flex", alignItems: "flex-end", justifyContent: "space-around",
      padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 100,
    }}>
      {NAV_ITEMS.map((item, i) => {
        const active = item.path && location.pathname === item.path;

        if (item.central) {
          return (
            <button key={i} onClick={() => onSpawtTap && onSpawtTap()}
              style={{
                width: 52, height: 52, borderRadius: "50%",
                background: C.gold, border: "none", color: C.black,
                fontSize: 22, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 4px 12px ${C.goldGlow}`,
                transform: "translateY(-10px)",
              }}
            >
              {item.icon}
            </button>
          );
        }

        return (
          <button key={i}
            onClick={() => item.path && !item.disabled && navigate(item.path)}
            style={{
              background: "none", border: "none",
              cursor: item.disabled ? "default" : "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 2, padding: "6px 12px",
              opacity: item.disabled ? 0.35 : 1,
            }}
          >
            <span style={{
              fontSize: 20,
              color: active ? C.gold : C.grey400,
            }}>
              {item.icon}
            </span>
            <span style={{
              fontFamily: 'var(--body, "Manrope", sans-serif)',
              fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? C.gold : C.grey400,
            }}>
              {item.label}
            </span>
            {active && (
              <div style={{
                width: 4, height: 4, borderRadius: "50%",
                background: C.gold, marginTop: 1,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
