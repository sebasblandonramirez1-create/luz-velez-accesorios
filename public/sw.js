/* Service worker de Luzazul Accesorios.
 *
 * - Archivos estáticos (/_next/static, iconos): caché primero.
 * - Páginas (navegaciones): red primero; si no hay red, la última copia guardada
 *   de esa página (solo lectura) o la página «Sin conexión».
 * - Nunca guarda respuestas de la API de Supabase ni acciones (POST).
 */
const VERSION = "lva-v1";
const CACHE_PAGINAS = `${VERSION}-paginas`;
const CACHE_ESTATICOS = `${VERSION}-estaticos`;
const SIN_CONEXION = "/sin-conexion";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE_PAGINAS)
      .then((c) => c.addAll([SIN_CONEXION]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase y otros: siempre red
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/iconos/") || url.pathname === "/favicon.ico") {
    evento.respondWith(
      caches.open(CACHE_ESTATICOS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    if (url.searchParams.has("_rsc")) return; // navegaciones internas de Next: solo red
    evento.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok && res.type === "basic" && !url.pathname.startsWith("/auth/") && !url.pathname.startsWith("/ingresar")) {
            const c = await caches.open(CACHE_PAGINAS);
            c.put(req, res.clone());
          }
          return res;
        })
        .catch(async () => {
          const c = await caches.open(CACHE_PAGINAS);
          return (await c.match(req)) || (await c.match(SIN_CONEXION)) || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }),
    );
  }
});
