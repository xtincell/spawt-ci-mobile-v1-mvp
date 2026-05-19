/* global React, Phone, Ico, CatBubble, TabBar, Wordmark, PalaisRadar */
// SPAWT Mid-fi Screens — part 5: Auth, Onboarding 5 écrans, Découvrir, Listes, Profil Territoire

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

const Splash = () => (
  <Phone label="Splash" tone="dark">
    <div style={{
      flex: 1, background: 'var(--gr-night)', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff', overflow: 'hidden',
    }}>
      <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}/>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ marginBottom: 18 }}><Wordmark color="var(--spawt-gold)" size={48}/></div>
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, opacity: 0.75, fontWeight: 400, letterSpacing: '0.04em' }}>
          Trouve ton spot, marque ton territoire.
        </div>
        <div style={{ marginTop: 60, fontSize: 32 }}>🐾</div>
      </div>
      <div style={{ position: 'absolute', bottom: 30, fontSize: 10, opacity: 0.5, letterSpacing: '0.1em' }}>ABIDJAN · 2026</div>
    </div>
  </Phone>
);

const Login = () => (
  <Phone label="Login">
    <div style={{ flex: 1, padding: '40px 22px 22px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 36 }}><Wordmark size={28}/></div>
      <h1 className="t-h1" style={{ marginBottom: 6 }}>Re-bonjour.</h1>
      <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 32 }}>
        Ton chat t'attendait.
      </div>

      <label className="t-overline" style={{ marginBottom: 6 }}>EMAIL OU TÉLÉPHONE</label>
      <input className="input" defaultValue="betsy@spawt.ci" style={{ marginBottom: 14 }}/>

      <label className="t-overline" style={{ marginBottom: 6 }}>MOT DE PASSE</label>
      <input className="input" type="password" defaultValue="••••••••" style={{ marginBottom: 6 }}/>
      <a style={{ fontSize: 11, color: 'var(--spawt-gold)', fontWeight: 600, alignSelf: 'flex-end' }}>Mot de passe oublié ?</a>

      <button className="btn btn-primary" style={{ marginTop: 28, width: '100%' }}>Entrer</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0', fontSize: 11, color: 'var(--ink-mute)' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
        <span>OU</span>
        <div style={{ flex: 1, height: 1, background: 'var(--line)' }}/>
      </div>

      <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 10 }}>📱 Continuer avec Google</button>
      <button className="btn btn-secondary" style={{ width: '100%' }}>📞 Continuer avec WhatsApp</button>

      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
        Pas de compte ? <strong style={{ color: 'var(--spawt-gold)' }}>Crée ton spawt</strong>
      </div>
    </div>
  </Phone>
);

const Signup = () => (
  <Phone label="Signup">
    <div style={{ flex: 1, padding: '40px 22px 22px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 28 }}><Wordmark size={26}/></div>
      <div className="t-overline" style={{ marginBottom: 4 }}>NOUVEAU SPAWTER</div>
      <h1 className="t-h1" style={{ marginBottom: 6 }}>Crée ton spawt.</h1>
      <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 24 }}>
        90 secondes. Le chat s'occupe du reste.
      </div>

      {[
        ['PRÉNOM', 'Betsy'],
        ['EMAIL', 'betsy@spawt.ci'],
        ['MOT DE PASSE', '••••••••', 'password'],
      ].map(([l, v, t]) => (
        <div key={l} style={{ marginBottom: 14 }}>
          <label className="t-overline" style={{ display: 'block', marginBottom: 6 }}>{l}</label>
          <input className="input" defaultValue={v} type={t || 'text'}/>
        </div>
      ))}

      <label style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        <input type="checkbox" defaultChecked style={{ marginTop: 2 }}/>
        <span>J'accepte les conditions et la charte du spawter.</span>
      </label>

      <button className="btn btn-primary" style={{ marginTop: 22, width: '100%' }}>
        Continuer → Calibrage
      </button>

      <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: 12, color: 'var(--ink-soft)' }}>
        Déjà un compte ? <strong style={{ color: 'var(--spawt-gold)' }}>Connexion</strong>
      </div>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// ONBOARDING — 5 écrans complets
// ─────────────────────────────────────────────────────────────

const OnbStep = ({ step, total, title, sub, children, ctaLabel = 'Continuer' }) => (
  <Phone label={`Onboarding ${step}/${total}`}>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 22px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i < step ? 'var(--spawt-gold)' : 'var(--line)',
            }}/>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-mute)', fontWeight: 600 }}>{step}/{total}</div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '14px 22px 16px' }}>
        <h1 className="t-h1" style={{ marginBottom: 6 }}>{title}</h1>
        {sub && <div className="t-body" style={{ color: 'var(--ink-soft)', marginBottom: 22 }}>{sub}</div>}
        {children}
      </div>

      <div style={{ padding: '12px 22px 24px', borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-primary" style={{ width: '100%' }}>
          {ctaLabel} <Ico name="arrow-right" size={16} color="#fff"/>
        </button>
      </div>
    </div>
  </Phone>
);

const Onb1 = () => (
  <OnbStep step={1} total={5} title="Salut. Je suis ton chat." sub="Mon job : t'épargner les mauvais spots. 90 secondes pour qu'on se calibre.">
    <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 22px' }}>
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        background: 'var(--gr-night)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', boxShadow: '0 8px 24px rgba(200,164,78,0.3)',
      }}>
        <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: 0.4 }}/>
        <div style={{ fontSize: 64, position: 'relative' }}>🐱</div>
      </div>
    </div>
    <div style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 16, fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
      <strong>3 questions courtes</strong> sur ton style, tes envies, ton budget. Après, je te trouve un spot en 90 secondes au lieu de 47 minutes Google + groupe WhatsApp.
    </div>
  </OnbStep>
);

const Onb2 = () => (
  <OnbStep step={2} total={5} title="Quel quartier tu kiffes ?" sub="On part de chez toi. Tu pourras élargir plus tard.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[
        ['Cocody', '47 spots', true],
        ['Plateau', '32 spots'],
        ['Marcory', '28 spots'],
        ['Yopougon', '19 spots'],
        ['Zone 4', '23 spots'],
        ['Assinie', '12 spots'],
      ].map(([n, c, sel]) => (
        <div key={n} style={{
          padding: '16px 12px', borderRadius: 12,
          background: sel ? 'var(--spawt-black)' : 'var(--pure-white)',
          color: sel ? '#fff' : 'var(--ink)',
          border: sel ? '2px solid var(--spawt-black)' : '1px solid var(--line-strong)',
        }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{n}</div>
          <div style={{ fontSize: 10.5, opacity: sel ? 0.7 : 0.5, marginTop: 2 }}>{c}</div>
        </div>
      ))}
    </div>
  </OnbStep>
);

const Onb3 = () => (
  <OnbStep step={3} total={5} title="Ton style, c'est plutôt…" sub="Choisis 2-3. Tu pourras affiner.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {[
        ['🌴', 'Roots', 'Maquis, terre', true],
        ['🥂', 'Chic', 'Fine dining', false],
        ['🍻', 'Festif', 'Bars, ambiance', true],
        ['🌿', 'Healthy', 'Bowls, jus', false],
        ['🌍', 'Voyageur', 'Cuisines monde', true],
        ['🍔', 'Casual', 'Burger, pizza', false],
      ].map(([e, n, s, sel]) => (
        <div key={n} style={{
          padding: '14px 12px', borderRadius: 12, textAlign: 'center',
          background: sel ? 'var(--gr-gold)' : 'var(--pure-white)',
          border: sel ? '2px solid var(--spawt-gold)' : '1px solid var(--line-strong)',
        }}>
          <div style={{ fontSize: 26 }}>{e}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginTop: 6 }}>{n}</div>
          <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>{s}</div>
        </div>
      ))}
    </div>
  </OnbStep>
);

const Onb4 = () => (
  <OnbStep step={4} total={5} title="Budget moyen par sortie ?" sub="Pour un repas duo. Le chat s'adapte au cas par cas.">
    {[
      ['🍽️', 'Petit', '< 8K FCFA', 'Maquis, street food'],
      ['🥂', 'Moyen', '8-25K FCFA', 'Casual, brasseries', true],
      ['🍷', 'Premium', '25-50K FCFA', 'Fine dining, rooftop'],
      ['🥃', 'Sky\'s the limit', '50K+', 'Pas de plafond'],
    ].map(([e, l, b, s, sel], i) => (
      <div key={l} style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: 14,
        borderRadius: 12, marginBottom: 8,
        background: sel ? 'var(--gr-gold)' : 'var(--pure-white)',
        border: sel ? 'none' : '1px solid var(--line-strong)',
      }}>
        <div style={{ fontSize: 24 }}>{e}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{l}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{s}</div>
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12 }}>{b}</div>
      </div>
    ))}
  </OnbStep>
);

const Onb5 = () => (
  <OnbStep step={5} total={5} title="Premier mode ?" sub="Ce que tu veux faire maintenant. Tu changes quand tu veux." ctaLabel="C'est parti">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        ['🍽️', 'Solo rapide', 'Je veux manger en 30 min', 'dark'],
        ['👥', 'Avec quelqu\'un', 'Date, biz, famille, squad', null, true],
        ['📍', 'Autour de moi', 'Tout ce qui est ouvert', null],
      ].map(([e, l, s, accent, sel]) => (
        <div key={l} style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 16,
          background: accent === 'dark' ? 'var(--gr-night)' : sel ? 'var(--gr-gold)' : 'var(--pure-white)',
          color: accent === 'dark' ? '#fff' : 'var(--ink)',
          borderRadius: 14, border: accent === 'dark' || sel ? 'none' : '1px solid var(--line-strong)',
        }}>
          <div style={{ fontSize: 26 }}>{e}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{l}</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{s}</div>
          </div>
        </div>
      ))}
    </div>
  </OnbStep>
);

// ─────────────────────────────────────────────────────────────
// DÉCOUVRIR
// ─────────────────────────────────────────────────────────────

const Discovery = () => (
  <Phone label="Découvrir">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px' }}>
        <div className="t-overline">DÉCOUVRIR</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, margin: '4px 0 0' }}>
          Au-delà de ton territoire
        </h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '8px 22px 22px' }}>
        {/* Trending hero */}
        <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 22 }}>
          <div className="food-ph alt-2" style={{ width: '100%', height: 180, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85))' }}/>
          </div>
          <span className="chip" style={{ position: 'absolute', top: 12, left: 12, background: 'var(--alert-red)', color: '#fff', fontWeight: 700 }}>
            🔥 TRENDING
          </span>
          <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, color: '#fff' }}>
            <div className="t-overline" style={{ color: 'var(--spawt-gold-light)' }}>NOUVEAU · COCODY</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, lineHeight: 1.1, marginTop: 4 }}>Le Petit Jardin</div>
            <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 6 }}>+47 spawtes cette semaine · « Le buzz du moment »</div>
          </div>
        </div>

        {/* Par zone */}
        <div className="t-overline" style={{ marginBottom: 10 }}>🗺️ EXPLORE PAR ZONE</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 22 }}>
          {[
            ['Cocody', 47], ['Plateau', 32], ['Marcory', 28],
            ['Yopougon', 19], ['Zone 4', 23], ['Assinie', 12],
          ].map(([n, c]) => (
            <div key={n} style={{
              padding: '12px 8px', textAlign: 'center', borderRadius: 10,
              background: 'var(--bg-warm)', border: '1px solid var(--line)',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{n}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>{c} spots</div>
            </div>
          ))}
        </div>

        {/* Par envie */}
        <div className="t-overline" style={{ marginBottom: 10 }}>🍽️ PAR ENVIE</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
          {['Ivoirien', 'Grillades', 'Poisson', 'Brunch', 'Street Food', 'Fine Dining', 'Vegan', 'Asiatique'].map(t => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>

        {/* Hasard / spawt aventure */}
        <div style={{
          background: 'var(--gr-night)', color: '#fff', borderRadius: 14, padding: 18,
          position: 'relative', overflow: 'hidden',
        }}>
          <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.3 }}/>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 26 }}>🎲</div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, marginTop: 8, lineHeight: 1.4 }}>
              « Ton chat a flairé un spot que tu n'as jamais testé. »
            </div>
            <button className="btn btn-gold-grad" style={{ marginTop: 14, width: '100%' }}>
              Voir le spot mystère
              <Ico name="arrow-right" size={16}/>
            </button>
          </div>
        </div>
      </div>
      <TabBar active="map"/>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// LISTES
// ─────────────────────────────────────────────────────────────

const Listes = () => (
  <Phone label="Listes">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="t-overline">📋 LISTES</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, margin: '4px 0 0' }}>Tes collections</h1>
        </div>
        <button style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--spawt-black)',
          color: '#fff', border: 'none', fontSize: 20, fontWeight: 700,
        }}>+</button>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '12px 22px 22px' }}>
        {[
          { e: '♡', n: 'Favoris', c: 12, t: 'Mis à jour il y a 2j', alts: [0, 3, 4] },
          { e: '📍', n: 'À tester', c: 8, t: 'Mis à jour il y a 5j', alts: [1, 2, 0] },
          { e: '👥', n: 'Samedi squad', c: 3, t: 'Vote en cours · 2/5 votes', alts: [2, 0, 1], live: true },
          { e: '💕', n: 'Spots date', c: 6, t: 'Mis à jour il y a 1sem', alts: [3, 1, 4] },
          { e: '🍖', n: 'Grillades', c: 4, t: 'Mis à jour il y a 2sem', alts: [2, 0, 1] },
        ].map(L => (
          <div key={L.n} style={{
            display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)',
            alignItems: 'center',
          }}>
            <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
              {L.alts.map((a, i) => (
                <div key={i} className={`food-ph alt-${a}`} style={{
                  position: 'absolute', width: 38, height: 38, borderRadius: 8, padding: 0,
                  left: i * 11, top: i * 6, border: '2px solid var(--pure-white)',
                  zIndex: 3 - i,
                }}/>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{L.e}</span>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>{L.n}</div>
                {L.live && <span className="chip chip-gold" style={{ fontSize: 9, padding: '2px 6px' }}>🔴 Live</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{L.c} spots · {L.t}</div>
            </div>
            <Ico name="chevron-right" size={16} color="var(--ink-mute)"/>
          </div>
        ))}

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16 }}>
          + Créer une liste
        </button>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

// ─────────────────────────────────────────────────────────────
// PROFIL TERRITOIRE — refonte avec 5 axes corrects
// ─────────────────────────────────────────────────────────────

const ProfilTerritoire = () => (
  <Phone label="Profil · Territoire">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1 }}>
        {/* Hero territoire */}
        <div style={{
          background: 'var(--gr-night)', color: '#fff', padding: '28px 22px 24px',
          position: 'relative', overflow: 'hidden',
        }}>
          <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.3 }}/>
          <div style={{ position: 'relative' }}>
            <div className="t-overline" style={{ color: 'var(--spawt-gold)' }}>TERRITOIRE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <div className="food-ph alt-3" style={{ width: 56, height: 56, borderRadius: '50%', padding: 0, border: '2px solid var(--spawt-gold)' }}/>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>Betsy Diomandé</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>@betsy · Cocody</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <span style={{
                background: 'var(--spawt-gold)', color: 'var(--spawt-black)',
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              }}>🐱 ✨ Explorateur</span>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Badge Doré</span>
            </div>
            <div style={{ display: 'flex', gap: 28, marginTop: 18 }}>
              {[['847', '🐾 paws'], ['23', 'spots'], ['5', 'zones']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 }}>{v}</div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Palais 5 axes */}
        <div style={{ padding: '22px 22px 16px' }}>
          <div className="t-overline" style={{ marginBottom: 12 }}>📊 TON PALAIS</div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <PalaisRadar
              size={220}
              labels={['Curiosité', 'Discernement', 'Générosité', 'Raffinement', 'Ancrage']}
              values={[0.82, 0.64, 0.91, 0.73, 0.45]}
            />
          </div>
          {[
            ['Curiosité', 82, 'Tu testes du nouveau souvent'],
            ['Discernement', 64, 'Tu sais ce qui est bon'],
            ['Générosité', 91, 'Tu partages tes spots'],
            ['Raffinement', 73, 'Tu cherches la qualité'],
            ['Ancrage', 45, 'Tu pourrais explorer plus de zones'],
          ].map(([k, v, h]) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{k}</span>
                <span style={{ color: 'var(--spawt-gold)', fontWeight: 700 }}>{v}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${v}%`, height: '100%', background: 'var(--spawt-gold)' }}/>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 3, fontStyle: 'italic' }}>« {h} »</div>
            </div>
          ))}
        </div>

        {/* Zones explorées */}
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div className="t-overline">🗺️ TES ZONES</div>
            <div style={{ fontSize: 11, color: 'var(--spawt-gold)', fontWeight: 700 }}>5/12 · Voir tout</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Cocody', 'Plateau', 'Marcory', 'Zone 4', 'Treichville'].map(z => (
              <span key={z} className="chip chip-gold">{z}</span>
            ))}
            {['Yopougon', 'Adjamé', 'Riviera'].map(z => (
              <span key={z} className="chip" style={{ opacity: 0.5 }}>{z}</span>
            ))}
          </div>
        </div>

        {/* Stats premium */}
        <div style={{ padding: '0 22px 16px' }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>📈 TES STATS PREMIUM</div>
          <div style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 11.5 }}>⏱️ Temps économisé ce mois</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>3h 24min</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 11.5 }}>🎯 Taux satisfaction</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--chat-green-deep)' }}>94%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: 11.5 }}>👥 Impact communauté</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>127 personnes</span>
            </div>
          </div>
        </div>

        {/* Jalons */}
        <div style={{ padding: '0 22px 22px' }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>🏆 JALONS</div>
          {[
            ['✅', 'Premier spawte', 'Complété', true],
            ['✅', '10 spots', 'Complété', true],
            ['✅', 'Premier quartier', 'Complété', true],
            ['🏠', 'La Tanière', 'En cours', false, 'highlight'],
            ['🔒', 'Le Cercle', '5 amis invités', false],
            ['🔒', 'Le Guide', '50 spots', false],
          ].map(([e, t, s, done, hi], i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '10px 12px', marginBottom: 6,
              borderRadius: 10,
              background: hi ? 'rgba(200,164,78,0.1)' : 'transparent',
              border: hi ? '1px solid var(--spawt-gold)' : 'none',
              opacity: !done && !hi ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 16 }}>{e}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{t}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="profile"/>
    </div>
  </Phone>
);

Object.assign(window, {
  Splash, Login, Signup,
  Onb1, Onb2, Onb3, Onb4, Onb5,
  Discovery, Listes, ProfilTerritoire,
});
