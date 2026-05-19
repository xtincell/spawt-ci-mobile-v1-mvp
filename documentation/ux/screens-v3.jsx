// V3 — Fiche lieu sans radar (gain de place, focus avis + lieu)
function FicheV3Final() {
  return (
    <Phone label="Fiche lieu · sans radar">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ImgBox h={140} label="photo de couverture" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', flexShrink: 0 }} />
        <div style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>←</div>
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6 }}>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>♡</div>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>↗</div>
        </div>

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

        {/* ADN tags ligne (compact, pas de radar) */}
        <div style={{ padding: '8px 14px 6px', borderBottom: '1.5px dashed var(--ink-light)' }}>
          <div className="wf-label" style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>ADN du lieu</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Pill style={{ fontSize: 10 }}>local +90</Pill>
            <Pill style={{ fontSize: 10 }}>informel</Pill>
            <Pill style={{ fontSize: 10 }}>budget</Pill>
            <Pill style={{ fontSize: 10 }}>décontracté</Pill>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid var(--ink)' }}>
          {['Avis','Lieu','Photos'].map((t,i) => (
            <div key={i} className="wf-hand" style={{
              flex: 1, textAlign: 'center', padding: '6px 0', fontSize: 13,
              borderBottom: i === 0 ? '3px solid var(--ink)' : 'none',
              fontWeight: i === 0 ? 700 : 400, marginBottom: -1.5,
            }}>{t}</div>
          ))}
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Pill fill style={{ fontSize: 10 }}>copieux ·12</Pill>
            <Pill style={{ fontSize: 10 }}>à refaire ·9</Pill>
            <Pill style={{ fontSize: 10 }}>ambiance ·7</Pill>
            <Pill style={{ fontSize: 10 }}>rapide ·5</Pill>
          </div>
          {[
            { who: 'Aïcha · Detective', q: 'Le poisson braisé est sérieux. Tantie te sert comme sa fille.', s: 5, hot: true },
            { who: 'Marc · Djidji', q: 'Roots mais propre. Vaut largement le détour.', s: 5 },
            { who: 'Sika · Explorateur', q: 'Un peu d\'attente le samedi midi.', s: 4 },
          ].map((r,i) => (
            <div key={i} className="wf-box-soft" style={{ padding: 6, borderColor: r.hot ? 'var(--ink)' : undefined, borderWidth: r.hot ? 1.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>{r.who}</span>
                <Stars full={r.s} size={10} />
              </div>
              <div className="wf-text" style={{ fontSize: 11, marginTop: 2, lineHeight: 1.25 }}>« {r.q} »</div>
            </div>
          ))}
        </div>

        {/* Mini map + adresse */}
        <div className="wf-box" style={{ display: 'flex', overflow: 'hidden', flexShrink: 0, margin: '0 12px 8px', borderRadius: 6 }}>
          <div style={{ width: 90, height: 64, position: 'relative', flexShrink: 0, borderRight: '1.5px solid var(--ink)' }}>
            <FakeMap />
            <Pin x={45} y={45} fav />
          </div>
          <div style={{ padding: '6px 8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>📍 Abobo Baulé · 0.8km</div>
            <div className="wf-label" style={{ fontSize: 10, lineHeight: 1.3 }}>en face pharmacie Soleil</div>
            <div className="wf-label" style={{ fontSize: 10, color: 'var(--vert)', fontWeight: 700, marginTop: 2 }}>↗ itinéraire · 12 min</div>
          </div>
        </div>

        <div style={{ padding: '8px 12px 10px', borderTop: '1.5px solid var(--ink)', display: 'flex', gap: 6, flexShrink: 0 }}>
          <div className="wf-box" style={{ width: 44, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 14 }}>📞</div>
          <div className="wf-box" style={{ width: 44, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 14 }}>♡</div>
          <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: 13 }}>spawter ici</div>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { FicheV3Final });
