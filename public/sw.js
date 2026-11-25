// Service worker do MA Sorteio: deixa o app abrir sem internet (tela offline)
// e recebe as notificações (push).
const VERSAO = "masorteio-v1";
const ESSENCIAIS = ["/offline.html", "/icons/192.png", "/icons/512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase e Google passam direto

  // Páginas: tenta a internet; sem conexão, mostra a última versão guardada ou a tela offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(req, copia));
          return r;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/offline.html"))),
    );
    return;
  }

  // Arquivos do Next (com hash no nome) e ícones: guarda e reaproveita.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((resp) => {
            const copia = resp.clone();
            caches.open(VERSAO).then((c) => c.put(req, copia));
            return resp;
          }),
      ),
    );
  }
});

self.addEventListener("push", (e) => {
  let dados = { titulo: "MA Sorteio", corpo: "", url: "/" };
  try {
    dados = { ...dados, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/icons/192.png",
      badge: "/icons/192.png",
      tag: dados.tag,
      actions: Array.isArray(dados.acoes) ? dados.acoes.slice(0, 2) : [],
      data: { url: dados.url, evento: dados.evento },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const dados = e.notification.data || {};
  // "✋ Vou" / "Não vou": responde sem abrir o app e mostra a confirmação.
  if ((e.action === "vou" || e.action === "naovou") && dados.evento) {
    e.waitUntil(
      fetch("/api/lista/responder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento_id: dados.evento, resposta: e.action }),
      })
        .then((r) => r.json())
        .catch(() => ({ titulo: "Não deu certo", corpo: "Abre o app pra responder." }))
        .then((j) => self.registration.showNotification(j.titulo || "MA Sorteio", { body: j.corpo || "", icon: "/icons/192.png", badge: "/icons/192.png", data: { url: dados.url } })),
    );
    return;
  }
  const url = dados.url || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if ("focus" in j) {
          j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
