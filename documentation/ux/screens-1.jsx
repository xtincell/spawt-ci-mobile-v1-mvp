// Screens 1-3: Onboarding, Feed, Fiche lieu — 3 variations each

// ═════════════════════════════════════════════════════════════
// SCREEN 1 — ONBOARDING / CALIBRAGE PALAIS
// ═════════════════════════════════════════════════════════════

// V1 — Slider bipolaire classique (1 axe à la fois)
function OnbV1({ stade = 'touriste', voixChat = true }) {
  return (
    <Phone label="A · Slider bipolaire">
      <div style={{ padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="wf-label">Étape 3 / 5</span>
          <span className="wf-label">passer ›</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,1,1,0,0].map((v,i) => (
            <div key={i} style={{ flex: 1, height: 4, background: v ? 'var(--ink)' : 'var(--ink-faint)', borderRadius: 2 }}></div>
          ))}
        </div>
        <div className="wf-title" style={{ fontSize: 22, lineHeight: 1.15, marginTop: 4 }}>
          Tu manges plutôt…
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Caveat', fontSize: 16, marginTop: 8 }}>
          <span><span className="wf-squiggle">Racines</span></span>
          <span><span className="wf-squiggle">Horizons</span></span>
        </div>
        <div className="wf-slider" style={{ marginTop: 4 }}>
          <div className="wf-slider-thumb" style={{ left: '32%' }}></div>
        </div>
        <div className="wf-label" style={{ textAlign: 'center', fontSize: 12 }}>
          Attiéké, garba, alloco · vs · sushi, pizza, ramen
        </div>
        <div style={{ flex: 1 }}></div>
        {voixChat && <CatSays text="On apprend ton goût. Pas de mauvaise réponse." />}
        <div className="wf-pill wf-pill-fill" style={{ justifyContent: 'center', padding: '12px', fontSize: 14 }}>
          Suivant →
        </div>
      </div>
    </Phone>
  );
}

// V2 — This or That cards (swipe choices)
function OnbV2({ voixChat = true }) {
  return (
    <Phone label="B · This or That">
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span className="wf-label">3 / 5</span>
          <span className="wf-label">○○●○○</span>
        </div>
        <div className="wf-title" style={{ fontSize: 19, lineHeight: 1.15 }}>
          Quel spot te parle plus ?
        </div>
        <div style={{ display: 'flex', gap: 10, flex: 1 }}>
          <div className="wf-box-rough" style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ImgBox h={90} label="maquis" rough />
            <div className="wf-hand" style={{ fontSize: 16, fontWeight: 700 }}>Maquis du coin</div>
            <div className="wf-label" style={{ fontSize: 11 }}>plastique, braise, bruit</div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Pill style={{ fontSize: 10 }}>roots</Pill>
              <Pill style={{ fontSize: 10 }}>1500 F</Pill>
            </div>
          </div>
          <div className="wf-box-rough" style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ImgBox h={90} label="resto" rough />
            <div className="wf-hand" style={{ fontSize: 16, fontWeight: 700 }}>Table dressée</div>
            <div className="wf-label" style={{ fontSize: 11 }}>nappe, cave, calme</div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Pill style={{ fontSize: 10 }}>chic</Pill>
              <Pill style={{ fontSize: 10 }}>15k F</Pill>
            </div>
          </div>
        </div>
        <div className="wf-label" style={{ textAlign: 'center' }}>↑ tap · ou swipe →</div>
        {voixChat && <CatSays text="J'observe. Je note. Je dirai rien." />}
      </div>
    </Phone>
  );
}

// V3 — Pile de tags à attraper (multi-select grid)
function OnbV3({ voixChat = true }) {
  const tags = [
    { t: 'attiéké', on: true },
    { t: 'garba', on: true },
    { t: 'sushi', on: false },
    { t: 'pizza', on: true },
    { t: 'shawarma', on: false },
    { t: 'thieb', on: true },
    { t: 'burger', on: false },
    { t: 'brunch', on: true },
    { t: 'café', on: false },
    { t: 'cocktails', on: true },
    { t: 'pâtisserie', on: false },
    { t: 'bbq', on: true },
  ];
  return (
    <Phone label="C · Tags à attraper">
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div className="wf-label">3 / 5 · choisis-en au moins 4</div>
        <div className="wf-title" style={{ fontSize: 20, lineHeight: 1.15 }}>
          Qu'est-ce qui te fait <span className="wf-hl">saliver</span> ?
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {tags.map((tag, i) => (
            <span key={i} className={`wf-pill ${tag.on ? 'wf-pill-fill' : ''}`} style={{ fontSize: 12, padding: '6px 10px' }}>
              {tag.on && '✓ '}{tag.t}
            </span>
          ))}
        </div>
        <div className="wf-label" style={{ marginTop: 6 }}>↳ 6 sélectionnés</div>
        <div style={{ flex: 1 }}></div>
        {voixChat && <CatSays text="Pas mal. Le chat sent un Gardien du Maquis qui pointe." />}
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="wf-box" style={{ padding: '10px', flex: 1, textAlign: 'center', fontFamily: 'Caveat', fontSize: 14 }}>← retour</div>
          <div className="wf-pill wf-pill-fill" style={{ justifyContent: 'center', padding: '10px', fontSize: 14, flex: 2 }}>Suivant →</div>
        </div>
      </div>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// SCREEN 2 — FEED PERSONNALISÉ
// ═════════════════════════════════════════════════════════════

// V1 — Liste verticale dense
function FeedV1({ stade = 'detective', voixChat = true }) {
  return (
    <Phone label="A · Liste dense">
      <ScreenHeader left="≡" title="Pour Betsy" right="⚙" />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'hidden' }}>
          <Pill fill style={{ fontSize: 11 }}>Près de toi</Pill>
          <Pill style={{ fontSize: 11 }}>Brunch</Pill>
          <Pill style={{ fontSize: 11 }}>Maquis</Pill>
          <Pill style={{ fontSize: 11 }}>Soir</Pill>
        </div>
        {voixChat && (
          <div className="wf-bubble" style={{ fontSize: 13, padding: '6px 10px' }}>
            <span style={{ fontFamily: 'Caveat', fontWeight: 700 }}>chat dit · </span>
            5 spots fraîchement validés près de chez toi.
          </div>
        )}
        {[
          { name: 'Chez Tantie Rose', cuis: 'attiéké · maquis', km: '0.8', match: 92, badge: 'pépite' },
          { name: 'Le Bo Zinc', cuis: 'français · table', km: '1.4', match: 87, badge: 'institution' },
          { name: 'Coco Brunch', cuis: 'brunch · café', km: '2.1', match: 81, badge: null },
        ].map((p, i) => (
          <div key={i} className="wf-box" style={{ padding: 8, display: 'flex', gap: 8 }}>
            <ImgBox w={64} h={64} label="📷" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div className="wf-hand" style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.1 }}>{p.name}</div>
              <div className="wf-label" style={{ fontSize: 11 }}>{p.cuis} · {p.km} km</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                <Stars full={4} size={12} />
                {p.badge && <Pill or style={{ fontSize: 9, padding: '2px 6px' }}>{p.badge}</Pill>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700, color: 'var(--vert)' }}>{p.match}%</div>
              <div className="wf-label" style={{ fontSize: 10 }}>match</div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

// V2 — Cartes magazine (1 hero + petits)
function FeedV2() {
  return (
    <Phone label="B · Hero + grid">
      <ScreenHeader left="≡" title="Aujourd'hui" right="◯" />
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div className="wf-label">le chat te recommande</div>
        <div className="wf-box-rough" style={{ padding: 0, overflow: 'hidden' }}>
          <ImgBox h={130} label="hero — Chez Tantie Rose" rough />
          <div style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="wf-hand" style={{ fontSize: 17, fontWeight: 700 }}>Chez Tantie Rose</div>
              <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700, color: 'var(--vert)' }}>92%</div>
            </div>
            <div className="wf-label" style={{ fontSize: 11, marginTop: 2 }}>attiéké · 0.8 km · pépite vérifiée</div>
          </div>
        </div>
        <div className="wf-label" style={{ marginTop: 2 }}>autres pistes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="wf-box" style={{ display: 'flex', flexDirection: 'column' }}>
              <ImgBox h={60} label="📷" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }} />
              <div style={{ padding: 6 }}>
                <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>Spot #{i}</div>
                <div className="wf-label" style={{ fontSize: 10 }}>{80 + i}% · {i+0.5}km</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

// V3 — Stories horizontales + liste minimale
function FeedV3() {
  return (
    <Phone label="C · Stories + liste">
      <div style={{ padding: '12px 14px 6px' }}>
        <div className="wf-title" style={{ fontSize: 22 }}>SPAWT</div>
        <div className="wf-label">Bonsoir Betsy · Cocody</div>
      </div>
      <div style={{ padding: '0 14px 8px', display: 'flex', gap: 10, overflowX: 'hidden' }}>
        {['Près','Brunch','Soir','Roots','Date'].map((s,i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 13 }}>{i+1}</div>
            <div className="wf-label" style={{ fontSize: 10 }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '4px 14px', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { name: 'Coco Brunch', sub: '92% · 1.2km · brunch' },
          { name: 'Le Maquis 47', sub: '88% · 0.6km · roots' },
          { name: 'Sora Sushi', sub: '79% · 2.4km · table' },
          { name: 'Tantie Rose', sub: '92% · 0.8km · pépite' },
        ].map((p,i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1.5px dashed var(--ink-light)', paddingBottom: 8 }}>
            <div className="wf-hand" style={{ fontSize: 22, fontWeight: 700, width: 22 }}>{i+1}</div>
            <div style={{ flex: 1 }}>
              <div className="wf-hand" style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
              <div className="wf-label" style={{ fontSize: 11 }}>{p.sub}</div>
            </div>
            <div style={{ fontSize: 18 }}>♡</div>
          </div>
        ))}
      </div>
      <TabBar active="home" />
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// SCREEN 3 — FICHE LIEU
// ═════════════════════════════════════════════════════════════

// V1 — Photo header + ADN radar dans le scroll
function FicheV1() {
  return (
    <Phone label="A · Photo + radar">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ImgBox h={150} label="photo de couverture" style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }} />
        <div style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>←</div>
        <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 6 }}>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>♡</div>
          <div style={{ width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>↗</div>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="wf-title" style={{ fontSize: 20 }}>Chez Tantie Rose</div>
              <div className="wf-label">Maquis · Abobo Baulé · 1500 F</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wf-hand" style={{ fontSize: 24, fontWeight: 700, color: 'var(--vert)', lineHeight: 1 }}>92%</div>
              <div className="wf-label" style={{ fontSize: 10 }}>match toi</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Pill or style={{ fontSize: 10 }}>★ pépite vérifiée</Pill>
            <Pill style={{ fontSize: 10 }}>★ 4.6 · 47 avis</Pill>
          </div>
          <div className="wf-box-soft" style={{ padding: 10, marginTop: 4 }}>
            <div className="wf-label" style={{ fontSize: 12, marginBottom: 4 }}>ADN du lieu</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Radar size={150} values={[0.9, 0.3, 0.5, 0.4, 0.95]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <div className="wf-box" style={{ flex: 1, textAlign: 'center', padding: 10, fontFamily: 'Caveat', fontSize: 13 }}>📞 appeler</div>
            <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: 13 }}>spawter ici</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

// V2 — Tabs (Infos / Avis / ADN) — focus avis
function FicheV2() {
  return (
    <Phone label="B · Tabs avis">
      <ScreenHeader left="←" title="Le Bo Zinc" right="↗" />
      <div style={{ padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <Stars full={5} size={13} />
        <span className="wf-hand" style={{ fontSize: 14, fontWeight: 700 }}>4.7</span>
        <span className="wf-label">· 124 avis</span>
        <span style={{ marginLeft: 'auto' }} className="wf-hand">87%</span>
      </div>
      <div style={{ padding: '0 14px', display: 'flex', gap: 0, borderBottom: '1.5px solid var(--ink)' }}>
        {['Infos','Avis','ADN'].map((t,i) => (
          <div key={i} className="wf-hand" style={{
            flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 14,
            borderBottom: i === 1 ? '3px solid var(--ink)' : 'none',
            fontWeight: i === 1 ? 700 : 400, marginBottom: -1.5,
          }}>{t}</div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        {[
          { who: 'Aïcha · Detective', q: 'Service au top, le bar à vins est sérieux.', s: 5 },
          { who: 'Marc · Djidji', q: 'Roots mais propre. La carte mérite le détour.', s: 5 },
          { who: 'Sika · Explorateur', q: 'Trop cher pour ce qui est servi.', s: 3 },
        ].map((r,i) => (
          <div key={i} className="wf-box-soft" style={{ padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="wf-hand" style={{ fontSize: 13, fontWeight: 700 }}>{r.who}</div>
              <Stars full={r.s} size={11} />
            </div>
            <div className="wf-text" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.3 }}>« {r.q} »</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '8px 14px 10px', borderTop: '1.5px solid var(--ink)', display: 'flex', gap: 8 }}>
        <div className="wf-box" style={{ width: 44, textAlign: 'center', padding: 8 }}>♡</div>
        <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: 13 }}>j'y vais →</div>
      </div>
    </Phone>
  );
}

// V3 — Carte plein écran avec sheet en bas
function FicheV3() {
  return (
    <Phone label="C · Map sheet">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {/* fake map */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'var(--paper-2)',
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }}>
          {/* fake roads */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M-10 80 Q 80 100, 150 60 T 290 90" stroke="rgba(0,0,0,0.2)" strokeWidth="6" fill="none" />
            <path d="M-10 80 Q 80 100, 150 60 T 290 90" stroke="var(--paper)" strokeWidth="3" fill="none" />
            <path d="M40 -10 Q 60 100, 100 200 T 130 400" stroke="rgba(0,0,0,0.2)" strokeWidth="6" fill="none" />
            <path d="M40 -10 Q 60 100, 100 200 T 130 400" stroke="var(--paper)" strokeWidth="3" fill="none" />
          </svg>
          <div style={{ position: 'absolute', top: 90, left: 130, width: 28, height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 24, height: 24, background: 'var(--vert)', border: '1.5px solid var(--ink)', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }}></div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat' }}>←</div>
        {/* Bottom sheet */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'var(--paper)',
          border: '1.5px solid var(--ink)',
          borderRadius: '14px 14px 0 0',
          padding: '8px 14px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ width: 36, height: 4, background: 'var(--ink-light)', borderRadius: 2, alignSelf: 'center' }}></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <ImgBox w={70} h={70} label="📷" rough />
            <div style={{ flex: 1 }}>
              <div className="wf-title" style={{ fontSize: 17 }}>Coco Brunch</div>
              <div className="wf-label" style={{ fontSize: 11 }}>brunch · 1.2 km · 8000 F</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <Stars full={4} size={11} />
                <span className="wf-label" style={{ fontSize: 10 }}>4.3 · 32</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wf-hand" style={{ fontSize: 19, fontWeight: 700, color: 'var(--vert)' }}>89%</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill style={{ fontSize: 10 }}>copieux</Pill>
            <Pill style={{ fontSize: 10 }}>ambiance top</Pill>
            <Pill style={{ fontSize: 10 }}>insta-friendly</Pill>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="wf-box" style={{ flex: 1, textAlign: 'center', padding: 8, fontFamily: 'Caveat', fontSize: 12 }}>itinéraire</div>
            <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '8px', fontSize: 12 }}>spawter</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  OnbV1, OnbV2, OnbV3,
  FeedV1, FeedV2, FeedV3,
  FicheV1, FicheV2, FicheV3,
});
