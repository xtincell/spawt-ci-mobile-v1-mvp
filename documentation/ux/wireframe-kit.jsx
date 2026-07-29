// Sketchy wireframe primitives — hand-drawn vibe in B&W with a couple of
// SPAWT accent colors (or, vert chat) reserved for emphasis. All shapes are
// rendered with slight rotations + filter:url(#wobble) to feel sketchy.

(function injectWireframeAssets() {
  if (document.getElementById('wf-styles')) return;
  const s = document.createElement('style');
  s.id = 'wf-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Kalam:wght@300;400;700&family=Patrick+Hand&display=swap');

    .wf {
      --ink: #1a1a1a;
      --ink-soft: #4a4a4a;
      --ink-light: #9a9a9a;
      --ink-faint: #c8c4bc;
      --paper: #fbf9f4;
      --paper-2: #f3efe5;
      --or: #c9a227;
      --vert: #4cae6e;
      --rouge: #c84b3a;
      font-family: 'Kalam', 'Patrick Hand', cursive;
      color: var(--ink);
      box-sizing: border-box;
    }
    .wf *, .wf *::before, .wf *::after { box-sizing: border-box; }
    .wf-hand { font-family: 'Caveat', cursive; }
    .wf-mono { font-family: ui-monospace, 'Courier New', monospace; }

    /* sketchy borders */
    .wf-box {
      border: 1.5px solid var(--ink);
      border-radius: 4px;
      background: var(--paper);
      position: relative;
    }
    .wf-box-soft { border: 1.5px solid var(--ink-soft); border-radius: 6px; }
    .wf-box-faint { border: 1.5px dashed var(--ink-light); border-radius: 4px; }
    .wf-box-rough {
      border: 1.5px solid var(--ink);
      border-radius: 8px 6px 9px 5px / 5px 9px 6px 8px;
    }
    .wf-pill {
      border: 1.5px solid var(--ink);
      border-radius: 999px;
      padding: 4px 10px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--paper);
      font-size: 12px;
      line-height: 1;
    }
    .wf-pill-fill { background: var(--ink); color: var(--paper); }
    .wf-pill-or { background: var(--or); color: #1a1a1a; border-color: var(--ink); }
    .wf-pill-vert { background: var(--vert); color: #fff; border-color: var(--ink); }

    .wf-line { height: 1.5px; background: var(--ink); border-radius: 2px; }
    .wf-line-soft { height: 1.5px; background: var(--ink-soft); }
    .wf-line-dashed { border-top: 1.5px dashed var(--ink-light); height: 0; }

    .wf-text { font-family: 'Kalam', cursive; font-weight: 400; }
    .wf-label { font-family: 'Caveat', cursive; font-size: 13px; color: var(--ink-soft); }
    .wf-title { font-family: 'Caveat', cursive; font-weight: 700; }

    /* placeholder image (diagonal stripes) */
    .wf-img {
      background-image: repeating-linear-gradient(45deg,
        transparent 0, transparent 7px,
        rgba(0,0,0,0.10) 7px, rgba(0,0,0,0.10) 8px);
      background-color: var(--paper-2);
      border: 1.5px solid var(--ink);
      border-radius: 4px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--ink-soft);
      font-family: 'Caveat', cursive;
      font-size: 13px;
      overflow: hidden;
    }
    .wf-img-rough { border-radius: 7px 4px 9px 5px / 5px 8px 4px 9px; }

    /* squiggly underline */
    .wf-squiggle {
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 6'><path d='M0 3 Q 2.5 0, 5 3 T 10 3 T 15 3 T 20 3' fill='none' stroke='%231a1a1a' stroke-width='1.2'/></svg>");
      background-repeat: repeat-x;
      background-position: 0 100%;
      background-size: 12px 6px;
      padding-bottom: 5px;
    }

    /* fake checkbox / radio */
    .wf-check { width: 18px; height: 18px; border: 1.5px solid var(--ink); border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; }
    .wf-check.on::after { content: '✓'; font-family: 'Caveat'; font-size: 17px; line-height: 1; }
    .wf-radio { width: 18px; height: 18px; border: 1.5px solid var(--ink); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
    .wf-radio.on::after { content: ''; width: 9px; height: 9px; background: var(--ink); border-radius: 50%; }

    /* slider track */
    .wf-slider { position: relative; height: 3px; background: var(--ink); border-radius: 2px; }
    .wf-slider-thumb { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; background: var(--paper); border: 2px solid var(--ink); border-radius: 50%; }

    /* scribble fill */
    .wf-scribble {
      background-image: repeating-linear-gradient(135deg,
        transparent 0, transparent 4px,
        rgba(0,0,0,0.5) 4px, rgba(0,0,0,0.5) 4.8px);
    }

    /* tilt utilities */
    .wf-t1 { transform: rotate(-0.4deg); }
    .wf-t2 { transform: rotate(0.6deg); }
    .wf-t3 { transform: rotate(-0.8deg); }

    /* phone shell */
    .wf-phone {
      width: 280px;
      height: 580px;
      background: var(--paper);
      border: 2.5px solid var(--ink);
      border-radius: 32px;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .wf-phone-notch {
      position: absolute;
      top: 8px; left: 50%;
      transform: translateX(-50%);
      width: 80px; height: 18px;
      background: var(--ink);
      border-radius: 12px;
      z-index: 5;
    }
    .wf-statusbar {
      height: 30px;
      padding: 6px 22px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Kalam', cursive;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .wf-screen {
      flex: 1;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .wf-tabbar {
      height: 56px;
      border-top: 1.5px solid var(--ink);
      display: flex;
      justify-content: space-around;
      align-items: center;
      padding: 0 8px 6px;
      background: var(--paper);
      flex-shrink: 0;
    }
    .wf-tab {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      font-family: 'Caveat', cursive; font-size: 11px; color: var(--ink-soft);
    }
    .wf-tab.active { color: var(--ink); font-weight: 700; }
    .wf-tab-icon {
      width: 22px; height: 22px;
      border: 1.5px solid currentColor;
      border-radius: 4px;
    }
    .wf-tab-icon.cta {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: var(--vert);
      border-color: var(--ink);
      color: var(--ink);
      display: flex; align-items: center; justify-content: center;
    }

    /* cat avatar */
    .wf-cat {
      width: 32px; height: 32px;
      border: 1.5px solid var(--ink);
      border-radius: 50%;
      background: var(--paper);
      position: relative;
      display: inline-block;
      flex-shrink: 0;
    }
    .wf-cat::before, .wf-cat::after {
      content: ''; position: absolute; top: -3px;
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 8px solid var(--paper);
      filter: drop-shadow(0 -1.5px 0 var(--ink));
    }
    .wf-cat::before { left: 4px; transform: rotate(-15deg); }
    .wf-cat::after { right: 4px; transform: rotate(15deg); }

    /* cat speech bubble */
    .wf-bubble {
      background: var(--paper);
      border: 1.5px solid var(--ink);
      border-radius: 14px 14px 14px 3px;
      padding: 8px 12px;
      font-family: 'Caveat', cursive;
      font-size: 14px;
      line-height: 1.2;
      position: relative;
    }

    /* radar axes (5 axes pentagon) */
    .wf-radar { position: relative; }

    /* highlight marker */
    .wf-hl {
      background: linear-gradient(180deg, transparent 55%, rgba(201,162,39,0.4) 55%);
      padding: 0 2px;
    }

    /* Annotation arrows (pointing labels) */
    .wf-anno {
      position: absolute;
      font-family: 'Caveat', cursive;
      font-size: 13px;
      color: var(--ink-soft);
      display: flex;
      align-items: center;
      gap: 4px;
      pointer-events: none;
      white-space: nowrap;
    }
    .wf-anno-arrow {
      stroke: var(--ink-soft);
      stroke-width: 1.2;
      fill: none;
    }

    /* Section header on canvas */
    .wf-section-h { font-family: 'Caveat', cursive; font-weight: 700; }
  `;
  document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────
// Phone shell — sketchy iPhone outline
// ─────────────────────────────────────────────────────────────
function Phone({ children, label, time = '9:41' }) {
  return (
    <div className="wf" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div className="wf-phone">
        <div className="wf-phone-notch"></div>
        <div className="wf-statusbar">
          <span>{time}</span>
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Caveat', fontSize: 12 }}>•••</span>
            <span style={{ width: 16, height: 9, border: '1.5px solid var(--ink)', borderRadius: 2, position: 'relative' }}>
              <span style={{ position: 'absolute', inset: 1, background: 'var(--ink)', width: '70%', borderRadius: 1 }}></span>
            </span>
          </span>
        </div>
        <div className="wf-screen">{children}</div>
      </div>
      {label && <div className="wf-label" style={{ marginTop: 2 }}>{label}</div>}
    </div>
  );
}

// Tab bar (bottom navigation)
function TabBar({ active = 'home' }) {
  const tabs = [
    { id: 'home', label: 'Accueil', icon: '⌂' },
    { id: 'search', label: 'Chercher', icon: '○' },
    { id: 'spawt', label: 'Spawter', icon: '🐾', cta: true },
    { id: 'map', label: 'Carte', icon: '◇' },
    { id: 'me', label: 'Moi', icon: '☻' },
  ];
  return (
    <div className="wf-tabbar">
      {tabs.map(t => (
        <div key={t.id} className={`wf-tab ${active === t.id ? 'active' : ''}`}>
          <div className={`wf-tab-icon ${t.cta ? 'cta' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: t.cta ? 16 : 11, fontFamily: 'Caveat' }}>
            {t.icon}
          </div>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// Reusable scribble box (placeholder image with caption)
function ImgBox({ w = '100%', h = 80, label = 'photo', rough = false, style = {} }) {
  return (
    <div className={`wf-img ${rough ? 'wf-img-rough' : ''}`} style={{ width: w, height: h, ...style }}>
      {label}
    </div>
  );
}

// Pill / chip
function Pill({ children, fill, or, vert, style = {} }) {
  const cls = ['wf-pill'];
  if (fill) cls.push('wf-pill-fill');
  if (or) cls.push('wf-pill-or');
  if (vert) cls.push('wf-pill-vert');
  return <span className={cls.join(' ')} style={style}>{children}</span>;
}

// Sketchy radar (pentagon, 5 axes)
function Radar({ size = 140, values = [0.6, 0.4, 0.7, 0.5, 0.8], labels = ['Racines','Tanière','Exigeant','Foule','Maquis'], opposite = ['Horizons','Nomade','Enthous.','Secret','Table'], showLabels = true }) {
  const r = size / 2 - 10;
  const cx = size / 2, cy = size / 2;
  const pts = values.map((v, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v];
  });
  const ring = (k) => values.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
  });
  const polyStr = (arr) => arr.map(p => p.join(',')).join(' ');
  const axisEnds = values.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {[0.33, 0.66, 1].map(k => (
          <polygon key={k} points={polyStr(ring(k))} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1" strokeDasharray={k < 1 ? '2 3' : ''} />
        ))}
        {axisEnds.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgba(0,0,0,0.3)" strokeWidth="1" strokeDasharray="2 3" />
        ))}
        <polygon points={polyStr(pts)} fill="rgba(201,162,39,0.25)" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#1a1a1a" />)}
      </svg>
      {showLabels && labels.map((l, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const lx = cx + Math.cos(a) * (r + 14);
        const ly = cy + Math.sin(a) * (r + 14);
        return (
          <div key={i} style={{
            position: 'absolute', left: lx, top: ly, transform: 'translate(-50%, -50%)',
            fontFamily: 'Caveat', fontSize: 11, color: 'var(--ink)', textAlign: 'center', whiteSpace: 'nowrap'
          }}>{l}</div>
        );
      })}
    </div>
  );
}

// Cat with speech bubble
function CatSays({ text, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, ...style }}>
      <div className="wf-cat"></div>
      <div className="wf-bubble" style={{ flex: 1 }}>{text}</div>
    </div>
  );
}

// Star rating (sketchy)
function Stars({ n = 5, full = 4, size = 14 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} style={{
          fontSize: size, lineHeight: 1, color: i < full ? 'var(--or)' : 'var(--ink-light)',
          textShadow: i < full ? '0 0 0 var(--or)' : 'none'
        }}>★</span>
      ))}
    </span>
  );
}

// Header bar inside phone screen
function ScreenHeader({ left, title, right }) {
  return (
    <div style={{
      padding: '12px 14px 8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      borderBottom: '1.5px dashed var(--ink-light)',
      flexShrink: 0,
    }}>
      <div style={{ width: 28, fontFamily: 'Caveat', fontSize: 16 }}>{left}</div>
      <div className="wf-title" style={{ fontSize: 17 }}>{title}</div>
      <div style={{ width: 28, fontFamily: 'Caveat', fontSize: 16, textAlign: 'right' }}>{right}</div>
    </div>
  );
}

// Annotation note (post-it style for designer comments)
function Note({ children, style = {}, color = '#fef3a3' }) {
  return (
    <div style={{
      background: color,
      border: '1.5px solid #1a1a1a',
      padding: '8px 10px',
      fontFamily: 'Caveat',
      fontSize: 14,
      lineHeight: 1.25,
      color: '#1a1a1a',
      borderRadius: '4px 8px 4px 8px',
      maxWidth: 220,
      transform: 'rotate(-1.2deg)',
      boxShadow: '2px 3px 0 rgba(0,0,0,0.12)',
      ...style,
    }}>{children}</div>
  );
}

// Export to window for cross-script access
Object.assign(window, { Phone, TabBar, ImgBox, Pill, Radar, CatSays, Stars, ScreenHeader, Note });
