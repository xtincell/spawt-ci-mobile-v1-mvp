export const CHANNEL = "spawt-le-cha-v1";
export const OTHER_PLACES: ReadonlySet<string> = new Set([
  "a1000000-0000-4000-8000-000000000001",
  "85433084-a972-563c-b9d1-6fac34f776d9",
]);
export type PreviewTab = "menu" | "avis" | "photos" | "media" | "infos";
export const sectionForTab = (tab?: string) => {
  if (tab === "menu") return "menu-complet";
  if (tab === "avis") return "tous-les-avis";
  if (tab === "photos" || tab === "media") return "photos";
  return tab === "infos" ? "infos-pratiques" : "";
};
export interface PreviewState { saved: boolean; heart: boolean; remaining: number | null; member: boolean; }
export type HostMessage =
  | { type: "state"; state: PreviewState }
  | { type: "notice"; title: string; body: string }
  | { type: "position"; coords: {latitude: number; longitude: number; accuracy: number} | null; denied: boolean }
  | { type: "back" };

const operations = ["ready", "exit", "save", "share", "spawt", "heart", "direct", "reviews", "open-place", "locate"] as const;
export type Action = typeof operations[number];
export interface ActionMessage { action: Action; place?: string; }
export function parsePreviewAction(value: unknown): ActionMessage | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const data = JSON.parse(value);
    if (data?.channel !== CHANNEL || !operations.includes(data.action)) return null;
    if (data.action === "open-place" && !OTHER_PLACES.has(data.place)) return null;
    return data.action === "open-place" ? {action:data.action, place:data.place} : {action:data.action};
  } catch { return null; }
}

// The document is delivered in the app. Only intentional gestures cross this
// bridge; its example reviews, ratings and awards never leave the document.
export function frameDocument(html: string, tab?: string) {
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'";
  const script = `(() => {
    const channel = ${JSON.stringify(CHANNEL)};
    const section = ${JSON.stringify(sectionForTab(tab))};
    const post = (action, place) => {
      const message = JSON.stringify({channel, action, place});
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
      else window.parent.postMessage(message, '*');
    };
    const modal = document.getElementById('modal');
    const notice = (title, body, extras = []) => {
      const copy = document.createElement('p');
      copy.textContent = body;
      dialog(title, [copy, ...extras]);
    };
    const link = (label, action) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'section-more'; b.textContent = label;
      b.addEventListener('click', () => post(action)); return b;
    };
    const explain = () => notice('Aperçu SPAWT', 'Cette fiche présente le fonctionnement de SPAWT. Certains avis, notes et distinctions sont illustrés pour la démonstration.', [
      link('Ouvrir la fiche en direct', 'direct'), link('Lire les avis publiés', 'reviews')
    ]);
    const context = document.querySelector('.summary .kind');
    const about = document.createElement('button'); about.type = 'button'; about.textContent = 'Aperçu SPAWT';
    about.className = 'preview-context'; about.onclick = explain;
    context.append(document.createTextNode(' · '), about);
    const info = document.createElement('section');
    const h = document.createElement('h2'); h.textContent = 'À propos de cet aperçu';
    const p = document.createElement('p'); p.textContent = 'Les exemples de la fiche illustrent les avis et les distinctions. Retrouve les contributions publiées sur la fiche en direct.';
    info.append(h, p, link('Fiche en direct', 'direct'), link('Avis publiés', 'reviews'));
    document.querySelector('.practical-grid').append(info);
    let currentState;
    function paint() {
      if (!currentState) return;
      const {saved, heart, remaining, member} = currentState;
      refreshSave(saved);
      const b = document.getElementById('coup-de-coeur');
      if (!b) return;
      const label = heart ? 'Mon coup de cœur' : 'Coup de cœur';
      const hint = heart ? 'Toucher pour retirer' : remaining === null ? (member ? 'Mon quota du mois' : 'Mon compte SPAWT') : remaining + ' disponible' + (remaining > 1 ? 's' : '') + ' ce mois-ci';
      b.setAttribute('aria-pressed', String(heart)); b.setAttribute('aria-disabled','false');
      b.querySelector('b').textContent = label; b.querySelector('small').textContent = hint;
      b.title = label + ' · ' + hint; b.setAttribute('aria-label', b.title);
    }
    const locationRequests = [];
    try {
      Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {
        getCurrentPosition(success, error) {
          locationRequests.push({success, error}); if (locationRequests.length === 1) post('locate');
        }
      }});
    } catch {}
    const localHistory = [];
    let lastHash = location.hash;
    addEventListener('hashchange', () => {
      const hash = location.hash;
      if (localHistory.length && hash === localHistory[localHistory.length - 1]) localHistory.pop();
      else localHistory.push(lastHash);
      lastHash = hash;
    });
    window.spawtPreviewReceive = data => {
      if (data.type === 'state') {currentState = data.state; paint();}
      else if (data.type === 'notice') notice(data.title, data.body);
      else if (data.type === 'position') {
        const callbacks = locationRequests.splice(0);
        callbacks.forEach(q => data.coords ? q.success({coords:data.coords, timestamp:Date.now()}) : q.error?.({code:data.denied ? 1 : 2}));
      } else if (data.type === 'back') {
        if (modal.open) modal.close();
        else if (localHistory.length) history.back();
        else if (location.hash) {location.hash = ''; window.scrollTo(0,0);}
        else post('exit');
      }
    };
    addEventListener('message', e => {
      if (e.source === parent && e.data?.channel === channel) window.spawtPreviewReceive(e.data.message);
    });
    window.addEventListener('pageshow', paint);
    window.addEventListener('storage', paint);
    document.addEventListener('visibilitychange', paint);
    const buttons = {spawter:'spawt', save:'save', share:'share', 'coup-de-coeur':'heart'};
    document.addEventListener('click', e => {
      const node = e.target.closest('a,button');
      if (!node) return;
      let action = buttons[node.id];
      let place;
      if (node.classList.contains('home-link')) action = 'exit';
      else if (!action && node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (href.startsWith('#')) {
          e.preventDefault();
          if (location.hash !== href) location.hash = href.slice(1);
          return;
        }
        e.preventDefault(); e.stopImmediatePropagation();
        try {
          const url = new URL(href);
          if (url.origin === 'https://spawt.online' && url.pathname === '/carte' && url.searchParams.has('lieu')) post('open-place', url.searchParams.get('lieu'));
        } catch {}
        return;
      }
      if (!action) return;
      e.preventDefault(); e.stopImmediatePropagation(); post(action, place);
    }, true);
    if (section) location.hash = section;
    post('ready');
  })();`;
  const style = '<style>.preview-context{font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;text-decoration:underline;text-underline-offset:3px;padding:4px 0}</style>';
  return html.replace(/<head\b[^>]*>/i, match => match + '<meta http-equiv="Content-Security-Policy" content="' + policy + '">' + style)
    .replace(/<\/body>/i, () => '<script>' + script + '</script></body>');
}
