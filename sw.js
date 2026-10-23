const CACHE = "site-shell-v3";

const ADMIN_PAGES = ["admin.html", "admin-login.html"];
const PUBLIC_PAGES = ["index.html", "historia.html", "privacidad.html", "404.html"];
const ADMIN_JS = ["js/admin.js", "js/admin-login.js", "js/pwa.js"];
const PUBLIC_JS = [
  "js/absoluto.js",
  "js/cliente.js",
  "js/contenido.js",
  "js/faq.js",
  "js/historia.js",
  "js/main.js",
  "js/movimiento.js",
  "js/tracking.js"
];

const SHELL = [
  ...ADMIN_PAGES,
  ...PUBLIC_PAGES,
  "css/admin.css",
  "css/styles.css",
  ...ADMIN_JS,
  ...PUBLIC_JS,
  "js/config.js",
  "js/servicios.js",
  "js/supabase.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png"
];

const SHELL_SET = new Set(SHELL);
const ADMIN_PAGE_SET = new Set(ADMIN_PAGES);
const PUBLIC_PAGE_SET = new Set(PUBLIC_PAGES);
const ADMIN_JS_SET = new Set(ADMIN_JS);
const PUBLIC_JS_SET = new Set(PUBLIC_JS);

const relativePath = (url) => {
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return "";
  let path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("/")) path = path.slice(1);
  try {
    return decodeURIComponent(path);
  } catch (error) {
    return "";
  }
};

const leaveAlone = (url, request) => {
  if (request.method !== "GET") return true;
  const host = url.hostname;
  if (host === "supabase.co" || host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return true;
  const blob = url.pathname + url.search;
  if (/access_token|refresh_token|provider_token|code_verifier|token_type|apikey/i.test(blob)) return true;
  if (/\/auth\/v1\/|\/rest\/v1\/|\/realtime\/v1\//.test(url.pathname)) return true;
  if (request.headers.get("authorization") || request.headers.get("apikey")) return true;
  return false;
};

const laneOf = (request) => {
  const path = relativePath(new URL(request.url));
  if (!SHELL_SET.has(path)) return "";
  if (request.mode === "navigate" || request.destination === "document") {
    if (ADMIN_PAGE_SET.has(path)) return "admin";
    if (PUBLIC_PAGE_SET.has(path)) return "public";
    return "";
  }
  if (!request.referrer) return "";
  let referrer;
  try {
    referrer = new URL(request.referrer);
  } catch (error) {
    return "";
  }
  const ref = relativePath(referrer);
  if (ADMIN_PAGE_SET.has(ref) || ADMIN_JS_SET.has(ref)) return "admin";
  if (PUBLIC_PAGE_SET.has(ref) || PUBLIC_JS_SET.has(ref)) return "public";
  if (SHELL_SET.has(ref) && ref.startsWith("js/")) return "public";
  return "";
};

const cleanRequest = (path) => new Request(new URL(path, self.registration.scope).href);

const canStore = (request, response) => {
  if (!response || !response.ok || response.type !== "basic" || response.redirected) return false;
  const url = new URL(request.url);
  if (leaveAlone(url, request) || !SHELL_SET.has(relativePath(url))) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("json")) return false;
  return type.includes("text/html") || type.includes("text/css") || type.includes("javascript") || type.includes("image/png");
};

const offlineAdmin = () => new Response(
  "<!DOCTYPE html><html lang=\"es-CO\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"theme-color\" content=\"#161210\"><title>Panel</title><style>html,body{margin:0;height:100%;background:#f7f3eb;color:#1a1512}body{min-height:100%;display:grid;place-items:center;padding:2rem;text-align:center;font-family:Georgia,'Times New Roman',serif}p{margin:0;max-width:14rem;font-size:2rem;line-height:1.05}p::before{content:'';display:block;width:2rem;height:1px;margin:0 auto 1rem;background:#c9a24b}</style></head><body><p>Sin conexión. Conéctate para ver tus citas.</p><script>addEventListener('online',function(){location.reload()})</script></body></html>",
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
);

const offlinePublic = () => new Response(
  "<!DOCTYPE html><html lang=\"es-CO\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"theme-color\" content=\"#161210\"><title>Sin conexión</title><style>html,body{margin:0;height:100%;background:#f7f3eb;color:#1a1512}body{min-height:100%;display:grid;place-items:center;padding:2rem;text-align:center;font-family:Georgia,'Times New Roman',serif}p{margin:0;max-width:14rem;font-size:2rem;line-height:1.05}p::before{content:'';display:block;width:2rem;height:1px;margin:0 auto 1rem;background:#c9a24b}</style></head><body><p>Sin conexión</p><script>addEventListener('online',function(){location.reload()})</script></body></html>",
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
);

const networkFirst = async (request, lane) => {
  const path = relativePath(new URL(request.url));
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request.url, {
      cache: "no-store",
      credentials: "same-origin",
      redirect: "follow"
    });
    if (canStore(request, response)) await cache.put(cleanRequest(path), response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cleanRequest(path));
    if (cached) return cached;
    if (request.mode === "navigate" || request.destination === "document") {
      return lane === "admin" ? offlineAdmin() : offlinePublic();
    }
    throw error;
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((path) => "./" + path)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (leaveAlone(url, request)) return;
  const lane = laneOf(request);
  if (!lane) return;
  event.respondWith(networkFirst(request, lane));
});
