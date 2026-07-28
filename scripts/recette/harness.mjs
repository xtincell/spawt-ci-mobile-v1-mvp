// =============================================================================
// SPAWT — banc de recette : servir une interface et la piloter au navigateur
// =============================================================================
// Pourquoi ce détour plutôt que d'ouvrir directement admin.spawt.online :
// dans l'environnement d'exécution des agents, Chromium n'a pas d'accès réseau
// sortant (toute navigation externe se solde par ERR_CONNECTION_RESET), alors
// que Node, lui, sort normalement. Le navigateur peut en revanche joindre
// 127.0.0.1.
//
// On monte donc un relais local qui :
//   * sert les fichiers statiques d'un `dist/` déjà construit ;
//   * retransmet les chemins d'API (/rest, /auth, /functions, /storage, /pg)
//     vers le VRAI backend, avec les requêtes exécutées par Node.
//
// Le navigateur exerce ainsi l'interface réelle contre les données réelles.
// Ce n'est pas une simulation : les réponses viennent de api.spawt.online.
//
// Utilisable aussi hors agent (poste de dev) pour rejouer une recette
// reproductible sans dépendre de l'environnement de production.
// =============================================================================

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
};

/** Chemins retransmis au backend réel plutôt que servis depuis le disque. */
const API_PREFIXES = ["/rest/", "/auth/", "/functions/", "/storage/", "/realtime/", "/pg/"];

/**
 * Démarre le relais.
 * @param {{distDir: string, backend: string, port?: number, spa?: boolean}} opts
 * @returns {Promise<{url: string, close: () => Promise<void>, apiCalls: Array}>}
 */
export async function startHarness({ distDir, backend, port = 0, spa = true }) {
  const apiCalls = [];

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    // ── Retransmission vers le backend réel ────────────────────────────────
    if (API_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      const target = backend.replace(/\/+$/, "") + url.pathname + url.search;
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;
      delete headers["accept-encoding"]; // on laisse Node gérer

      let body;
      if (req.method !== "GET" && req.method !== "HEAD") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = Buffer.concat(chunks);
      }

      try {
        const upstream = await fetch(target, { method: req.method, headers, body });
        const buf = Buffer.from(await upstream.arrayBuffer());
        apiCalls.push({ method: req.method, path: url.pathname, status: upstream.status });
        const out = {};
        upstream.headers.forEach((v, k) => {
          // Les en-têtes de transfert/compression ne survivent pas au relais.
          if (!["content-encoding", "content-length", "transfer-encoding"].includes(k)) out[k] = v;
        });
        out["access-control-allow-origin"] = "*";
        res.writeHead(upstream.status, out);
        res.end(buf);
      } catch (e) {
        apiCalls.push({ method: req.method, path: url.pathname, status: 0, error: e.message });
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "relais: " + e.message }));
      }
      return;
    }

    // ── Fichiers statiques ─────────────────────────────────────────────────
    // `normalize` + retrait des `..` : le relais ne doit pas pouvoir servir
    // un fichier hors du dist, même en recette.
    const safe = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    let file = join(distDir, safe);
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, "index.html");
      await stat(file);
    } catch {
      // Repli SPA : toute route inconnue rend index.html (comme nginx en prod).
      if (!spa) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      file = join(distDir, "index.html");
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });

  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  const actual = server.address().port;
  return {
    url: `http://127.0.0.1:${actual}`,
    apiCalls,
    close: () => new Promise((r) => server.close(r)),
  };
}

/** Lance Chromium (sans bac à sable — conteneur CI) et renvoie page + erreurs. */
export async function openBrowser() {
  const { chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs");
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 200)));
  return { browser, context, page, errors };
}
