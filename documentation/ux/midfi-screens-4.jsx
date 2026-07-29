/* global React, Phone, Ico, CatBubble, Stars, MatchScore, TabBar */
// SPAWT Mid-fi Screens — part 4: Résultats par mode (Date / Solo / Squad), Squad list, Spot detail premium

const ResultRow = ({ rank, item }) => (
  <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
    <div style={{
      width: 36, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24,
      color: rank === 1 ? 'var(--spawt-gold)' : 'var(--ink-mute)', lineHeight: 1,
    }}>
      {String(rank).padStart(2, '0')}
    </div>
    <div className={`food-ph alt-${item.alt}`} style={{ width: 56, height: 56, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{item.name}</div>
        {item.match && <MatchScore value={item.match}/>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>★ {item.stars} · {item.sub}</div>
      {item.tag && <div style={{ fontSize: 10.5, color: 'var(--spawt-gold)', marginTop: 4, fontWeight: 500, fontStyle: 'italic' }}>« {item.tag} »</div>}
    </div>
  </div>
);

// Résultats Date · Wow Factor
const ResultsDate = ({ voixChat = true }) => (
  <Phone label="Résultats · Date Wow">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: 'var(--spawt-gold)' }}>DATE · WOW FACTOR</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>3 spots taillés pour ce soir</div>
        </div>
        <Ico name="filter" size={20}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '0 22px 22px' }}>
        {/* Hero #1 */}
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <div className="food-ph alt-3" style={{ width: '100%', height: 220, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85))' }}/>
          </div>
          <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
            <span className="chip" style={{ background: 'var(--spawt-gold)', color: 'var(--spawt-black)', fontWeight: 700 }}>🏆 TOP MATCH</span>
          </div>
          <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, color: '#fff' }}>
            <div className="t-overline" style={{ color: 'var(--spawt-gold-light)' }}>ROOFTOP · COCODY</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, lineHeight: 1.1, marginTop: 4 }}>Sky Lounge Ivoire</div>
            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 6 }}>★ 4.8 · 2.3 km · 92% dates réussies</div>
          </div>
        </div>

        {voixChat && (
          <div style={{ marginBottom: 14 }}>
            <CatBubble>Vue lagune au coucher de soleil. Si elle aime ce genre, c'est plié.</CatBubble>
          </div>
        )}

        {[
          { name: 'La Table de Marie', stars: 4.7, sub: 'Gastro · 1.8 km', match: 88, tag: 'Intime, qualité garantie', alt: 1 },
          { name: 'Villa Ker Maeva', stars: 4.6, sub: 'Cuisine fusion · 3.1 km', match: 84, tag: 'Jardin tropical, cosy', alt: 0 },
        ].map((s, i) => <ResultRow key={i} rank={i + 2} item={s}/>)}

        <div style={{ paddingTop: 16, textAlign: 'center' }}>
          <button className="btn btn-secondary" style={{ fontSize: 12 }}>Pas convaincu · refaire</button>
        </div>
      </div>
      <TabBar active="home"/>
    </div>
  </Phone>
);

// Résultats Solo · Léger
const ResultsSolo = () => (
  <Phone label="Résultats · Solo léger">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>SOLO · LÉGER · 500M</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>3 trouvailles à pied</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '0 22px 22px' }}>
        {/* TOP card */}
        <div style={{
          background: 'var(--gr-night)', color: '#fff', borderRadius: 16,
          padding: '18px 18px 16px', position: 'relative', overflow: 'hidden', marginBottom: 14,
        }}>
          <div className="pattern-dots-gold" style={{ position: 'absolute', inset: 0, opacity: 0.4 }}/>
          <div style={{ position: 'relative' }}>
            <div className="t-overline" style={{ color: 'var(--spawt-gold)' }}>1️⃣ C'EST LÀ 👆</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, marginTop: 6 }}>Juice Factory</div>
            <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 4 }}>★ 4.7 · Salades & Jus · 180m</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, opacity: 0.85 }}>
              <span>💰 3-5K</span>
              <span>⏱️ 15min service</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--spawt-gold)', marginTop: 10, fontStyle: 'italic' }}>
              « Tu y vas 2×/mois déjà. Si c'est validé, c'est validé. »
            </div>
            <button className="btn btn-gold-grad" style={{ marginTop: 14, width: '100%' }}>
              Y aller maintenant
              <Ico name="arrow-right" size={16}/>
            </button>
          </div>
        </div>

        {[
          { name: 'Café Nomade', stars: 4.5, sub: '320m · café', tag: 'Nouveau pour toi', alt: 4 },
          { name: 'Green Bowl', stars: 4.4, sub: '480m · bowl', tag: 'Le moins cher', alt: 1 },
        ].map((s, i) => <ResultRow key={i} rank={i + 2} item={s}/>)}
      </div>
      <TabBar active="home"/>
    </div>
  </Phone>
);

// Résultats Squad
const ResultsSquad = () => (
  <Phone label="Résultats · Squad">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1 }}>
          <div className="t-overline" style={{ color: 'var(--ink-mute)' }}>SQUAD · 5-8 · BOUFFE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>3 suggestions pour vous</div>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '0 22px 22px' }}>
        {/* Vote CTA */}
        <div style={{
          background: 'var(--bg-warm)', borderRadius: 14, padding: 14,
          border: '1px dashed var(--spawt-gold)', marginBottom: 18,
        }}>
          <div className="t-overline" style={{ color: 'var(--spawt-gold)', marginBottom: 4 }}>📋 CRÉER UNE LISTE VOTE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>« Samedi avec le squad »</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
            Le squad vote, SPAWT décide.
          </div>
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 12 }}>
            Créer et partager
          </button>
        </div>

        <div className="t-overline" style={{ marginBottom: 8 }}>MES SUGGESTIONS POUR VOUS</div>

        {[
          { name: "Le Ranch d'Abidjan", stars: 4.6, sub: 'BBQ · ~6K/pers · Cocody', checks: ['Tables 8 pers dispo', 'Parking OK', 'Bruit OK'], alt: 2 },
          { name: 'Chez Tantie Rose', stars: 4.8, sub: 'Maquis · ~4K/pers · Marcory', checks: ['Tables grandes', 'Ambiance familière'], alt: 0 },
          { name: 'Saveurs du Lac', stars: 4.5, sub: 'Poisson · ~5K/pers · Zone 4', checks: ['Vue eau', 'Calme'], alt: 1 },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={`food-ph alt-${s.alt}`} style={{ width: 56, height: 56, borderRadius: 10, padding: 0, flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>★ {s.stars} · {s.sub}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {s.checks.map(c => (
                <span key={c} style={{ fontSize: 10.5, color: 'var(--chat-green-deep)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ✅ {c}
                </span>
              ))}
            </div>
            <button style={{ marginTop: 10, fontSize: 11, color: 'var(--spawt-gold)', background: 'none', border: 'none', fontWeight: 700, padding: 0, cursor: 'pointer' }}>
              + Ajouter à la liste
            </button>
          </div>
        ))}
      </div>
      <TabBar active="home"/>
    </div>
  </Phone>
);

// Squad list — page de vote partagée
const SquadList = () => (
  <Phone label="Squad · liste vote">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ico name="arrow-left" size={20}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-overline">LISTE VOTE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Samedi avec le squad</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', marginTop: 2 }}>Créée par toi · 3 spots · 2 votes</div>
        </div>
        <Ico name="share" size={18}/>
      </div>

      <div className="scroll" style={{ flex: 1, padding: '0 22px 22px' }}>
        {/* WhatsApp share band */}
        <div style={{
          background: '#1F4D39', color: '#fff', borderRadius: 14, padding: '14px 16px',
          marginBottom: 18,
        }}>
          <div style={{ fontSize: 11.5, opacity: 0.85, marginBottom: 6 }}>🔗 spawt.ci/vote/xK7mP</div>
          <div style={{ fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.4, marginBottom: 12 }}>
            « Le squad vote, SPAWT décide. »
          </div>
          <button style={{
            background: '#25D366', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 14px', width: '100%', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          }}>
            📤 Partager sur WhatsApp
          </button>
        </div>

        {[
          { rank: 1, name: "Le Ranch d'Abidjan", sub: '★ 4.6 · BBQ · ~6K/pers', votes: 1, alt: 2 },
          { rank: 2, name: 'Chez Tantie Rose', sub: '★ 4.8 · Maquis · ~4K/pers', votes: 1, alt: 0, leader: true },
          { rank: 3, name: 'Saveurs du Lac', sub: '★ 4.5 · Poisson · ~5K/pers', votes: 0, alt: 1 },
        ].map(s => (
          <div key={s.rank} style={{
            display: 'flex', gap: 12, padding: '14px 12px', marginBottom: 8,
            borderRadius: 12, border: s.leader ? '2px solid var(--spawt-gold)' : '1px solid var(--line)',
            background: s.leader ? 'rgba(200,164,78,0.08)' : 'var(--pure-white)',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: 'var(--bg-warm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>{s.rank}</div>
            <div className={`food-ph alt-${s.alt}`} style={{ width: 44, height: 44, borderRadius: 8, padding: 0, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-mute)', marginTop: 2 }}>{s.sub}</div>
              <div style={{ fontSize: 10, color: s.votes > 0 ? 'var(--spawt-gold)' : 'var(--ink-mute)', fontWeight: 600, marginTop: 4 }}>
                {s.votes} vote{s.votes !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}

        <div style={{
          padding: 12, background: 'var(--bg-warm)', borderRadius: 10,
          fontSize: 11, color: 'var(--ink-soft)', textAlign: 'center', marginTop: 8,
        }}>
          ⏰ Vote ouvert jusqu'à <strong>vendredi 18h</strong>
        </div>

        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }}>+ Ajouter un spot</button>
        <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }}>Fermer le vote</button>
      </div>
    </div>
  </Phone>
);

// Spot detail premium — refonte façon démo dev
const SpotDetailPremium = () => (
  <Phone label="Spot · Sky Lounge premium">
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="scroll" style={{ flex: 1 }}>
        <div style={{ position: 'relative' }}>
          <div className="food-ph alt-3" style={{ width: '100%', height: 240, padding: 0 }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), transparent 40%, rgba(0,0,0,0.5))' }}/>
          </div>
          <div style={{ position: 'absolute', top: 14, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', zIndex: 5 }}>
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: 'none' }}>
              <Ico name="arrow-left" size={16} color="#fff"/>
            </button>
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: 'none' }}>
              <Ico name="heart" size={16} color="#fff"/>
            </button>
          </div>
        </div>

        <div style={{ padding: '18px 22px 12px' }}>
          <div className="t-overline">ROOFTOP · COCODY · 2.3 KM</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 28, margin: '6px 0 8px', lineHeight: 1.05 }}>
            Sky Lounge Ivoire
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--ink-soft)' }}>
            <span>★ 4.8</span>
            <span>·</span>
            <span>127 spawtes</span>
            <MatchScore value={92}/>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            <span className="chip chip-gold">🏆 Top Date</span>
            <span className="chip">📸 Photogénique</span>
            <span className="chip">🌙 Date Night</span>
          </div>
        </div>

        {/* Pourquoi ce spot */}
        <div style={{ padding: '6px 22px 16px' }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>💬 POURQUOI POUR TOI</div>
          <div style={{ background: 'var(--bg-warm)', borderRadius: 12, padding: 14, fontSize: 12.5, lineHeight: 1.6 }}>
            <div>• 92% de dates réussies</div>
            <div>• Tu aimes les rooftops</div>
            <div>• Vue sur la lagune (ton truc)</div>
            <div>• Carte vins extensive</div>
          </div>
        </div>

        {/* Stats qui comptent */}
        <div style={{ padding: '0 22px 16px' }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>📊 STATS QUI COMPTENT</div>
          {[
            ['Ambiance', 'Intime', 0.85],
            ['Volume sonore', 'Calme', 0.30],
            ['Service', 'Top', 0.95],
            ['Rapport Q/P', 'Premium', 0.65],
          ].map(([k, v, w]) => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
              <div style={{ height: 4, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${w * 100}%`, height: '100%', background: 'var(--spawt-gold)' }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Budget */}
        <div style={{ padding: '0 22px 16px' }}>
          <div className="t-overline" style={{ marginBottom: 10 }}>💰 BUDGET ESTIMÉ</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[['Solo', '15-20K'], ['En duo', '35-45K'], ['Groupe 4', '70-90K']].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--bg-warm)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>{l}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, marginTop: 2 }}>{v} F</div>
              </div>
            ))}
          </div>
        </div>

        {/* Traces récentes */}
        <div style={{ padding: '0 22px 22px' }}>
          <div className="t-overline" style={{ marginBottom: 12 }}>📝 TRACES RÉCENTES</div>
          <div style={{ background: 'var(--pure-white)', borderRadius: 12, padding: 14, border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <div className="food-ph alt-4" style={{ width: 32, height: 32, borderRadius: '50%', padding: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5 }}>Aminata K. · 🏆 Djidji</div>
                <div style={{ fontSize: 10, color: 'var(--ink-mute)' }}>Il y a 3 jours · ⭐⭐⭐⭐⭐</div>
              </div>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-soft)' }}>
              « Date parfaite. La vue au coucher de soleil, le service discret, le tartare était incroyable. »
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--spawt-gold)', marginTop: 8, fontWeight: 600 }}>🐾 23 reconnaissances</div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--spawt-gold)', fontWeight: 700 }}>
            Voir les 127 traces →
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 18px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 0, padding: '13px 14px' }}>
          <Ico name="pin" size={16}/>
        </button>
        <button className="btn btn-gold-grad" style={{ flex: 1 }}>
          🗓️ Réserver · Premium
        </button>
      </div>
    </div>
  </Phone>
);

Object.assign(window, { ResultsDate, ResultsSolo, ResultsSquad, SquadList, SpotDetailPremium });
