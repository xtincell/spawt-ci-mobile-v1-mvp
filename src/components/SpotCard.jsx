import { useState, useRef, useEffect, useCallback } from 'react';
import { COLORS as C } from '../theme';

const AXES_META = [
  { key: 'racinesHorizons', left: 'Racines', right: 'Horizons' },
  { key: 'taniereNomade', left: 'Tanière', right: 'Nomade' },
  { key: 'exigeantEnthousiaste', left: 'Exigeant', right: 'Enthousiaste' },
  { key: 'fouleSecret', left: 'Foule', right: 'Secret' },
  { key: 'gargoteTable', left: 'Gargote', right: 'Table' },
];

// ── Inject 3D flip CSS once ──
let flipCssInjected = false;
function injectFlipCSS() {
  if (flipCssInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .spotcard-flip-container { perspective: 800px; }
    .spotcard-flip-inner {
      transition: transform 0.5s ease;
      transform-style: preserve-3d;
      position: relative;
    }
    .spotcard-flip-inner.flipped { transform: rotateY(180deg); }
    .spotcard-flip-front,
    .spotcard-flip-back {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .spotcard-flip-back {
      transform: rotateY(180deg);
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
    }
  `;
  document.head.appendChild(style);
  flipCssInjected = true;
}

// ── Sub-components ──

function BudgetDots({ budget = 1, max = 4 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{
          width: 6, height: 6, borderRadius: '50%',
          background: i < budget ? C.gold : C.grey200,
        }} />
      ))}
    </span>
  );
}

function StarRating({ rating = 0, max = 5 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, fontSize: 12, color: C.gold }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ opacity: i < Math.round(rating) ? 1 : 0.3 }}>&#9733;</span>
      ))}
    </span>
  );
}

// Compact ADN axis for back face
function MiniAxis({ left, right, value = 0 }) {
  const norm = Math.max(0, Math.min(1, (value + 50) / 100));
  const isL = norm < 0.5;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 7 }}>
      <span style={{
        fontFamily: 'var(--body)', fontSize: 8, fontWeight: 600,
        color: C.grey300, minWidth: 50, textAlign: 'right', lineHeight: 1.1,
      }}>{left}</span>
      <div style={{
        flex: 1, height: 3, borderRadius: 2, background: C.grey600,
        position: 'relative', overflow: 'visible',
      }}>
        <div style={{
          position: 'absolute', left: '50%', top: -1, width: 1, height: 5,
          background: C.grey400, transform: 'translateX(-0.5px)',
        }} />
        <div style={{
          position: 'absolute', top: 0,
          left: isL ? `${norm * 100}%` : '50%',
          width: isL ? `${(0.5 - norm) * 100}%` : `${(norm - 0.5) * 100}%`,
          height: '100%', borderRadius: 2,
          background: `linear-gradient(${isL ? '270deg' : '90deg'}, ${C.gold}, rgba(200,164,78,0.15))`,
        }} />
        <div style={{
          position: 'absolute', top: '50%', left: `${norm * 100}%`,
          width: 7, height: 7, borderRadius: '50%', background: C.gold,
          border: `1.5px solid ${C.warmBlack}`, transform: 'translate(-50%, -50%)', zIndex: 2,
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--body)', fontSize: 8, fontWeight: 600,
        color: C.grey300, minWidth: 50, textAlign: 'left', lineHeight: 1.1,
      }}>{right}</span>
    </div>
  );
}

// ═════════════════════════════════════════
// SpotCard — flippable card component
// ═════════════════════════════════════════

export default function SpotCard({ spot = {}, matchScore, onClick, isMarked, onToggleMark }) {
  const {
    name = 'Restaurant',
    type = '',
    quartier = '',
    budget = 2,
    communityRating = 0,
    emoji = '',
    image,
  } = spot;

  const hasAdn = spot.adn && typeof spot.adn === 'object';

  const [flipped, setFlipped] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Long-press gesture refs
  const longPressRef = useRef(null);
  const isLongPressRef = useRef(false);
  const justFlippedRef = useRef(false);
  const didMoveRef = useRef(false);
  const startPosRef = useRef(null);

  useEffect(() => { injectFlipCSS(); }, []);
  useEffect(() => () => clearTimeout(longPressRef.current), []);

  // ── Pointer handlers for long-press (flip) vs tap (navigate) ──

  const handlePointerDown = useCallback((e) => {
    // Always reset refs
    isLongPressRef.current = false;
    didMoveRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    // Only start long-press timer if not flipped and has ADN
    if (flipped || !hasAdn) return;

    longPressRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      justFlippedRef.current = true;
      setFlipped(true);
    }, 400);
  }, [flipped, hasAdn]);

  const handlePointerUp = useCallback(() => {
    clearTimeout(longPressRef.current);

    // Just flipped via long-press → don't flip back on release
    if (justFlippedRef.current) {
      justFlippedRef.current = false;
      return;
    }

    // Back face tap → flip back to front
    if (flipped) {
      setFlipped(false);
      return;
    }

    // Short tap on front face → navigate
    if (!isLongPressRef.current && !didMoveRef.current && onClick) {
      onClick();
    }
  }, [flipped, onClick]);

  const handlePointerMove = useCallback((e) => {
    if (!startPosRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressRef.current);
      didMoveRef.current = true;
    }
  }, []);

  const handlePointerCancel = useCallback(() => {
    clearTimeout(longPressRef.current);
    didMoveRef.current = true;
  }, []);

  const handleContextMenu = useCallback((e) => e.preventDefault(), []);

  // Bookmark handlers — stop propagation to avoid triggering card events
  const handleMarkPointerDown = (e) => e.stopPropagation();
  const handleMark = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleMark) onToggleMark(spot.id);
  };

  // ═════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════

  return (
    <div
      className="spotcard-flip-container"
      style={{
        width: '100%',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'pan-y',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
    >
      <div
        className={`spotcard-flip-inner ${flipped ? 'flipped' : ''}`}
        style={{ width: '100%' }}
      >
        {/* ═══ FRONT FACE ═══ */}
        <div className="spotcard-flip-front" style={{
          background: C.white, borderRadius: 16,
          border: `1px solid ${C.grey100}`, overflow: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          width: '100%',
        }}>
          {/* Image or emoji fallback */}
          <div style={{
            width: '100%', height: 140, position: 'relative',
            background: C.warmBlack, overflow: 'hidden',
          }}>
            {image && !imgError ? (
              <img
                src={image} alt={name}
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `linear-gradient(135deg, ${C.warmBlack}, #2A2520)`,
                fontSize: 48,
              }}>
                {emoji}
              </div>
            )}

            {/* Match score badge */}
            {matchScore != null && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                background: C.gold, color: C.black,
                fontFamily: 'var(--body, "Manrope", sans-serif)',
                fontSize: 11, fontWeight: 700,
                borderRadius: 20, padding: '3px 10px',
              }}>
                {matchScore}%
              </div>
            )}

            {/* Bookmark icon */}
            {onToggleMark && (
              <button
                onClick={handleMark}
                onPointerDown={handleMarkPointerDown}
                style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 32, height: 32, borderRadius: '50%',
                  background: isMarked ? C.gold : 'rgba(0,0,0,0.45)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14,
                  transition: 'all 0.2s ease',
                  transform: isMarked ? 'scale(1.1)' : 'scale(1)',
                }}
                aria-label={isMarked ? "Retirer du marquage" : "Marquer à tester"}
              >
                <span style={{ color: isMarked ? C.black : C.white }}>
                  {isMarked ? '📌' : '📌'}
                </span>
              </button>
            )}

            {/* Flip hint — subtle indicator */}
            {hasAdn && (
              <div style={{
                position: 'absolute', bottom: 6, right: 8,
                fontFamily: 'var(--body)', fontSize: 8, color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.03em',
              }}>maintenir = ADN</div>
            )}
          </div>

          {/* Body */}
          <div style={{ padding: '10px 12px 12px' }}>
            <div style={{
              fontFamily: 'var(--display, "DM Serif Text", serif)',
              fontSize: 16, color: C.warmBlack,
              marginBottom: 2, lineHeight: 1.25,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {name}
            </div>
            {type && <div style={{ fontFamily: 'var(--body)', fontSize: 11, color: C.grey400, marginBottom: 1 }}>{type}</div>}
            {quartier && <div style={{ fontFamily: 'var(--body)', fontSize: 10, color: C.grey300, marginBottom: 6 }}>{quartier}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BudgetDots budget={budget} />
              <StarRating rating={communityRating} />
              {isMarked && (
                <span style={{
                  fontSize: 9, color: C.gold,
                  fontFamily: 'var(--body)', fontWeight: 700,
                  background: C.goldGlow, padding: '1px 6px', borderRadius: 8,
                }}>A tester</span>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BACK FACE — ADN du Lieu ═══ */}
        {hasAdn && (
          <div className="spotcard-flip-back" style={{
            background: C.warmBlack, borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column',
            padding: '12px 10px 8px',
          }}>
            {/* Title */}
            <div style={{
              fontFamily: 'var(--display)', fontSize: 13, color: C.gold,
              textAlign: 'center', marginBottom: 2,
            }}>ADN du Lieu</div>
            <div style={{
              fontFamily: 'var(--body)', fontSize: 9, color: C.grey400,
              textAlign: 'center', marginBottom: 8,
            }}>{name}</div>

            {/* 5 ADN axes — compact */}
            <div style={{ flex: 1 }}>
              {AXES_META.map(({ key, left, right }) => (
                <MiniAxis key={key} left={left} right={right} value={spot.adn[key] || 0} />
              ))}
            </div>

            {/* Bottom info row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)',
              marginTop: 2, gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <BudgetDots budget={budget} max={4} />
              </div>
              {spot.horaires && (
                <span style={{
                  fontFamily: 'var(--body)', fontSize: 8, color: C.grey400,
                  whiteSpace: 'nowrap',
                }}>🕐 {spot.horaires}</span>
              )}
              {type && (
                <span style={{
                  fontFamily: 'var(--body)', fontSize: 8, color: C.grey400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{type}</span>
              )}
            </div>

            {/* Flip-back hint */}
            <div style={{
              textAlign: 'center', marginTop: 4,
              fontFamily: 'var(--body)', fontSize: 7, color: C.grey400, opacity: 0.5,
            }}>toucher pour retourner</div>
          </div>
        )}
      </div>
    </div>
  );
}
