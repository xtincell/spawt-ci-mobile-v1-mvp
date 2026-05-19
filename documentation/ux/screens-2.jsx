// Screens 4-6: Le Spawt (check-in), Profil + Palais, Carte + paywall

// ═════════════════════════════════════════════════════════════
// SCREEN 4 — LE SPAWT (check-in VTC)
// ═════════════════════════════════════════════════════════════

// V1 — Notification system + sheet (on a notification on lock)
function SpawtV1({ voixChat = true }) {
  return (
    <Phone label="A · Notif système">
      <div style={{ flex: 1, background: 'var(--paper-2)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 12px', textAlign: 'center', fontFamily: 'Caveat' }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>20:34</div>
          <div className="wf-label" style={{ fontSize: 14 }}>vendredi 9 mai</div>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="wf-box" style={{ padding: 10, display: 'flex', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'var(--vert)', border: '1.5px solid var(--ink)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>S</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="wf-hand" style={{ fontSize: 12, fontWeight: 700 }}>SPAWT</span>
                <span className="wf-label" style={{ fontSize: 10 }}>maintenant</span>
              </div>
              <div className="wf-hand" style={{ fontSize: 14, marginTop: 2 }}>
                Comment c'était chez <b>Tantie Rose</b> ?
              </div>
              <div className="wf-label" style={{ fontSize: 11, marginTop: 2 }}>tape pour spawter · 14 min restantes</div>
            </div>
          </div>
          <div className="wf-label" style={{ textAlign: 'center', fontSize: 11, marginTop: 6 }}>↓ swipe pour ouvrir</div>
        </div>
        <Note style={{ position: 'absolute', right: -20, top: 100, transform: 'rotate(4deg)' }}>
          mécanique VTC :<br/>détection 10m → timer 15min → notif locale
        </Note>
      </div>
    </Phone>
  );
}

// V2 — Sheet de check-in actif (post-tap)
function SpawtV2({ voixChat = true }) {
  return (
    <Phone label="B · Sheet de spawt">
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {/* dimmed background */}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--paper)', opacity: 0.5 }}></div>
        <div style={{
          position: 'relative',
          background: 'var(--paper)',
          border: '1.5px solid var(--ink)',
          borderRadius: '20px 20px 0 0',
          padding: '12px 16px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ width: 36, height: 4, background: 'var(--ink-light)', borderRadius: 2, alignSelf: 'center' }}></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <ImgBox w={50} h={50} label="📷" rough />
            <div style={{ flex: 1 }}>
              <div className="wf-title" style={{ fontSize: 16 }}>Tantie Rose</div>
              <div className="wf-label" style={{ fontSize: 11 }}>📍 tu es ici · 8 min</div>
            </div>
          </div>
          <div className="wf-hand" style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>Note</div>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
            {[1,2,3,4,5].map(s => (
              <div key={s} style={{ flex: 1, height: 38, border: '1.5px solid var(--ink)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: s <= 4 ? 'var(--or)' : 'var(--ink-light)', background: s <= 4 ? '#fff7d6' : 'transparent' }}>★</div>
            ))}
          </div>
          <div className="wf-hand" style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>tags rapides</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Pill fill style={{ fontSize: 11 }}>✓ copieux</Pill>
            <Pill fill style={{ fontSize: 11 }}>✓ à refaire</Pill>
            <Pill style={{ fontSize: 11 }}>rapide</Pill>
            <Pill style={{ fontSize: 11 }}>ambiance top</Pill>
            <Pill style={{ fontSize: 11 }}>cher</Pill>
          </div>
          <div className="wf-box-faint" style={{ padding: 8, marginTop: 4, fontFamily: 'Caveat', fontSize: 12, color: 'var(--ink-light)' }}>
            ajoute un mot... (optionnel)
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="wf-box" style={{ width: 44, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📷</div>
            <div className="wf-pill wf-pill-vert" style={{ flex: 1, justifyContent: 'center', padding: '10px', fontSize: 13 }}>publier mon spawt</div>
          </div>
          <div className="wf-label" style={{ textAlign: 'center', fontSize: 11 }}>snooze · plus tard (2 restants)</div>
        </div>
      </div>
    </Phone>
  );
}

// V3 — Confirmation post-spawt — montée de stade
function SpawtV3() {
  return (
    <Phone label="C · Montée de stade">
      <div style={{ flex: 1, background: 'var(--paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 14, textAlign: 'center', position: 'relative' }}>
        {/* radial scribbles */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI * 2) / 12;
            const cx = 140, cy = 240;
            const x1 = cx + Math.cos(a) * 90, y1 = cy + Math.sin(a) * 90;
            const x2 = cx + Math.cos(a) * 130, y2 = cy + Math.sin(a) * 130;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="wf-label" style={{ fontSize: 13 }}>spawt #21 enregistré</div>
        <div className="wf-title" style={{ fontSize: 26, lineHeight: 1.05 }}>
          Tu passes <span className="wf-hl">Detective</span>
        </div>
        <div style={{
          width: 110, height: 110,
          border: '2px solid var(--ink)',
          borderRadius: '50%',
          background: 'var(--or)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Caveat', fontSize: 42, fontWeight: 700,
        }}>🐈</div>
        <div className="wf-hand" style={{ fontSize: 22, fontWeight: 700 }}>Pisteur Noir</div>
        <div className="wf-label" style={{ fontSize: 13, lineHeight: 1.3, maxWidth: 220 }}>
          Tu sens les pistes que personne ne voit. Ton avis pèse maintenant 2× dans la colonie.
        </div>
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          <div className="wf-pill wf-pill-fill" style={{ justifyContent: 'center', padding: 10, fontSize: 13 }}>partager sur WhatsApp</div>
          <div className="wf-label">continuer →</div>
        </div>
      </div>
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// SCREEN 5 — PROFIL + PALAIS
// ═════════════════════════════════════════════════════════════

// V1 — Radar central + stats
function ProfilV1({ premium = false }) {
  return (
    <Phone label="A · Radar central">
      <ScreenHeader left="←" title="Moi" right="⚙" />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, border: '2px solid var(--ink)', borderRadius: '50%', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 22, fontWeight: 700 }}>B</div>
          <div style={{ flex: 1 }}>
            <div className="wf-title" style={{ fontSize: 18 }}>Betsy {premium && '✦'}</div>
            <div className="wf-label" style={{ fontSize: 11 }}>Pisteur Noir · Detective</div>
          </div>
          {premium && <Pill or style={{ fontSize: 10 }}>GOLD</Pill>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 0', borderTop: '1.5px dashed var(--ink-light)', borderBottom: '1.5px dashed var(--ink-light)' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700 }}>23</div>
            <div className="wf-label" style={{ fontSize: 10 }}>spots</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700 }}>41</div>
            <div className="wf-label" style={{ fontSize: 10 }}>spawts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700 }}>18</div>
            <div className="wf-label" style={{ fontSize: 10 }}>avis</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="wf-hand" style={{ fontSize: 18, fontWeight: 700 }}>4</div>
            <div className="wf-label" style={{ fontSize: 10 }}>♡ coups</div>
          </div>
        </div>
        <div className="wf-hand" style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Mon Palais</div>
        <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Radar size={170} values={[0.4, 0.85, 0.6, 0.3, 0.8]} />
          {!premium && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(251,249,244,0.7)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="wf-pill wf-pill-or" style={{ fontSize: 11 }}>🔒 Gold débloque les 5 axes</div>
            </div>
          )}
        </div>
        <div className="wf-label" style={{ textAlign: 'center', fontSize: 11 }}>Nomade · Maquis dominent</div>
      </div>
      <TabBar active="me" />
    </Phone>
  );
}

// V2 — Collection de titres (cartes)
function ProfilV2() {
  const titres = [
    { t: 'Petit Pisteur', s: 'Touriste', on: false, w: false },
    { t: 'Pisteur', s: 'Explorateur', on: false, w: false },
    { t: 'Pisteur de Brousse', s: 'Detective', on: false, w: false },
    { t: 'Pisteur Noir', s: 'Detective', on: true, w: false },
    { t: 'Chat Fantôme', s: 'mue', on: false, w: false },
    { t: 'La Piste', s: 'Guide', on: false, w: true },
  ];
  return (
    <Phone label="B · Collection titres">
      <ScreenHeader left="←" title="Ma collection" right="↗" />
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div className="wf-label" style={{ fontSize: 11 }}>4 titres gagnés · 2 à débloquer</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
          {titres.map((t, i) => (
            <div key={i} className="wf-box" style={{
              padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
              background: t.on ? '#fff7d6' : t.w ? 'var(--paper-2)' : 'var(--paper)',
              opacity: t.w ? 0.5 : 1,
              borderStyle: t.w ? 'dashed' : 'solid',
            }}>
              <div style={{
                width: 38, height: 38, border: '1.5px solid var(--ink)', borderRadius: '50%',
                background: t.on ? 'var(--or)' : 'var(--paper-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Caveat', fontSize: 14, fontWeight: 700,
              }}>{t.w ? '?' : '🐈'}</div>
              <div className="wf-hand" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}>{t.t}</div>
              <div className="wf-label" style={{ fontSize: 10 }}>{t.s}</div>
              {t.on && <div className="wf-label" style={{ fontSize: 9, color: 'var(--or)', fontWeight: 700 }}>actuel · affiché</div>}
            </div>
          ))}
        </div>
      </div>
      <TabBar active="me" />
    </Phone>
  );
}

// V3 — Voix du chat — historique
function ProfilV3({ voixChat = true }) {
  return (
    <Phone label="C · Journal du chat">
      <ScreenHeader left="←" title="Le chat" right="⋯" />
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="wf-cat" style={{ width: 44, height: 44 }}></div>
          <div>
            <div className="wf-title" style={{ fontSize: 15 }}>23 spots · Detective</div>
            <div className="wf-label" style={{ fontSize: 11 }}>9 conversations cette semaine</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
          {voixChat && (
            <>
              <CatSays text="Tu passes Detective. Pisteur Noir, c'est mérité." />
              <div className="wf-label" style={{ fontSize: 10, alignSelf: 'flex-start', paddingLeft: 40 }}>il y a 2j</div>
              <CatSays text="Je te sens différent. Tes 30 derniers spots disent Fantôme plus que Pisteur." />
              <div className="wf-label" style={{ fontSize: 10, alignSelf: 'flex-start', paddingLeft: 40 }}>il y a 5j</div>
              <CatSays text="Encore un maquis. Tu connais ton territoire." />
            </>
          )}
          {!voixChat && (
            <div className="wf-box-faint" style={{ padding: 14, textAlign: 'center', fontFamily: 'Caveat', fontSize: 13, color: 'var(--ink-light)' }}>
              voix du chat désactivée
            </div>
          )}
        </div>
        <div className="wf-box" style={{ padding: 8, fontFamily: 'Caveat', fontSize: 12, textAlign: 'center' }}>
          📊 voir mon Palais radar
        </div>
      </div>
      <TabBar active="me" />
    </Phone>
  );
}

// ═════════════════════════════════════════════════════════════
// SCREEN 6 — CARTE + PAYWALL
// ═════════════════════════════════════════════════════════════

function FakeMap({ cluster = false }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundColor: 'var(--paper-2)',
      backgroundImage: `
        linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)
      `,
      backgroundSize: '20px 20px',
      overflow: 'hidden',
    }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <path d="M-20 100 Q 100 80, 180 130 T 320 110" stroke="rgba(0,0,0,0.18)" strokeWidth="8" fill="none" />
        <path d="M-20 100 Q 100 80, 180 130 T 320 110" stroke="var(--paper)" strokeWidth="4" fill="none" />
        <path d="M60 -10 Q 80 100, 130 200 T 180 400" stroke="rgba(0,0,0,0.18)" strokeWidth="6" fill="none" />
        <path d="M60 -10 Q 80 100, 130 200 T 180 400" stroke="var(--paper)" strokeWidth="3" fill="none" />
        <path d="M0 250 Q 100 240, 200 280 T 320 260" stroke="rgba(0,0,0,0.18)" strokeWidth="5" fill="none" />
        <path d="M0 250 Q 100 240, 200 280 T 320 260" stroke="var(--paper)" strokeWidth="2.5" fill="none" />
      </svg>
    </div>
  );
}

function Pin({ x, y, blur = false, fav = false, color = 'vert' }) {
  const c = color === 'or' ? 'var(--or)' : 'var(--vert)';
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', filter: blur ? 'blur(3px)' : 'none' }}>
      <div style={{
        width: 22, height: 22, background: c,
        border: '1.5px solid var(--ink)',
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {fav && <span style={{ transform: 'rotate(45deg)', fontSize: 10, fontFamily: 'Caveat' }}>♡</span>}
      </div>
    </div>
  );
}

// V1 — Carte avec cercle 3km + pins floutés au-delà
function CarteV1({ premium = false }) {
  return (
    <Phone label="A · Cercle 3km + flou">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <FakeMap />
        {/* zone 3km */}
        {!premium && (
          <>
            <div style={{
              position: 'absolute', left: '50%', top: '50%',
              width: 200, height: 200,
              transform: 'translate(-50%, -50%)',
              border: '2px dashed var(--vert)',
              borderRadius: '50%',
              background: 'rgba(76,174,110,0.08)',
            }}></div>
            <div className="wf-label" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, 80px)', fontSize: 11, background: 'var(--paper)', padding: '2px 6px', border: '1.5px solid var(--vert)', borderRadius: 4, color: 'var(--vert)' }}>
              3 km · ta zone
            </div>
          </>
        )}
        {/* pins inside */}
        <Pin x={140} y={210} fav />
        <Pin x={170} y={250} />
        <Pin x={110} y={250} />
        <Pin x={155} y={290} />
        {/* pins outside (blurred if not premium) */}
        <Pin x={50} y={130} blur={!premium} color="or" />
        <Pin x={230} y={150} blur={!premium} color="or" />
        <Pin x={250} y={350} blur={!premium} color="or" />
        <Pin x={40} y={400} blur={!premium} color="or" />

        <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', gap: 6 }}>
          <div className="wf-box" style={{ flex: 1, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Caveat', fontSize: 12 }}>
            <span>🔍</span>
            <span style={{ color: 'var(--ink-light)' }}>Cherche un quartier, un plat...</span>
          </div>
          <div className="wf-box" style={{ width: 36, padding: 8, textAlign: 'center', fontFamily: 'Caveat', fontSize: 13 }}>≡</div>
        </div>

        {!premium && (
          <div style={{
            position: 'absolute', left: 14, right: 14, bottom: 80,
            background: 'var(--paper)',
            border: '1.5px solid var(--ink)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <div style={{ width: 32, height: 32, background: 'var(--or)', border: '1.5px solid var(--ink)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontWeight: 700 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div className="wf-hand" style={{ fontSize: 13, fontWeight: 700 }}>23 spots cachés ailleurs</div>
              <div className="wf-label" style={{ fontSize: 11 }}>Gold · 2 950 F/mois · tout Abidjan</div>
            </div>
            <div className="wf-pill wf-pill-or" style={{ fontSize: 11 }}>passer Gold</div>
          </div>
        )}
      </div>
      <TabBar active="map" />
    </Phone>
  );
}

// V2 — Liste hybride (carte mini en haut, liste en bas)
function CarteV2({ premium = false }) {
  return (
    <Phone label="B · Hybride map+list">
      <ScreenHeader left="←" title="Carte" right="⊕" />
      <div style={{ position: 'relative', height: 200, borderBottom: '1.5px solid var(--ink)' }}>
        <FakeMap />
        <Pin x={140} y={100} fav />
        <Pin x={90} y={140} />
        <Pin x={200} y={120} />
        <Pin x={160} y={160} />
        <div style={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="wf-box" style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>+</div>
          <div className="wf-box" style={{ width: 30, height: 30, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>−</div>
        </div>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="wf-hand" style={{ fontSize: 14, fontWeight: 700 }}>4 spots dans cette zone</span>
          <span className="wf-label" style={{ fontSize: 11 }}>↕ tri · note</span>
        </div>
        {[
          { n: 'Tantie Rose', s: '★4.6 · 0.8km · 92%' },
          { n: 'Maquis 47', s: '★4.3 · 1.1km · 88%', locked: !premium },
          { n: 'Coco Brunch', s: '★4.5 · 1.4km · 89%' },
        ].map((p,i) => (
          <div key={i} className="wf-box-soft" style={{ padding: 8, display: 'flex', gap: 8, alignItems: 'center', filter: p.locked ? 'blur(2px)' : 'none' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--vert)', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 11, fontWeight: 700 }}>{i+1}</div>
            <div style={{ flex: 1 }}>
              <div className="wf-hand" style={{ fontSize: 13, fontWeight: 700 }}>{p.n}</div>
              <div className="wf-label" style={{ fontSize: 10 }}>{p.s}</div>
            </div>
            <span className="wf-label">›</span>
          </div>
        ))}
      </div>
      <TabBar active="map" />
    </Phone>
  );
}

// V3 — Heatmap par archetypes / colonie
function CarteV3() {
  return (
    <Phone label="C · Heatmap colonie">
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <FakeMap />
        {/* heat blobs */}
        {[
          { x: 140, y: 220, r: 80, c: 'rgba(76,174,110,0.35)' },
          { x: 90, y: 130, r: 60, c: 'rgba(201,162,39,0.35)' },
          { x: 220, y: 170, r: 50, c: 'rgba(200,75,58,0.30)' },
          { x: 200, y: 350, r: 70, c: 'rgba(76,174,110,0.30)' },
        ].map((b,i) => (
          <div key={i} style={{
            position: 'absolute', left: b.x, top: b.y,
            width: b.r * 2, height: b.r * 2,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            borderRadius: '50%',
          }}></div>
        ))}
        <Pin x={140} y={220} fav />
        <Pin x={90} y={130} color="or" />
        <Pin x={220} y={170} />

        <div style={{ position: 'absolute', top: 14, left: 14, right: 14 }}>
          <div className="wf-box" style={{ padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Caveat', fontSize: 12, fontWeight: 700 }}>vu par :</span>
            <Pill fill style={{ fontSize: 10 }}>Pisteur</Pill>
            <Pill style={{ fontSize: 10 }}>Bouche d'Or</Pill>
            <Pill style={{ fontSize: 10 }}>+3</Pill>
          </div>
        </div>

        {/* legend */}
        <div style={{ position: 'absolute', bottom: 80, left: 14, background: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 6, padding: 8, fontFamily: 'Caveat', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--vert)', borderRadius: '50%' }}></span> Maquis</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--or)', borderRadius: '50%' }}></span> Table</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, background: 'var(--rouge)', borderRadius: '50%' }}></span> Hype</div>
        </div>
      </div>
      <TabBar active="map" />
    </Phone>
  );
}

Object.assign(window, {
  SpawtV1, SpawtV2, SpawtV3,
  ProfilV1, ProfilV2, ProfilV3,
  CarteV1, CarteV2, CarteV3,
});
