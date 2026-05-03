import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useUser from "../hooks/useUser";
import { findArchetype, getTitle, getPalaisLabel } from "../data/archetypes";
import { COLORS as C } from "../theme";

// ─── Questions config ────────────────────────────────────
const QUESTIONS = [
  {
    key: "racinesHorizons",
    question: "Cuisine de chez toi ou d\u2019ailleurs\u00a0?",
    left: "Racines",
    right: "Horizons",
    bubbles: [
      { range: [-50, -30], text: "Le vrai go\u00fbt, c\u2019est celui de la maison." },
      { range: [-29, -10], text: "Tu sais ce que tu aimes. Bien." },
      { range: [-9, 9], text: "Un pied ici, un pied l\u00e0-bas. Int\u00e9ressant." },
      { range: [10, 29], text: "Curieux du monde. Le chat approuve." },
      { range: [30, 50], text: "Chaque assiette est un billet d\u2019avion pour toi." },
    ],
  },
  {
    key: "taniereNomade",
    question: "Ton spot fid\u00e8le ou toujours un nouveau\u00a0?",
    left: "Tani\u00e8re",
    right: "Nomade",
    bubbles: [
      { range: [-50, -30], text: "La fid\u00e9lit\u00e9. Rare et pr\u00e9cieuse." },
      { range: [-29, -10], text: "Tu as tes habitudes. Rien de mal \u00e0 \u00e7a." },
      { range: [-9, 9], text: "Un peu des deux. Classique." },
      { range: [10, 29], text: "L\u2019inconnu te tente souvent." },
      { range: [30, 50], text: "Toujours ailleurs. Le chat te suivra." },
    ],
  },
  {
    key: "exigeantEnthousiaste",
    question: "Exigeant ou bon vivant\u00a0?",
    left: "Exigeant",
    right: "Enthousiaste",
    bubbles: [
      { range: [-50, -30], text: "Le d\u00e9tail. Toujours le d\u00e9tail." },
      { range: [-29, -10], text: "Tu as des standards. Normal." },
      { range: [-9, 9], text: "\u00c9quilibr\u00e9. Pas facile \u00e0 cerner." },
      { range: [10, 29], text: "Tu profites, c\u2019est l\u2019essentiel." },
      { range: [30, 50], text: "Tout est bon quand l\u2019ambiance est l\u00e0." },
    ],
  },
  {
    key: "fouleSecret",
    question: "Spots populaires ou adresses cach\u00e9es\u00a0?",
    left: "Foule",
    right: "Secret",
    bubbles: [
      { range: [-50, -30], text: "L\u00e0 o\u00f9 le monde va, la f\u00eate est bonne." },
      { range: [-29, -10], text: "Tu aimes l\u2019\u00e9nergie collective." },
      { range: [-9, 9], text: "Parfois la foule, parfois le calme." },
      { range: [10, 29], text: "Les bons plans, tu les gardes pour toi." },
      { range: [30, 50], text: "Si c\u2019est sur Google, c\u2019est d\u00e9j\u00e0 fini." },
    ],
  },
  {
    key: "gargoteTable",
    question: "Gargote ou belle table\u00a0?",
    left: "Gargote",
    right: "Table",
    bubbles: [
      { range: [-50, -30], text: "Le plastique et le go\u00fbt brut. Respect." },
      { range: [-29, -10], text: "La simplicit\u00e9 a du charme." },
      { range: [-9, 9], text: "Tu t\u2019adaptes au terrain." },
      { range: [10, 29], text: "Un peu de classe ne fait pas de mal." },
      { range: [30, 50], text: "Nappe blanche. Couteau affil\u00e9. Toujours." },
    ],
  },
];

// ─── Inject keyframes once ───────────────────────────────
const injectStyles = (() => {
  if (typeof document === "undefined") return false;
  const id = "onboarding-keyframes";
  if (document.getElementById(id)) return true;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes onbFadeUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes onbFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes onbPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(200,164,78,0.4); }
      50%      { box-shadow: 0 0 0 12px rgba(200,164,78,0); }
    }
    @keyframes onbGlowPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(200,164,78,0.15); }
      50%      { box-shadow: 0 0 40px rgba(200,164,78,0.3); }
    }
    @keyframes onbSlideUp {
      from { opacity: 0; transform: translateY(40px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  return true;
})();

// ─── Custom Slider Component ─────────────────────────────
function PalaisSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(false);

  const getValueFromX = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const pct = x / rect.width;
    return Math.round(pct * 100 - 50);
  }, []);

  const handleStart = useCallback((clientX) => {
    dragging.current = true;
    onChange(getValueFromX(clientX));
  }, [getValueFromX, onChange]);

  const handleMove = useCallback((clientX) => {
    if (!dragging.current) return;
    onChange(getValueFromX(clientX));
  }, [getValueFromX, onChange]);

  const handleEnd = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onTouchMove = (e) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleMove, handleEnd]);

  const pct = ((value + 50) / 100) * 100;

  return (
    <div
      ref={trackRef}
      onMouseDown={(e) => handleStart(e.clientX)}
      onTouchStart={(e) => {
        if (e.touches.length > 0) handleStart(e.touches[0].clientX);
      }}
      style={{
        position: "relative",
        height: 44,
        cursor: "pointer",
        touchAction: "none",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Track background */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: C.grey200,
        }}
      />

      {/* Active fill from center */}
      <div
        style={{
          position: "absolute",
          left: value >= 0 ? "50%" : `${pct}%`,
          width: `${Math.abs(value)}%`,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${C.gold}, rgba(232,201,114,0.6))`,
          transition: dragging.current ? "none" : "left 0.1s, width 0.1s",
        }}
      />

      {/* Center tick */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: 2,
          height: 12,
          borderRadius: 1,
          background: C.grey300,
          opacity: 0.5,
        }}
      />

      {/* Draggable dot */}
      <div
        style={{
          position: "absolute",
          left: `${pct}%`,
          transform: "translate(-50%, 0)",
          width: 24,
          height: 24,
          borderRadius: 12,
          background: C.gold,
          boxShadow: `0 2px 10px rgba(200,164,78,0.4), 0 0 0 4px rgba(200,164,78,0.12)`,
          transition: dragging.current ? "none" : "left 0.1s ease",
          zIndex: 2,
        }}
      >
        {/* Inner shine */}
        <div
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            background: "rgba(255,255,255,0.35)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Cat Avatar (green eye icon) ─────────────────────────
function CatAvatar({ size = 36, dark = false }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: dark ? C.white : C.black,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: dark
          ? `0 0 0 3px rgba(250,250,248,0.1)`
          : `0 0 0 3px rgba(200,164,78,0.15)`,
      }}
    >
      <div
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: "50%",
          background: dark ? C.gold : C.white,
          position: "relative",
        }}
      >
        <div
          style={{
            width: size * 0.12,
            height: size * 0.12,
            borderRadius: "50%",
            background: dark ? C.white : C.gold,
            position: "absolute",
            top: "30%",
            left: "30%",
          }}
        />
      </div>
    </div>
  );
}

// ─── Chat Bubble for Onboarding ──────────────────────────
function OnboardingBubble({ text, dark = false, delay = 0 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        opacity: 0,
        animation: `onbFadeUp 0.5s ease ${delay}ms forwards`,
      }}
    >
      <CatAvatar size={32} dark={dark} />
      <div
        style={{
          background: dark ? C.warmBlack : C.grey50,
          border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : C.grey100}`,
          borderRadius: "2px 14px 14px 14px",
          padding: "10px 14px",
          maxWidth: "80%",
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 13,
          lineHeight: 1.55,
          fontStyle: "italic",
          color: dark ? C.grey300 : C.grey600,
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ─── Splash Screen ───────────────────────────────────────
function SplashScreen({ onStart }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.black,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 40px",
        position: "relative",
      }}
    >
      {/* Logo + Avatar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: 0,
          animation: "onbFadeUp 0.8s ease 200ms forwards",
        }}
      >
        <div
          style={{
            animation: "onbGlowPulse 3s ease infinite",
            borderRadius: "50%",
          }}
        >
          <CatAvatar size={64} dark />
        </div>

        <h1
          style={{
            fontFamily: 'var(--display, "DM Serif Text", serif)',
            fontStyle: "italic",
            fontSize: 48,
            fontWeight: 400,
            color: C.white,
            margin: 0,
            letterSpacing: 2,
          }}
        >
          SPAWT
        </h1>

        <p
          style={{
            fontFamily: 'var(--body, "Manrope", sans-serif)',
            fontSize: 14,
            color: C.grey400,
            letterSpacing: 1.5,
            fontWeight: 500,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          La carte du bon go{"\u00fb"}t
        </p>
      </div>

      {/* Tap to start */}
      <button
        onClick={onStart}
        style={{
          position: "absolute",
          bottom: 80,
          left: "50%",
          transform: "translateX(-50%)",
          background: "none",
          border: `1px solid ${C.grey600}`,
          borderRadius: 30,
          padding: "14px 40px",
          color: C.grey300,
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          letterSpacing: 0.5,
          opacity: 0,
          animation: "onbFadeUp 0.6s ease 800ms forwards",
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.gold;
          e.currentTarget.style.color = C.gold;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.grey600;
          e.currentTarget.style.color = C.grey300;
        }}
      >
        Commencer
      </button>
    </div>
  );
}

// ─── Question Slide ──────────────────────────────────────
function QuestionSlide({ question, value, onChange, onNext, stepIndex, total }) {
  const bubbleText = question.bubbles.find(
    (b) => value >= b.range[0] && value <= b.range[1]
  )?.text || "";

  return (
    <div
      key={question.key}
      style={{
        minHeight: "100vh",
        background: C.white,
        display: "flex",
        flexDirection: "column",
        padding: "0 24px",
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          paddingTop: 20,
          opacity: 0,
          animation: "onbFadeIn 0.4s ease 100ms forwards",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= stepIndex ? C.gold : C.grey200,
                transition: "background 0.4s ease",
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontFamily: 'var(--body, "Manrope", sans-serif)',
            fontSize: 11,
            color: C.grey400,
            marginTop: 10,
            fontWeight: 500,
          }}
        >
          {stepIndex + 1} / {total}
        </p>
      </div>

      {/* Question */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
          paddingBottom: 40,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--display, "DM Serif Text", serif)',
            fontStyle: "italic",
            fontSize: 28,
            fontWeight: 400,
            color: C.black,
            lineHeight: 1.3,
            margin: 0,
            opacity: 0,
            animation: "onbFadeUp 0.6s ease 150ms forwards",
          }}
        >
          {question.question}
        </h2>

        {/* Slider section */}
        <div
          style={{
            opacity: 0,
            animation: "onbFadeUp 0.5s ease 300ms forwards",
          }}
        >
          {/* Labels */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--body, "Manrope", sans-serif)',
                fontSize: 12,
                fontWeight: 600,
                color: value < -10 ? C.gold : C.grey400,
                transition: "color 0.3s ease",
                letterSpacing: 0.3,
              }}
            >
              {question.left}
            </span>
            <span
              style={{
                fontFamily: 'var(--body, "Manrope", sans-serif)',
                fontSize: 12,
                fontWeight: 600,
                color: value > 10 ? C.gold : C.grey400,
                transition: "color 0.3s ease",
                letterSpacing: 0.3,
              }}
            >
              {question.right}
            </span>
          </div>

          <PalaisSlider value={value} onChange={onChange} />

          {/* Value indicator */}
          <div
            style={{
              textAlign: "center",
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--body, "Manrope", sans-serif)',
                fontSize: 10,
                color: C.grey300,
                fontWeight: 500,
              }}
            >
              {value === 0
                ? "Neutre"
                : value < 0
                ? `${question.left} ${Math.abs(value)}%`
                : `${question.right} ${value}%`}
            </span>
          </div>
        </div>

        {/* Chat bubble */}
        <div
          style={{
            minHeight: 60,
            opacity: 0,
            animation: "onbFadeUp 0.5s ease 450ms forwards",
          }}
        >
          <OnboardingBubble text={bubbleText} delay={0} />
        </div>

        {/* Next button */}
        <div
          style={{
            opacity: 0,
            animation: "onbFadeUp 0.4s ease 550ms forwards",
          }}
        >
          <button
            onClick={onNext}
            style={{
              width: "100%",
              padding: "16px 0",
              background: C.black,
              color: C.white,
              border: "none",
              borderRadius: 14,
              fontFamily: 'var(--body, "Manrope", sans-serif)',
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: 0.3,
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.warmBlack;
              e.currentTarget.style.transform = "scale(1.01)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = C.black;
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Result Screen ───────────────────────────────────────
function ResultScreen({ palaisValues, onFinish }) {
  const archetype = findArchetype(palaisValues, 0);
  const title = getTitle(archetype, 0);
  const palaisLabel = getPalaisLabel(palaisValues);
  const catText = `Ton premier Palais dit ${archetype.name}. On verra si \u00e7a tient. Pour l\u2019instant, explore.`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.black,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 28px",
        position: "relative",
      }}
    >
      {/* Overline */}
      <p
        style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: C.grey500,
          textTransform: "uppercase",
          margin: 0,
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 200ms forwards",
        }}
      >
        Ton premier Palais
      </p>

      {/* Palais label */}
      <p
        style={{
          fontFamily: 'var(--display, "DM Serif Text", serif)',
          fontStyle: "italic",
          fontSize: 22,
          color: C.gold,
          margin: "12px 0 0",
          opacity: 0,
          animation: "onbFadeUp 0.6s ease 350ms forwards",
        }}
      >
        {palaisLabel}
      </p>

      {/* Archetype name */}
      <h2
        style={{
          fontFamily: 'var(--display, "DM Serif Text", serif)',
          fontStyle: "italic",
          fontSize: 36,
          fontWeight: 400,
          color: C.white,
          margin: "20px 0 0",
          textAlign: "center",
          lineHeight: 1.2,
          opacity: 0,
          animation: "onbFadeUp 0.6s ease 500ms forwards",
        }}
      >
        {archetype.name}
      </h2>

      {/* Stage */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          padding: "5px 14px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 20,
          border: `1px solid rgba(255,255,255,0.08)`,
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 650ms forwards",
        }}
      >
        <span style={{ fontSize: 12 }}>{"\uD83D\uDC31"}</span>
        <span
          style={{
            fontFamily: 'var(--body, "Manrope", sans-serif)',
            fontSize: 12,
            color: C.grey400,
            fontWeight: 500,
          }}
        >
          Stade : Chaton
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 14,
          color: C.grey300,
          margin: "6px 0 0",
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 750ms forwards",
        }}
      >
        {title}
      </p>

      {/* Cat bubble */}
      <div
        style={{
          marginTop: 36,
          width: "100%",
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 900ms forwards",
        }}
      >
        <OnboardingBubble text={catText} dark delay={0} />
      </div>

      {/* Axis preview */}
      <div
        style={{
          width: "100%",
          marginTop: 32,
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 1050ms forwards",
        }}
      >
        {QUESTIONS.map((q) => {
          const val = palaisValues[q.key];
          const pct = ((val + 50) / 100) * 100;
          return (
            <div
              key={q.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: C.grey500,
                  width: 72,
                  textAlign: "right",
                  fontFamily: 'var(--body, "Manrope", sans-serif)',
                  fontWeight: 500,
                }}
              >
                {q.left}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 3,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 2,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: val >= 0 ? "50%" : `${pct}%`,
                    width: `${Math.abs(val)}%`,
                    height: 3,
                    borderRadius: 2,
                    background: `linear-gradient(90deg, ${C.gold}, rgba(232,201,114,0.6))`,
                    transition: "all 1s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${pct}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: C.gold,
                    boxShadow: "0 0 6px rgba(200,164,78,0.4)",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: C.grey500,
                  width: 72,
                  fontFamily: 'var(--body, "Manrope", sans-serif)',
                  fontWeight: 500,
                }}
              >
                {q.right}
              </span>
            </div>
          );
        })}
      </div>

      {/* Commencer button */}
      <button
        onClick={onFinish}
        style={{
          position: "absolute",
          bottom: 48,
          left: 28,
          right: 28,
          padding: "16px 0",
          background: C.gold,
          color: C.black,
          border: "none",
          borderRadius: 14,
          fontFamily: 'var(--body, "Manrope", sans-serif)',
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: 0.3,
          opacity: 0,
          animation: "onbFadeUp 0.5s ease 1200ms forwards",
          transition: "transform 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.02)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        Commencer
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN ONBOARDING COMPONENT
// ═══════════════════════════════════════════
export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useUser();

  // step 0 = splash, 1-5 = questions, 6 = result
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [values, setValues] = useState({
    racinesHorizons: 0,
    taniereNomade: 0,
    exigeantEnthousiaste: 0,
    fouleSecret: 0,
    gargoteTable: 0,
  });

  const goTo = useCallback(
    (nextStep) => {
      setTransitioning(true);
      setTimeout(() => {
        setStep(nextStep);
        setTransitioning(false);
      }, 300);
    },
    []
  );

  const handleSliderChange = useCallback(
    (key, val) => {
      setValues((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const handleFinish = useCallback(() => {
    completeOnboarding(values);
    navigate("/");
  }, [completeOnboarding, values, navigate]);

  // Determine current question index (0-based) when step is 1-5
  const questionIndex = step - 1;

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          transition: "opacity 0.3s ease, transform 0.3s ease",
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? "translateY(16px)" : "translateY(0)",
        }}
      >
        {step === 0 && <SplashScreen onStart={() => goTo(1)} />}

        {step >= 1 && step <= 5 && (
          <QuestionSlide
            key={QUESTIONS[questionIndex].key}
            question={QUESTIONS[questionIndex]}
            value={values[QUESTIONS[questionIndex].key]}
            onChange={(val) =>
              handleSliderChange(QUESTIONS[questionIndex].key, val)
            }
            onNext={() => goTo(step + 1)}
            stepIndex={questionIndex}
            total={5}
          />
        )}

        {step === 6 && (
          <ResultScreen palaisValues={values} onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
