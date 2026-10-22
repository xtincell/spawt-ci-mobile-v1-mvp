import { renderShare, type SharedItem } from "./render.ts";
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
export async function handlePublicShare(req: Request): Promise<Response> {
 if (!["GET", "HEAD"].includes(req.method)) return new Response("Method not allowed", { status: 405, headers });
 const url = new URL(req.url); const kind = url.searchParams.get("kind"); const id = url.searchParams.get("id") ?? "";
 if (!["lieu", "liste"].includes(kind ?? "") || !UUID.test(id)) return new Response("Lien introuvable", { status: 404, headers });
 const origin = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY");
 if (!origin || !anon) return new Response("Cette sélection est momentanément indisponible.", { status: 503, headers });
 const read = async (path: string, body?: unknown) => {
  const result = await fetch(`${origin}/rest/v1/${path}`, { method: body ? "POST" : "GET", headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw new Error("public_read_failed"); return result.json();
 };
 try {
  let title: string; let description: string; let items: SharedItem[];
  if (kind === "liste") {
   const list = await read("rpc/public_outing_list", { p_token: id });
   if (!list) return new Response("Ce lien n’est plus disponible.", { status: 404, headers });
   title = list.title; description = "Une sélection à explorer et à retrouver dans tes envies de sortie."; items = list.items;
  } else {
   const rows = await read(`places?select=id,name,neighborhood,descriptive_address,cover_photo_url&id=eq.${id}&is_published=eq.true`);
   if (!rows.length) return new Response("Ce lieu n’est plus publié.", { status: 404, headers });
   const place = rows[0]; title = place.name; description = [place.neighborhood, place.descriptive_address].filter(Boolean).join(" · ");
   const dishes = await read(`public_menu_items?select=id,name,place_id,place_name,photo_url,price_xof,observed_on,neighborhood&place_id=eq.${id}&order=name&limit=100`);
   items = [{ place_id: place.id, place_name: place.name, neighborhood: place.neighborhood, photo_url: place.cover_photo_url }, ...dishes.map((d: Record<string, unknown>) => ({ ...d, menu_item_id: d.id, dish_name: d.name }))];
  }
  const page = renderShare({ title, description, items, canonical: `https://spawt.online/${kind}/${id}`, appLink: kind === "lieu" ? `spawt://place/${id}` : `spawt://liste/${id}` });
  return new Response(req.method === "HEAD" ? null : page, { headers });
 } catch { return new Response("Les données ne sont pas disponibles pour le moment. Réessaie dans un instant.", { status: 503, headers }); }
}
Deno.serve(handlePublicShare);
