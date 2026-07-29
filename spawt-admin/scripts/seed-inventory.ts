// Story 6.3 — Script Node idempotent : lit le CSV + appelle l'Edge Function `seed-inventory`.
//
// Usage : npx tsx spawt-admin/scripts/seed-inventory.ts ../supabase/seed/inventory.csv
//
// Auth : utilise une session staff (login préalable côté admin web, JWT récupéré via
// supabase.auth.signInWithPassword ici par les env vars STAFF_EMAIL + STAFF_PASSWORD).
// JAMAIS de SUPABASE_SERVICE_ROLE_KEY ici — la fonction Edge l'a côté serveur.

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const STAFF_EMAIL = process.env.STAFF_EMAIL ?? "";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD ?? "";
const SEED_SPAWTER_ID = process.env.SEED_SPAWTER_ID ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STAFF_EMAIL || !STAFF_PASSWORD || !SEED_SPAWTER_ID) {
  console.error("Env requis : SUPABASE_URL, SUPABASE_ANON_KEY, STAFF_EMAIL, STAFF_PASSWORD, SEED_SPAWTER_ID");
  process.exit(2);
}

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
  reviews: Array<{ note_etoiles: 1 | 2 | 3 | 4 | 5; tags: string[]; texte_avis: string }>;
}

function parseRow(headers: string[], line: string): SeedPlaceInput | null {
  // Naive CSV parser tolerant of comma-in-quotes — sufficient for seed CSVs.
  const cells: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      buf += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  cells.push(buf);
  if (cells.length !== headers.length) return null;

  const row = Object.fromEntries(headers.map((h, i) => [h.trim(), cells[i].trim()])) as Record<string, string>;
  const tier = Number(row.price_tier);
  if (tier !== 1 && tier !== 2 && tier !== 3) return null;
  return {
    name: row.name,
    cuisine: row.cuisine.split("|").filter(Boolean),
    lat: Number(row.lat),
    lng: Number(row.lng),
    descriptive_address: row.descriptive_address,
    neighborhood: row.neighborhood,
    city: row.city,
    price_tier: tier,
    avg_ticket_xof: row.avg_ticket_xof ? Number(row.avg_ticket_xof) : null,
    hours: row.hours_json ? JSON.parse(row.hours_json) : {},
    phone: row.phone || null,
    whatsapp: row.whatsapp || null,
    cover_photo_url: row.cover_photo_url || null,
    gallery_urls: row.gallery_urls_pipe ? row.gallery_urls_pipe.split("|") : [],
    signals: row.signals_pipe ? row.signals_pipe.split("|") : [],
    is_published: row.is_published === "true",
    adn: {
      axe_local_international: Number(row.adn_local_international),
      axe_informel_etabli: Number(row.adn_informel_etabli),
      axe_budget_premium: Number(row.adn_budget_premium),
      axe_populaire_prive: Number(row.adn_populaire_prive),
      axe_decontracte_habille: Number(row.adn_decontracte_habille),
    },
    reviews: [1, 2, 3]
      .map((n) => {
        const note = row[`review_${n}_note`];
        if (!note) return null;
        return {
          note_etoiles: Number(note) as 1 | 2 | 3 | 4 | 5,
          tags: (row[`review_${n}_tags_pipe`] ?? "").split("|").filter(Boolean),
          texte_avis: row[`review_${n}_text`] ?? "",
        };
      })
      .filter((r): r is { note_etoiles: 1 | 2 | 3 | 4 | 5; tags: string[]; texte_avis: string } => r !== null),
  };
}

async function main(): Promise<void> {
  const csvArg = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../supabase/seed/inventory.csv");
  const stream = createReadStream(csvArg, { encoding: "utf-8" });
  const rl = createInterface({ input: stream });

  let headers: string[] | null = null;
  const places: SeedPlaceInput[] = [];

  for await (const raw of rl) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (!headers) {
      headers = line.split(",").map((h) => h.trim());
      continue;
    }
    const parsed = parseRow(headers, line);
    if (parsed) places.push(parsed);
  }

  console.log(`[seed] parsed ${places.length} places from ${csvArg}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: STAFF_PASSWORD,
  });
  if (signErr) {
    console.error("[seed] auth failed:", signErr.message);
    process.exit(3);
  }

  const { data, error } = await supabase.functions.invoke("seed-inventory", {
    body: { seed_spawter_id: SEED_SPAWTER_ID, places },
  });
  if (error) {
    console.error("[seed] invoke failed:", error.message);
    process.exit(4);
  }
  console.log("[seed] result:", JSON.stringify(data, null, 2));
}

void main();
