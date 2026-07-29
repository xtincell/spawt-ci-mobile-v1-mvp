# Story 6.5: Tableau de métriques basiques

Status: ready-for-dev

<!-- 5e et dernière story Epic 6 — dashboard custom Refine (page
/metriques) qui affiche 3 KPIs principaux (nb spawters, spawts/jour,
avis/jour) + 3 courbes temporelles 30 jours. Calcul direct via
agrégations SQL sur spawters / spawt_checkin (pas de dashboard tiers —
Madame Sun apporte PostHog Sprint 2 PRD §11). Pas de cache, pas de
vues matérialisées V1 — charge négligeable alpha 5 spawters. Auto-
refresh 60s + bouton manuel. Dépend de 6.1 (shell), idéalement après
6.3 (seed data pour avoir des chiffres réalistes). -->

## Story

As a membre `spawt_staff`,
I want consulter les métriques basiques du produit (nombre de spawters, spawts/jour, avis/jour) avec courbes temporelles 30 jours,
so that l'équipe suit l'activité alpha sans attendre l'intégration PostHog Sprint 2, avec des agrégations calculées directement sur Supabase et un rafraîchissement transparent.

## ⚠️ Brownfield context — read first

État courant Story 6.5 :

| Élément | Fichier / Table | État | Action |
|---|---|---|---|
| Table `spawters` | `0001_create_spawters_spawt_staff.sql` Story 1.5 | ✅ Existe — `created_at`, `is_banned` (post-Story 6.4) | **Consommer** — count + filtres |
| Table `spawt_checkin` | `0011_create_spawt_checkin.sql` Story 4.1 | ✅ Existe — `created_at`, `note_etoiles`, `is_seed`, `deleted_at` (post-Story 6.4) | **Consommer** — filtres `is_seed = false AND deleted_at IS NULL` |
| Table `admin_audit_log` | `0017_create_admin_audit_log.sql` Story 6.1 | ✅ Existe | **Consommer** Sprint 2 (dashboard modération metrics) — pas V1 |
| Table `user_signals` | `0003_create_user_signals_appendonly.sql` Story 1.7 | ✅ Existe — append-only | **Pas consommé V1** — Madame Sun les exploitera Sprint 2 via PostHog |
| Wrapper analytics PostHog | `app/src/lib/analytics.ts` Story 1.7 | ✅ Existe — events typés mobile | **Pas consommé V1** — événements remontent à PostHog (config Kidam), pas à Supabase direct |
| Resource Refine `metriques` | `spawt-admin/src/App.tsx` Story 6.1 | ✅ Déclarée (placeholder) | **Compléter** — page custom dashboard (pas un CRUD standard Refine) |
| Charting lib | (aucune) | ❌ | **Choisir Recharts** (Dev Notes §1) — `recharts@2.13.x` |
| Vues matérialisées Postgres | (aucune) | ❌ | **Pas créées V1** — charge négligeable, query directe acceptable (Dev Notes §3) |

**Décisions héritées non-revisitables** :

- **3 KPIs canoniques** (PRD FR-023 acceptance, epics Story 6.5 AC #1) :
  1. **Nombre de spawters** (total `spawters` non-banni)
  2. **Spawts/jour** (count `spawt_checkin WHERE created_at >= today_start`)
  3. **Avis/jour** (count `spawt_checkin WHERE note_etoiles IS NOT NULL AND is_seed = false AND created_at >= today_start`)
- **Pas de dashboard tiers V1** (epics Story 6.5 AC, PRD §11) — Madame Sun arrive Sprint 2 avec PostHog. Le panel V1 calcule en direct sur Supabase.
- **Filtres canoniques** : `is_seed = false` partout (seeds ≠ activité réelle), `deleted_at IS NULL` partout (post-Story 6.4), `is_banned = false` pour le compte spawter (un compte banni ne compte plus dans l'activité).
- **Pas de cache V1** : volume alpha 5 spawters × ~30 spawts/mois × ~50 places = négligeable. Acceptable d'agréger à chaque load.
- **Auto-refresh 60s + bouton manuel « Actualiser »** (story 6.5 spécifique).
- **Refine custom page** (pas un CRUD resource standard) — `useCustom` ou `useList` avec agrégations côté client (V1) ou Edge Function `metrics-summary` (Sprint 2).

## Acceptance Criteria

**AC #1 — Dashboard `/metriques` — 3 KPIs principaux + 3 courbes 30 jours**

**Given** `spawt-admin/src/pages/metriques/index.tsx`
**When** Story 6.5 est livrée
**Then** la page expose 2 sections :

**Section 1 — KPIs principaux (3 cartes)** :

```tsx
// spawt-admin/src/pages/metriques/index.tsx
import { useMetricsSnapshot } from "./hooks/useMetricsSnapshot";
import { useTimeSeries30d } from "./hooks/useTimeSeries30d";

export const MetriquesDashboard = () => {
  const { data: snapshot, refetch: refetchSnapshot, isFetching: f1 } = useMetricsSnapshot();
  const { data: series, refetch: refetchSeries, isFetching: f2 } = useTimeSeries30d();

  const refetchAll = () => { refetchSnapshot(); refetchSeries(); };
  // Auto-refresh 60s
  useEffect(() => {
    const id = setInterval(refetchAll, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="metriques-page">
      <header>
        <h1>Métriques</h1>
        <p className="banner-info">
          ⓘ Métriques V1 — calculées en direct sur Supabase. Dashboard analytics complet
          (PostHog) arrive Sprint 2 avec Madame Sun.
        </p>
        <button onClick={refetchAll} disabled={f1 || f2}>
          {f1 || f2 ? "Actualisation…" : "Actualiser"}
        </button>
      </header>

      <section className="kpi-cards">
        <KpiCard label="Spawters actifs" value={snapshot?.spawters_active ?? "—"} sub={`${snapshot?.spawters_banned ?? 0} bannis`} />
        <KpiCard label="Spawts aujourd'hui" value={snapshot?.spawts_today ?? "—"} sub={`${snapshot?.spawts_total ?? 0} au total`} />
        <KpiCard label="Avis aujourd'hui" value={snapshot?.reviews_today ?? "—"} sub={`${snapshot?.reviews_total ?? 0} au total (hors seed)`} />
      </section>

      <section className="charts-30d">
        <h2>30 derniers jours</h2>
        <ChartCard title="Nouveaux spawters / jour" data={series?.new_spawters_30d ?? []} />
        <ChartCard title="Spawts / jour" data={series?.spawts_30d ?? []} />
        <ChartCard title="Avis communauté / jour" data={series?.reviews_30d ?? []} />
      </section>
    </div>
  );
};
```

**Section 2 — KPIs secondaires (3 cartes Sprint 1 figées)** :

```tsx
<section className="kpi-cards-secondary">
  <KpiCard label="Lieux publiés" value={snapshot?.places_published ?? "—"} sub={`${snapshot?.places_total ?? 0} en base`} />
  <KpiCard label="Note moyenne pondérée" value={snapshot?.avg_weighted_rating?.toFixed(2) ?? "—"} sub="sur les lieux avec ≥ 5 avis" />
  <KpiCard label="Avis flagged anti-fraude" value={snapshot?.flagged_reviews_total ?? "—"} sub="à modérer (Story 6.4)" />
</section>
```

**And** chaque `KpiCard` affiche :
- Label en haut.
- Valeur principale grande typo.
- Sub-text discret en dessous.
- État loading : skeleton CSS minimal (pas de spinner intrusif).

**And** chaque `ChartCard` rend un graphique Recharts (`<LineChart>` ou `<BarChart>`) avec :
- Axe X : 30 derniers jours (dates).
- Axe Y : count (entiers).
- Tooltip au hover.
- Couleur sobre (palette canonique — pas de drift).

---

**AC #2 — Hook `useMetricsSnapshot` — 6 agrégations Supabase**

**Given** la nécessité d'agréger côté client (pas de vue matérialisée V1)
**When** Story 6.5 est livrée
**Then** `spawt-admin/src/pages/metriques/hooks/useMetricsSnapshot.ts` expose :

```ts
import { useQuery } from "@tanstack/react-query"; // Refine fournit react-query
import { supabaseClient } from "../../../utility/supabaseClient";

export interface MetricsSnapshot {
  spawters_active: number;
  spawters_banned: number;
  spawts_today: number;
  spawts_total: number;
  reviews_today: number;       // hors seed, hors deleted
  reviews_total: number;       // hors seed, hors deleted
  places_published: number;
  places_total: number;
  avg_weighted_rating: number | null;
  flagged_reviews_total: number;
}

export function useMetricsSnapshot() {
  return useQuery({
    queryKey: ["metrics", "snapshot"],
    queryFn: async (): Promise<MetricsSnapshot> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      // 6 requêtes parallèles via Promise.all
      const [
        { count: spawtersActive },
        { count: spawtersBanned },
        { count: spawtsToday },
        { count: spawtsTotal },
        { count: reviewsToday },
        { count: reviewsTotal },
        { count: placesPublished },
        { count: placesTotal },
        { data: ratingRows },
        { count: flagged },
      ] = await Promise.all([
        supabaseClient.from("spawters").select("id", { count: "exact", head: true }).eq("is_banned", false),
        supabaseClient.from("spawters").select("id", { count: "exact", head: true }).eq("is_banned", true),
        supabaseClient.from("spawt_checkin").select("id", { count: "exact", head: true })
          .gte("created_at", todayISO).is("deleted_at", null).eq("is_seed", false),
        supabaseClient.from("spawt_checkin").select("id", { count: "exact", head: true })
          .is("deleted_at", null).eq("is_seed", false),
        supabaseClient.from("spawt_checkin").select("id", { count: "exact", head: true })
          .gte("created_at", todayISO).not("note_etoiles", "is", null).is("deleted_at", null).eq("is_seed", false),
        supabaseClient.from("spawt_checkin").select("id", { count: "exact", head: true })
          .not("note_etoiles", "is", null).is("deleted_at", null).eq("is_seed", false),
        supabaseClient.from("places").select("id", { count: "exact", head: true }).eq("is_published", true),
        supabaseClient.from("places").select("id", { count: "exact", head: true }),
        supabaseClient.from("place_adn").select("weighted_rating").gte("total_reviews", 5),
        supabaseClient.from("spawt_checkin").select("id", { count: "exact", head: true })
          .not("flag_reason", "is", null).is("deleted_at", null),
      ]);

      const avgWeighted = ratingRows && ratingRows.length > 0
        ? ratingRows.reduce((sum, r) => sum + (r.weighted_rating ?? 0), 0) / ratingRows.length
        : null;

      return {
        spawters_active: spawtersActive ?? 0,
        spawters_banned: spawtersBanned ?? 0,
        spawts_today: spawtsToday ?? 0,
        spawts_total: spawtsTotal ?? 0,
        reviews_today: reviewsToday ?? 0,
        reviews_total: reviewsTotal ?? 0,
        places_published: placesPublished ?? 0,
        places_total: placesTotal ?? 0,
        avg_weighted_rating: avgWeighted,
        flagged_reviews_total: flagged ?? 0,
      };
    },
    staleTime: 30_000, // considère stale après 30s — refetch auto si refocus
    refetchInterval: 60_000, // auto-refresh 60s (cohérent AC #1)
  });
}
```

**And** les requêtes utilisent `head: true` (pas de transfer du body) → léger.

**And** un commentaire explique : « V1 = 10 round-trips Supabase parallèles. Sprint 2 = Edge Function `metrics-summary` qui exécute SQL agrégé serveur-side en 1 call. »

---

**AC #3 — Hook `useTimeSeries30d` — 3 séries temporelles**

**Given** la nécessité d'afficher des courbes 30 jours
**When** Story 6.5 est livrée
**Then** `spawt-admin/src/pages/metriques/hooks/useTimeSeries30d.ts` expose :

```ts
export interface DailyPoint { date: string; count: number; }
export interface TimeSeries30d {
  new_spawters_30d: DailyPoint[];
  spawts_30d: DailyPoint[];
  reviews_30d: DailyPoint[];
}

export function useTimeSeries30d() {
  return useQuery({
    queryKey: ["metrics", "timeseries", "30d"],
    queryFn: async (): Promise<TimeSeries30d> => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      const startISO = start.toISOString();

      // V1 : fetch toutes les rows des 30j et agrège côté client
      // (volume négligeable alpha < 1000 rows)
      const [
        { data: newSpawters },
        { data: spawts },
        { data: reviews },
      ] = await Promise.all([
        supabaseClient.from("spawters").select("created_at").gte("created_at", startISO),
        supabaseClient.from("spawt_checkin").select("created_at").gte("created_at", startISO).is("deleted_at", null).eq("is_seed", false),
        supabaseClient.from("spawt_checkin").select("created_at").gte("created_at", startISO).not("note_etoiles", "is", null).is("deleted_at", null).eq("is_seed", false),
      ]);

      // Bucketize par jour
      const bucketize = (rows: Array<{ created_at: string }>): DailyPoint[] => {
        const buckets = new Map<string, number>();
        for (let i = 0; i < 30; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
          buckets.set(key, 0);
        }
        for (const row of rows ?? []) {
          const key = row.created_at.slice(0, 10);
          if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
        }
        return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
      };

      return {
        new_spawters_30d: bucketize(newSpawters ?? []),
        spawts_30d: bucketize(spawts ?? []),
        reviews_30d: bucketize(reviews ?? []),
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
```

**And** la fonction `bucketize` initialise les 30 buckets à 0 (même les jours sans activité), garantissant un axe X continu.

**And** Dev Notes §3 documente la limite : volume > 5000 rows / 30j commence à dégrader (transfer + parse). Sprint 2 = Edge Function avec `GROUP BY date_trunc('day', created_at)` côté Postgres.

---

**AC #4 — Composants `KpiCard` + `ChartCard` (Recharts)**

**Given** la nécessité de composants UI propres
**When** Story 6.5 est livrée
**Then** :

```tsx
// spawt-admin/src/pages/metriques/components/KpiCard.tsx
interface KpiCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

export const KpiCard = ({ label, value, sub }: KpiCardProps) => (
  <div className="kpi-card">
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);
```

```tsx
// spawt-admin/src/pages/metriques/components/ChartCard.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ChartCardProps {
  title: string;
  data: Array<{ date: string; count: number }>;
}

export const ChartCard = ({ title, data }: ChartCardProps) => (
  <div className="chart-card">
    <h3>{title}</h3>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={6} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#C8A44E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
```

**And** la couleur `#C8A44E` est l'Or SPAWT canonique (mémoire `project_spawt_ux_canonical.md`) — discrète, cohérente.

**And** Recharts est ajouté à `spawt-admin/package.json` : `recharts@^2.13.0`.

---

**AC #5 — Pas de cache V1 — performance acceptable alpha**

**Given** la charge alpha
**When** la page `/metriques` est ouverte
**Then** :

1. **10 requêtes parallèles** Promise.all → temps total ≤ max des 10 (≤ 300ms réseau Abidjan, count en `head: true` rapide).
2. **3 fetches timeseries** parallèles → 50-500 rows chacune, parse côté client.
3. **Total time-to-interactive** : < 1.5s P95 sur connexion staff (4G/wifi standard).

**And** un test smoke documente : « Avec 5 spawters × 30 spawts/mois × 50 lieux = ~150 rows total → load < 500ms ». Cohérent volume alpha.

**Sprint 2 (D-651)** : si > 5000 rows ou si l'équipe staff scale > 10 personnes, créer une Edge Function `metrics-summary` qui exécute :

```sql
-- Sketch Sprint 2
SELECT
  (SELECT COUNT(*) FROM spawters WHERE is_banned = false) AS spawters_active,
  (SELECT COUNT(*) FROM spawters WHERE is_banned = true) AS spawters_banned,
  -- ... 8 autres agrégations
FROM (VALUES (1)) AS _;
```

Et retourne le snapshot en 1 round-trip. Bonus : peut être cachée côté Edge (Cloudflare KV / Supabase Memcached) avec TTL 30s.

---

**AC #6 — Auto-refresh 60s + bouton « Actualiser » manuel**

**Given** la page ouverte
**When** elle reste visible
**Then** :

1. Un `useEffect` interval rafraîchit les 2 hooks toutes les 60s :

```tsx
useEffect(() => {
  const id = setInterval(() => {
    refetchSnapshot();
    refetchSeries();
  }, 60_000);
  return () => clearInterval(id);
}, []);
```

2. Le bouton « Actualiser » force un refetch immédiat (bypass `staleTime`).

3. Pendant un refetch, le bouton affiche « Actualisation… » et est disabled.

4. Les KPIs et les graphs se mettent à jour **sans flash blanc** — React Query garde les données précédentes pendant le refetch (placeholderData).

**Given** la page non-visible (onglet inactif)
**When** elle reste en arrière-plan
**Then** le refetch auto continue. **Trade-off** : 1 round-trip / minute par staff connecté → négligeable. Pas de pause `document.visibilityState` V1.

---

**AC #7 — Pas d'event analytics côté admin pour ces metrics**

**Given** la séparation app/admin
**When** Story 6.5 est livrée
**Then** :

1. Le panel admin **n'envoie pas** d'event PostHog (cohérent Story 6.1 §Dev Notes §10).
2. Les metrics affichées sont **lues** de Supabase, pas reconstituées à partir de `user_signals`.
3. Sprint 2 : Madame Sun branchera PostHog côté mobile + dashboard PostHog **séparé** pour le funnel onboarding → 1er spawt. Le panel admin Story 6.5 reste sur les agrégations Supabase pour les KPIs opérationnels.

**And** le banner « ⓘ Métriques V1 — calculées en direct sur Supabase. Dashboard analytics complet (PostHog) arrive Sprint 2 avec Madame Sun » est visible en haut de la page.

---

**AC #8 — Tests + triple gate**

**Given** la suite de tests
**When** lancée
**Then** la couverture inclut :

1. **`useMetricsSnapshot.test.ts`** :
   - Mock 10 requêtes Supabase retournant counts → `useMetricsSnapshot` retourne un objet `MetricsSnapshot` complet.
   - Mock une requête en erreur → React Query retourne `error` mais les autres data sont OK (Promise.all dans `Promise.allSettled` ? Non — Promise.all fail-fast V1, le hook entier est en erreur. Documenté Dev Notes §4).

2. **`useTimeSeries30d.test.ts`** :
   - Mock retournant 5 rows sur 3 dates distinctes → `bucketize` produit 30 points dont 3 non-nuls.
   - Verify : tous les jours initialisés à 0.

3. **`MetriquesDashboard.test.tsx`** :
   - Render avec mocked hooks → 6 KpiCards rendues (3 principales + 3 secondaires) + 3 ChartCards.
   - Click sur « Actualiser » → `refetch` appelé sur les 2 hooks.

4. **`KpiCard.test.tsx`** :
   - Render avec value `42` → affiche `42`.
   - Render avec value `undefined` → affiche `"—"`.

5. **`ChartCard.test.tsx`** :
   - Render avec 30 points → Recharts render (test snapshot DOM minimal — Recharts mock).

**Given** la triple gate `spawt-admin/`
**When** lancée
**Then** `cd spawt-admin && npx tsc --noEmit && npm run lint && npm test` vert.
**And** `cd spawt-admin && npm run build` produit `dist/` < 600 KB gzippé (Recharts ajoute ~150 KB — acceptable côté admin).

**And** la triple gate mobile reste verte — Story 6.5 ne touche pas `app/`.

## Tasks / Subtasks

- [ ] **Task 1 — Page `MetriquesDashboard` + structure** (AC: #1)
  - [ ] Réécrire `spawt-admin/src/pages/metriques/index.tsx` selon AC #1.
  - [ ] Header + banner + bouton refresh.
  - [ ] 2 sections : KPIs principaux (3) + secondaires (3) + 3 charts.
  - [ ] CSS dans `spawt-admin/src/styles/metriques.css` (grid responsive minimum 3 colonnes desktop).

- [ ] **Task 2 — Hook `useMetricsSnapshot`** (AC: #2)
  - [ ] Créer `spawt-admin/src/pages/metriques/hooks/useMetricsSnapshot.ts`.
  - [ ] 10 requêtes parallèles via Promise.all.
  - [ ] Types stricts `MetricsSnapshot`.
  - [ ] Tests unitaires.

- [ ] **Task 3 — Hook `useTimeSeries30d`** (AC: #3)
  - [ ] Créer `spawt-admin/src/pages/metriques/hooks/useTimeSeries30d.ts`.
  - [ ] 3 fetches parallèles + bucketize fonction pure.
  - [ ] Tests unitaires bucketize.

- [ ] **Task 4 — Composants `KpiCard` + `ChartCard`** (AC: #4)
  - [ ] Créer `spawt-admin/src/pages/metriques/components/KpiCard.tsx`.
  - [ ] Créer `spawt-admin/src/pages/metriques/components/ChartCard.tsx`.
  - [ ] Ajouter `recharts@^2.13.0` à `spawt-admin/package.json`.

- [ ] **Task 5 — Auto-refresh + bouton manuel** (AC: #6)
  - [ ] `useEffect` interval 60s dans `MetriquesDashboard`.
  - [ ] Bouton refresh disabled pendant fetch.
  - [ ] Pas de flash blanc (React Query placeholderData).

- [ ] **Task 6 — Tests + triple gate** (AC: #8)
  - [ ] Tests des 5 fichiers AC #8.
  - [ ] Triple gate `spawt-admin/` + mobile non-régressé.
  - [ ] Build production < 600 KB gzippé.
  - [ ] CHANGELOG : `feat(spawt-admin): dashboard métriques basiques (Story 6.5)`.

- [ ] **Task 7 — Sign-off Epic 6 close**
  - [ ] Smoke test complet Stéphanie : login → 4 sections testées → logout.
  - [ ] Retrospective Epic 6 à programmer (par Alexandre, hors story).

## Dev Notes

### 1. Choix charting lib — Recharts retenu

| Option | Bundle | Verdict |
|---|---|---|
| **Recharts** | ~150 KB gzippé | ✅ **Retenu V1.** React-native, declarative, SVG-based, sobre, customisable. Communauté large. |
| **Chart.js + react-chartjs-2** | ~200 KB | ⚠️ Canvas-based (perf OK), API moins React-idiomatique. |
| **Nivo** | ~300 KB | ❌ Trop lourd pour 3 line charts. Trop riche features inutiles V1. |
| **Visx (Airbnb)** | ~80 KB (cherry-pick) | ⚠️ Low-level, plus de code à écrire. Bon pour custom complexe — overkill V1. |
| **Apexcharts** | ~250 KB | ❌ jQuery-flavored, drift stack. |
| **Pas de chart V1 — tableau simple** | 0 KB | ⚠️ Tentant mais le visuel courbe est demandé par AC #1. Refuse. |

**Décision V1 : Recharts**. Cohérent ambiance sobre + minor bump bundle (acceptable admin internal).

### 2. Pourquoi pas de vues matérialisées Postgres

| Option | Verdict |
|---|---|
| **Query directe Supabase (V1)** | ✅ **Retenu V1.** Charge alpha négligeable (~150 rows), < 500ms total. Pas de complexité de maintenance. |
| **Vues matérialisées + `REFRESH MATERIALIZED VIEW CONCURRENTLY`** | ❌ Surcoût V1. Refresh manuel ou via `pg_cron` — complexité ops disproportionnée. |
| **Edge Function `metrics-summary` qui exécute SQL agrégé** | ⏭️ Sprint 2 si volume > 5000 rows ou staff > 10. |

**Décision V1** : direct query. **Defer D-651** Edge Function pour Sprint 2.

### 3. Limite du bucketize côté client

Le hook `useTimeSeries30d` fetch **toutes** les rows des 30 derniers jours puis bucketize en mémoire. Volume V1 :

- 5 spawters × 30j = 150 rows max nouveaux spawters (en pratique ~5 sur 30j).
- 5 spawters × 30 spawts/mois = 150 rows max spawts/30j.
- ~50% des spawts ont un avis = ~75 rows reviews/30j.

→ **Total < 400 rows fetched + parse < 50ms**. Acceptable.

**Sprint 2** : Edge Function avec `SELECT date_trunc('day', created_at)::date AS day, COUNT(*) FROM spawt_checkin WHERE ... GROUP BY day` retournera 30 rows directement.

### 4. Promise.all fail-fast — accepté V1

Si une des 10 requêtes échoue (réseau, RLS, etc.), `Promise.all` rejette tout. Le hook React Query retourne `error`. **Trade-off** :

- ✅ Comportement simple, predictable.
- ❌ Un seul fail = pas de metrics du tout.

**Mitigation V1** : retry React Query par défaut (3 retries, exponential backoff). En pratique, rare qu'une seule requête fail isolément.

**Sprint 2 (D-652)** : `Promise.allSettled` + partial render (afficher les KPIs disponibles, hide les autres avec message). V1 = trop de UX state à gérer pour un cas rare.

### 5. Pas d'export CSV / PDF V1

Trade-off : un export serait utile pour les rapports équipe. **V1** : capture d'écran navigateur suffit. **Defer D-653** export CSV (Sprint 2 si demande Madame Sun).

### 6. Authentification & RLS

Toutes les requêtes passent par `supabaseClient` (anon key + JWT staff session). Les RLS sont satisfaites :

- `spawters_select_staff` (Story 1.5) → un staff actif lit tous les spawters → `count` OK.
- `spawt_checkin_select_staff` (Story 6.4) → idem sur spawt_checkin.
- `place_adn_select_staff` (Story 6.2) → idem.
- `places` : `places_select_staff` (Story 6.2) → un staff actif lit tous (publiés ou drafts).

**Test RLS** : un compte spawter public qui aurait accès au panel (impossible par construction Story 6.1) retournerait `count: 0` partout → la page s'affiche vide. Pas de leak.

### 7. Refine `useCustom` vs `useList` vs `useQuery`

Trois options pour fetch les metrics :

| Option | Verdict |
|---|---|
| **Refine `useCustom({ url: "metrics-summary" })`** | ⚠️ Convient pour Edge Function Sprint 2 mais V1 pas d'Edge Function. |
| **Refine `useList({ resource: "spawters" })` × N** | ⚠️ Refine attend des resources standards (filtres simples). Les counts avec aggregation custom = friction. |
| **React Query `useQuery` direct** | ✅ **Retenu V1.** Refine **embarque** React Query (`useTable`, `useList` sont des wrappers). On peut utiliser `useQuery` directement pour les agrégations custom. |

**Décision V1 : `useQuery` direct** (via le React Query bundlé par Refine). Cohérent avec le pattern Refine docs (« custom hooks »).

### 8. Sign-off

- **Stéphanie** (tech) : revue performance des 10 round-trips (acceptable V1), choix Recharts, defer Edge Function Sprint 2.
- **Kidam** (analytics) : confirmer que les 6 KPIs V1 sont **suffisants** Sprint 1 et qu'ils ne préemptent pas son dashboard PostHog Sprint 2 (orthogonalité validée). Confirmer formule `spawts_today` (cohérent definition Kidam).
- **Alexandre** (brand) : revue sobre du dashboard — pas de gamification (« vous êtes 1er staff de la semaine »), pas de couleurs criardes, libellé pro français.

### 9. Defers identifiés

- **D-651** — Edge Function `metrics-summary` (1 round-trip serveur-side agrégé) (Sprint 2 si volume scale).
- **D-652** — `Promise.allSettled` + partial render (Sprint 2).
- **D-653** — Export CSV / PDF des metrics (Sprint 2).
- **D-654** — Dashboard PostHog branché côté Madame Sun — orthogonal au panel V1.
- **D-655** — Drill-down par lieu / par spawter (Sprint 2 — Story 6.5b).
- **D-656** — Alertes seuils (e.g. « 0 spawts ce matin → email staff ») (Sprint 2 si demande équipe).
- **D-657** — Time-series > 30j (90j, 365j) avec sélecteur (Sprint 2).
- **D-658** — Cohort retention (rétention M1, M3) — Madame Sun (Sprint 2 PostHog).
- **D-659** — Funnel onboarding (`onboarding_started → onboarding_completed`) — Madame Sun (Sprint 2 PostHog).

### 10. Risk

- **Risque #1** : Volume explose post-lancement (alpha → 50 spawters) → 10 round-trips se ralentissent. Mitigation = monitoring temps de load + bascule Edge Function Sprint 2.
- **Risque #2** : Recharts bundle dépasse le budget gzippé. Mitigation = tree-shaking ESM (Vite gère) + check `cd spawt-admin && npm run build` confirme < 600 KB.
- **Risque #3** : Compte spawter seed (Story 6.3) compté dans `spawters_active` → biais. Mitigation V1 = accepter (impact = +1 spawter, négligeable). Sprint 2 = filtrer par metadata `user_metadata.role = "seed"` côté query.
- **Risque #4** : Auto-refresh 60s × N staff connectés = N requêtes / minute × 10 / minute = 10×N RTs / min. Pour N=5 staff, OK. Pour N=50 staff, charge x10 — surveillance Supabase plan. Mitigation Sprint 2 = cache Edge.

### Project Structure Notes

- **Aucun nouveau fichier SQL** — Story 6.5 lit les tables existantes.
- **Nouveaux fichiers `spawt-admin/src/`** :
  - `pages/metriques/index.tsx`
  - `pages/metriques/hooks/useMetricsSnapshot.ts`
  - `pages/metriques/hooks/useTimeSeries30d.ts`
  - `pages/metriques/components/KpiCard.tsx`
  - `pages/metriques/components/ChartCard.tsx`
  - `styles/metriques.css`
  - Tests (5 fichiers)
- **Modifs `spawt-admin/package.json`** : `recharts@^2.13.0`.
- **CHANGELOG** : `feat(spawt-admin): dashboard métriques basiques (Story 6.5)` + entry close Epic 6.
- **Pas de modif `app/`**.
- **Pas de modif `supabase/migrations/`**.
- **Pas de modif `supabase/functions/`** (Edge Function `metrics-summary` defer Sprint 2).

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 1168-1183 — Story 6.5 user story + BDD AC.
- [Source: _bmad-output/planning-artifacts/PRD.md] FR-023 acceptance (« métriques basiques » + « pas de dashboard analytics tiers »), §11 (PostHog Sprint 2 Madame Sun).
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 392-397 (admin Cloudflare Pages), 395-397 (PostHog mobile = wrapper analytics).
- [Source: _bmad-output/project-context.md] §Vocabulaire SPAWT, §Anti-leaderboard (pas de classement staff).
- [Source: documentation/analytics/events.md] — taxonomie events (consommée mobile, pas admin V1).
- [Source: supabase/migrations/0001_create_spawters_spawt_staff.sql] — `spawters` schéma.
- [Source: supabase/migrations/0011_create_spawt_checkin.sql] — `spawt_checkin` schéma + `is_seed`.
- [Source: supabase/migrations/0019_alter_spawters_moderation.sql] Story 6.4 — colonnes `is_banned`, `deleted_at`.
- [Source: _bmad-output/implementation-artifacts/6-1-...md] — shell + auth (consommé tel quel).
- [Source: _bmad-output/implementation-artifacts/6-4-...md] — table audit (consommé Sprint 2).
- [Recharts docs] https://recharts.org/en-US/api/LineChart.

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev agent)_

### Debug Log References

_(à remplir par le dev agent)_

### Completion Notes List

_(à remplir par le dev agent)_

### File List

_(à remplir par le dev agent)_
