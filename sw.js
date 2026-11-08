// Service worker: deixa o app abrir sem internet (RNF01) e mostra as notificações.
const CACHE = "remedios-v1";
const ARQUIVOS = ["./", "index.html", "medico.html", "paciente.html", "style.css",
  "dados.js", "interacoes.js", "manifest.json", "icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Rede primeiro (sempre a versão mais nova); sem internet, usa a cópia salva
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia));
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Tocar na notificação abre/foca o app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(abas =>
    abas.length ? abas[0].focus() : self.clients.openWindow("paciente.html")));
});
