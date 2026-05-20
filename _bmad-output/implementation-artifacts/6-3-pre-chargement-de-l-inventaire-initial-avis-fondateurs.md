# Story 6.3: Pré-chargement de l'inventaire initial + avis fondateurs

Status: ready-for-dev

<!-- 3e story Epic 6 — story d'ops/seed data plus que de dev. Livre :
(1) un script Node.js idempotent `spawt-admin/scripts/seed-inventory.ts`
qui lit `supabase/seed/inventory.csv` (50-100 lieux + 150-300 avis
fondateurs `is_seed = true`) et upsert via une Edge Function
`seed-inventory` (service_role bypass RLS pour `is_seed`), (2) la
distinction UI « avis fondateur » vs « avis communauté » côté admin,
(3) la création d'un compte spawter seed dédié (`spawter_seed_alpha`).
Dépend de 6.1 (audit log + auth) et 6.2 (resources places).
Compatibilité Story 4.7 (les avis seed alimentent ADN). -->

## Story

As a membre `spawt_staff` / Ally terrain,
I want pré-charger l'inventaire initial (50-100 lieux dont 20 onboardés Mission 1) et 3 avis fondateurs par lieu via un script Node idempotent + une Edge Function service_role,
so that aucun spawter n'arrive sur une carte vide au lancement, l'ADN de chaque lieu n'est pas « en construction » à J0, et la distinction avis fondateur vs communauté est claire côté panel admin.

## ⚠️ Brownfield context — read first

État courant Story 6.3 :

| Élément | Fichier / Table | État | Action |
|---|---|---|---|
| Table `places` | `supabase/migrations/0010_*` | ✅ Existe (Story 3.3a) | **Insérer** via upsert ON CONFLICT |
| Table `place_adn` | `0010_*` | ✅ Existe | **Insérer** ADN cohérents (calculés à partir des seeds avis ou saisis manuellement) |
| Table `spawt_checkin` avec `is_seed` | `supabase/migrations/0011_create_spawt_checkin.sql` | ✅ Existe — colonne `is_seed BOOLEAN DEFAULT false` ligne 39 | **Insérer** avis avec `is_seed = true` |
| RLS `spawt_checkin_insert_own` | `0011_*` ligne 75-77 | ⚠️ `WITH CHECK (spawter_id = auth.uid() AND is_seed = false)` — bloque les seeds côté client | **Bypass via Edge Function service_role** (architecture §3 l289-294) |
| Anti-fraude triggers | `0012_antifraud_triggers.sql` Story 4.4 | ✅ Tous les triggers bypass `is_seed = true` (`IF NEW.is_seed = true THEN RETURN NEW;`) | **Préserver** — les seeds ne déclenchent pas les flags |
| Compte spawter seed | `auth.users` + `spawters` | ❌ N'existe pas | **Créer** un compte `spawter_seed_alpha` (ou plusieurs, 1 par Ally — décision Dev Notes §4) |
| Seed CSV source | `supabase/seed/inventory.csv` | ❌ N'existe pas | **Créer** template + documentation format |
| Seeds `app/src/data/seed/places.ts` | `app/src/data/seed/places.ts` | ✅ 12 lieux (Story 3.3a) — **mode fallback démo** uniquement | **Ne pas confondre** — les 12 seeds mobiles ≠ les 50-100 seeds DB. Les 12 sont pour le mode démo Expo Go offline. |
| Seeds SQL existants | `supabase/seed/places.sql` | ✅ 12 inserts statiques (Story 3.3a) | **Garder** pour bootstrap initial dev — Story 6.3 ajoute le **vrai** flow upsert dynamique CSV → DB |
| Edge Functions dossier | `supabase/functions/` | ✅ Existe (otp-send, etc.) | **Ajouter** `supabase/functions/seed-inventory/` |
| Helper `audit.ts` admin | `spawt-admin/src/lib/audit.ts` Story 6.1 | ✅ | **Consommer** — action `seed_inventory_run` (déjà dans CHECK enum migration 0014) |

**Décisions héritées non-revisitables** :

- **`is_seed = true`** colonne unique sur `spawt_checkin` — pas de table `seed_reviews` séparée (architecture §3 l290-294, PRD §5.4, project-context).
- **20 lieux Mission 1** ventilation figée (PRD FR-032, epics Story 6.3 AC #1) :
  - 5 Date night / Premium
  - 5 Dabali / Racines clean
  - 3 Boys / Barbecue
  - 3 Nouveaux restaurants
  - 2 Hype / Instagram
  - 2 Sceptiques
- **3 avis seed par lieu** = 150-300 avis seed au total (PRD FR-032).
- **Avis seed alimentent ADN, exclus du compteur public** `total_reviews` (Story 4.7 `applyReviewToAdn` AC #4). Côté Story 6.3 : on insère `is_seed = true` ; le calcul ADN initial peut être fait soit (a) en exécutant `applyReviewToAdn` séquentiellement côté script, soit (b) en hardcoded ADN dans le CSV. Décision Dev Notes §3.
- **service_role uniquement dans une Edge Function** — jamais côté client admin (architecture §Authentication & Security l322-325).
- **Script idempotent** — re-runs n'ajoutent pas de duplicates (upsert ON CONFLICT sur clé naturelle).
- **Mission 1 = collecte terrain Ally** — Story 6.3 livre **l'outil**, pas les 20 lieux Mission 1 collectés (Ally collecte en parallèle Phase 0 du Sprint 1, cahier des charges §5.8 alpha).
- **Vanessa = canal acquisition, pas user cœur** (mémoire `feedback_made_in_abidjan.md` non-applicable directement, mais PRD §18.1 décision #6) — pas de surreprésentation Hype/Instagram dans le seed initial.

## Acceptance Criteria

**AC #1 — Structure CSV `supabase/seed/inventory.csv` + documentation format**

**Given** le dossier `supabase/seed/`
**When** Story 6.3 est livrée
**Then** un fichier template `supabase/seed/inventory.template.csv` existe avec le header :

```csv
# Format : 1 ligne par lieu + 3 lignes par avis seed (clés review_N_*).
# Encoding UTF-8. Délimiteur virgule. Champs texte entre guillemets si comma interne.
# Idempotence : clé naturelle = (name, neighborhood) — upsert ON CONFLICT.
#
# Mission 1 ventilation (PRD FR-032) :
#   - 5 Date night/Premium (price_tier=3, signals incluant 'institution' ou 'date_night')
#   - 5 Dabali/Racines (cuisine 'ivoirienne', price_tier=1)
#   - 3 Boys/Barbecue
#   - 3 Nouveaux restaurants (signal 'nouveau')
#   - 2 Hype/Instagram (signal 'hype')
#   - 2 Sceptiques (lieux à valider — score modéré)
#
name,cuisine,lat,lng,descriptive_address,neighborhood,city,price_tier,avg_ticket_xof,hours_json,phone,whatsapp,cover_photo_url,gallery_urls_pipe,signals_pipe,is_published,adn_local_international,adn_informel_etabli,adn_budget_premium,adn_populaire_prive,adn_decontracte_habille,review_1_note,review_1_tags_pipe,review_1_text,review_2_note,review_2_tags_pipe,review_2_text,review_3_note,review_3_tags_pipe,review_3_text
"Bô Zinc","francaise|fusion",5.328,-4.009,"Zone 4, en face du centre commercial","Zone 4","Abidjan",3,25000,"{""mon"":[{""open"":""12:00"",""close"":""23:00""}]}","+22527XXXXXXX",,,,"institution|date_night",true,0.6,0.85,0.7,-0.3,0.6,5,"ambiance_top","Cadre soigné, service au niveau.",4,"copieux|cher","Bonne cuisine mais addition costaud.",5,"a_refaire","Spot rituel famille."
```

**And** `supabase/seed/inventory.template.csv` contient un en-tête commenté `#` (lignes ignorées par le parser) qui explique chaque colonne :

- `cuisine` : liste séparée par `|` (pipe), valeurs canonique (`ivoirienne`, `francaise`, `fusion`, `ouest_africaine`, etc.).
- `hours_json` : JSON sérialisé inline (échappé en CSV par doublement des guillemets).
- `gallery_urls_pipe`, `signals_pipe`, `tags_pipe` : listes séparées par `|`.
- `adn_*` : 5 axes ADN initiaux saisis manuellement par l'Ally (ou recalculés via Story 4.7 — voir Dev Notes §3).
- `review_N_note` : 1-5, `review_N_tags_pipe` : ∈ {`copieux`, `rapide`, `ambiance_top`, `cher`, `a_refaire`}, `review_N_text` : texte court avis.

**And** un fichier `supabase/seed/inventory.example.csv` contient **5 lignes d'exemple** (1 par catégorie Mission 1, pour Ally lookalike) — pas committé en prod, sert de référence dev.

**And** un script `supabase/seed/validate-inventory.mjs` (Node ESM) parse le CSV + valide chaque ligne via Zod, retourne 0 si OK / 1 si erreurs :

```js
// node supabase/seed/validate-inventory.mjs supabase/seed/inventory.csv
// Affiche les erreurs par ligne sans interrompre.
```

---

**AC #2 — Edge Function `seed-inventory` (service_role bypass `is_seed`)**

**Given** le dossier `supabase/functions/`
**When** Story 6.3 est livrée
**Then** une Edge Function `supabase/functions/seed-inventory/index.ts` (Deno) existe :

```ts
// supabase/functions/seed-inventory/index.ts
// Story 6.3 — Upsert d'un lieu + 3 avis fondateurs is_seed = true.
// Bypass RLS via service_role (anti-bypass anti-fraud trigger via is_seed = true).
//
// Auth : header Bearer <SUPABASE_SERVICE_ROLE_KEY> (env Edge Function) OU
// session staff valide (récupère auth.uid() via supabase.auth.getUser(token)
// puis vérifie spawt_staff actif). Une exécution non-staff retourne 403.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

interface SeedPlaceInput {
  name: string;
  cuisine: string[];
  lat: number;
  lng: number;
  descriptive_address: string;
  neighborhood: string;
  city: string;
  price_tier: 1 | 2 | 3;
  avg_ticket_xof: number | null;
  hours: Record<string, Array<{ open: string; close: string }>>;
  phone: string | null;
  whatsapp: string | null;
  cover_photo_url: string | null;
  gallery_urls: string[];
  signals: string[];
  is_published: boolean;
  adn: {
    axe_local_international: number;
    axe_informel_etabli: number;
    axe_budget_premium: number;
    axe_populaire_prive: number;
    axe_decontracte_habille: number;
  };
  reviews: Array<{
    note_etoiles: 1 | 2 | 3 | 4 | 5;
    tags: string[];
    texte_avis: string;
  }>;
}

interface SeedRequest {
  seed_spawter_id: string;       // UUID du compte spawter seed (créé AC #3)
  places: SeedPlaceInput[];
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ━━━ Auth check ━━━
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Récupère l'identité du caller via son JWT (anon-key + bearer = session)
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ data: null, error: { code: "UNAUTHENTICATED", message: "Login required" } }), { status: 401 });
  }

  // Vérifie spawt_staff actif (via service_role car la RLS spawt_staff_select_own ne suffit pas ici)
  const { data: staff } = await supabase
    .from("spawt_staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!staff) {
    return new Response(JSON.stringify({ data: null, error: { code: "FORBIDDEN", message: "spawt_staff required" } }), { status: 403 });
  }

  const payload = await req.json() as SeedRequest;

  const results: Array<{ name: string; place_id?: string; status: "created" | "updated" | "error"; error?: string }> = [];

  for (const place of payload.places) {
    try {
      // 1. Upsert `places` (clé naturelle = lower(name) + lower(neighborhood))
      const { data: existing } = await supabase
        .from("places")
        .select("id")
        .ilike("name", place.name)
        .ilike("neighborhood", place.neighborhood)
        .maybeSingle();

      let placeId: string;
      let status: "created" | "updated";

      if (existing) {
        placeId = existing.id;
        status = "updated";
        const { error: updErr } = await supabase
          .from("places")
          .update({
            cuisine: place.cuisine,
            lat: place.lat, lng: place.lng,
            descriptive_address: place.descriptive_address,
            neighborhood: place.neighborhood,
            city: place.city,
            price_tier: place.price_tier,
            avg_ticket_xof: place.avg_ticket_xof,
            hours: place.hours,
            phone: place.phone,
            whatsapp: place.whatsapp,
            cover_photo_url: place.cover_photo_url,
            gallery_urls: place.gallery_urls,
            signals: place.signals,
            is_published: place.is_published,
          })
          .eq("id", placeId);
        if (updErr) throw updErr;
      } else {
        const { data: created, error: insErr } = await supabase
          .from("places")
          .insert({
            name: place.name,
            cuisine: place.cuisine,
            lat: place.lat, lng: place.lng,
            descriptive_address: place.descriptive_address,
            neighborhood: place.neighborhood,
            city: place.city,
            price_tier: place.price_tier,
            avg_ticket_xof: place.avg_ticket_xof,
            hours: place.hours,
            phone: place.phone,
            whatsapp: place.whatsapp,
            cover_photo_url: place.cover_photo_url,
            gallery_urls: place.gallery_urls,
            signals: place.signals,
            is_published: place.is_published,
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        placeId = created.id;
        status = "created";
      }

      // 2. Upsert `place_adn` 1:1
      await supabase
        .from("place_adn")
        .upsert({ place_id: placeId, ...place.adn, total_reviews: 0, weighted_rating: 0, confidence_score: 0 }, { onConflict: "place_id" });

      // 3. Insert 3 avis seed (is_seed = true bypass RLS via service_role)
      // Idempotence : skip si déjà 3 reviews seed pour ce place + spawter
      const { count: existingSeeds } = await supabase
        .from("spawt_checkin")
        .select("id", { count: "exact", head: true })
        .eq("place_id", placeId)
        .eq("spawter_id", payload.seed_spawter_id)
        .eq("is_seed", true);

      if ((existingSeeds ?? 0) < place.reviews.length) {
        for (const review of place.reviews) {
          await supabase.from("spawt_checkin").insert({
            spawter_id: payload.seed_spawter_id,
            place_id: placeId,
            arrived_at: new Date().toISOString(),
            checked_in_at: new Date().toISOString(),
            left_at: new Date(Date.now() + 30 * 60_000).toISOString(),
            check_in_type: "manual",
            geolocation_source: "manual",
            is_verified: true,
            note_etoiles: review.note_etoiles,
            tags: review.tags,
            texte_avis: review.texte_avis,
            is_seed: true,
          });
        }
      }

      // 4. Recompute place_adn.weighted_rating + total_reviews + confidence_score
      // Story 4.7 logique côté serveur : SELECT all reviews du place, recompute.
      const { data: allReviews } = await supabase
        .from("spawt_checkin")
        .select("note_etoiles, tags, is_seed, spawters!inner(stade)")
        .eq("place_id", placeId)
        .not("note_etoiles", "is", null);

      // Cf. Dev Notes §3 — V1 = recompute simple, sans pondération stade
      // (le compte spawter seed est en stade 'touriste' par défaut, weight 1x — ça passe).
      // Sprint 2 : porter applyReviewToAdn en Deno pour cohérence parfaite.
      const allNotes = (allReviews ?? []).map(r => r.note_etoiles ?? 0).filter(n => n > 0);
      const weighted_rating = allNotes.length > 0 ? allNotes.reduce((a, b) => a + b, 0) / allNotes.length : 0;
      const total_reviews = (allReviews ?? []).filter(r => !r.is_seed).length; // compteur public exclut seeds
      const confidence_score = Math.max(0, Math.min(1, 1 - 1 / (1 + (allReviews?.length ?? 0) * 0.05)));

      await supabase.from("place_adn").update({ weighted_rating, total_reviews, confidence_score }).eq("place_id", placeId);

      // 5. Audit log
      await supabase.from("admin_audit_log").insert({
        spawt_staff_id: user.id,
        action: "seed_inventory_run",
        entity_type: "seed_batch",
        entity_id: placeId,
        payload_after: { name: place.name, reviews_count: place.reviews.length },
      });

      results.push({ name: place.name, place_id: placeId, status });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ name: place.name, status: "error", error: message });
    }
  }

  return new Response(JSON.stringify({ data: { results }, error: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

**And** la fonction est déployée via `supabase functions deploy seed-inventory --no-verify-jwt=false` (vérif JWT = on).

**And** Dev Notes §3 documente le trade-off sur le recompute ADN (simple V1 vs `applyReviewToAdn` portée Sprint 2).

---

**AC #3 — Compte spawter seed `spawter_seed_alpha` créé via migration ou script setup**

**Given** la nécessité d'attribuer les `is_seed = true` à un `spawter_id` cohérent (FK `spawt_checkin.spawter_id → spawters(id)`)
**When** Story 6.3 est livrée
**Then** un compte spawter seed est créé via :

**Option A — Script de setup `supabase/scripts/setup-seed-spawter.ts`** (recommandé V1) :

```ts
// Exécuté UNE FOIS par Stéphanie en dev/prod avec service_role.
// Crée 1 (V1) ou N (Sprint 2 multi-Ally) compte spawter dédié(s) aux seeds.
// Ne pas committer les credentials — variables d'env.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 1. Crée auth.users via Supabase Auth admin API
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: "seed-alpha@spawt.internal",      // email interne non-routable
    password: process.env.SEED_SPAWTER_PASSWORD!,
    email_confirm: true,
    user_metadata: { role: "seed", origin: "Story 6.3" },
  });
  if (authErr) throw authErr;

  // 2. Crée la ligne spawters (phone fictif réservé +225700000001)
  const { error: spawterErr } = await supabase.from("spawters").insert({
    id: authUser.user!.id,
    phone_e164: "+225700000001",            // numéro fictif réservé seed
    display_name: "Spawter Seed Alpha",
    country_code: "CI",
    gender: "non_renseigne",
    stade: "touriste",                       // stade weight 1x (cf. Dev Notes §3)
    geoloc_consent_at: new Date().toISOString(),
    cgv_accepted_at: new Date().toISOString(),
  });
  if (spawterErr) throw spawterErr;

  console.log("Seed spawter created:", authUser.user!.id);
}

main().catch(console.error);
```

**And** le script peut être réexécuté sans casser (vérifie l'existence du compte d'abord) — idempotent.

**And** l'UUID du compte créé est stocké dans une variable d'env `SEED_SPAWTER_ID` consommée par `seed-inventory.ts` (CSV runner) et l'Edge Function.

**Option B — Migration dédiée** : écartée Dev Notes §4 (un `INSERT INTO auth.users` direct est anti-pattern Supabase ; l'admin API officielle est plus propre).

---

**AC #4 — Script `spawt-admin/scripts/seed-inventory.ts` — runner CSV → Edge Function**

**Given** un CSV `supabase/seed/inventory.csv` validé
**When** un staff lance `cd spawt-admin && npm run seed:inventory`
**Then** le script :

```ts
// spawt-admin/scripts/seed-inventory.ts
// Usage : cd spawt-admin && npm run seed:inventory -- --csv ../supabase/seed/inventory.csv --dry-run
//        cd spawt-admin && npm run seed:inventory -- --csv ../supabase/seed/inventory.csv
//
// Lit le CSV, parse + valide chaque ligne, batches par 10, appelle Edge Function
// seed-inventory avec session staff (login OTP-like ou direct password).

import { parse as parseCsv } from "https://deno.land/std@0.168.0/csv/mod.ts"; // ou csv-parse côté Node
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

// Schemas Zod (port partiel de PlaceFormSchema + extension reviews)
const SeedRowSchema = z.object({
  name: z.string().min(1),
  cuisine: z.string().transform(s => s.split("|")),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  // ... (tous les champs CSV)
  reviews: z.array(z.object({
    note_etoiles: z.coerce.number().int().min(1).max(5),
    tags: z.array(z.string()),
    texte_avis: z.string(),
  })).length(3),
});

async function main() {
  const args = parseArgs(process.argv);
  const csvPath = args["--csv"];
  const dryRun = args["--dry-run"] === "true" || args["--dry-run"] === undefined && false;

  // 1. Login staff (variables d'env SEED_STAFF_EMAIL/PASSWORD)
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
  const { data: session, error: loginErr } = await supabase.auth.signInWithPassword({
    email: process.env.SEED_STAFF_EMAIL!,
    password: process.env.SEED_STAFF_PASSWORD!,
  });
  if (loginErr) throw loginErr;

  // 2. Parse CSV
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(csvContent, { skip_empty_lines: true, comment: "#" });
  console.log(`Parsed ${rows.length} rows from ${csvPath}`);

  // 3. Valide chaque ligne via Zod
  const valid: SeedPlaceInput[] = [];
  const errors: Array<{ row: number; error: unknown }> = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = SeedRowSchema.safeParse(rowToObject(rows[i]));
    if (parsed.success) valid.push(toEdgePayload(parsed.data));
    else errors.push({ row: i, error: parsed.error.flatten() });
  }
  console.log(`Valid: ${valid.length}, Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error(JSON.stringify(errors, null, 2));
    if (!args["--force"]) process.exit(1);
  }

  if (dryRun) {
    console.log("Dry-run — no DB writes.");
    return;
  }

  // 4. Appelle Edge Function par batches de 10
  const SEED_SPAWTER_ID = process.env.SEED_SPAWTER_ID!;
  for (let i = 0; i < valid.length; i += 10) {
    const batch = valid.slice(i, i + 10);
    const { data, error } = await supabase.functions.invoke("seed-inventory", {
      body: { seed_spawter_id: SEED_SPAWTER_ID, places: batch },
    });
    if (error) console.error(`Batch ${i / 10}: ${error.message}`);
    else console.log(`Batch ${i / 10}: ${JSON.stringify(data.results.map((r: any) => `${r.name}:${r.status}`))}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

**And** le script est ajouté à `spawt-admin/package.json` :

```json
{
  "scripts": {
    "seed:inventory": "tsx scripts/seed-inventory.ts",
    "seed:validate": "node ../supabase/seed/validate-inventory.mjs"
  }
}
```

**And** un dry-run (`--dry-run`) parse + valide sans écrire en DB — usage canonique pré-prod.

---

**AC #5 — Distinction UI « avis fondateur » vs « avis communauté » côté admin**

**Given** la liste des avis d'un lieu côté admin (préfigure Story 6.4)
**When** Story 6.3 est livrée
**Then** la **fiche lieu admin** (route `/lieux/show/:id` ou panneau dans `/lieux/edit/:id`) affiche une section « Avis » :

```tsx
// spawt-admin/src/pages/lieux/components/PlaceReviewsList.tsx
import { useList } from "@refinedev/core";

export const PlaceReviewsList = ({ placeId }: { placeId: string }) => {
  const { data } = useList({
    resource: "spawt_checkin",
    filters: [
      { field: "place_id", operator: "eq", value: placeId },
      { field: "note_etoiles", operator: "ne", value: null },
    ],
    sorters: [{ field: "created_at", order: "desc" }],
    pagination: { pageSize: 50 },
  });

  return (
    <div>
      <h3>Avis ({data?.total ?? 0})</h3>
      <ul>
        {data?.data.map(r => (
          <li key={r.id} className={r.is_seed ? "review-seed" : "review-community"}>
            <span className={`badge ${r.is_seed ? "badge-seed" : "badge-community"}`}>
              {r.is_seed ? "Avis fondateur" : "Avis communauté"}
            </span>
            <strong>{r.note_etoiles}★</strong>
            <span>{(r.tags ?? []).join(", ")}</span>
            <p>{r.texte_avis}</p>
            <small>{new Date(r.created_at).toLocaleDateString("fr-FR")}</small>
          </li>
        ))}
      </ul>
    </div>
  );
};
```

**And** le CSS distingue visuellement :
- `.review-seed` : bordure gauche dorée (rappel SPAWT) + badge texte « Avis fondateur ».
- `.review-community` : bordure neutre + badge texte « Avis communauté ».

**And** un compteur en haut de la section indique : `« N avis communauté + M avis fondateur (alimentent l'ADN, exclus du compteur public) »`.

---

**AC #6 — Idempotence + re-runs sans duplicates**

**Given** un `inventory.csv` déjà exécuté une fois
**When** le script est ré-exécuté avec le même CSV
**Then** :

1. Aucun nouveau lieu n'est créé en double — la clé naturelle `(LOWER(name), LOWER(neighborhood))` matche l'existant → UPDATE.
2. Les avis seed ne sont pas dupliqués — le check `existingSeeds < place.reviews.length` skip l'insert.
3. L'ADN est recalculé à chaque run mais avec les mêmes inputs → idempotent par construction (sauf si Ally modifie le CSV entre-temps, auquel cas le re-run propage les changements).
4. L'audit log accumule 1 ligne `seed_inventory_run` par run — historique des batches conservé (non-idempotent par design : un re-run est un événement distinct, l'audit le trace).

**Given** un CSV modifié (e.g. correction du `descriptive_address`)
**When** ré-exécuté
**Then** UPDATE propagé, audit log entry créée avec `payload_after` reflétant la nouvelle valeur.

---

**AC #7 — Tests + smoke**

**Given** la suite de tests
**When** lancée
**Then** la couverture inclut :

1. **`validate-inventory.test.mjs`** (Node natif test runner ou vitest) :
   - CSV exemple 5 lignes valides → 0 erreur.
   - CSV avec une ligne `lat = "invalid"` → 1 erreur signalée à la bonne ligne.
   - CSV avec moins de 3 reviews → erreur.

2. **`seed-inventory-edge.test.ts`** (Deno test ou mock côté admin) :
   - Mock supabase service_role → upsert d'un lieu inexistant retourne `status: "created"`.
   - Re-exécution → `status: "updated"`.
   - Mock spawt_staff inexistant → retourne 403.

3. **`PlaceReviewsList.test.tsx`** (côté `spawt-admin/`) :
   - Mock useList retournant 2 reviews `is_seed = true` + 1 `is_seed = false` → 3 entrées affichées, 2 avec classe `.review-seed`, 1 avec `.review-community`.

**Given** un smoke test manuel
**When** Stéphanie lance le flow complet en dev :
1. Crée le compte seed via `setup-seed-spawter.ts`.
2. Remplit `inventory.example.csv` avec 3 lieux Mission 1.
3. `npm run seed:validate` → 0 erreur.
4. `npm run seed:inventory -- --dry-run` → preview OK.
5. `npm run seed:inventory` → 3 lieux + 9 avis seed insérés.
6. Vérifie côté admin que les 3 lieux apparaissent avec « Avis fondateur » badges.
7. Re-run → 3 lieux `updated`, 0 nouveau seed.

**Then** le flow tourne sans erreur.

**And** la triple gate `spawt-admin/` + mobile reste verte.

## Tasks / Subtasks

- [ ] **Task 1 — Template CSV + documentation format** (AC: #1)
  - [ ] Créer `supabase/seed/inventory.template.csv` avec header commenté.
  - [ ] Créer `supabase/seed/inventory.example.csv` avec 5 lignes (1 par catégorie Mission 1).
  - [ ] Créer `supabase/seed/README.md` documentant le format CSV + workflow.
  - [ ] Créer `supabase/seed/validate-inventory.mjs` (script ESM Node).

- [ ] **Task 2 — Edge Function `seed-inventory`** (AC: #2)
  - [ ] Créer `supabase/functions/seed-inventory/index.ts` (Deno) selon AC #2.
  - [ ] Créer `supabase/functions/seed-inventory/import_map.json` (deps Supabase + Std lib).
  - [ ] Déployer (dev) : `supabase functions deploy seed-inventory`.
  - [ ] Tests Deno : `supabase/functions/seed-inventory/index_test.ts` (mock service_role + cas auth/idempotence).

- [ ] **Task 3 — Script setup compte spawter seed** (AC: #3)
  - [ ] Créer `supabase/scripts/setup-seed-spawter.ts` selon AC #3.
  - [ ] Ajouter à `supabase/README.md` le workflow setup initial.
  - [ ] Stocker l'UUID résultant dans `.env.seed` (non-commit).

- [ ] **Task 4 — Script runner CSV côté spawt-admin** (AC: #4)
  - [ ] Créer `spawt-admin/scripts/seed-inventory.ts`.
  - [ ] Ajouter dependencies : `tsx`, `csv-parse` (Node), `dotenv`.
  - [ ] Ajouter `seed:inventory` + `seed:validate` à `spawt-admin/package.json`.
  - [ ] Documenter dans `spawt-admin/README.md`.

- [ ] **Task 5 — UI distinction avis fondateur côté admin** (AC: #5)
  - [ ] Créer `spawt-admin/src/pages/lieux/components/PlaceReviewsList.tsx`.
  - [ ] Intégrer dans la page `/lieux/edit/:id` (Story 6.2) ou créer `/lieux/show/:id`.
  - [ ] CSS dans `spawt-admin/src/styles/reviews.css`.

- [ ] **Task 6 — Idempotence + tests integration** (AC: #6, #7)
  - [ ] Vérifier idempotence Edge Function via test Deno répété.
  - [ ] Test `validate-inventory.test.mjs`.
  - [ ] Test `PlaceReviewsList.test.tsx`.

- [ ] **Task 7 — Smoke test manuel** (AC: #7)
  - [ ] Stéphanie exécute le flow complet en dev (cf. AC #7).
  - [ ] Vérifie côté admin (badges) + côté mobile (`HomeD` affiche les lieux seedés sans « ADN en construction » massif).

- [ ] **Task 8 — Doc + CHANGELOG**
  - [ ] CHANGELOG : `feat(spawt-admin): pré-chargement inventaire + Edge Function seed-inventory (Story 6.3)`.
  - [ ] Mettre à jour `supabase/seed/README.md` avec la liste finale Mission 1 (à compléter par Ally).

## Dev Notes

### 1. Pourquoi pas une seed page UI dans le panel (option B écartée)

| Option | Verdict |
|---|---|
| **Option A — Script Node + CSV source-controlled** | ✅ **Retenu V1.** Le CSV vit dans le repo (`supabase/seed/inventory.csv`), versionné, reviewable. Le script est reproductible. L'Ally édite le CSV (Excel / Google Sheets export), Stéphanie lance le script. |
| **Option B — Écran upload CSV `/seed` dans panel** | ❌ Surcoût UI pour une opération exceptionnelle (lancement + corrections Sprint 1, pas un workflow continu). |
| **Option C — Manuel via panel CRUD Story 6.2** | ❌ 50-100 lieux × 3 avis = 150-300 actions UI → 4-6 heures de saisie manuelle. Pas scalable. |

**Décision V1 : Option A.** Sprint 2 pourrait ajouter une page upload CSV si l'équipe operations le demande.

### 2. Pourquoi Edge Function + service_role (pas direct via SDK staff)

**Contrainte technique** : la RLS `spawt_checkin_insert_own` (migration 0011 ligne 75-77) bloque `WITH CHECK (is_seed = false)` — un INSERT avec `is_seed = true` est refusé même au staff.

**Options** :

| Option | Verdict |
|---|---|
| **Edge Function service_role bypass RLS** | ✅ **Retenu.** Sécurité préservée : seul un staff authentifié peut **invoquer** l'Edge Function (auth check explicit), la fonction utilise service_role pour le bypass uniquement à l'intérieur. Anti-tampering : impossible pour un client non-staff de poser `is_seed = true`. |
| **Étendre la RLS staff sur spawt_checkin** | ⚠️ Possible (CREATE POLICY `spawt_checkin_insert_staff_seed`), mais expose le SDK staff à pouvoir poser `is_seed = true` directement — surface d'attaque plus large. Préférable de centraliser dans une Edge Function. |
| **Triggers SQL qui forcent `is_seed = false` côté authenticated** | ❌ Surcomplexité. La RLS existante est suffisante côté contrainte ; le bypass passe par service_role. |

**Décision V1 : Edge Function `seed-inventory`** — cohérent architecture §Authentication & Security et §API & Communication Patterns.

### 3. Recompute ADN dans l'Edge Function — V1 simple vs Sprint 2 `applyReviewToAdn`

L'Edge Function V1 fait un recompute simple :

```ts
weighted_rating = AVG(note_etoiles WHERE note_etoiles IS NOT NULL)
total_reviews = COUNT WHERE is_seed = false
confidence_score = 1 - 1/(1 + count*0.05)
```

**Limites V1** :
- Pas de pondération stade (Story 3.2 `STADE_WEIGHTS`). Acceptable car le compte seed = stade `touriste` (weight 1x), donc une moyenne simple = la weighted_rating exacte si tous les avis sont seed du même compte.
- Pas de mapping `ReviewTag → 5 axes ADN` (Story 4.7 `applyReviewToAdn`). Les 5 axes ADN sont **saisis manuellement dans le CSV** par l'Ally — décision pragmatique V1.

**Sprint 2 (D-631)** : porter `applyReviewToAdn` (et son helper `place-adn-signals.ts`) en Deno-compatible, l'utiliser dans l'Edge Function pour cohérence parfaite mobile/admin.

### 4. Pourquoi un seul compte spawter seed (pas 1 par Ally)

| Option | Verdict |
|---|---|
| **1 compte unique `spawter_seed_alpha`** | ✅ **Retenu V1.** Simplifie l'attribution. Tous les avis seed pointent vers ce compte. L'UI mobile **ne montre pas** ces avis dans le profil public (`is_seed = true` filtré côté Story 4.x). |
| **N comptes (1 par Ally + 1 par catégorie)** | ⚠️ Plus réaliste (« Cette Ally a posé 5 avis Dabali »), mais multiplie la complexité du setup. |

**Décision V1 : 1 compte unique.** Sprint 2 si Ally augmente (3+ personnes terrain), on peut multiplier.

**Conséquence** : le compte seed ne doit JAMAIS apparaître dans la communauté publique (FR-027 séparation). Vérification :
- Pas de `spawt_checkin.is_seed = false` côté ce compte → 0 avis communauté → le profil est invisible.
- Pas de `coup_de_coeur` posé → pas de signal social.
- Le `total_spawts` reste 0 (les seeds ne comptent pas dans le compteur public — à confirmer côté Story 4.x feature mais V1 = filtre côté display).

### 5. Mission 1 ventilation — collecte terrain ≠ Story 6.3 livre l'outil

Le scope Story 6.3 = **livrer l'outil** (script, Edge Function, CSV template). La **collecte effective des 20 lieux Mission 1** est faite en parallèle Phase 0 par Ally terrain (cahier des charges §5.8 alpha). Le CSV `supabase/seed/inventory.csv` final est committé séparément quand Ally a terminé sa collecte.

**Décision V1** : Story 6.3 livre `inventory.example.csv` avec **5 lignes lookalike** (1 par catégorie majeure Mission 1, fictives mais cohérentes pour smoke test). Le vrai `inventory.csv` est ajouté à la branche par Ally + Stéphanie au moment du lancement alpha.

### 6. Politique : avis seed alimentent ADN mais pas le compteur public

Architecture §3 l290-294 + PRD FR-032 figent la règle. L'Edge Function la respecte :

- `total_reviews = COUNT WHERE is_seed = false` → compteur public.
- `weighted_rating` calculé sur **tous** les avis (seed + communauté).
- `confidence_score` calculé sur **tous** les avis.

**Cohérence avec Story 4.7** : `applyReviewToAdn` (mobile) fait pareil — `total_reviews += 0` pour les seeds, mais axes / weighted_rating / confidence se mettent à jour.

### 7. Idempotence : clé naturelle `(LOWER(name), LOWER(neighborhood))`

**Choix** : pas de `ON CONFLICT (id)` car les UUID sont générés DB-side via `gen_random_uuid()`. La clé naturelle pour le re-run = `name + neighborhood` (case-insensitive).

**Risque** : 2 lieux différents avec le même nom dans le même quartier (e.g. 2 « Chez Tantie Rose » à Abobo) → conflit. Mitigation : ajouter un suffixe ` (annexe)` ou ` (n°2)` au `name`. Documenté `supabase/seed/README.md`.

**Sprint 2 (D-633)** : ajouter une contrainte unique `UNIQUE(LOWER(name), LOWER(neighborhood))` côté DB pour enforcer au schéma.

### 8. Sign-off

- **Stéphanie** (tech) : revue Edge Function (auth check, idempotence, service_role usage), workflow setup seed spawter.
- **Kidam** (analytics) : confirmer que les avis seed ne polluent pas les KPIs alpha (filtres `is_seed = false` à appliquer côté Story 6.5 metrics).
- **Alexandre** (brand) : validation finale du CSV Mission 1 (20 lieux) — équilibrage catégories + cohérence vocab (pas de pollution « Made in Abidjan »).

### 9. Defers identifiés

- **D-631** — Port `applyReviewToAdn` + `place-adn-signals.ts` en Deno pour cohérence parfaite mobile/admin (Sprint 2).
- **D-632** — Page UI `/seed` dans le panel (upload CSV) (Sprint 2 si demande operations).
- **D-633** — Contrainte unique `(LOWER(name), LOWER(neighborhood))` au schéma `places` (Sprint 2).
- **D-634** — Multi-comptes seed (1 par Ally) (Sprint 2 si Ally scale).
- **D-635** — Photos seed (upload bulk depuis un dossier `supabase/seed/photos/` ; V1 = `cover_photo_url` URL externe dans CSV).
- **D-636** — Soft-delete d'un seed run (rollback batch via audit log) (Sprint 2).

### 10. Risk

- **Risque #1** : Doublon `name + neighborhood` cause un UPDATE inopiné d'un lieu existant. Mitigation = validation pré-run (`npm run seed:validate` + dry-run) + revue Ally avant push.
- **Risque #2** : Edge Function timeout sur batch > 50 lieux. Mitigation V1 = batches de 10 par invoke (cf. AC #4 script runner). Sprint 2 = streaming.
- **Risque #3** : CSV mal encodé (UTF-8 BOM, accents cassés) → validation Zod n'attrape pas. Mitigation = `iconv -f utf-8 -t utf-8` pré-run + grep visuel par Stéphanie.
- **Risque #4** : Le compte seed apparaît dans la communauté publique. Mitigation = audit explicit (`SELECT * FROM spawters WHERE id = SEED_SPAWTER_ID` doit avoir `total_spawts = 0`, pas de `spawt_checkin.is_seed = false`).
- **Risque #5** : Service role key fuitée via les logs de l'Edge Function. Mitigation = `--no-verify-jwt=false` activé + Supabase secrets manager (jamais en clair dans le code).

### Project Structure Notes

- **Nouveaux fichiers `supabase/`** :
  - `seed/inventory.template.csv`
  - `seed/inventory.example.csv`
  - `seed/README.md`
  - `seed/validate-inventory.mjs`
  - `functions/seed-inventory/index.ts`
  - `functions/seed-inventory/import_map.json`
  - `functions/seed-inventory/index_test.ts`
  - `scripts/setup-seed-spawter.ts`
- **Nouveaux fichiers `spawt-admin/`** :
  - `scripts/seed-inventory.ts`
  - `src/pages/lieux/components/PlaceReviewsList.tsx`
  - `src/styles/reviews.css`
  - `src/pages/lieux/__tests__/PlaceReviewsList.test.tsx`
- **Modifs `spawt-admin/package.json`** : scripts `seed:inventory`, `seed:validate` + deps `tsx`, `csv-parse`, `dotenv`.
- **Pas de modif `app/`** — boundary préservée.
- **CHANGELOG** : 1 entry `feat(spawt-admin)`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md] lignes 1127-1146 — Story 6.3 user story + BDD AC.
- [Source: _bmad-output/planning-artifacts/PRD.md] FR-032 (lignes 552-555), FR-026 amendé (lignes 516-519), §5.4 amendement Claude (lignes 743).
- [Source: _bmad-output/planning-artifacts/architecture.md] lignes 290-294 (is_seed alimente ADN, exclus compteur public), 322-325 (service_role Edge Function).
- [Source: _bmad-output/project-context.md] §Security & privacy, §Vocabulaire SPAWT.
- [Source: supabase/migrations/0011_create_spawt_checkin.sql] — colonne `is_seed`, RLS bloquant `is_seed = true`.
- [Source: supabase/migrations/0012_antifraud_triggers.sql] — bypass `is_seed = true` dans tous les triggers (Story 4.4).
- [Source: supabase/migrations/0017_create_admin_audit_log.sql] Story 6.1 — action `seed_inventory_run` dans CHECK enum.
- [Source: _bmad-output/implementation-artifacts/4-7-mise-a-jour-de-l-adn-du-lieu.md] §AC #4 — politique seed bypass total_reviews.
- [Source: _bmad-output/implementation-artifacts/6-1-...md] — Edge Function pattern.
- [Source: documentation/SPRINT_1_CAHIER_DES_CHARGES.md §5.8] — Ally Mission 1 ventilation.

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev agent)_

### Debug Log References

_(à remplir par le dev agent)_

### Completion Notes List

_(à remplir par le dev agent)_

### File List

_(à remplir par le dev agent)_
