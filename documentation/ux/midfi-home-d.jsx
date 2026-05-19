/* global React */
// SPAWT Mid-fi · HomeD — transposition mid-fi de l'option D wireframe validée
// Stories de modes (44px) + carrousel de Unes éditoriales + édito du chat + feuilleton

const HomeD = ({ stade = 'Explorateur', voixChat = true, mode = 'Manger' }) => {
  const heroes = [
    { kicker: 'WOW · 92% match', title: 'Sky Lounge fait son retour', byline: 'Cocody · 18 000 F /pers · libre 20h', medal: '★ Sélection', medalGold: true, alt: 0, quote: 'Nouveau chef. Pour impressionner sans te ruiner, c\'est ton moment.' },
    { kicker: 'CLASSE · 88% match', title: 'La Petite Cave', byline: 'Plateau · 22 000 F /pers · 4 places', medal: 'Cave à vin', alt: 1, quote: 'Ils gardent une bouteille de Saint-Émilion qui te ressemble.' },
    { kicker: 'AUTHENTIQUE · 86% match', title: 'Chez Brigitte', byline: 'Treichville · 6 000 F · ouvert tard', medal: 'Garba 2.0', alt: 2, quote: 'Le garba qui a fait pleurer ton oncle, en mieux.' },
  ];
  const [heroIdx, setHeroIdx] = React.useState(0);
  const hero = heroes[heroIdx];

  const modes = [
    { lbl: 'Manger', sub: 'à 2', glyph: '🍽' },
    { lbl: 'Boire', sub: 'crew', glyph: '🥂' },
    { lbl: 'Bouger', sub: 'solo', glyph: '↗' },
    { lbl: 'Date', sub: 'wow', glyph: '★' },
    { lbl: 'Matin', sub: '', glyph: '☀' },
  ];

  return (
    <Phone label="Home D · stories + Unes + édito">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Bandeau journal compact */}
        <div style={{ padding: '8px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CatIcon size={18}/>
            <Wordmark size={16}/>
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--ink-mute)', letterSpacing: '0.04em' }}>Mardi · Cocody · 27°</div>
        </div>

        {/* Stories de modes — sticky top */}
        <div style={{
          flexShrink: 0,
          padding: '6px 0 10px',
          borderTop: '1px solid var(--line)',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg-warm)',
        }}>
          <div className="t-overline" style={{ padding: '2px 18px 6px', fontSize: 9.5, color: 'var(--ink-mute)' }}>JE SORS POUR…</div>
          <div style={{ display: 'flex', gap: 10, padding: '0 18px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {modes.map((m, i) => {
              const active = m.lbl === mode;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 50 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    border: active ? '2px solid var(--ink)' : '1px solid var(--line-strong)',
                    background: 'var(--pure-white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, position: 'relative',
                  }}>
                    {m.glyph}
                    {active && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: 'var(--chat-green)', border: '1.5px solid var(--bg-warm)' }}/>}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: active ? 700 : 400, lineHeight: 1 }}>{m.lbl}</div>
                  {m.sub && <div style={{ fontFamily: 'var(--font-body)', fontSize: 8.5, color: 'var(--ink-mute)', lineHeight: 1 }}>{m.sub}</div>}
                </div>
              );
            })}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 44 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1px dashed var(--line-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: 'var(--ink-mute)' }}>+</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, color: 'var(--ink-mute)' }}>Plus</div>
            </div>
          </div>
        </div>

        <div className="scroll" style={{ flex: 1 }}>
          {/* Sous-titre dynamique */}
          <div style={{ padding: '12px 18px 4px' }}>
            <div className="t-overline" style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>
              {mode.toUpperCase()} · À 2 · CE SOIR — LE CHAT PROPOSE
            </div>
          </div>

          {/* Carrousel de Unes — swipable */}
          <div style={{ position: 'relative', padding: '8px 0 0' }}>
            <div style={{
              display: 'flex', gap: 12, padding: '0 18px',
              overflowX: 'auto', scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
            }}>
              {heroes.map((h, i) => (
                <div key={i}
                  onClick={() => setHeroIdx(i)}
                  style={{ flexShrink: 0, width: 'calc(100% - 36px)', scrollSnapAlign: 'center', position: 'relative', borderRadius: 16, overflow: 'hidden', cursor: 'pointer' }}>
                  <div className={`food-ph alt-${h.alt}`} style={{ width: '100%', height: 240, padding: 0, borderRadius: 16, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55) 100%)' }}/>
                    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 14, color: '#fff' }}>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.95, fontWeight: 600 }}>{h.kicker}</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 4 }}>{h.title}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, opacity: 0.92, marginTop: 4 }}>{h.byline}</div>
                    </div>
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      background: h.medalGold ? 'var(--spawt-gold)' : 'rgba(255,255,255,0.92)',
                      color: 'var(--ink)',
                      padding: '4px 10px', borderRadius: 100,
                      fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700,
                      boxShadow: 'var(--sh-s)',
                    }}>{h.medal}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Indicateurs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
              {heroes.map((_, i) => (
                <div key={i} style={{
                  width: i === heroIdx ? 18 : 6, height: 6, borderRadius: 3,
                  background: i === heroIdx ? 'var(--ink)' : 'var(--line-strong)',
                  transition: 'all 0.2s',
                }}/>
              ))}
            </div>
          </div>

          {/* Édito du chat — réfère à la Une visible */}
          {voixChat && (
            <div style={{ padding: '14px 18px 4px' }}>
              <div style={{
                background: 'var(--ink)', color: 'var(--spawt-gold-light)',
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <CatIcon size={20} color="var(--spawt-gold)"/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 14.5, lineHeight: 1.35, fontStyle: 'italic' }}>
                    « {hero.quote} »
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 6, letterSpacing: '0.04em' }}>
                    — le chat, à toi seul
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--ink-mute)', marginTop: 6, fontStyle: 'italic', textAlign: 'center' }}>
                ← swipe pour voir les autres propositions
              </div>
            </div>
          )}

          {/* Feuilleton — Et aussi, dans le mode */}
          <div style={{ padding: '14px 18px 8px', borderTop: '1px solid var(--line)', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>Et aussi, dans le mode</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--ink-mute)' }}>3 adresses</div>
            </div>

            {[
              { kicker: 'AUTHENTIQUE · 86%', title: 'Chez Brigitte · garba revisité', meta: 'Treichville · 6 000 F', stars: '4.5', alt: 2 },
              { kicker: 'CLASSE · 81%', title: 'La Petite Cave', meta: 'Plateau · 22 000 F', stars: '4.4', alt: 1 },
              { kicker: 'NOUVEAU · à goûter', title: "La Cantinière · brunch d'auteur", meta: 'Cocody · 9 000 F', stars: '—', alt: 4 },
            ].map((c, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < 2 ? '1px solid var(--line)' : 'none',
              }}>
                <div className={`food-ph alt-${c.alt}`} style={{ width: 64, height: 64, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-overline" style={{ fontSize: 9.5, color: 'var(--ink-mute)' }}>{c.kicker}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>{c.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, fontWeight: 700, color: 'var(--spawt-gold)' }}>★ {c.stars}</span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'var(--ink-mute)' }}>{c.meta}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pavé édito du chat — sur changement de mode */}
          <div style={{ margin: '14px 18px 0', padding: '14px 16px', background: 'var(--bg-warm)', borderRadius: 14, borderLeft: '3px solid var(--spawt-gold)' }}>
            <div className="t-overline" style={{ fontSize: 9.5, color: 'var(--ink-mute)', letterSpacing: '0.12em' }}>EDITO · LE CHAT</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, lineHeight: 1.25, marginTop: 4, fontStyle: 'italic' }}>
              « Change de mode là-haut, je te réécris la une. »
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '16px 0 24px', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.06em' }}>
            ~ tu es à jour ~
          </div>
        </div>

        <TabBar active="home"/>
      </div>
    </Phone>
  );
};

Object.assign(window, { HomeD });
