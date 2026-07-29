// V2 — Mixed wireframes per user choices

// ═════════════════════════════════════════════════════════════
// 1 · ONBOARDING — Mix B + C
// Cartes visuelles multi-select (image card pour chaque option)
// ═════════════════════════════════════════════════════════════
function OnbMix({ voixChat = true }) {
  const cards = [
    { t: 'Maquis du coin', s: 'roots · 1500F', on: true, l: 'maquis' },
    { t: 'Brunch terrasse', s: 'aesthetic · 8k', on: true, l: 'brunch' },
    { t: 'Table dressée', s: 'chic · 15k', on: false, l: 'resto' },
    { t: 'Sushi spot', s: 'horizons · 12k', on: true, l: 'sushi' },
    { t: 'Beach club', s: 'événement', on: false, l: 'beach' },
    { t: 'Garba bord de route', s: 'roots · 800F', on: true, l: 'garba' },
  ];
  return (
    <Phone label="A · Cartes visuelles (B+C)">
      <div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="wf-label">3 / 5</span>
          <span className="wf-label">passer ›</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,1,1,0,0].map((v,i) => (
            <div key={i} style={{ flex: 1, height: 4, background: v ? 'var(--ink)' : 'var(--ink-faint)', borderRadius: 2 }}></div>
          ))}
        </div>
        <div className="wf-title" style={{ fontSize: 20, lineHeight: 1.15, marginTop: 4 }}>
          Tu choisirais lesquels ?
        </div>
        <div className="wf-label" style={{ fontSize: 11, marginTop: -4 }}>tap autant que tu veux · min 2</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, flex: 1, overflow: 'hidden' }}>
          {cards.map((c, i) => (
            <div key={i} className="wf-box-rough" style={{
              padding: 5, display: 'flex', flexDirection: 'column', gap: 3,
              background: c.on ? '#fff7d6' : 'var(--paper)',
              borderWidth: c.on ? 2 : 1.5,
              position: 'relative',
            }}>
              <ImgBox h={58} label={c.l} rough />
              {c.on && <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, background: 'var(--vert)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 13, fontWeight: 700, color: '#fff' }}>✓</div>}
              <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{c.t}</div>
              <div className="wf-label" style={{ fontSize: 10 }}>{c.s}</div>
            </div>
          ))}
        </div>
        {voixChat && <CatSays text="4 sélectionnés. Le chat sent un Pisteur qui s'éveille." />}
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="wf-box" style={{ padding: '10px', flex: 1, textAlign: 'center', fontFamily: 'Caveat', fontSize: 13 }}>← retour</div>
          <div className="wf-pill wf-pill-fill" style={{ justifyContent: 'center', padding: '10px', fontSize: 13, flex: 2 }}>Suivant →</div>
        </div>
      </div>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// 2 · FEED — Mix A + B style magazine culinaire
// Une de couverture grand titre + densité ensuite
// ═════════════════════════════════════════════════════════════
function FeedMix({ stade = 'touriste', voixChat = true }) {
  return (
    <Phone label="A · Magazine + dense">
      <div style={{ padding: '14px 14px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1.5px solid var(--ink)' }}>
        <div>
          <div className="wf-title" style={{ fontSize: 22, letterSpacing: 1, lineHeight: 1 }}>SPAWT</div>
          <div className="wf-label" style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: 2, textTransform: 'uppercase' }}>N° 47 · vendredi</div>
        </div>
        <div className="wf-label" style={{ fontSize: 11 }}>Cocody · 28°</div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Cover story */}
        <div style={{ padding: '10px 14px 12px', borderBottom: '1.5px solid var(--ink)' }}>
          <div className="wf-label" style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--rouge)', marginBottom: 4 }}>★ une du jour</div>
          <ImgBox h={120} label="hero — photo couverture" rough style={{ marginBottom: 8 }} />
          <div className="wf-title" style={{ fontSize: 24, lineHeight: 1.05, marginBottom: 4 }}>
            Chez Tantie Rose,<br/>l'attiéké qui fait taire la table
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <Pill or style={{ fontSize: 9, padding: '2px 6px' }}>★ pépite</Pill>
            <span className="wf-label" style={{ fontSize: 11 }}>Abobo Baulé · 0.8 km</span>
            <span className="wf-hand" style={{ fontSize: 18, fontWeight: 700, color: 'var(--vert)', marginLeft: 'auto' }}>92%</span>
          </div>
        </div>

        {/* Dense list rest */}
        <div className="wf-label" style={{ padding: '8px 14px 4px', fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          ↳ aussi pour toi ce soir
        </div>
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          {[
            { name: 'Le Bo Zinc', cuis: 'français · table', km: '1.4', match: 87, badge: 'institution' },
            { name: 'Coco Brunch', cuis: 'brunch · café', km: '2.1', match: 81, badge: null },
            { name: 'Maquis 47', cuis: 'roots · braise', km: '0.6', match: 84, badge: null },
          ].map((p, i) => (
            <div key={i} style={{ padding: '8px 0', display: 'flex', gap: 10, alignItems: 'center', borderBottom: i < 2 ? '1.5px dashed var(--ink-light)' : 'none' }}>
              <div className="wf-hand" style={{ fontSize: 22, fontWeight: 700, width: 22, color: 'var(--ink-soft)' }}>{i + 2}</div>
              <ImgBox w={48} h={48} label="📷" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wf-hand" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{p.name}</div>
                <div className="wf-label" style={{ fontSize: 10 }}>{p.cuis} · {p.km}km</div>
              </div>
              <div className="wf-hand" style={{ fontSize: 16, fontWeight: 700, color: 'var(--vert)' }}>{p.match}%</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// 3 · FICHE LIEU — Mix A + B + localisation
// Photo header + radar ADN + tabs avis + mini map
// ═════════════════════════════════════════════════════════════
function FicheMix() {
  return (
    <Phone label="A · Photo + ADN + avis + map">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Photo header */}
        <ImgBox h={130} label="photo de couverture" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', flexShrink: 0 }} />
        <div style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>←</div>
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6 }}>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>♡</div>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>↗</div>
        </div>

        {/* Title block */}
        <div style={{ padding: '10px 14px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1.5px solid var(--ink)' }}>
          <div style={{ flex: 1 }}>
            <div className="wf-title" style={{ fontSize: 19, lineHeight: 1.05 }}>Chez Tantie Rose</div>
            <div className="wf-label" style={{ fontSize: 11, marginTop: 2 }}>Maquis · Abobo Baulé · 1500F</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <Stars full={5} size={11} />
              <span className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>4.6</span>
              <span className="wf-label" style={{ fontSize: 10 }}>· 47 avis</span>
              <Pill or style={{ fontSize: 9, padding: '2px 5px', marginLeft: 4 }}>pépite</Pill>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="wf-hand" style={{ fontSize: 24, fontWeight: 700, color: 'var(--vert)', lineHeight: 1 }}>92%</div>
            <div className="wf-label" style={{ fontSize: 9 }}>match toi</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid var(--ink)' }}>
          {['ADN','Avis','Lieu'].map((t,i) => (
            <div key={i} className="wf-hand" style={{
              flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 13,
              borderBottom: i === 0 ? '3px solid var(--ink)' : 'none',
              fontWeight: i === 0 ? 700 : 400, marginBottom: -1.5,
            }}>{t}</div>
          ))}
        </div>

        {/* Tab content — ADN view first, then avis preview, then mini map */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
          {/* ADN radar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Radar size={110} values={[0.9, 0.3, 0.5, 0.4, 0.95]}
              labels={['Local','Inform.','Budget','Pop.','Décont.']}
              showLabels={true}
            />
            <div style={{ flex: 1, fontSize: 11, fontFamily: 'Kalam, cursive', lineHeight: 1.3 }}>
              <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>Roots & populaire</div>
              <div className="wf-label" style={{ fontSize: 10, marginTop: 2 }}>Local +90 · Informel −70 · Budget −85</div>
              <div className="wf-label" style={{ fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>« attiéké généreux, ambiance taule chaleureuse »</div>
            </div>
          </div>

          {/* Top avis preview */}
          <div className="wf-box-soft" style={{ padding: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>Aïcha · Detective</span>
              <Stars full={5} size={10} />
            </div>
            <div className="wf-text" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.25 }}>
              « Le poisson braisé est sérieux. Tantie te sert comme sa fille. »
            </div>
          </div>

          {/* Mini map + adresse */}
          <div className="wf-box" style={{ display: 'flex', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: 90, height: 70, position: 'relative', flexShrink: 0, borderRight: '1.5px solid var(--ink)' }}>
              <FakeMap />
              <Pin x={45} y={50} fav />
            </div>
            <div style={{ padding: '6px 8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>📍 Abobo Baulé</div>
              <div className="wf-label" style={{ fontSize: 10, lineHeight: 1.3 }}>en face pharmacie Soleil, après le carrefour</div>
              <div className="wf-label" style={{ fontSize: 10, color: 'var(--vert)', fontWeight: 700, marginTop: 2 }}>↗ itinéraire · 12 min</div>
            </div>
          </div>
        </div>

        {/* Sticky footer CTAs */}
        <div style={{ padding: '8px 12px 10px', borderTop: '1.5px solid var(--ink)', display: 'flex', gap: 6, flexShrink: 0 }}>
          <div className="wf-box" style={{ width: 44, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 14 }}>📞</div>
          <div className="wf-box" style={{ width: 44, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 14 }}>♡</div>
          <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: 13 }}>spawter ici</div>
        </div>
      </div>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// 6 · CARTE — A retenue, refinement
// Cercle 3km avec flou, plus de polish
// ═════════════════════════════════════════════════════════════
function CarteRetenue({ premium = false }) {
  return (
    <Phone label="A · Cercle 3km + flou (retenue)">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <FakeMap />

        {/* zone 3km */}
        {!premium && (
          <>
            <div style={{
              position: 'absolute', left: '50%', top: '48%',
              width: 220, height: 220,
              transform: 'translate(-50%, -50%)',
              border: '2.5px dashed var(--vert)',
              borderRadius: '50%',
              background: 'rgba(76,174,110,0.10)',
              boxShadow: '0 0 0 1000px rgba(0,0,0,0.04)',
            }}></div>
            <div className="wf-label" style={{
              position: 'absolute', left: '50%', top: '48%',
              transform: 'translate(-50%, 105px)',
              fontSize: 11, background: 'var(--paper)',
              padding: '3px 8px',
              border: '1.5px solid var(--vert)',
              borderRadius: 4, color: 'var(--vert)', fontWeight: 700,
            }}>
              ◯ 3 km · ta zone
            </div>
          </>
        )}

        {/* you-are-here marker */}
        <div style={{
          position: 'absolute', left: '50%', top: '48%',
          transform: 'translate(-50%, -50%)',
          width: 16, height: 16,
          background: 'var(--rouge)',
          border: '2px solid var(--paper)',
          borderRadius: '50%',
          boxShadow: '0 0 0 2px var(--ink)',
        }}></div>

        {/* pins inside zone */}
        <Pin x={155} y={235} fav />
        <Pin x={185} y={278} />
        <Pin x={120} y={275} />
        <Pin x={170} y={315} />
        <Pin x={100} y={210} />

        {/* pins outside (blurred) */}
        <Pin x={45} y={130} blur={!premium} color="or" />
        <Pin x={235} y={155} blur={!premium} color="or" />
        <Pin x={250} y={355} blur={!premium} color="or" />
        <Pin x={50} y={420} blur={!premium} color="or" />
        <Pin x={210} y={420} blur={!premium} color="or" />

        {/* search bar */}
        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 6 }}>
          <div className="wf-box" style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Caveat', fontSize: 12, boxShadow: '2px 2px 0 rgba(0,0,0,0.08)' }}>
            <span>🔍</span>
            <span style={{ color: 'var(--ink-light)' }}>Cherche un quartier, un plat...</span>
          </div>
          <div className="wf-box" style={{ width: 36, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 13, boxShadow: '2px 2px 0 rgba(0,0,0,0.08)' }}>≡</div>
        </div>

        {/* filter chips */}
        <div style={{ position: 'absolute', top: 56, left: 14, right: 14, display: 'flex', gap: 6, overflowX: 'hidden' }}>
          <Pill fill style={{ fontSize: 10 }}>tous</Pill>
          <Pill style={{ fontSize: 10 }}>maquis</Pill>
          <Pill style={{ fontSize: 10 }}>brunch</Pill>
          <Pill style={{ fontSize: 10 }}>ouvert</Pill>
        </div>

        {/* zoom controls */}
        <div style={{ position: 'absolute', right: 14, bottom: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="wf-box" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--paper)' }}>+</div>
          <div className="wf-box" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: 'var(--paper)' }}>−</div>
          <div className="wf-box" style={{ width: 32, height: 32, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, background: 'var(--paper)' }}>⊕</div>
        </div>

        {/* paywall nudge */}
        {!premium && (
          <div style={{
            position: 'absolute', left: 14, right: 14, bottom: 14,
            background: 'var(--paper)',
            border: '1.5px solid var(--ink)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex', gap: 10, alignItems: 'center',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.12)',
          }}>
            <div style={{ width: 36, height: 36, background: 'var(--or)', border: '1.5px solid var(--ink)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700, fontSize: 18 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div className="wf-hand" style={{ fontSize: 13, fontWeight: 700 }}>23 spots cachés ailleurs</div>
              <div className="wf-label" style={{ fontSize: 10 }}>Gold · 2 950F/mois · tout Abidjan</div>
            </div>
            <div className="wf-pill wf-pill-or" style={{ fontSize: 11 }}>passer Gold</div>
          </div>
        )}
      </div>
      <TabBar active="map" />
    </Phone>
  );
}

Object.assign(window, { OnbMix, FeedMix, FicheMix, CarteRetenue });
