// 3 options wireframe — Home/Feed scrollable unique
// Style éditorial sketchy N&B + accents or/vert chat
// Divergence : hiérarchie + logique de feed + placement Mode contextuel & CTA Spawter

// ─────────────────────────────────────────────────────────────
// Briques d'écran (réutilisées dans les 3 options)
// ─────────────────────────────────────────────────────────────

function StatusBarLight() {
  return (
    <div className="wf-statusbar" style={{ borderBottom: '1.5px dashed var(--ink-light)' }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontFamily: 'Caveat', fontSize: 12 }}>•••</span>
        <span style={{ width: 16, height: 9, border: '1.5px solid var(--ink)', borderRadius: 2, position: 'relative' }}>
          <span style={{ position: 'absolute', inset: 1, background: 'var(--ink)', width: '70%', borderRadius: 1 }}></span>
        </span>
      </span>
    </div>
  );
}

// Photo placeholder spécial éditorial (avec titre suggéré)
function EditorialImg({ h = 200, label = 'photo', kicker, title, byline, style = {} }) {
  return (
    <div className="wf-img wf-img-rough" style={{ width: '100%', height: h, position: 'relative', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 0, ...style }}>
      {(kicker || title || byline) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '10px 12px', background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.45) 100%)', color: '#fbf9f4' }}>
          {kicker && <div style={{ fontFamily: 'Caveat', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.95 }}>{kicker}</div>}
          {title && <div style={{ fontFamily: 'Caveat', fontSize: 22, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{title}</div>}
          {byline && <div style={{ fontFamily: 'Kalam', fontSize: 11, opacity: 0.9, marginTop: 4 }}>{byline}</div>}
        </div>
      )}
      <span style={{ position: 'absolute', top: 8, left: 10, fontFamily: 'Caveat', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{label}</span>
    </div>
  );
}

// Petit avatar de chat éditorial (signe de la maison)
function CatGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M4 8 L4 18 Q4 21 7 21 L17 21 Q20 21 20 18 L20 8 L16 11 L8 11 Z" fill="none" stroke="#1a1a1a" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="9" cy="15" r="0.8" fill="#1a1a1a"/>
      <circle cx="15" cy="15" r="0.8" fill="#1a1a1a"/>
      <path d="M11 17 Q12 18 13 17" fill="none" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════
// OPTION A · MAGAZINE ÉDITORIAL
// "Une" verticale haute (60%), Mode contextuel sticky bas, FAB Spawter
// Hiérarchie : émotion d'abord (l'image, le titre), action ensuite
// ═════════════════════════════════════════════════════════════
function HomeFeedA() {
  return (
    <Phone label="A · Magazine — la Une d'abord" time="9:41">
      {/* Bandeau journal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 6px', borderBottom: '1.5px solid var(--ink)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CatGlyph size={16}/>
          <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>SPAWT</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="wf-label" style={{ fontSize: 11 }}>Mardi · Cocody</span>
          <div style={{ width: 24, height: 24, border: '1.5px solid var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 11 }}>B</div>
        </div>
      </div>

      <div className="wf-screen" style={{ overflowY: 'auto', overflowX: 'hidden', display: 'block' }}>
        {/* La Une — full bleed */}
        <div style={{ position: 'relative' }}>
          <EditorialImg
            h={310}
            label="hero"
            kicker="LE SPAWT DU JOUR"
            title="Sky Lounge fait son retour"
            byline="Cocody · Wow factor · 18 paws cette semaine"
          />
          {/* Médaille premium en coin */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--or)', border: '1.5px solid var(--ink)', padding: '3px 8px', fontFamily: 'Caveat', fontSize: 12, fontWeight: 700, transform: 'rotate(2deg)' }}>★ Sélection</div>
        </div>

        {/* Baseline du chat */}
        <div style={{ padding: '10px 14px', borderBottom: '1.5px solid var(--ink)', background: 'var(--paper-2)' }}>
          <div style={{ fontFamily: 'Caveat', fontSize: 14, lineHeight: 1.25 }}>
            <span style={{ fontWeight: 700 }}>« </span>
            Le rooftop a changé de chef. Si tu veux impressionner sans te ruiner, c'est ton moment.
            <span style={{ fontWeight: 700 }}> »</span>
          </div>
          <div style={{ fontFamily: 'Caveat', fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>— le chat, à toi seul</div>
        </div>

        {/* "Et aussi" — feuilleton de 3 cards éditoriales */}
        <div style={{ padding: '14px 14px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="wf-title" style={{ fontSize: 17 }}>Et aussi, à 5 min</div>
            <span className="wf-label">3 adresses</span>
          </div>

          {[
            { kicker: 'AUTHENTIQUE', title: "Chez Madeleine · poisson braisé", note: '4.6', dist: '700 m', tone: 'wf-pill-vert', cat: 'maquis' },
            { kicker: 'CLASSE', title: "Le Petit Verdot · cave à vin", note: '4.4', dist: '1,2 km', tone: '', cat: 'date' },
            { kicker: 'NOUVEAU', title: "La Cantinière · brunch d'auteur", note: 'à goûter', dist: '900 m', tone: 'wf-pill-or', cat: 'matin' },
          ].map((c, i) => (
            <div key={i} className="wf-box-rough" style={{ padding: 10, marginBottom: 10, display: 'flex', gap: 10, transform: `rotate(${i % 2 ? 0.3 : -0.2}deg)` }}>
              <ImgBox w={64} h={64} label="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Caveat', fontSize: 11, letterSpacing: 1, color: 'var(--ink-soft)' }}>{c.kicker}</div>
                <div style={{ fontFamily: 'Caveat', fontSize: 16, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <Pill style={{ fontSize: 10 }}>★ {c.note}</Pill>
                  <span className="wf-label" style={{ fontSize: 11 }}>{c.dist}</span>
                  <span className="wf-label" style={{ fontSize: 11 }}>· {c.cat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pavé éditorial : un mot du chat */}
        <div style={{ margin: '4px 14px 14px', borderTop: '1.5px solid var(--ink)', borderBottom: '1.5px solid var(--ink)', padding: '12px 0' }}>
          <div style={{ fontFamily: 'Caveat', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>EDITO · le chat</div>
          <div style={{ fontFamily: 'Caveat', fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>
            « Cette semaine, on sort du périph d'Abidjan. Yopougon a quatre choses à te dire. »
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <Pill or>Lire la sélection →</Pill>
          </div>
        </div>

        {/* Fin de feed marker */}
        <div style={{ textAlign: 'center', padding: '4px 0 80px', fontFamily: 'Caveat', fontSize: 13, color: 'var(--ink-light)' }}>
          ~ tu es à jour ~
        </div>
      </div>

      {/* Mode contextuel sticky bas (au-dessus de la tab bar) */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 56,
        padding: '8px 12px',
        background: 'var(--paper)',
        borderTop: '1.5px solid var(--ink)',
        display: 'flex', gap: 6, alignItems: 'center',
        zIndex: 4,
      }}>
        <span className="wf-label" style={{ fontSize: 12, marginRight: 2 }}>Je sors :</span>
        <Pill fill style={{ fontSize: 11 }}>Solo</Pill>
        <Pill style={{ fontSize: 11 }}>À 2</Pill>
        <Pill style={{ fontSize: 11 }}>Crew</Pill>
        <span style={{ flex: 1 }}/>
        <span style={{ fontFamily: 'Caveat', fontSize: 14 }}>›</span>
      </div>

      {/* FAB Spawter (au-dessus de la sticky bar) */}
      <div style={{
        position: 'absolute', right: 14, bottom: 116,
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--vert)', border: '2px solid var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Caveat', fontSize: 22, fontWeight: 700,
        boxShadow: '2px 3px 0 rgba(0,0,0,0.25)',
        zIndex: 5,
      }}>
        🐾
      </div>

      <TabBar active="home"/>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// OPTION B · MODE-FIRST · STORIES + CARTES ALTERNÉES
// Mode contextuel TOUT EN HAUT (chips horizontaux comme stories)
// Feed = cartes alternées grand/petit format, calé sur le mode actif
// CTA Spawter = bouton central de la tab bar
// ═════════════════════════════════════════════════════════════
function HomeFeedB() {
  return (
    <Phone label="B · Mode-first — stories en haut" time="9:41">
      {/* Bandeau réduit */}
      <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CatGlyph size={14}/>
          <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 16 }}>SPAWT</span>
        </div>
        <span className="wf-label" style={{ fontSize: 11 }}>Cocody · 27°</span>
      </div>

      {/* Stories de Mode contextuel — sticky top */}
      <div style={{
        flexShrink: 0,
        padding: '6px 0 10px',
        borderTop: '1.5px solid var(--ink)',
        borderBottom: '1.5px solid var(--ink)',
        background: 'var(--paper-2)',
      }}>
        <div className="wf-label" style={{ fontSize: 11, padding: '2px 14px 6px', letterSpacing: 0.5 }}>JE SORS POUR…</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 14px', overflowX: 'auto' }}>
          {[
            { lbl: 'Manger', sub: 'à 2', active: true, glyph: '🍽' },
            { lbl: 'Boire', sub: 'crew', glyph: '🥂' },
            { lbl: 'Bouger', sub: 'solo', glyph: '↗' },
            { lbl: 'Date', sub: 'wow', glyph: '★' },
            { lbl: 'Matinal', sub: '', glyph: '☀' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 60 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: m.active ? '2.5px solid var(--ink)' : '1.5px solid var(--ink-soft)',
                background: m.active ? 'var(--paper)' : 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Caveat', fontSize: 22,
                position: 'relative',
              }}>
                {m.glyph}
                {m.active && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: 'var(--vert)', border: '1.5px solid var(--ink)' }}/>}
              </div>
              <div style={{ fontFamily: 'Caveat', fontSize: 12, fontWeight: m.active ? 700 : 400, lineHeight: 1 }}>{m.lbl}</div>
              {m.sub && <div className="wf-label" style={{ fontSize: 10, lineHeight: 1 }}>{m.sub}</div>}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, width: 56 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px dashed var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 22, color: 'var(--ink-soft)' }}>+</div>
            <div className="wf-label" style={{ fontSize: 11 }}>Plus</div>
          </div>
        </div>
      </div>

      {/* Sous-titre éditorial dynamique */}
      <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
        <div className="wf-label" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Manger · à 2 · ce soir</div>
        <div className="wf-title" style={{ fontSize: 18, lineHeight: 1.15 }}>4 spawts pour ne pas se rater.</div>
      </div>

      {/* Feed alterné */}
      <div className="wf-screen" style={{ overflowY: 'auto', overflowX: 'hidden', display: 'block' }}>
        {/* Card 1 — grand format */}
        <div style={{ padding: '0 14px 12px' }}>
          <EditorialImg h={170} label="" kicker="WOW · 92% match" title="Le Toit Rouge"/>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: 'Caveat', fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>Le Toit Rouge</div>
              <div className="wf-label" style={{ fontSize: 11 }}>Cocody · 1,1 km · 18 000 F /pers · ouvert</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Pill or style={{ fontSize: 10 }}>★ 4.7</Pill>
              <Pill vert style={{ fontSize: 10 }}>libre 20h</Pill>
            </div>
          </div>
        </div>

        {/* Card 2 — petit format en ligne */}
        <div style={{ padding: '0 14px 12px', borderTop: '1.5px dashed var(--ink-light)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <ImgBox w={88} h={88} label=""/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wf-label" style={{ fontSize: 10, letterSpacing: 1 }}>AUTHENTIQUE · 86%</div>
              <div style={{ fontFamily: 'Caveat', fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>Chez Brigitte · garba revisité</div>
              <div className="wf-label" style={{ fontSize: 11, marginTop: 2 }}>Treichville · 2,3 km · 6 000 F</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <Pill style={{ fontSize: 10 }}>★ 4.5</Pill>
                <Pill style={{ fontSize: 10 }}>9 paws</Pill>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3 — grand format */}
        <div style={{ padding: '12px 14px', borderTop: '1.5px dashed var(--ink-light)' }}>
          <EditorialImg h={150} label="" kicker="CLASSE · 81%" title="La Petite Cave"/>
          <div className="wf-label" style={{ fontSize: 11, marginTop: 6 }}>Plateau · 3,5 km · 22 000 F · 4 places</div>
        </div>

        {/* Card 4 — surprise du chat */}
        <div style={{ margin: '4px 14px 12px', padding: '10px 12px', background: 'var(--paper-2)', border: '1.5px solid var(--ink)', borderRadius: '6px 9px 5px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CatGlyph size={20}/>
            <div style={{ flex: 1 }}>
              <div className="wf-label" style={{ fontSize: 11, letterSpacing: 1 }}>SI TU VEUX SURPRENDRE</div>
              <div style={{ fontFamily: 'Caveat', fontSize: 15, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>L'Adresse, à 4 km, ouverte tard.</div>
              <div className="wf-label" style={{ fontSize: 11, marginTop: 4 }}>87% match · jamais visité par toi</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 80px', fontFamily: 'Caveat', fontSize: 13, color: 'var(--ink-light)' }}>
          ↻ change de mode pour voir d'autres adresses
        </div>
      </div>

      <TabBar active="spawt"/>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// OPTION C · QUESTION + SLOW SCROLL
// Inspiré démo dev : "C'est l'heure. Où tu manges ?"
// CTA Spawter intégré dans la question, mode contextuel = onglets discrets
// Feed = sections nommées (Aujourd'hui / Le pavé / Trois adresses)
// ═════════════════════════════════════════════════════════════
function HomeFeedC() {
  return (
    <Phone label="C · Question + slow scroll" time="9:41">
      <div className="wf-screen" style={{ overflowY: 'auto', overflowX: 'hidden', display: 'block' }}>
        {/* Salutation */}
        <div style={{ padding: '14px 18px 4px' }}>
          <div className="wf-label" style={{ fontSize: 11 }}>☀ Mardi · 12:47 · Cocody</div>
          <div style={{ fontFamily: 'Caveat', fontSize: 22, fontWeight: 700, marginTop: 2 }}>Salut Betsy,</div>
        </div>

        {/* La question — bloc cathédrale */}
        <div style={{ margin: '8px 14px 14px', padding: '20px 18px 18px', border: '1.5px solid var(--ink)', borderRadius: '8px 14px 6px 12px', background: 'var(--paper)', position: 'relative' }}>
          <div style={{ fontFamily: 'Caveat', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>LA QUESTION</div>
          <div style={{ fontFamily: 'Caveat', fontSize: 26, fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>
            C'est l'heure.<br/>Où tu manges ?
          </div>
          <div className="wf-label" style={{ fontSize: 12, marginTop: 10 }}>
            ⏱ En moyenne, tu trouves en <span style={{ color: 'var(--vert)', fontWeight: 700 }}>1 min 23</span>
          </div>

          {/* Mode contextuel = mini onglets sous la question */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
            <Pill fill style={{ fontSize: 11 }}>Solo</Pill>
            <Pill style={{ fontSize: 11 }}>Avec quelqu'un</Pill>
            <Pill style={{ fontSize: 11 }}>En crew</Pill>
          </div>

          {/* CTA Spawter intégré dans la question */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1,
              padding: '10px 14px',
              border: '1.5px solid var(--ink)',
              borderRadius: '999px',
              background: 'var(--vert)',
              fontFamily: 'Caveat',
              fontSize: 16,
              fontWeight: 700,
              textAlign: 'center',
              boxShadow: '2px 3px 0 rgba(0,0,0,0.18)',
            }}>
              🐾 Spawter maintenant
            </div>
            <div style={{
              width: 42, height: 42, border: '1.5px solid var(--ink)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Caveat', fontSize: 18,
            }}>↻</div>
          </div>

          {/* Petit corner cat */}
          <div style={{ position: 'absolute', top: -10, right: 12, transform: 'rotate(8deg)', background: 'var(--paper)', padding: '2px 8px', border: '1.5px solid var(--ink)', borderRadius: 999, fontFamily: 'Caveat', fontSize: 11 }}>
            <CatGlyph size={12}/> propose
          </div>
        </div>

        {/* Section · Aujourd'hui */}
        <div style={{ padding: '4px 18px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: '1.5px solid var(--ink)', paddingBottom: 4 }}>
            <span className="wf-title" style={{ fontSize: 17 }}>Aujourd'hui</span>
            <span className="wf-label" style={{ fontSize: 11 }}>autour de toi maintenant</span>
          </div>
        </div>

        <div style={{ padding: '10px 18px 6px' }}>
          <EditorialImg h={130} label="" kicker="OUVERT · 5 MIN" title="Le Patio · déjeuner d'auteur"/>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Pill style={{ fontSize: 10 }}>★ 4.6</Pill>
            <Pill style={{ fontSize: 10 }}>9 000 F</Pill>
            <Pill vert style={{ fontSize: 10 }}>libre</Pill>
            <span className="wf-label" style={{ fontSize: 11, marginLeft: 'auto' }}>91% match</span>
          </div>
        </div>

        {/* Le pavé — édito du chat */}
        <div style={{ margin: '14px 0 0', padding: '14px 18px', borderTop: '1.5px solid var(--ink)', borderBottom: '1.5px solid var(--ink)', background: 'var(--paper-2)' }}>
          <div className="wf-label" style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>LE PAVÉ · le chat</div>
          <div style={{ fontFamily: 'Caveat', fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>
            « Tu vas finir par y aller, à Sky Lounge. Je te mets de côté la table 7. »
          </div>
          <div style={{ marginTop: 8 }}>
            <Pill or style={{ fontSize: 11 }}>Garder la table →</Pill>
          </div>
        </div>

        {/* Section · Trois adresses */}
        <div style={{ padding: '14px 18px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: '1.5px solid var(--ink)', paddingBottom: 4 }}>
            <span className="wf-title" style={{ fontSize: 17 }}>Trois adresses</span>
            <span className="wf-label" style={{ fontSize: 11 }}>pour ce soir, plus tard</span>
          </div>
        </div>

        {[
          { n: '01', kicker: 'DATE · classe', title: 'La Petite Cave', meta: 'Plateau · 22 000 F · 4 places' },
          { n: '02', kicker: 'SQUAD', title: 'Sao · table 8', meta: 'Marcory · 12 000 F · jusqu\'à 1h' },
          { n: '03', kicker: 'AUTHENTIQUE', title: 'Le Maquis du Bord', meta: 'Yopougon · 4 500 F · ouvert tard' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: '1.5px dashed var(--ink-light)' }}>
            <div style={{ fontFamily: 'Caveat', fontSize: 22, fontWeight: 700, color: 'var(--ink-soft)', width: 28, flexShrink: 0 }}>{row.n}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="wf-label" style={{ fontSize: 10, letterSpacing: 1 }}>{row.kicker}</div>
              <div style={{ fontFamily: 'Caveat', fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>{row.title}</div>
              <div className="wf-label" style={{ fontSize: 11, marginTop: 2 }}>{row.meta}</div>
            </div>
            <ImgBox w={60} h={60} label=""/>
          </div>
        ))}

        {/* Pied — l'ours du journal */}
        <div style={{ textAlign: 'center', padding: '14px 18px 80px', fontFamily: 'Caveat', fontSize: 12, color: 'var(--ink-light)' }}>
          —— SPAWT · n° 048 · le quotidien d'Abidjan ——
        </div>
      </div>

      <TabBar active="home"/>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// OPTION D · COMPROMIS A+B
// Stories de modes en haut (compactes) + Une grande + CTA pleine largeur
// ═════════════════════════════════════════════════════════════
function HomeFeedD() {
  return (
    <Phone label="D · Mode + Une + CTA pleine largeur" time="9:41">
      {/* Bandeau journal compact */}
      <div style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CatGlyph size={14}/>
          <span style={{ fontFamily: 'Caveat', fontWeight: 700, fontSize: 16 }}>SPAWT</span>
        </div>
        <span className="wf-label" style={{ fontSize: 11 }}>Mardi · Cocody · 27°</span>
      </div>

      {/* Stories de modes — compactes (44px) */}
      <div style={{
        flexShrink: 0,
        padding: '4px 0 8px',
        borderTop: '1.5px solid var(--ink)',
        borderBottom: '1.5px solid var(--ink)',
        background: 'var(--paper-2)',
      }}>
        <div className="wf-label" style={{ fontSize: 11, padding: '2px 14px 4px', letterSpacing: 0.5 }}>JE SORS POUR…</div>
        <div style={{ display: 'flex', gap: 8, padding: '0 14px', overflowX: 'auto' }}>
          {[
            { lbl: 'Manger', sub: 'à 2', active: true, glyph: '🍽' },
            { lbl: 'Boire', sub: 'crew', glyph: '🥂' },
            { lbl: 'Bouger', sub: 'solo', glyph: '↗' },
            { lbl: 'Date', sub: 'wow', glyph: '★' },
            { lbl: 'Matin', sub: '', glyph: '☀' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, width: 50 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                border: m.active ? '2.5px solid var(--ink)' : '1.5px solid var(--ink-soft)',
                background: 'var(--paper)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Caveat', fontSize: 18,
                position: 'relative',
              }}>
                {m.glyph}
                {m.active && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: 'var(--vert)', border: '1.5px solid var(--ink)' }}/>}
              </div>
              <div style={{ fontFamily: 'Caveat', fontSize: 11, fontWeight: m.active ? 700 : 400, lineHeight: 1 }}>{m.lbl}</div>
              {m.sub && <div className="wf-label" style={{ fontSize: 9, lineHeight: 1 }}>{m.sub}</div>}
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, width: 44 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1.5px dashed var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 18, color: 'var(--ink-soft)' }}>+</div>
            <div className="wf-label" style={{ fontSize: 10 }}>Plus</div>
          </div>
        </div>
      </div>

      <div className="wf-screen" style={{ overflowY: 'auto', overflowX: 'hidden', display: 'block' }}>
        {/* Sous-titre dynamique pré-filtré par le mode */}
        <div style={{ padding: '10px 14px 4px' }}>
          <div className="wf-label" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>Manger · à 2 · ce soir — le chat propose</div>
        </div>

        {/* CARROUSEL de Unes — swipable gauche/droite */}
        <div style={{ padding: '6px 0 0', position: 'relative' }}>
          <div style={{ display: 'flex', gap: 10, padding: '0 14px', overflowX: 'auto', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
            {[
              { kicker: 'WOW · 92% match', title: 'Sky Lounge fait son retour', byline: 'Cocody · 18 000 F /pers · libre 20h', medal: '★ Sélection', quote: 'Nouveau chef. Pour impressionner sans te ruiner, c’est ton moment.' },
              { kicker: 'CLASSE · 88% match', title: 'La Petite Cave', byline: 'Plateau · 22 000 F /pers · 4 places', medal: 'Cave à vin', quote: 'Ils gardent une bouteille de Saint-Émilion qui te ressemble.' },
              { kicker: 'AUTHENTIQUE · 86% match', title: 'Chez Brigitte', byline: 'Treichville · 6 000 F · ouvert tard', medal: 'Garba 2.0', quote: 'Le garba qui a fait pleurer ton oncle, en mieux.' },
            ].map((card, i) => (
              <div key={i} style={{ flexShrink: 0, width: 'calc(100% - 28px)', scrollSnapAlign: 'center', position: 'relative' }}>
                <EditorialImg h={240} label="hero" kicker={card.kicker} title={card.title} byline={card.byline}/>
                <div style={{ position: 'absolute', top: 8, right: 8, background: i === 0 ? 'var(--or)' : 'var(--paper)', border: '1.5px solid var(--ink)', padding: '3px 8px', fontFamily: 'Caveat', fontSize: 12, fontWeight: 700, transform: 'rotate(2deg)' }}>{card.medal}</div>
              </div>
            ))}
          </div>
          {/* Indicateurs de pagination */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: i === 0 ? 18 : 6, height: 6, borderRadius: 3, background: i === 0 ? 'var(--ink)' : 'var(--ink-light)', transition: 'all 0.2s' }}/>
            ))}
          </div>
          {/* Affordance flèches sketchy */}
          <div style={{ position: 'absolute', top: 110, left: 4, fontFamily: 'Caveat', fontSize: 22, color: 'var(--ink-soft)', pointerEvents: 'none' }}>‹</div>
          <div style={{ position: 'absolute', top: 110, right: 4, fontFamily: 'Caveat', fontSize: 22, color: 'var(--ink-soft)', pointerEvents: 'none' }}>›</div>
        </div>

        {/* Baseline du chat — réfère à la Une visible */}
        <div style={{ padding: '12px 14px 14px' }}>
          <div style={{ fontFamily: 'Caveat', fontSize: 14, lineHeight: 1.25, color: 'var(--ink-soft)' }}>
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}>« </span>
            Nouveau chef. Pour impressionner sans te ruiner, c'est ton moment.
            <span style={{ fontWeight: 700, color: 'var(--ink)' }}> »</span>
            <span style={{ fontFamily: 'Caveat', fontSize: 11, marginLeft: 6 }}>— le chat</span>
          </div>
          <div className="wf-label" style={{ fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>← swipe pour voir les autres propositions du chat</div>
        </div>

        {/* Feuilleton — édito, calé sur le mode */}
        <div style={{ padding: '12px 14px 8px', borderTop: '1.5px solid var(--ink)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="wf-title" style={{ fontSize: 16 }}>Et aussi, dans le mode</div>
            <span className="wf-label" style={{ fontSize: 11 }}>3 adresses</span>
          </div>

          {[
            { kicker: 'AUTHENTIQUE · 86%', title: "Chez Brigitte · garba revisité", note: '4.5', meta: 'Treichville · 6 000 F' },
            { kicker: 'CLASSE · 81%', title: "La Petite Cave", note: '4.4', meta: 'Plateau · 22 000 F' },
            { kicker: 'NOUVEAU · à goûter', title: "La Cantinière · brunch d'auteur", note: '—', meta: 'Cocody · 9 000 F' },
          ].map((c, i) => (
            <div key={i} className="wf-box-rough" style={{ padding: 10, marginBottom: 10, display: 'flex', gap: 10, transform: `rotate(${i % 2 ? 0.3 : -0.2}deg)` }}>
              <ImgBox w={64} h={64} label="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Caveat', fontSize: 11, letterSpacing: 1, color: 'var(--ink-soft)' }}>{c.kicker}</div>
                <div style={{ fontFamily: 'Caveat', fontSize: 16, fontWeight: 700, lineHeight: 1.15 }}>{c.title}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <Pill style={{ fontSize: 10 }}>★ {c.note}</Pill>
                  <span className="wf-label" style={{ fontSize: 11 }}>{c.meta}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pavé édito du chat */}
        <div style={{ margin: '4px 14px 14px', borderTop: '1.5px solid var(--ink)', borderBottom: '1.5px solid var(--ink)', padding: '12px 0' }}>
          <div style={{ fontFamily: 'Caveat', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>EDITO · le chat</div>
          <div style={{ fontFamily: 'Caveat', fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginTop: 4 }}>
            « Change de mode là-haut, je te réécris la une. »
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '4px 0 30px', fontFamily: 'Caveat', fontSize: 13, color: 'var(--ink-light)' }}>
          ~ tu es à jour ~
        </div>
      </div>

      <TabBar active="spawt"/>
    </Phone>
  );
}

Object.assign(window, { HomeFeedA, HomeFeedB, HomeFeedC, HomeFeedD, CatGlyph });
