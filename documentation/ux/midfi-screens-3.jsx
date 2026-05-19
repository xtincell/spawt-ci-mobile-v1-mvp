/* global React, Phone, Ico, CatBubble, CatIcon, Stars, MatchScore, TabBar, Wordmark, PalaisRadar */
// SPAWT Mid-fi Screens — part 3: Home contextuel (CŒUR du produit) + flows mode

// Shared big choice tile — used in Home, Avec, Solo, Squad
const BigTile = ({ emoji, label, sub, accent, onClick, full = false }) => (
  <div onClick={onClick} style={{
    flex: full ? 'none' : 1,
    width: full ? '100%' : 'auto',
    background: accent === 'gold' ? 'var(--gr-gold)'
              : accent === 'dark' ? 'var(--gr-night)'
              : 'var(--pure-white)',
    color: accent === 'dark' ? '#fff' : 'var(--ink)',
    border: accent ? 'none' : '1px solid var(--line-strong)',
    borderRadius: 16,
    padding: '18px 16px',
    display: 'flex', alignItems: 'center', gap: 14,
    cursor: 'pointer',
    boxShadow: accent === 'gold' ? '0 4px 16px rgba(200,164,78,0.25)' : '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{emoji}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, lineHeight: 1.15 }}>{label}</div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, opacity: accent === 'dark' ? 0.7 : 0.55, marginTop: 3, lineHeight: 1.35 }}>{sub}</div>
      )}
    </div>
    <Ico name="chevron-right" size={18} color={accent === 'dark' ? 'rgba(255,255,255,0.5)' : 'var(--ink-mute)'}/>
  </div>
);

const SmallTile = ({ emoji, label, sub, selected, onClick }) => (
  <div onClick={onClick} style={{
    background: selected ? 'var(--spawt-black)' : 'var(--pure-white)',
    color: selected ? '#fff' : 'var(--ink)',
    border: selected ? '2px solid var(--spawt-black)' : '1px solid var(--line-strong)',
    borderRadius: 14,
    padding: '14px 12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 6, textAlign: 'center', minHeight: 92, cursor: 'pointer',
  }}>
    <div style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, lineHeight: 1.15 }}>{label}</div>
    {sub && <div style={{ fontSize: 9.5, opacity: selected ? 0.7 : 0.55, lineHeight: 1.3 }}>{sub}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────
// HOME — Mode contextuel (entrée principale)
// ─────────────────────────────────────────────────────────────

const HomeContextuel = ({ stade = 'Explorateur', voixChat = true, empty = false }) => (
  <Phone label="Home · mode contextuel">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.05em' }}>
            ☀️ Mardi · 12:47
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, lineHeight: 1.1, marginTop: 4 }}>
            Salut Betsy,
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', marginTop: 2 }}>
            où tu manges ?
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div className="food-ph alt-3" style={{ width: 42, height: 42, borderRadius: '50%', padding: 0, border: '2px solid var(--spawt-gold)' }}/>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '0 22px 22px' }}>
        {/* Insight band */}
        <div style={{
          background: 'var(--bg-warm)', borderRadius: 12, padding: '10px 14px',
          marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 11.5, color: 'var(--ink-soft)',
        }}>
          <Ico name="clock" size={14} color="var(--spawt-gold)"/>
          <span>En moyenne, tu trouves en <strong>1min 23s</strong></span>
        </div>

        {/* THE 3 BIG TILES — mode contextuel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          <BigTile emoji="🍽️" label="Solo rapide" sub="500m · trouve en 30s" accent="dark"/>
          <BigTile emoji="👥" label="Avec quelqu'un" sub="Date · Biz · Squad · Famille"/>
          <BigTile emoji="📍" label="Autour de toi" sub="Tout ce qui est ouvert maintenant"/>
        </div>

        {empty ? (
          <div style={{
            background: 'var(--bg-warm)', borderRadius: 14, padding: '22px 18px',
            textAlign: 'center', border: '1px dashed var(--line-strong)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>🐾</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>Pas encore de spawte</div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4, lineHeight: 1.5 }}>
              Tape un mode au-dessus. Je te trouve un truc en 90 secondes.
            </div>
          </div>
        ) : (
          <>
            {/* Ton chat te suggère */}
            {voixChat && (
              <div style={{ marginBottom: 14 }}>
                <CatBubble>3 spots qui collent à ton humeur du moment. Pas plus, pas moins.</CatBubble>
              </div>
            )}

            <div className="t-overline" style={{ marginBottom: 10 }}>POUR TOI · MAINTENANT</div>
            {[
              { name: 'Chez Maman Africa', stars: 4.7, sub: 'Ivoirien · 800m', tag: 'Ton style: roots authentique', alt: 0 },
              { name: 'Le Nomade', stars: 4.5, sub: 'Fusion · 1.2km', tag: 'Nouveau, tu testes ?', alt: 1 },
              { name: 'Juice Factory', stars: 4.6, sub: 'Healthy · 400m', tag: 'Tu y vas 2×/mois déjà', alt: 4 },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < 2 ? '1px solid var(--line)' : 'none',
              }}>
                <div className={`food-ph alt-${s.alt}`} style={{ width: 56, height: 56, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>★ {s.stars} · {s.sub}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--spawt-gold)', marginTop: 4, fontWeight: 500, fontStyle: 'italic' }}>« {s.tag} »</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <TabBar active="home"/>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// Avec quelqu'un — choix du contexte
// ─────────────────────────────────────────────────────────────

const HomeAvec = () => (
  <Phone label="Avec quelqu'un · contexte">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Ico name="arrow-left" size={20}/>
        <div>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>ÉTAPE 1/2</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Avec quelqu'un</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 22px 22px' }}>
        <div className="t-h1" style={{ marginBottom: 6 }}>C'est pour quoi ?</div>
        <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>
          Le contexte change tout. Dis-moi.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SmallTile emoji="💕" label="Date" sub="Dîner romantique"/>
          <SmallTile emoji="💼" label="Business" sub="Repas pro" selected/>
          <SmallTile emoji="🍻" label="Squad" sub="Sortie potes"/>
          <SmallTile emoji="👨‍👩‍👧" label="Famille" sub="Avec les enfants"/>
        </div>

        <div style={{ marginTop: 22, padding: 14, background: 'var(--bg-warm)', borderRadius: 12, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          <strong>Pourquoi on demande :</strong> un date n'a pas les mêmes critères qu'un repas business — l'ambiance, le bruit, le budget, tout change.
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          Continuer · Business
          <Ico name="arrow-right" size={16} color="#fff"/>
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// Niveau d'impression (Date / Biz / Famille → 3 niveaux)
// ─────────────────────────────────────────────────────────────

const HomeImpress = () => (
  <Phone label="Niveau · Date">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Ico name="arrow-left" size={20}/>
        <div>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>ÉTAPE 2/2 · DATE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Quel niveau ?</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '4px 22px 22px' }}>
        <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 18 }}>
          Trois ambiances. Trois budgets. À toi de voir.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            {
              emoji: '🌟', label: 'Wow Factor', accent: 'gold',
              desc: 'Rooftop, vue, expérience mémorable',
              budget: '15-25K FCFA / pers',
              selected: true,
            },
            {
              emoji: '✨', label: 'Classe mais cool',
              desc: 'Ambiance intime, qualité garantie',
              budget: '8-15K FCFA / pers',
            },
            {
              emoji: '🍷', label: 'Authentique',
              desc: 'Roots mais propre, cuisine vraie',
              budget: '4-8K FCFA / pers',
            },
          ].map((t, i) => (
            <div key={i} style={{
              background: t.selected ? 'var(--gr-gold)' : 'var(--pure-white)',
              border: t.selected ? 'none' : '1px solid var(--line-strong)',
              borderRadius: 16, padding: '18px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: t.selected ? '0 4px 16px rgba(200,164,78,0.25)' : 'none',
            }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>{t.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 3, lineHeight: 1.4 }}>{t.desc}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: t.selected ? 'var(--ink)' : 'var(--ink-mute)', marginTop: 5, fontWeight: 600, letterSpacing: '0.04em' }}>
                  💰 {t.budget}
                </div>
              </div>
              {t.selected && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: 'var(--spawt-black)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke="var(--spawt-gold)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          Trouve-moi 3 spots
          <Ico name="arrow-right" size={16} color="#fff"/>
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// Solo — mood
// ─────────────────────────────────────────────────────────────

const HomeSolo = () => (
  <Phone label="Solo · mood">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>SOLO RAPIDE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>📍 500m autour de toi</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '4px 22px 22px' }}>
        <div className="t-h1" style={{ marginBottom: 6 }}>Mood du moment ?</div>
        <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>
          Tape ce qui te parle. On part de là.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <SmallTile emoji="🍗" label="Lourd"/>
          <SmallTile emoji="🥗" label="Léger" selected/>
          <SmallTile emoji="🍜" label="Chaud"/>
          <SmallTile emoji="🌍" label="Local"/>
          <SmallTile emoji="💰" label="Budget"/>
          <SmallTile emoji="⚡" label="Rapide"/>
        </div>

        <div style={{ marginTop: 22 }}>
          <div className="t-overline" style={{ marginBottom: 8 }}>OU TAPE EN VITE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['attiéké', 'bissap', 'shawarma', 'salade', 'burger', 'jus pressé'].map(t => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          Trouve-moi · 3 spots léger
          <Ico name="arrow-right" size={16} color="#fff"/>
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// Squad — combien + ambiance
// ─────────────────────────────────────────────────────────────

const HomeSquad = () => (
  <Phone label="Squad · config">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Ico name="arrow-left" size={20}/>
        <div>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>SQUAD</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>Sortie potes</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '4px 22px 22px' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>VOUS ÊTES COMBIEN ?</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
          {['2-4', '5-8', '9-15', '15+'].map((n, i) => (
            <div key={n} style={{
              padding: '14px 6px',
              background: i === 1 ? 'var(--spawt-black)' : 'var(--pure-white)',
              color: i === 1 ? '#fff' : 'var(--ink)',
              border: i === 1 ? '2px solid var(--spawt-black)' : '1px solid var(--line-strong)',
              borderRadius: 12, textAlign: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
            }}>{n}</div>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>C'EST QUOI L'AMBIANCE ?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <SmallTile emoji="🍖" label="Bouffe d'abord" sub="Repas central" selected/>
          <SmallTile emoji="🍻" label="Drinks + grignoter" sub="Tapas style"/>
          <SmallTile emoji="🎉" label="Ambiance chaude" sub="Musique forte"/>
          <SmallTile emoji="🌴" label="Chill" sub="Tranquille"/>
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          Trouve-moi · Squad 5-8 · Bouffe
          <Ico name="arrow-right" size={16} color="#fff"/>
        </button>
      </div>
    </div>
  </Phone>
);

Object.assign(window, { BigTile, SmallTile, HomeContextuel, HomeAvec, HomeImpress, HomeSolo, HomeSquad });
