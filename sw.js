const CACHE = "site-shell-v21";

const SHELL = [
  "index.html",
  "css/styles.css",
  "js/absoluto.js",
  "js/arranque.js",
  "js/carga.js",
  "assets/fonts/cinzel-600.woff2",
  "assets/fonts/outfit-400.woff2",
  "assets/logo/logo-256.webp",
  "assets/img/fotos/interior-sala-blur.webp"
];

const SHELL_SET = new Set(SHELL);

const relativePath = (url) => {
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return "";
  let path = url.pathname.slice(scope.pathname.length);
  if (path.startsWith("/")) path = path.slice(1);
  try {
    path = decodeURIComponent(path);
  } catch (error) {
    return "";
  }
  if (path === "" || path === "/") return "index.html";
  return path;
};

const isAdmin = (path) => /^(admin\.html|admin-login\.html|css\/admin\.css|js\/admin(?:\.js|-login\.js|-cliente\.js))/ .test(path);

const leaveAlone = (url, request) => {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  const blob = url.pathname + url.search;
  if (/access_token|refresh_token|provider_token|code_verifier|token_type|apikey/i.test(blob)) return true;
  if (/\/auth\/v1\/|\/rest\/v1\/|\/realtime\/v1\//.test(url.pathname)) return true;
  if (request.headers.get("authorization") || request.headers.get("apikey")) return true;
  return false;
};

const cacheRequest = (path) => new Request(new URL(path, self.registration.scope).href);

const canStore = (response) => {
  if (!response || !response.ok || response.type !== "basic" || response.redirected) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") || type.includes("text/css") || type.includes("javascript") || type.includes("json") || type.includes("image/") || type.includes("font/") || type.includes("application/manifest")) return true;
  return false;
};

const offlinePage = () => new Response(
  "<!DOCTYPE html><html lang=\"es-CO\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><meta name=\"theme-color\" content=\"#0A0A0A\"><title>Sin conexión</title></head><body style=\"margin:0;background:#0A0A0A;color:#F5F1E8;font-family:system-ui,sans-serif\"><p style=\"padding:2rem\">Sin conexión</p></body></html>",
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
);

const staleWhileRevalidate = async (request, path) => {
  const cache = await caches.open(CACHE);
  const key = cacheRequest(SHELL_SET.has(path) ? path : path);
  const cached = await cache.match(key) || await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (canStore(response)) cache.put(key, response.clone());
    return response;
  }).catch(() => null);
  if (cached) {
    refresh.catch(() => {});
    return cached;
  }
  const fresh = await refresh;
  if (fresh) return fresh;
  if (request.mode === "navigate" || request.destination === "document") return offlinePage();
  return new Response("", { status: 504, statusText: "Offline" });
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
  const path = relativePath(url);
  if (!path || isAdmin(path)) return;
  event.respondWith(staleWhileRevalidate(request, path));
});
