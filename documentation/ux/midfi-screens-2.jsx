/* global React, Phone, Ico, CatBubble, CatIcon, SpawtPin, Stars, MatchScore, TabBar, Wordmark, PalaisRadar, StatusBar */
// SPAWT Mid-fi Screens — part 2: Le Spawt (3 moments), Profil (3 vues), Carte

// ─────────────────────────────────────────────────────────────
// 4A · LE SPAWT — Notif système (lock screen)
// ─────────────────────────────────────────────────────────────

const SpawtNotif = ({ voixChat = true }) => (
  <Phone label="Spawt · notif lock">
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #1a1410 0%, #2a1f15 50%, #0a0a0a 100%)' }}>
      {/* Lock screen time */}
      <div style={{ paddingTop: 50, textAlign: 'center', color: '#fff' }}>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, opacity: 0.8 }}>vendredi 14 mars</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 70, lineHeight: 1, marginTop: 4, letterSpacing: '-0.02em' }}>13:42</div>
      </div>

      {/* Notification card */}
      <div style={{ position: 'absolute', left: 12, right: 12, top: 230 }}>
        <div style={{
          background: 'rgba(20,18,16,0.78)',
          backdropFilter: 'blur(20px)',
          borderRadius: 18, padding: 14,
          border: '0.5px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--spawt-black)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpawtPin size={14}/>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500, letterSpacing: '0.02em' }}>SPAWT</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>maintenant</span>
          </div>
          <div style={{ color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Tu sors de Saakan ?
          </div>
          <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, lineHeight: 1.4 }}>
            On a détecté ton VTC. Comment c'était ? Tape pour spawter — tu as 15 minutes.
          </div>

          {voixChat && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
              <CatIcon size={14} color="rgba(255,255,255,0.6)"/>
              « Allez, dis-moi tout. »
            </div>
          )}
        </div>

        {/* Older notif (stacked) */}
        <div style={{
          marginTop: 6, marginLeft: 8, marginRight: 8,
          padding: '8px 14px',
          background: 'rgba(20,18,16,0.55)', backdropFilter: 'blur(20px)',
          borderRadius: 14, fontSize: 11, color: 'rgba(255,255,255,0.55)',
        }}>
          <span style={{ fontWeight: 500 }}>WhatsApp</span> · Adam : « tu vas où ce soir ? »
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        Glisse vers le haut pour ouvrir
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// 4B · LE SPAWT — Sheet de notation
// ─────────────────────────────────────────────────────────────

const SpawtSheet = ({ voixChat = true }) => {
  const [rating] = [4];
  return (
    <Phone label="Spawt · sheet de notation">
      {/* Faded background showing the lieu fiche behind */}
      <div style={{ flex: 1, position: 'relative', background: 'rgba(10,10,10,0.5)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <div className="food-ph alt-2" style={{ width: '100%', height: 280, padding: 0 }}/>
        </div>

        {/* Bottom sheet */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'var(--bg)', borderRadius: '24px 24px 0 0',
          padding: '14px 22px 22px',
          maxHeight: '88%', overflow: 'auto',
        }}>
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, background: 'rgba(10,10,10,0.18)', borderRadius: 4, margin: '0 auto 16px' }}/>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div className="food-ph alt-2" style={{ width: 48, height: 48, borderRadius: 12, padding: 0, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, lineHeight: 1.1 }}>Saakan</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}>Maquis · 14 mars · 13:38</div>
            </div>
            <Ico name="close" size={20} color="var(--ink-mute)"/>
          </div>

          {voixChat && (
            <div style={{ marginBottom: 18 }}>
              <CatBubble>Alors, valait le détour ? Sois honnête — ton Palais en dépend.</CatBubble>
            </div>
          )}

          {/* Rating */}
          <div className="t-overline" style={{ marginBottom: 10 }}>TA NOTE</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                flex: 1, aspectRatio: '1',
                borderRadius: 12,
                background: i <= rating ? 'var(--spawt-gold)' : 'transparent',
                border: i <= rating ? '2px solid var(--spawt-gold)' : '2px solid var(--line-strong)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: i <= rating ? 'var(--spawt-black)' : 'rgba(10,10,10,0.25)',
              }}>★</div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -16, marginBottom: 22, textAlign: 'center', fontStyle: 'italic' }}>
            "Très bon — on revient"
          </div>

          {/* Tags */}
          <div className="t-overline" style={{ marginBottom: 10 }}>EN UN MOT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>
            {[
              ['Généreux', true], ['Authentique', true], ['Service rapide', false],
              ['Cadre', false], ['Bruyant', true], ['+ Ajouter', false]
            ].map(([t, on], i) => (
              <span key={i} className={on ? 'chip chip-dark' : 'chip chip-outline'} style={{ fontSize: 11.5 }}>
                {on && <span style={{ fontSize: 9 }}>✓</span>}{t}
              </span>
            ))}
          </div>

          {/* Photo */}
          <div className="t-overline" style={{ marginBottom: 10 }}>UNE PHOTO ? OPTIONNEL</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 12,
              border: '1.5px dashed var(--line-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-mute)',
            }}>
              <Ico name="camera" size={20}/>
            </div>
            <div className="food-ph alt-2" style={{ width: 64, height: 64, borderRadius: 12, padding: 0 }}/>
          </div>

          {/* Submit */}
          <button className="btn btn-primary" style={{ width: '100%', padding: '15px' }}>
            Spawter ce lieu
            <Ico name="arrow-right" size={16} color="#fff"/>
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: 'var(--ink-mute)' }}>
            +1 spot dans ton Palais · stade Explorateur
          </div>
        </div>
      </div>
    </Phone>
  );
};

// ─────────────────────────────────────────────────────────────
// 4C · LE SPAWT — Montée de stade (célébration)
// ─────────────────────────────────────────────────────────────

const SpawtCelebration = () => (
  <Phone label="Spawt · montée de stade">
    <div style={{
      flex: 1, background: 'var(--gr-night)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 28px 28px', color: '#fff',
    }}>
      {/* Subtle dot pattern */}
      <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}/>

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,164,78,0.35), transparent 70%)',
        filter: 'blur(12px)',
      }}/>

      <div style={{ position: 'relative', textAlign: 'center', marginTop: 24 }}>
        <div className="t-overline" style={{ color: 'var(--spawt-gold)', marginBottom: 12, letterSpacing: '0.2em' }}>
          ✦ TU CHANGES DE STADE ✦
        </div>
      </div>

      {/* Big cat icon */}
      <div style={{ position: 'relative', marginTop: 32, marginBottom: 24 }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'var(--gr-gold)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 40px rgba(200,164,78,0.5)',
        }}>
          <CatIcon size={64} color="#0A0A0A"/>
        </div>
        <div style={{
          position: 'absolute', top: -10, right: -10,
          background: 'var(--pure-white)', color: 'var(--spawt-black)',
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 13, padding: '4px 10px', borderRadius: 100,
        }}>+1</div>
      </div>

      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through', marginBottom: 4 }}>
          🐱 Touriste
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38, color: 'var(--spawt-gold)', lineHeight: 1, letterSpacing: '-0.01em' }}>
          🐈 Explorateur
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>11 spawts · ton territoire se dessine</div>
      </div>

      {/* Cat speaks */}
      <div style={{
        position: 'relative', width: '100%',
        background: 'rgba(255,255,255,0.06)',
        border: '0.5px solid rgba(200,164,78,0.3)',
        borderRadius: 16, padding: 16,
        fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.92)',
        textAlign: 'center', marginBottom: 16,
      }}>
        « Tu commences à avoir du flair. Encore quelques spots et je te dirai à quel archétype tu appartiens. »
        <div style={{ marginTop: 8, fontStyle: 'normal', fontSize: 10, color: 'var(--spawt-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>— Le Chat</div>
      </div>

      {/* Progression */}
      <div style={{ position: 'relative', width: '100%', marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 6, color: 'rgba(255,255,255,0.6)' }}>
          <span>11 / 20 spawts</span>
          <span>→ Détective</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: '55%', height: '100%', background: 'var(--gr-gold)' }}/>
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1, color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>
          Partager
        </button>
        <button className="btn btn-gold-grad" style={{ flex: 1 }}>
          Voir mon Palais
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// 5A · PROFIL — Carte spawter flip recto/verso
// Recto : visible, fierté (nom, archétype, photo, citation, stats héro)
// Verso : technique (radar 5 axes + axes dominants)
// ─────────────────────────────────────────────────────────────

const SpawterCard = ({ flipped, onFlip, premium }) => (
  <div
    onClick={onFlip}
    style={{
      width: '100%', aspectRatio: '0.72', perspective: 1400,
      cursor: 'pointer', userSelect: 'none',
    }}
  >
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      transformStyle: 'preserve-3d',
      transition: 'transform 0.7s cubic-bezier(.4,.2,.2,1)',
      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
    }}>
      {/* RECTO */}
      <div style={{
        position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
        background: 'var(--gr-night)', borderRadius: 22,
        overflow: 'hidden', color: '#fff',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        border: '1px solid rgba(200,164,78,0.35)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.45 }}/>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,164,78,0.35), transparent 70%)', filter: 'blur(8px)',
        }}/>

        {/* Top: rang + carte # */}
        <div style={{ position: 'relative', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, color: 'var(--spawt-gold)', letterSpacing: '0.18em', fontWeight: 700 }}>SPAWTER · DJIDJI</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, opacity: 0.55, letterSpacing: '0.1em' }}>N° 0142 / ABJ</span>
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <div style={{ position: 'relative' }}>
            <div className="food-ph alt-3" style={{
              width: 96, height: 96, borderRadius: '50%', padding: 0,
              border: '3px solid var(--spawt-gold)',
              boxShadow: '0 0 24px rgba(200,164,78,0.4)',
            }}/>
            {premium && (
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                background: 'var(--gr-gold)', width: 30, height: 30, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #0A0A0A',
              }}>
                <Ico name="crown" size={14} color="#0A0A0A" filled/>
              </div>
            )}
          </div>
        </div>

        {/* Name + archetype */}
        <div style={{ position: 'relative', padding: '14px 18px 0', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 1.1 }}>Betsy Diomandé</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--spawt-gold)', marginTop: 6, letterSpacing: '-0.005em' }}>
            Œil de Chat
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 8, fontStyle: 'italic', lineHeight: 1.4, padding: '0 8px' }}>
            « Si c'est moyen, ça n'existe pas. »
          </div>
        </div>

        {/* Hero stats */}
        <div style={{ position: 'relative', marginTop: 'auto', padding: '14px 18px 8px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            ['38', 'Spawts'],
            ['12', 'Tanières'],
            ['6', 'Quartiers'],
          ].map(([n, l], i) => (
            <div key={l} style={{ textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--spawt-gold)' }}>{n}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.65, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Flip hint */}
        <div style={{
          position: 'relative', padding: '8px 18px 14px', textAlign: 'center',
          fontSize: 10, color: 'rgba(255,255,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: '0.05em',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 12 A9 9 0 0 1 21 12 M21 12 L17 8 M21 12 L17 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          Tape pour voir ton Palais
        </div>
      </div>

      {/* VERSO */}
      <div style={{
        position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        background: 'var(--bg-warm)', borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        border: '1px solid var(--line-strong)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div className="pattern-dots" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}/>

        <div style={{ position: 'relative', padding: '14px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="t-overline">LE PALAIS</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>5 AXES</span>
        </div>

        {/* Radar */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <PalaisRadar values={[0.55, 0.85, 0.45, 0.9, 0.4]} size={210} fill="#2D6B4F"/>
        </div>

        {/* 2 dominants */}
        <div style={{ position: 'relative', padding: '8px 18px 0' }}>
          <div className="t-overline" style={{ marginBottom: 8, fontSize: 9 }}>2 AXES DOMINANTS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, background: 'rgba(45,107,79,0.12)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(45,107,79,0.28)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--chat-green-deep)' }}>Secret</div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 1 }}>85%</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(45,107,79,0.12)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(45,107,79,0.28)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--chat-green-deep)' }}>Exigeant</div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 1 }}>90%</div>
            </div>
          </div>
        </div>

        <div style={{
          position: 'relative', marginTop: 'auto', padding: '10px 18px 14px',
          textAlign: 'center', fontSize: 10, color: 'var(--ink-mute)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          letterSpacing: '0.05em',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M21 12 A9 9 0 0 1 3 12 M3 12 L7 8 M3 12 L7 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          Retourner
        </div>
      </div>
    </div>
  </div>
);

const ProfilRadar = ({ premium = false }) => {
  const [flipped, setFlipped] = React.useState(false);
  return (
  <Phone label="Profil · carte spawter">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ico name="arrow-left" size={20}/>
        <span className="t-overline">MA CARTE</span>
        <Ico name="share" size={18}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '12px 22px 22px' }}>
        {/* Flip card */}
        <SpawterCard flipped={flipped} onFlip={() => setFlipped(f => !f)} premium={premium}/>

        {/* Crew + sections sous la carte */}
        <div style={{ marginTop: 22 }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>TON CREW · GBONHI</div>
          <div style={{ display: 'flex', gap: -10, marginBottom: 14 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`food-ph alt-${i % 5}`} style={{
                width: 36, height: 36, borderRadius: '50%', padding: 0,
                border: '2px solid var(--bg)', marginLeft: i === 1 ? 0 : -10,
              }}/>
            ))}
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-warm)', border: '2px solid var(--bg)',
              marginLeft: -10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)',
            }}>+8</div>
          </div>
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {[
            ['Mes 12 tanières', 'heart'],
            ['Mes coups de cœur', 'star'],
            ['Mes spawts (38)', 'pin'],
            ['Réglages', 'sliders'],
          ].map(([label, icon]) => (
            <div key={label} style={{
              background: 'var(--pure-white)', padding: '13px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Ico name={icon} size={18} color="var(--ink-soft)"/>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{label}</span>
              <Ico name="chevron-right" size={16} color="var(--ink-mute)"/>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
  );
};

// ─────────────────────────────────────────────────────────────
// 5B · PROFIL — Collection de titres
// ─────────────────────────────────────────────────────────────

const TITRES = [
  { name: 'Œil Neuf', stade: 'Touriste', got: true, current: false },
  { name: 'Œil de Chat', stade: 'Explorateur', got: true, current: true },
  { name: 'Œil Vert', stade: 'Détective', got: true, current: false },
  { name: 'Regard', stade: 'Djidji', got: false, current: false },
  { name: 'Le Verdict', stade: 'Guide', got: false, current: false },
];

const ProfilTitres = () => (
  <Phone label="Profil · titres">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ico name="arrow-left" size={20}/>
        <span className="t-overline">MA COLLECTION</span>
        <Ico name="share" size={18}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 22px 22px' }}>
        {/* Archetype banner */}
        <div style={{
          background: 'var(--gr-night)', color: '#fff',
          borderRadius: 16, padding: '20px 18px',
          position: 'relative', overflow: 'hidden', marginBottom: 22,
        }}>
          <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}/>
          <div style={{ position: 'relative' }}>
            <div className="t-overline" style={{ color: 'var(--spawt-gold)', marginBottom: 8 }}>ARCHÉTYPE · SECRET + EXIGEANT</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>Œil de Chat</div>
            <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 8, fontStyle: 'italic', lineHeight: 1.5 }}>
              « Si c'est moyen, ça n'existe pas. »
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              5 noms à débloquer · 3 obtenus
            </div>
          </div>
        </div>

        {/* Title cards */}
        <div className="t-overline" style={{ marginBottom: 12 }}>LES 5 NOMS DE TON ARCHÉTYPE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TITRES.map((t, i) => (
            <div key={t.name} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: 14,
              background: t.current ? 'var(--bg-warm)' : 'var(--pure-white)',
              border: t.current ? '2px solid var(--spawt-gold)' : '1px solid var(--line)',
              borderRadius: 14,
              opacity: t.got ? 1 : 0.6,
            }}>
              {/* Stade icon */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: t.got ? (t.current ? 'var(--gr-gold)' : 'var(--spawt-black)') : 'rgba(10,10,10,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: t.got ? (t.current ? '#0A0A0A' : 'var(--spawt-gold)') : 'var(--ink-mute)',
                flexShrink: 0,
              }}>
                {t.got ? (i === 4 ? '◉' : i === 3 ? '✦' : i === 2 ? '🐈' : i === 1 ? '🐈' : '🐱') : <Ico name="lock" size={18} color="var(--ink-mute)"/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                  {t.current && <span className="chip chip-gold" style={{ padding: '2px 8px', fontSize: 9 }}>ACTUEL</span>}
                </div>
                <div className="t-caption" style={{ marginTop: 2 }}>{t.stade}</div>
              </div>
              {t.got && <Ico name="chevron-right" size={18} color="var(--ink-mute)"/>}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: 14, background: 'rgba(45,107,79,0.08)', borderRadius: 12, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <CatIcon size={18} color="var(--chat-green-deep)"/>
          <div>
            <strong>Prochain titre :</strong> 7 spawts pour débloquer <em>Regard</em> au stade Djidji.
          </div>
        </div>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// 5C · PROFIL — Journal du chat
// ─────────────────────────────────────────────────────────────

const JOURNAL = [
  { date: 'Aujourd\'hui · 13:42', text: 'Saakan, encore un poisson braisé. Je commence à voir ton genre.', tag: 'Spawt #38', alt: 2 },
  { date: 'Mardi · 19:30', text: 'Premier spot à Marcory. T\'élargis ton territoire, c\'est bien.', tag: 'Nouveau quartier', alt: 1 },
  { date: 'Lundi · 12:15', text: 'Tu retournes chez Tantie Rose. Ça devient une tanière, ce truc.', tag: 'Tanière confirmée', alt: 0 },
  { date: 'Sem. dernière', text: 'Ta note sur Le Bô Zinc t\'a fait pencher Exigeant. Bien noté.', tag: 'Palais ajusté', alt: 4 },
];

const ProfilJournal = ({ voixChat = true }) => (
  <Phone label="Profil · journal du chat">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ico name="arrow-left" size={20}/>
        <span className="t-overline">JOURNAL DU CHAT</span>
        <div style={{ width: 20 }}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '12px 22px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--spawt-black)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CatIcon size={26} color="var(--spawt-gold)"/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Le Chat te suit</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>
              Ses observations sur ton parcours · 24 entrées
            </div>
          </div>
        </div>

        {voixChat && (
          <div style={{ marginBottom: 22 }}>
            <CatBubble>
              Je note ce que je vois. Tu peux désactiver mes commentaires si je suis trop bavard.
            </CatBubble>
          </div>
        )}

        {/* Timeline */}
        <div style={{ position: 'relative', paddingLeft: 22 }}>
          <div style={{ position: 'absolute', top: 6, bottom: 0, left: 7, width: 1.5, background: 'var(--line-strong)' }}/>
          {JOURNAL.map((j, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: 18 }}>
              <div style={{
                position: 'absolute', left: -22, top: 4,
                width: 16, height: 16, borderRadius: '50%',
                background: i === 0 ? 'var(--spawt-gold)' : 'var(--bg)',
                border: '2px solid var(--spawt-black)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i === 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--spawt-black)' }}/>}
              </div>
              <div className="t-caption" style={{ marginBottom: 6 }}>{j.date}</div>
              <div style={{
                background: 'var(--pure-white)', border: '1px solid var(--line)',
                borderRadius: 14, padding: 13,
                display: 'flex', gap: 11, alignItems: 'flex-start',
              }}>
                <div className={`food-ph alt-${j.alt}`} style={{ width: 44, height: 44, borderRadius: 8, padding: 0, flexShrink: 0 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--ink)', fontStyle: 'italic' }}>« {j.text} »</div>
                  <div style={{ marginTop: 8 }}>
                    <span className="chip chip-gold" style={{ padding: '3px 9px', fontSize: 9.5 }}>{j.tag}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// 6 · CARTE — Cercle 3km + flou + paywall Gold
// ─────────────────────────────────────────────────────────────

const MAP_PINS = [
  { x: 35, y: 38, gold: false },
  { x: 58, y: 30, gold: false },
  { x: 48, y: 52, gold: true },
  { x: 32, y: 60, gold: false },
  { x: 65, y: 55, gold: false },
  // Beyond circle (blurred)
  { x: 12, y: 18, blur: true },
  { x: 85, y: 22, blur: true },
  { x: 88, y: 70, blur: true },
  { x: 8, y: 80, blur: true },
  { x: 80, y: 88, blur: true },
];

const CarteMidfi = ({ premium = false }) => (
  <Phone label="Carte 3km">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Map background */}
      <div style={{
        position: 'relative', flex: 1,
        background: '#e6e0d0',
        backgroundImage: `
          linear-gradient(rgba(45,107,79,0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(45,107,79,0.06) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
        overflow: 'hidden',
      }}>
        {/* Roads */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M0 35 Q 30 38 50 40 T 100 45" stroke="#fff" strokeWidth="2.5" fill="none"/>
          <path d="M50 0 Q 48 30 50 50 T 52 100" stroke="#fff" strokeWidth="2.5" fill="none"/>
          <path d="M0 70 L 100 65" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="none"/>
          <path d="M25 0 L 30 100" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none"/>
          <path d="M75 0 L 78 100" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none"/>
        </svg>

        {/* 3km circle */}
        {!premium && (
          <>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 280, height: 280, borderRadius: '50%',
              border: '2px dashed var(--chat-green)',
              background: 'rgba(45,107,79,0.04)',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', top: 'calc(50% - 140px)', left: '50%',
              transform: 'translate(-50%, -100%)', marginTop: -4,
              background: 'var(--chat-green)', color: '#fff',
              fontFamily: 'var(--font-body)', fontWeight: 700,
              fontSize: 10, padding: '4px 10px', borderRadius: 100,
              letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>3 km · TON RAYON</div>
          </>
        )}

        {/* You-are-here */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--spawt-gold)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(200,164,78,0.25), 0 2px 8px rgba(0,0,0,0.2)' }}/>
        </div>

        {/* Pins */}
        {MAP_PINS.map((p, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${p.y}%`, left: `${p.x}%`,
            transform: 'translate(-50%, -100%)',
            filter: p.blur && !premium ? 'blur(4px)' : 'none',
            opacity: p.blur && !premium ? 0.5 : 1,
          }}>
            <SpawtPin size={p.gold ? 32 : 26} color={p.gold ? 'var(--spawt-gold)' : 'var(--spawt-black)'}/>
          </div>
        ))}

        {/* Top search bar */}
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          background: 'var(--pure-white)', borderRadius: 14,
          padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        }}>
          <Ico name="search" size={17} color="var(--ink-mute)"/>
          <span style={{ fontSize: 13, color: 'var(--ink-mute)', flex: 1 }}>Cherche un spawt, un quartier...</span>
          <div style={{ width: 1, height: 20, background: 'var(--line)' }}/>
          <Ico name="filter" size={17}/>
        </div>

        {/* Filter chips */}
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0,
          padding: '0 12px', display: 'flex', gap: 6, overflowX: 'auto',
        }}>
          <span className="chip chip-dark" style={{ fontSize: 11, padding: '6px 12px' }}>Tout</span>
          <span className="chip" style={{ fontSize: 11, padding: '6px 12px', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>Maquis</span>
          <span className="chip" style={{ fontSize: 11, padding: '6px 12px', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>Ouvert</span>
          <span className="chip" style={{ fontSize: 11, padding: '6px 12px', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>&lt; 3 000 F</span>
        </div>

        {/* Right zoom controls */}
        <div style={{ position: 'absolute', right: 12, top: 200, display: 'flex', flexDirection: 'column', gap: 0, background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          <button style={{ width: 38, height: 38, border: 'none', background: 'transparent', borderBottom: '1px solid var(--line)' }}>+</button>
          <button style={{ width: 38, height: 38, border: 'none', background: 'transparent' }}>−</button>
        </div>

        {/* Locate */}
        <div style={{ position: 'absolute', right: 12, top: 280, background: '#fff', borderRadius: 12, padding: 9, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          <Ico name="compass" size={20}/>
        </div>

        {/* Paywall nudge — bottom card */}
        {!premium && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, right: 12,
            background: 'var(--gr-night)', color: '#fff',
            borderRadius: 16, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid rgba(200,164,78,0.3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--gr-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Ico name="lock" size={18} color="#0A0A0A"/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
                127 spawts au-delà de ton rayon
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 2 }}>
                Passe Spawter Gold pour explorer Abidjan en entier
              </div>
            </div>
            <Ico name="arrow-right" size={18} color="var(--spawt-gold)"/>
          </div>
        )}

        {premium && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, right: 12,
            background: 'var(--pure-white)',
            borderRadius: 16, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            <SpawtPin size={28} color="var(--spawt-gold)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>5 spawts visibles</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>Mode Gold · toute la ville</div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 11 }}>Liste</button>
          </div>
        )}
      </div>

      <TabBar active="map"/>
    </div>
  </Phone>
);

Object.assign(window, { SpawtNotif, SpawtSheet, SpawtCelebration, ProfilRadar, ProfilTitres, ProfilJournal, CarteMidfi });
