/* global React, Phone, Ico, CatBubble, TabBar */
// SPAWT Mid-fi Screens — part 6: Recherche, Meute, Spawte suite, Paywall, Réglages, Notifs, États vides, Tanière

// ─────────────────────────────────────────────────────────────
// RECHERCHE
// ─────────────────────────────────────────────────────────────

const SearchEmpty = () => (
  <Phone label="Recherche · vide">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-warm)', borderRadius: 24, padding: '12px 16px',
          border: '1px solid var(--line)',
        }}>
          <Ico name="search" size={16} color="var(--ink-mute)"/>
          <input placeholder="Cherche un spot, un plat, une zone…" style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, outline: 'none' }}/>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>RÉCEMMENT</div>
        <div style={{ marginBottom: 22 }}>
          {['attiéké poisson Cocody', 'rooftop Plateau', 'brunch dimanche'].map(q => (
            <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <Ico name="clock" size={14} color="var(--ink-mute)"/>
              <span style={{ flex: 1, fontSize: 12.5 }}>{q}</span>
              <span style={{ fontSize: 16, color: 'var(--ink-mute)' }}>↗</span>
            </div>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>SUGGESTIONS DU CHAT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
          {['Maquis ouvert tard', 'Dattes premières', 'Fresh juice', 'Brunch instagrammable', 'Vue lagune', 'Sans gluten', 'Late night'].map(t => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>PAR CUISINE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[['🇨🇮', 'Ivoirien'], ['🥖', 'Français'], ['🍜', 'Asiatique'], ['🍕', 'Italien'], ['🥗', 'Healthy'], ['🌯', 'Street']].map(([e, n]) => (
            <div key={n} style={{ padding: '14px 8px', textAlign: 'center', background: 'var(--bg-warm)', borderRadius: 10 }}>
              <div style={{ fontSize: 22 }}>{e}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4 }}>{n}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="search"/>
    </div>
  </Phone>
);

const SearchResults = () => (
  <Phone label="Recherche · résultats">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-warm)', borderRadius: 24, padding: '12px 14px', border: '1px solid var(--line)' }}>
          <Ico name="search" size={16}/>
          <span style={{ flex: 1, fontSize: 13 }}>attiéké poisson</span>
          <Ico name="x" size={14} color="var(--ink-mute)"/>
        </div>
        <button style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'var(--pure-white)' }}>
          <Ico name="filter" size={16}/>
        </button>
      </div>

      <div style={{ padding: '4px 22px 0', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['Toutes', 'Cocody', 'Maquis', '< 5K', 'Ouvert'].map((c, i) => (
          <span key={c} className={`chip ${i === 0 ? 'chip-active' : ''}`} style={{ flexShrink: 0 }}>{c}</span>
        ))}
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 10 }}>14 spots · Triés par pertinence</div>
        {[
          { n: 'Chez Tantie Rose', sub: '★ 4.8 · Maquis · 1.2km', tag: 'Le poisson braisé est légendaire', alt: 0 },
          { n: 'Maquis du Lac', sub: '★ 4.6 · Marcory · 2.4km', tag: 'Attiéké fait maison', alt: 1 },
          { n: 'La Calebasse', sub: '★ 4.5 · Yopougon · 5.8km', tag: 'Roots, prix doux', alt: 2 },
          { n: 'Saveurs du Wharf', sub: '★ 4.4 · Plateau · 3.1km', tag: 'Vue eau, frais', alt: 3 },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
            <div className={`food-ph alt-${s.alt}`} style={{ width: 56, height: 56, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{s.n}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>{s.sub}</div>
              <div style={{ fontSize: 10.5, color: 'var(--spawt-gold)', marginTop: 4, fontStyle: 'italic' }}>« {s.tag} »</div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="search"/>
    </div>
  </Phone>
);

const SearchFilters = () => (
  <Phone label="Recherche · filtres">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Filtres</div>
        <Ico name="x" size={20}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '16px 22px 22px' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>DISTANCE</div>
        <div style={{ height: 30, position: 'relative', background: 'var(--line)', borderRadius: 4, marginBottom: 6 }}>
          <div style={{ position: 'absolute', left: '10%', right: '40%', top: 13, height: 4, background: 'var(--spawt-gold)' }}/>
          <div style={{ position: 'absolute', left: '10%', top: 8, width: 14, height: 14, borderRadius: '50%', background: 'var(--spawt-black)' }}/>
          <div style={{ position: 'absolute', left: '60%', top: 8, width: 14, height: 14, borderRadius: '50%', background: 'var(--spawt-black)' }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-mute)', marginBottom: 22 }}>
          <span>500m</span><span style={{ fontWeight: 700, color: 'var(--ink)' }}>3 km</span>
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>BUDGET / PERS</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {['< 3K', '3-8K', '8-15K', '15-25K', '25K+'].map((b, i) => (
            <span key={b} className={`chip ${i === 1 || i === 2 ? 'chip-active' : ''}`} style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>{b}</span>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>AMBIANCE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
          {[['Calme', true], ['Animée'], ['Romantique', true], ['Familial'], ['Pro'], ['Festive']].map(([n, sel]) => (
            <span key={n} className={`chip ${sel ? 'chip-active' : ''}`}>{n}</span>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 10 }}>SERVICES</div>
        {[
          ['Parking', true],
          ['Terrasse', true],
          ['Réservable', false],
          ['Climatisé', false],
          ['Halal', false],
          ['Live music', false],
        ].map(([s, on]) => (
          <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 13 }}>{s}</span>
            <div style={{
              width: 36, height: 20, borderRadius: 10, padding: 2,
              background: on ? 'var(--spawt-gold)' : 'var(--line-strong)',
              display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" style={{ flex: 1 }}>Reset</button>
        <button className="btn btn-primary" style={{ flex: 2 }}>Voir 14 spots</button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// MEUTE
// ─────────────────────────────────────────────────────────────

const MeuteFil = () => (
  <Phone label="Meute · fil">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="t-overline">🐺 LA MEUTE</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, margin: '4px 0 0' }}>Ce qu'ils ont spawté</h1>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-warm)', border: 'none' }}>
          <Ico name="users" size={16}/>
        </button>
      </div>

      <div style={{ padding: '6px 22px 4px', overflowX: 'auto', display: 'flex', gap: 12 }}>
        {[
          ['Kouassi', 4, '🟢'],
          ['Aminata', 3, '🟢'],
          ['Dadou', 1, '🟡'],
          ['Marc', 2, '⚫'],
          ['Fatou', 0, '🟢'],
        ].map(([n, alt, st]) => (
          <div key={n} style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <div className={`food-ph alt-${alt}`} style={{ width: 50, height: 50, borderRadius: '50%', padding: 0, border: '2px solid var(--spawt-gold)' }}/>
              <span style={{ position: 'absolute', bottom: 0, right: 0, fontSize: 10 }}>{st}</span>
            </div>
            <div style={{ fontSize: 10, marginTop: 4, fontWeight: 600 }}>{n}</div>
          </div>
        ))}
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        {[
          { who: 'Aminata K.', when: 'il y a 2h', spot: 'Sky Lounge Ivoire', stars: 5, msg: 'Date parfaite, vue dingue.', img: 3 },
          { who: 'Kouassi', when: 'il y a 5h', spot: 'Chez Maman Africa', stars: 4, msg: 'Le foutou banane est légendaire.', img: 0 },
          { who: 'Marc', when: 'hier', spot: 'Le Nomade', stars: 3, msg: 'Mitigé. Service lent ce soir-là.', img: 1 },
        ].map((p, i) => (
          <div key={i} style={{
            background: 'var(--pure-white)', border: '1px solid var(--line)', borderRadius: 14,
            padding: 14, marginBottom: 10,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <div className={`food-ph alt-${p.img}`} style={{ width: 32, height: 32, borderRadius: '50%', padding: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{p.who}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>spawté {p.spot} · {p.when}</div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--spawt-gold)' }}>{'★'.repeat(p.stars)}</span>
            </div>
            <div className={`food-ph alt-${p.img}`} style={{ width: '100%', height: 140, borderRadius: 10, padding: 0, marginBottom: 10 }}/>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>« {p.msg} »</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--ink-mute)' }}>
              <span>🐾 12 reconnaissent</span>
              <span>💬 3 commentaires</span>
              <span style={{ marginLeft: 'auto', color: 'var(--spawt-gold)', fontWeight: 700 }}>Voir le spot</span>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

const MeuteCrew = () => (
  <Phone label="Meute · crew">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1 }}>
          <div className="t-overline">TON CREW</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>5 spawters</h1>
        </div>
        <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--spawt-gold)', border: 'none' }}>
          <Ico name="plus" size={16}/>
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 22px 22px' }}>
        {[
          ['Aminata K.', '@aminata · 🏆 Djidji · 412 paws', 0],
          ['Kouassi B.', '@kouas · ✨ Explorateur · 287 paws', 4],
          ['Marc D.', '@marc · ✨ Explorateur · 156 paws', 1],
          ['Fatou T.', '@fatou · 🐾 Spawter · 89 paws', 2],
          ['Dadou', '@dadou · 🐾 Spawter · 64 paws', 3],
        ].map(([n, sub, alt]) => (
          <div key={n} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
            <div className={`food-ph alt-${alt}`} style={{ width: 44, height: 44, borderRadius: '50%', padding: 0, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{n}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</div>
            </div>
            <button style={{ fontSize: 11, color: 'var(--ink-mute)', background: 'none', border: 'none' }}>•••</button>
          </div>
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16 }}>
          + Inviter un spawter
        </button>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

const MeuteAsk = () => (
  <Phone label="Demander une reco">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div className="t-overline">DEMANDER À LA MEUTE</div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '6px 22px 22px' }}>
        <h1 className="t-h1" style={{ marginBottom: 6 }}>Tu cherches quoi ?</h1>
        <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 20 }}>
          Le chat ne sait pas tout. Ton crew oui.
        </div>

        <textarea
          defaultValue="Un bon endroit pour brunch dimanche, 4 personnes, sur Cocody. Ambiance posée."
          style={{
            width: '100%', minHeight: 110, padding: 14, borderRadius: 12,
            border: '1px solid var(--line-strong)', fontSize: 13, lineHeight: 1.5,
            fontFamily: 'inherit', resize: 'none',
          }}
        />

        <div className="t-overline" style={{ margin: '20px 0 10px' }}>QUI VA RECEVOIR</div>
        {['Crew complet (5)', 'Aminata, Kouassi (date pros)', 'Toute la meute'].map((c, i) => (
          <div key={c} style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 6,
            background: i === 0 ? 'var(--gr-gold)' : 'var(--pure-white)',
            border: i === 0 ? 'none' : '1px solid var(--line-strong)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '2px solid ' + (i === 0 ? 'var(--spawt-black)' : 'var(--ink-mute)'),
              background: i === 0 ? 'var(--spawt-black)' : 'transparent',
            }}/>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{c}</span>
          </div>
        ))}

        <div style={{
          marginTop: 20, padding: 14, background: 'var(--bg-warm)', borderRadius: 12,
          fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5,
        }}>
          💡 Tu auras les réponses dans ton fil meute. En moyenne, 3 réponses sous 2h.
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          Envoyer · Crew complet
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// SPAWTE SUITE — partage + détail passé
// ─────────────────────────────────────────────────────────────

const SpawtePartage = () => (
  <Phone label="Spawte · partage">
    <div style={{ flex: 1, background: 'var(--gr-night)', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ico name="x" size={20} color="#fff"/>
        <div className="t-overline" style={{ color: 'var(--spawt-gold)' }}>PARTAGER</div>
        <div style={{ width: 20 }}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        {/* Card preview */}
        <div style={{
          background: 'var(--pure-white)', color: 'var(--ink)',
          borderRadius: 18, padding: 18, marginBottom: 22,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}>
          <div className="food-ph alt-3" style={{ width: '100%', height: 200, borderRadius: 12, padding: 0, marginBottom: 14 }}/>
          <div className="t-overline">SPAWT · BETSY</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, marginTop: 4 }}>Sky Lounge Ivoire</div>
          <div style={{ display: 'flex', gap: 4, color: 'var(--spawt-gold)', marginTop: 6 }}>★★★★★</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 10, fontStyle: 'italic', color: 'var(--ink-soft)' }}>
            « Date réussie. Service top. Vue incroyable. »
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wordmark size={14}/>
            <span style={{ fontSize: 10, color: 'var(--ink-mute)', marginLeft: 'auto' }}>spawt.ci</span>
          </div>
        </div>

        <div className="t-overline" style={{ color: 'var(--spawt-gold)', marginBottom: 12 }}>PARTAGER VIA</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            ['📱', 'WhatsApp', '#25D366'],
            ['📷', 'IG Story', '#E4405F'],
            ['🔗', 'Lien', '#666'],
            ['💬', 'Meute', 'var(--spawt-gold)'],
          ].map(([e, n, c]) => (
            <div key={n} style={{ textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, background: c,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, margin: '0 auto 6px',
              }}>{e}</div>
              <div style={{ fontSize: 11 }}>{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </Phone>
);

const SpawteDetail = () => (
  <Phone label="Spawte · détail passé">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1 }}>
        <div className="food-ph alt-3" style={{ width: '100%', height: 240, padding: 0, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 14, left: 16 }}>
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none' }}>
              <Ico name="arrow-left" size={16} color="#fff"/>
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 22px 22px' }}>
          <div className="t-overline">SPAWT · 23 OCT 2026</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, margin: '6px 0 4px' }}>Sky Lounge Ivoire</h1>
          <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>Date · 19h45 · 2 personnes</div>

          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => <span key={i} style={{ fontSize: 22, color: 'var(--spawt-gold)' }}>★</span>)}
          </div>

          <div style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 16, marginTop: 16, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6 }}>
            « Date réussie. Service top. Vue incroyable au coucher de soleil. À refaire absolument. »
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {['Date réussie', 'Service top', 'Vue incroyable'].map(t => (
              <span key={t} className="chip chip-gold">{t}</span>
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <div className="t-overline" style={{ marginBottom: 10 }}>STATS DE CE SPAWT</div>
            <div style={{ background: 'var(--pure-white)', border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-mute)' }}>🐾 Reconnaissances</span>
                <span style={{ fontWeight: 700 }}>23</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-mute)' }}>👥 Suivi par</span>
                <span style={{ fontWeight: 700 }}>5 personnes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
                <span style={{ color: 'var(--ink-mute)' }}>💰 Budget réel</span>
                <span style={{ fontWeight: 700 }}>42K FCFA</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }}>Modifier</button>
            <button className="btn btn-primary" style={{ flex: 1 }}>Partager</button>
          </div>
        </div>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// PAYWALL
// ─────────────────────────────────────────────────────────────

const PaywallFull = () => (
  <Phone label="Paywall · Spawter Gold" tone="dark">
    <div style={{ flex: 1, background: 'var(--gr-night)', color: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Ico name="x" size={20} color="#fff"/>
        <Wordmark color="var(--spawt-gold)" size={20}/>
        <div style={{ width: 20 }}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 22px 22px' }}>
        <div style={{ textAlign: 'center', padding: '14px 0 22px' }}>
          <div style={{
            display: 'inline-block', padding: '5px 14px', borderRadius: 20,
            background: 'var(--spawt-gold)', color: 'var(--spawt-black)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 14,
          }}>SPAWTER GOLD</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, lineHeight: 1.05 }}>
            Marque ton territoire.
          </h1>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--spawt-gold-light)', marginTop: 8 }}>
            Sans limites.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
          {[
            ['🗺️', 'Carte sans limites', 'Tout Abidjan, pas seulement 3km'],
            ['🐺', 'Voix du chat enrichies', 'Déductions plus poussées sur tes patterns'],
            ['📊', 'Stats détaillées', 'Temps gagné, taux satisfaction, impact'],
            ['🎯', 'Recos prioritaires', 'Avant tout le monde sur les nouveaux spots'],
            ['🐾', '+50% paws sur tes spawts', 'Monte de stade plus vite'],
            ['🎟️', 'Réservations premium', 'Tables réservées en priorité'],
          ].map(([e, t, s]) => (
            <div key={t} style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(200,164,78,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{e}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>{t}</div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {[
            { p: 'Mensuel', v: '4 900', sub: 'F / mois', recurring: '4 900 F / mois' },
            { p: 'Annuel', v: '39 000', sub: 'F / an', recurring: '3 250 F / mois', save: '−34%', selected: true },
          ].map((P, i) => (
            <div key={P.p} style={{
              padding: 18, borderRadius: 14,
              background: P.selected ? 'var(--gr-gold)' : 'rgba(255,255,255,0.05)',
              color: P.selected ? 'var(--ink)' : '#fff',
              border: P.selected ? 'none' : '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{P.p}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{P.recurring}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>{P.v}</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{P.sub}</div>
                {P.save && <div style={{ fontSize: 10, color: P.selected ? 'var(--alert-red)' : 'var(--spawt-gold)', fontWeight: 700, marginTop: 2 }}>{P.save}</div>}
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-gold-grad" style={{ width: '100%', marginBottom: 8 }}>
          Devenir Spawter Gold · 39 000 F / an
        </button>
        <div style={{ textAlign: 'center', fontSize: 10, opacity: 0.55 }}>
          Annulation à tout moment · Mobile Money & Visa
        </div>
      </div>
    </div>
  </Phone>
);

const PaywallModal = () => (
  <Phone label="Paywall · modal en contexte">
    <div style={{ flex: 1, position: 'relative', background: 'var(--bg-warm)' }}>
      {/* faint underlying screen */}
      <div style={{ padding: '14px 22px', opacity: 0.3 }}>
        <div className="t-overline">CARTE</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>3 km autour</div>
      </div>
      <div style={{ background: 'var(--line)', height: 240, margin: '0 22px', borderRadius: 12, opacity: 0.3 }}/>

      {/* Modal */}
      <div style={{
        position: 'absolute', left: 18, right: 18, bottom: 30,
        background: 'var(--pure-white)', borderRadius: 20, padding: 22,
        boxShadow: '0 -16px 48px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--line)', borderRadius: 2, margin: '0 auto 16px' }}/>
        <div className="t-overline" style={{ color: 'var(--spawt-gold)', textAlign: 'center', marginBottom: 6 }}>SPAWTER GOLD</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 1.15, textAlign: 'center', margin: 0 }}>
          Tu veux voir tout Abidjan ?
        </h2>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', textAlign: 'center', marginTop: 8, lineHeight: 1.5 }}>
          La carte gratuite s'arrête à 3 km. Gold débloque tout — Cocody, Plateau, Yopougon, Assinie.
        </div>

        <div style={{ background: 'var(--bg-warm)', borderRadius: 10, padding: 12, marginTop: 16, fontSize: 11.5, color: 'var(--ink-soft)' }}>
          ✨ + voix chat enrichies · stats détaillées · réservations premium
        </div>

        <button className="btn btn-gold-grad" style={{ width: '100%', marginTop: 16 }}>
          Devenir Gold · 3 250 F / mois
        </button>
        <button style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', fontSize: 12, color: 'var(--ink-mute)', padding: 8 }}>
          Plus tard
        </button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// RÉGLAGES
// ─────────────────────────────────────────────────────────────

const Reglages = () => (
  <Phone label="Réglages">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Réglages</h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        {/* Profil edit */}
        <div style={{ background: 'var(--bg-warm)', borderRadius: 14, padding: 14, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="food-ph alt-3" style={{ width: 50, height: 50, borderRadius: '50%', padding: 0, border: '2px solid var(--spawt-gold)' }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>Betsy Diomandé</div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>betsy@spawt.ci</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--spawt-gold)', fontWeight: 700 }}>Modifier</span>
        </div>

        {[
          {
            t: 'Compte',
            items: [
              ['👤', 'Profil & photo'],
              ['📧', 'Email & téléphone'],
              ['🔒', 'Mot de passe'],
            ],
          },
          {
            t: 'Préférences',
            items: [
              ['🌍', 'Langue', 'Français'],
              ['📍', 'Quartier de référence', 'Cocody'],
              ['💰', 'Budget moyen', '8-25K FCFA'],
              ['🎨', 'Style culinaire', 'Roots, festif, voyageur'],
            ],
          },
          {
            t: 'Notifications',
            items: [
              ['🔔', 'Push (chat)', null, true],
              ['📨', 'Email résumé', null, false],
              ['🐺', 'Activité meute', null, true],
            ],
          },
          {
            t: 'Spawter Gold',
            items: [
              ['👑', 'Mon abonnement', 'Annuel · renouvelle 23/04/27'],
              ['💳', 'Mode de paiement', 'MoMo Orange ····12'],
            ],
          },
          {
            t: 'Légal',
            items: [
              ['📜', 'Conditions'],
              ['🔐', 'Confidentialité'],
              ['🐾', 'Charte du spawter'],
              ['❓', 'Aide & support'],
            ],
          },
        ].map(s => (
          <div key={s.t} style={{ marginBottom: 20 }}>
            <div className="t-overline" style={{ marginBottom: 8 }}>{s.t.toUpperCase()}</div>
            <div style={{ background: 'var(--pure-white)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              {s.items.map((row, i) => {
                const [e, l, val, on] = row;
                const isToggle = on !== undefined;
                return (
                  <div key={l} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    borderBottom: i < s.items.length - 1 ? '1px solid var(--line)' : 'none',
                  }}>
                    <span style={{ fontSize: 16 }}>{e}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
                    {val && <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{val}</span>}
                    {isToggle ? (
                      <div style={{
                        width: 36, height: 20, borderRadius: 10, padding: 2,
                        background: on ? 'var(--spawt-gold)' : 'var(--line-strong)',
                        display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
                      }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }}/>
                      </div>
                    ) : <Ico name="chevron-right" size={14} color="var(--ink-mute)"/>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <button style={{
          width: '100%', padding: 12, background: 'none', border: 'none',
          color: 'var(--alert-red)', fontWeight: 700, fontSize: 13,
        }}>Se déconnecter</button>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// NOTIFS
// ─────────────────────────────────────────────────────────────

const Notifs = () => (
  <Phone label="Notifs · centre">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, flex: 1 }}>Tes pings</h1>
        <span style={{ fontSize: 11, color: 'var(--spawt-gold)', fontWeight: 700 }}>Tout lu</span>
      </div>

      <div className="scroll" style={{ flex: 1 }}>
        {[
          { e: '🐱', cat: 'CHAT', t: 'Sky Lounge a une table libre ce soir 19h30. Tu m\'écoutes ?', when: 'il y a 12 min', unread: true },
          { e: '🐺', cat: 'MEUTE', t: 'Aminata a spawté Sky Lounge. ★★★★★', when: 'il y a 2h', unread: true },
          { e: '🐾', cat: 'STADE', t: 'Tu as gagné +12 paws sur ton dernier spawt.', when: 'il y a 4h' },
          { e: '🏆', cat: 'JALON', t: '"La Tanière" est complétée. Tu passes Djidji ce mois ?', when: 'hier' },
          { e: '🗳️', cat: 'SQUAD', t: 'Kouassi a voté sur "Samedi avec le squad".', when: 'hier' },
          { e: '✨', cat: 'NOUVEAU', t: 'Le Petit Jardin vient d\'ouvrir à Cocody. À tester ?', when: 'il y a 2 jours' },
        ].map((n, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, padding: '14px 22px',
            borderBottom: '1px solid var(--line)',
            background: n.unread ? 'rgba(200,164,78,0.06)' : 'transparent',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--bg-warm)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
            }}>{n.e}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9.5, letterSpacing: '0.08em', color: 'var(--spawt-gold)', fontWeight: 700, marginBottom: 2 }}>{n.cat}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{n.t}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 4 }}>{n.when}</div>
            </div>
            {n.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--spawt-gold)', flexShrink: 0, marginTop: 6 }}/>}
          </div>
        ))}
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// ÉTATS VIDES
// ─────────────────────────────────────────────────────────────

const EmptyState = ({ title, sub, emoji = '🐾', cta, label }) => (
  <Phone label={label}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 18 }}>{emoji}</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 1.15, margin: '0 0 10px' }}>{title}</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 22 }}>{sub}</div>
        {cta && <button className="btn btn-primary">{cta}</button>}
      </div>
    </div>
  </Phone>
);

const J0Empty = () => (
  <EmptyState
    label="État · J0 vide"
    emoji="🐱"
    title="Premier jour. Premier spawt."
    sub="Le chat ne sait rien de toi encore. Tape un mode pour démarrer — il observe, il déduit, il te connaît à J7."
    cta="Choisir un mode"
  />
);

const OfflineEmpty = () => (
  <EmptyState
    label="État · hors-ligne"
    emoji="📡"
    title="Pas de réseau."
    sub="Tu peux quand même voir tes spots favoris en cache. Le chat dort en attendant."
    cta="Voir les favoris (cache)"
  />
);

const NoResults = () => (
  <EmptyState
    label="État · 0 résultat"
    emoji="🐾"
    title="Rien dans ce coin."
    sub="Élargis la zone, change le mood, ou demande à la meute. Personne n'aime un chat vide."
    cta="Demander à la meute"
  />
);

const SpotClosed = () => (
  <EmptyState
    label="État · fermé"
    emoji="🔒"
    title="Sky Lounge est fermé maintenant."
    sub="Ouvre demain à 18h. Je te suggère 2 alternatives ouvertes dans le même style."
    cta="Voir 2 alternatives"
  />
);

const NetworkError = () => (
  <EmptyState
    label="État · erreur"
    emoji="😼"
    title="Le chat tousse."
    sub="Erreur réseau. Réessaie dans quelques secondes — c'est sûrement passager."
    cta="Réessayer"
  />
);

// ─────────────────────────────────────────────────────────────
// TANIÈRE — création + détail
// ─────────────────────────────────────────────────────────────

const TaniereCreate = () => (
  <Phone label="Tanière · création">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="x" size={20}/>
        <div className="t-overline">CRÉER UNE TANIÈRE</div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 22px' }}>
        <h1 className="t-h1" style={{ marginBottom: 6 }}>Ta tanière, c'est quoi ?</h1>
        <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>
          Un cercle privé pour partager tes spots avec ton crew. 5 personnes max.
        </div>

        <div className="t-overline" style={{ marginBottom: 6 }}>NOM DE LA TANIÈRE</div>
        <input className="input" defaultValue="Le Crew Cocody" style={{ marginBottom: 18 }}/>

        <div className="t-overline" style={{ marginBottom: 6 }}>EMOJI</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {['🐺', '🐾', '🌴', '🍻', '🎯', '✨', '🔥', '💛'].map((e, i) => (
            <div key={e} style={{
              width: 44, height: 44, borderRadius: 12,
              background: i === 0 ? 'var(--gr-gold)' : 'var(--bg-warm)',
              border: i === 0 ? '2px solid var(--spawt-gold)' : '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>{e}</div>
          ))}
        </div>

        <div className="t-overline" style={{ marginBottom: 6 }}>INVITER (max 5)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: 10, border: '1px solid var(--line-strong)', borderRadius: 10, marginBottom: 14 }}>
          {['Aminata', 'Kouassi'].map(n => (
            <span key={n} className="chip chip-active">{n} ×</span>
          ))}
          <input style={{ flex: 1, minWidth: 100, border: 'none', outline: 'none', fontSize: 12, padding: 4 }} placeholder="Ajouter @username…"/>
        </div>

        <div style={{ background: 'var(--bg-warm)', borderRadius: 10, padding: 12, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          🐾 Les tanières sont privées. Seuls les membres voient les spawts partagés dedans.
        </div>
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>Créer ma tanière</button>
      </div>
    </div>
  </Phone>
);

const TaniereDetail = () => (
  <Phone label="Tanière · détail">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        background: 'var(--gr-night)', color: '#fff', padding: '24px 22px 20px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.3 }}/>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Ico name="arrow-left" size={20} color="#fff"/>
            <div style={{ fontSize: 36 }}>🐺</div>
            <div style={{ flex: 1 }}>
              <div className="t-overline" style={{ color: 'var(--spawt-gold)' }}>TANIÈRE</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>Le Crew Cocody</div>
            </div>
            <Ico name="more" size={18} color="#fff"/>
          </div>
          <div style={{ display: 'flex', gap: -6, marginTop: 14 }}>
            {[0, 4, 1, 2].map((a, i) => (
              <div key={i} className={`food-ph alt-${a}`} style={{
                width: 32, height: 32, borderRadius: '50%', padding: 0,
                marginLeft: i === 0 ? 0 : -8, border: '2px solid var(--spawt-black)',
              }}/>
            ))}
            <div style={{ marginLeft: 10, fontSize: 12, opacity: 0.75, alignSelf: 'center' }}>4 spawters · 12 spots partagés</div>
          </div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '16px 22px 22px' }}>
        <div className="t-overline" style={{ marginBottom: 10 }}>SPOTS PARTAGÉS · 12</div>
        {[
          { n: 'Sky Lounge Ivoire', who: 'Aminata · ★★★★★', alt: 3 },
          { n: 'Chez Maman Africa', who: 'Kouassi · ★★★★', alt: 0 },
          { n: 'Le Nomade', who: 'Toi · ★★★', alt: 1 },
          { n: 'Juice Factory', who: 'Aminata · ★★★★', alt: 4 },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className={`food-ph alt-${s.alt}`} style={{ width: 48, height: 48, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>{s.n}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>{s.who}</div>
            </div>
          </div>
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16 }}>+ Partager un spot dans cette tanière</button>
      </div>
    </div>
  </Phone>
);

Object.assign(window, {
  SearchEmpty, SearchResults, SearchFilters,
  MeuteFil, MeuteCrew, MeuteAsk,
  SpawtePartage, SpawteDetail,
  PaywallFull, PaywallModal,
  Reglages, Notifs,
  J0Empty, OfflineEmpty, NoResults, SpotClosed, NetworkError,
  TaniereCreate, TaniereDetail,
});
