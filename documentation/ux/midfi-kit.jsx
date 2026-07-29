/* global React */
// SPAWT Mid-fi shared primitives — phone shell, icons, cat voice, status bar.

const Phone = ({ children, label }) => (
  <div className="phone" data-screen-label={label}>
    <div className="notch" />
    <div className="phone-screen">
      <StatusBar />
      {children}
    </div>
    <div className="home-bar" />
  </div>
);

const StatusBar = ({ time = "12:42", dark = false }) => (
  <div className="status-bar" style={{ color: dark ? '#fff' : 'var(--ink)' }}>
    <span>{time}</span>
    <div className="right">
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
        <path d="M1 8.5C1.5 8 3 7 5.5 7s4 1 5.5 2.5L13.5 7c-2-2-4.5-3-7-3S2 5 .5 6.5L1 8.5z" fill={dark ? '#fff' : '#0A0A0A'} />
        <circle cx="8" cy="9.5" r="1" fill={dark ? '#fff' : '#0A0A0A'} />
      </svg>
      <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
        <rect x="0.5" y="2" width="11" height="6" rx="1.5" stroke={dark ? '#fff' : '#0A0A0A'} fill="none" />
        <rect x="2" y="3.5" width="7" height="3" rx="0.5" fill={dark ? '#fff' : '#0A0A0A'} />
        <rect x="12" y="3.5" width="1.2" height="3" rx="0.5" fill={dark ? '#fff' : '#0A0A0A'} />
      </svg>
    </div>
  </div>
);

// Cat icon — minimalist silhouette inspired by SPAWT mascot
const CatIcon = ({ size = 18, color = '#0A0A0A', bg = 'transparent' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ background: bg, borderRadius: '50%', padding: bg !== 'transparent' ? 3 : 0 }}>
    <path d="M5 9 L4 4 L8 7 M19 9 L20 4 L16 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M5 9 C5 14 8 18 12 18 C16 18 19 14 19 9" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <circle cx="9.5" cy="11.5" r="0.9" fill={color}/>
    <circle cx="14.5" cy="11.5" r="0.9" fill={color}/>
    <path d="M11 14 L12 15 L13 14" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M9 13.5 L7 14 M15 13.5 L17 14 M9.5 14.5 L7.5 15.2 M14.5 14.5 L16.5 15.2" stroke={color} strokeWidth="0.7" strokeLinecap="round"/>
  </svg>
);

const SpawtPin = ({ size = 18, color = '#C8A44E' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z" fill={color}/>
    <circle cx="12" cy="9" r="3" fill="#0A0A0A"/>
  </svg>
);

// Cat voice bubble — used at moments-clés
const CatBubble = ({ children, stage = 'explorateur' }) => (
  <div className="cat-bubble">
    <div className="cat-icon"><CatIcon size={18} color="#0A0A0A"/></div>
    <div style={{ flex: 1, paddingTop: 2 }}>{children}</div>
  </div>
);

// Stars for ratings
const Stars = ({ value = 4, max = 4, size = 12 }) => (
  <span className="star-row" style={{ fontSize: size }}>
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className={i < value ? '' : 'empty'}>★</span>
    ))}
  </span>
);

// Score chip (matching %)
const MatchScore = ({ value = 92 }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '5px 9px', borderRadius: 100,
    background: value >= 85 ? 'rgba(45,107,79,0.14)' : 'rgba(10,10,10,0.06)',
    color: value >= 85 ? 'var(--chat-green-deep)' : 'var(--ink-soft)',
    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11,
    border: `1px solid ${value >= 85 ? 'rgba(45,107,79,0.3)' : 'transparent'}`,
  }}>
    <span style={{ fontSize: 9 }}>●</span>{value}%
  </div>
);

// Generic icon set (24x24, 1.6 stroke)
const Ico = ({ name, size = 20, color = 'currentColor', filled = false }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...props}><path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" fill={filled ? color : 'none'}/></svg>;
    case 'compass': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M16 8 L13 13 L8 16 L11 11 Z" fill={filled ? color : 'none'}/></svg>;
    case 'map': return <svg {...props}><path d="M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z"/><path d="M9 4 V18 M15 6 V20"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4" fill={filled ? color : 'none'}/><path d="M4 21 C4 16 7 14 12 14 C17 14 20 16 20 21" fill={filled ? color : 'none'}/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5 V19 M5 12 H19"/></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M16 16 L20 20"/></svg>;
    case 'filter': return <svg {...props}><path d="M3 5 H21 L14 13 V20 L10 18 V13 Z"/></svg>;
    case 'star': return <svg {...props}><path d="M12 3 L14.5 9 L21 9.7 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.7 L9.5 9 Z" fill={filled ? color : 'none'}/></svg>;
    case 'heart': return <svg {...props}><path d="M12 20 C5 15 3 10.5 3 7.5 A4.5 4.5 0 0 1 12 5 A4.5 4.5 0 0 1 21 7.5 C21 10.5 19 15 12 20 Z" fill={filled ? color : 'none'}/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12 H19 M13 6 L19 12 L13 18"/></svg>;
    case 'arrow-left': return <svg {...props}><path d="M19 12 H5 M11 6 L5 12 L11 18"/></svg>;
    case 'arrow-up': return <svg {...props}><path d="M12 19 V5 M6 11 L12 5 L18 11"/></svg>;
    case 'arrow-down': return <svg {...props}><path d="M12 5 V19 M6 13 L12 19 L18 13"/></svg>;
    case 'close': return <svg {...props}><path d="M6 6 L18 18 M18 6 L6 18"/></svg>;
    case 'chevron-right': return <svg {...props}><path d="M9 6 L15 12 L9 18"/></svg>;
    case 'chevron-left': return <svg {...props}><path d="M15 6 L9 12 L15 18"/></svg>;
    case 'chevron-down': return <svg {...props}><path d="M6 9 L12 15 L18 9"/></svg>;
    case 'lock': return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11 V8 A4 4 0 0 1 16 8 V11"/></svg>;
    case 'lock-open': return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11 V8 A4 4 0 0 1 14 5"/></svg>;
    case 'pin': return <svg {...props}><path d="M12 22 C12 22 4 14 4 9 A8 8 0 0 1 20 9 C20 14 12 22 12 22 Z" fill={filled ? color : 'none'}/><circle cx="12" cy="9" r="2.5" fill={filled ? '#fff' : 'none'} stroke={filled ? '#fff' : color}/></svg>;
    case 'crown': return <svg {...props}><path d="M3 7 L8 12 L12 6 L16 12 L21 7 V18 H3 Z" fill={filled ? color : 'none'}/></svg>;
    case 'gold-circle': return <svg {...props}><circle cx="12" cy="12" r="9" fill={filled ? color : 'none'}/><path d="M9 12 L11 14 L15 9" stroke={filled ? '#0A0A0A' : color}/></svg>;
    case 'camera': return <svg {...props}><path d="M3 8 H7 L9 6 H15 L17 8 H21 V18 H3 Z"/><circle cx="12" cy="13" r="3.5"/></svg>;
    case 'send': return <svg {...props}><path d="M3 11 L21 4 L14 21 L11 13 Z"/></svg>;
    case 'share': return <svg {...props}><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11 L16 7 M8 13 L16 17"/></svg>;
    case 'clock': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15 14"/></svg>;
    case 'walk': return <svg {...props}><circle cx="13" cy="4" r="2"/><path d="M9 22 L11 14 L8 11 V8 L13 7 L17 11 L20 12 M11 14 L15 16 L17 22"/></svg>;
    case 'sliders': return <svg {...props}><path d="M4 7 H20 M4 12 H20 M4 17 H20"/><circle cx="9" cy="7" r="2" fill="#fff"/><circle cx="15" cy="12" r="2" fill="#fff"/><circle cx="11" cy="17" r="2" fill="#fff"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 17 V11 A6 6 0 0 1 18 11 V17 L20 19 H4 Z"/><path d="M10 22 H14"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
};

// Tab bar (bottom navigation)
const TabBar = ({ active = 'home' }) => {
  const tabs = [
    { id: 'home', label: 'Feed', icon: 'home' },
    { id: 'map', label: 'Carte', icon: 'map' },
    { id: 'fab', label: '', icon: 'plus' },
    { id: 'tribu', label: 'Meute', icon: 'compass' },
    { id: 'profile', label: 'Palais', icon: 'user' },
  ];
  return (
    <div className="tab-bar">
      {tabs.map(t => t.id === 'fab' ? (
        <div key="fab" className="tab fab">
          <div className="fab-btn"><Ico name="plus" size={22} color="#C8A44E"/></div>
        </div>
      ) : (
        <div key={t.id} className={`tab ${active === t.id ? 'active' : ''}`}>
          <Ico name={t.icon} size={22} filled={active === t.id}/>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
};

// Wordmark / logo
const Wordmark = ({ size = 22, color = 'currentColor' }) => (
  <span style={{
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: size,
    letterSpacing: '0.02em',
    color,
  }}>SPAWT</span>
);

// Palais radar — 5 axes pentagonal radar
const PalaisRadar = ({ values = [0.7, 0.4, 0.8, 0.5, 0.65], size = 200, fill = '#2D6B4F', labels = ['Nomade','Foule','Maquis','Exigeant','Horizons'] }) => {
  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const angles = [0, 72, 144, 216, 288].map(a => (a - 90) * Math.PI / 180);
  const point = (i, v) => [cx + Math.cos(angles[i]) * r * v, cy + Math.sin(angles[i]) * r * v];
  const polyPts = values.map((v, i) => point(i, v).join(',')).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((scale, idx) => {
        const pts = angles.map((a) => `${cx + Math.cos(a) * r * scale},${cy + Math.sin(a) * r * scale}`).join(' ');
        return <polygon key={idx} points={pts} fill="none" stroke="rgba(10,10,10,0.10)" strokeWidth="1"/>;
      })}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke="rgba(10,10,10,0.08)" strokeWidth="1"/>
      ))}
      <polygon points={polyPts} fill={fill} fillOpacity="0.18" stroke={fill} strokeWidth="1.8" strokeLinejoin="round"/>
      {values.map((v, i) => {
        const [x, y] = point(i, v);
        return <circle key={i} cx={x} cy={y} r="3" fill={fill}/>;
      })}
      {labels.map((label, i) => {
        const [x, y] = point(i, 1.18);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-body)" fontSize="9" fontWeight="700" fill="#0A0A0A" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</text>;
      })}
    </svg>
  );
};

// Frame label (above artboard)
const FrameLabel = ({ children }) => (
  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 500, color: 'rgba(60,50,40,0.7)', letterSpacing: '0.04em' }}>
    {children}
  </div>
);

Object.assign(window, {
  Phone, StatusBar, CatIcon, SpawtPin, CatBubble, Stars, MatchScore, Ico, TabBar, Wordmark, PalaisRadar, FrameLabel,
});
