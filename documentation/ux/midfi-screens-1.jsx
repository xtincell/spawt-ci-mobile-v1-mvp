/* global React, Phone, Ico, CatBubble, CatIcon, SpawtPin, Stars, MatchScore, TabBar, Wordmark, PalaisRadar, StatusBar */
// SPAWT Mid-fi Screens — part 1: Onboarding, Feed, Fiche lieu

// ─────────────────────────────────────────────────────────────
// 1 · ONBOARDING — Cartes visuelles multi-select (mix B+C)
// 5 questions / "calibrage du Palais" — chaque écran propose 6 cartes avec image+label
// ─────────────────────────────────────────────────────────────

const ONB_CARDS = [
  { label: 'Garba', sub: 'thon + attiéké', alt: 0 },
  { label: 'Sushi', sub: 'japonais', alt: 4 },
  { label: 'Burger', sub: 'street américain', alt: 1 },
  { label: 'Maquis', sub: 'braisé local', alt: 0 },
  { label: 'Italien', sub: 'pâtes & pizza', alt: 1 },
  { label: 'Libanais', sub: 'mezze grillé', alt: 4 },
];

const OnbCard = ({ label, sub, alt, selected }) => (
  <div style={{
    position: 'relative', borderRadius: 16, overflow: 'hidden',
    border: selected ? '2.5px solid var(--spawt-gold)' : '1px solid var(--line)',
    boxShadow: selected ? '0 4px 16px rgba(200,164,78,0.3)' : 'none',
    transition: 'all 0.15s', aspectRatio: '1 / 1.15',
  }}>
    <div className={`food-ph alt-${alt}`} style={{ width: '100%', height: '70%', padding: 0 }}/>
    <div style={{ padding: '8px 10px', background: '#fff' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</div>
    </div>
    {selected && (
      <div style={{
        position: 'absolute', top: 8, right: 8,
        width: 22, height: 22, borderRadius: '50%',
        background: 'var(--spawt-gold)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6 L5 9 L10 3" stroke="#0A0A0A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    )}
  </div>
);

const OnbMidfi = ({ voixChat = true }) => {
  const selected = [0, 3, 4]; // garba, maquis, italien
  return (
    <Phone label="Onboarding · cartes visuelles">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar with progress */}
        <div style={{ padding: '8px 22px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Ico name="arrow-left" size={20}/>
          <div style={{ flex: 1, display: 'flex', gap: 4 }}>
            {[1,1,1,0,0].map((on, i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: on ? 'var(--spawt-black)' : 'rgba(10,10,10,0.12)' }}/>
            ))}
          </div>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-mute)', fontWeight: 500 }}>3/5</span>
        </div>

        <div style={{ padding: '0 22px 12px' }}>
          <div className="t-overline" style={{ color: 'var(--spawt-gold)', marginBottom: 8 }}>QUESTION 3 · LE TERRITOIRE</div>
          <h1 className="t-h1" style={{ marginBottom: 8 }}>Quels plats te font<br/>perdre la tête ?</h1>
          <p className="t-body" style={{ color: 'var(--ink-soft)' }}>Choisis-en au moins 3. On commence à voir ton Palais se dessiner.</p>
        </div>

        {voixChat && (
          <div style={{ padding: '4px 22px 14px' }}>
            <CatBubble>Pas de pression. Tu peux changer d'avis plus tard — moi aussi je suis indécis.</CatBubble>
          </div>
        )}

        <div className="scroll" style={{ flex: 1, padding: '0 22px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ONB_CARDS.map((c, i) => (
              <OnbCard key={i} {...c} selected={selected.includes(i)}/>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 22px 20px', background: 'linear-gradient(to top, var(--bg) 70%, transparent)', display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 0 }}>Passer</button>
          <button className="btn btn-primary" style={{ flex: 1 }}>
            Continuer
            <Ico name="arrow-right" size={16} color="#fff"/>
          </button>
        </div>
      </div>
    </Phone>
  );
};

// ─────────────────────────────────────────────────────────────
// 2 · FEED — Magazine culinaire (mix A+B)
// Hero "une de couverture" + liste numérotée style éditorial
// ─────────────────────────────────────────────────────────────

const FEED_LIST = [
  { num: '02', name: 'Saakan', cuisine: 'Maquis · Riviera 2', match: 91, dist: '1.4km', stars: 4, alt: 0 },
  { num: '03', name: 'Norima', cuisine: 'Japonais · Cocody', match: 88, dist: '2.1km', stars: 4, alt: 4 },
  { num: '04', name: 'Le Bô Zinc', cuisine: 'Bistrot · Riviera', match: 84, dist: '0.9km', stars: 3, alt: 2 },
  { num: '05', name: 'Tantie Rose', cuisine: 'Garba · Abobo Baoulé', match: 79, dist: '4.2km', stars: 3, alt: 0 },
];

const FeedMidfi = ({ stade = 'Explorateur', voixChat = true }) => {
  const stadeMessage = {
    'Touriste': 'Première semaine ? Tape ce qui te fait envie. On apprend.',
    'Explorateur': 'Ton Palais se dessine. 4 spots cette semaine, c\'est solide.',
    'Détective': 'Tu connais ta zone. Je t\'envoie 2 trouvailles à toi.',
    'Djidji': 'La meute t\'écoute. Voici ce qu\'on garde sous le coude.',
    'Guide': 'On te suit, pas l\'inverse. Voici ta sélection.',
  }[stade];

  return (
    <Phone label="Feed magazine">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Magazine masthead */}
        <div style={{ padding: '8px 22px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Wordmark size={22}/>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: 1 }}>
              Vendredi · 14 Mars · Cocody
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Ico name="search" size={20}/>
            <Ico name="bell" size={20}/>
          </div>
        </div>

        <div className="scroll" style={{ flex: 1 }}>
          {/* Hero "une de couverture" */}
          <div style={{ position: 'relative' }}>
            <div className={`food-ph alt-2`} style={{ width: '100%', height: 280, padding: 0 }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 100%)',
              }}/>
            </div>

            <div style={{ position: 'absolute', top: 14, left: 22, display: 'flex', gap: 6 }}>
              <span className="chip chip-dark" style={{ background: 'var(--spawt-gold)', color: 'var(--spawt-black)' }}>★ TROUVAILLE 01</span>
              <span className="chip" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(4px)' }}>97% match</span>
            </div>

            <div style={{ position: 'absolute', bottom: 18, left: 22, right: 22, color: '#fff' }}>
              <div className="t-overline" style={{ color: 'var(--spawt-gold-light)', marginBottom: 6 }}>MAQUIS · MARCORY</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, lineHeight: 1.0, letterSpacing: '-0.01em' }}>
                Chez Mama<br/>Yvonne
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, opacity: 0.85, marginTop: 8, lineHeight: 1.4 }}>
                « Le poisson braisé le plus honnête du quartier. Pas de chichi, juste du feu, du sel et du temps. »
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 11, opacity: 0.75 }}>
                <span><Stars value={4}/></span>
                <span>·</span>
                <span>3 200 F · 1.8km</span>
              </div>
            </div>
          </div>

          {/* Cat voice — contextual */}
          {voixChat && (
            <div style={{ padding: '14px 22px 0' }}>
              <CatBubble>{stadeMessage}</CatBubble>
            </div>
          )}

          {/* Section header */}
          <div className="s-header" style={{ paddingTop: 22 }}>
            <div>
              <div className="t-overline">La sélection du jour</div>
              <div className="t-h2" style={{ marginTop: 2 }}>Pour ton Palais</div>
            </div>
            <button className="chip chip-outline" style={{ fontSize: 10 }}>
              <Ico name="filter" size={12}/> Filtres
            </button>
          </div>

          {/* Numbered list */}
          <div style={{ padding: '0 22px 24px' }}>
            {FEED_LIST.map((item) => (
              <div key={item.num} style={{
                display: 'flex', gap: 14, padding: '14px 0',
                borderBottom: '1px solid var(--line)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28,
                  color: 'var(--spawt-gold)', lineHeight: 1, width: 36,
                }}>{item.num}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{item.name}</div>
                    <MatchScore value={item.match}/>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-mute)', marginTop: 3 }}>
                    {item.cuisine}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 11, color: 'var(--ink-soft)' }}>
                    <Stars value={item.stars} size={11}/>
                    <span style={{ color: 'var(--line-strong)' }}>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Ico name="walk" size={11}/>{item.dist}
                    </span>
                  </div>
                </div>
                <div className={`food-ph alt-${item.alt}`} style={{ width: 64, height: 64, borderRadius: 8, padding: 0, flexShrink: 0 }}/>
              </div>
            ))}

            <div style={{ paddingTop: 20, textAlign: 'center' }}>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '10px 18px' }}>
                Voir tout le numéro
              </button>
            </div>
          </div>
        </div>

        <TabBar active="home"/>
      </div>
    </Phone>
  );
};

// ─────────────────────────────────────────────────────────────
// 3 · FICHE LIEU — sans radar, ADN en tags + focus avis + mini-map
// ─────────────────────────────────────────────────────────────

const FicheMidfi = () => {
  return (
    <Phone label="Fiche lieu">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="scroll" style={{ flex: 1 }}>
          {/* Hero photo */}
          <div style={{ position: 'relative' }}>
            <div className={`food-ph alt-2`} style={{ width: '100%', height: 280, padding: 0 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.5) 100%)' }}/>
            </div>

            {/* Top actions */}
            <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
              <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Ico name="arrow-left" size={18} color="#fff"/>
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="share" size={16} color="#fff"/></button>
                <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="heart" size={16} color="#fff"/></button>
              </div>
            </div>

            {/* Photo counter */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, padding: '5px 10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', borderRadius: 100, color: '#fff', fontSize: 11, fontWeight: 500 }}>
              1 / 12
            </div>
          </div>

          {/* Title block */}
          <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--line)' }}>
            <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>MAQUIS · COCODY RIVIERA 2</div>
            <h1 className="t-display" style={{ fontSize: 32, marginTop: 6 }}>Saakan</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <Stars value={4}/>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13 }}>4.2</span>
              <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>· 184 spawts</span>
              <MatchScore value={91}/>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: 'var(--ink-soft)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="walk" size={13}/>1.4 km</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="clock" size={13}/>Ouvert · ferme 23h</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>5 000 F</span>
            </div>
          </div>

          {/* ADN du lieu — tags */}
          <div style={{ padding: '20px 22px 16px' }}>
            <div className="t-overline" style={{ marginBottom: 10 }}>L'ADN DU LIEU</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <span className="chip chip-green">● Maquis authentique</span>
              <span className="chip chip-gold">● Poisson braisé</span>
              <span className="chip">Ambiance famille</span>
              <span className="chip">Terrasse</span>
              <span className="chip">Service rapide</span>
              <span className="chip chip-outline">+4</span>
            </div>
            <div style={{ marginTop: 14, padding: 14, background: 'var(--bg-warm)', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
              « Tient sa promesse de maquis. Direct, généreux, sans détour. Va pour le poisson, reste pour l'ambiance. »
              <div style={{ marginTop: 6, fontStyle: 'normal', fontSize: 10, color: 'var(--ink-mute)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>SYNTHÈSE DE 184 AVIS</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', padding: '0 22px', gap: 24 }}>
            {['Aperçu', 'Avis (184)', 'Carte'].map((t, i) => (
              <div key={t} style={{
                padding: '12px 0',
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                color: i === 1 ? 'var(--ink)' : 'var(--ink-mute)',
                borderBottom: i === 1 ? '2.5px solid var(--spawt-gold)' : '2.5px solid transparent',
                marginBottom: -1,
              }}>{t}</div>
            ))}
          </div>

          {/* Avis focus */}
          <div style={{ padding: '18px 22px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="t-overline">3 SPAWTERS QUI TE RESSEMBLENT</div>
              <div style={{ fontSize: 11, color: 'var(--spawt-gold)', fontWeight: 700 }}>Tout voir →</div>
            </div>

            {[
              { name: 'Aïssata K.', title: 'Œil de Chat · Détective', text: 'Le poisson est nickel. Demande la sauce graine, c\'est leur secret.', stars: 5, alt: 4 },
              { name: 'Brice K.', title: 'Bouche d\'Or · Djidji', text: 'Pour un maquis du quartier, le rapport qualité/prix est imbattable. Évite le vendredi soir.', stars: 4, alt: 1 },
            ].map((r, i) => (
              <div key={i} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: i < 1 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <div className={`food-ph alt-${r.alt}`} style={{ width: 36, height: 36, borderRadius: '50%', padding: 0 }}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--spawt-gold)', fontWeight: 500, letterSpacing: '0.02em' }}>{r.title}</div>
                  </div>
                  <Stars value={r.stars} size={11}/>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{r.text}</div>
              </div>
            ))}
          </div>

          {/* Mini-map */}
          <div style={{ padding: '0 22px 28px' }}>
            <div className="t-overline" style={{ marginBottom: 10 }}>LE LIEU</div>
            <div style={{
              position: 'relative', height: 140, borderRadius: 14, overflow: 'hidden',
              background: '#e8e3d6',
              backgroundImage: `
                linear-gradient(rgba(45,107,79,0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(45,107,79,0.08) 1px, transparent 1px),
                radial-gradient(circle at 30% 50%, rgba(232,154,57,0.15), transparent 40%)
              `,
              backgroundSize: '20px 20px, 20px 20px, 100% 100%',
            }}>
              {/* Roads */}
              <div style={{ position: 'absolute', top: '40%', left: 0, right: 0, height: 4, background: '#fff' }}/>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '55%', width: 3, background: '#fff' }}/>
              <div style={{ position: 'absolute', top: '70%', left: '20%', right: '10%', height: 2, background: 'rgba(255,255,255,0.7)' }}/>
              {/* Pin */}
              <div style={{ position: 'absolute', top: '32%', left: '50%', transform: 'translate(-50%, -100%)' }}>
                <SpawtPin size={32}/>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Ico name="pin" size={13} color="var(--spawt-gold)" filled/>
              Rue J32, Riviera 2 · Cocody
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div style={{
          padding: '12px 18px 20px', background: 'var(--bg)',
          borderTop: '1px solid var(--line)',
          display: 'flex', gap: 10,
        }}>
          <button className="btn btn-secondary" style={{ flex: 0, padding: '13px 16px' }}>
            <Ico name="pin" size={16}/>
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }}>
            Spawter ici
            <Ico name="arrow-right" size={16} color="#fff"/>
          </button>
        </div>
      </div>
    </Phone>
  );
};

Object.assign(window, { OnbMidfi, FeedMidfi, FicheMidfi });
