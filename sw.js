/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* sw.js — gjør appen tilgjengelig uten nett, og sørger for at en ny
   utgave faktisk når fram.

   BUILD må være det samme tallet som ?v= i index.html. Bump begge når du
   endrer noe, så får alle den nye versjonen: nye filadresser går utenom
   både service workeren og nettleserens eget mellomlager. */

const BUILD = 99;
const CACHE = "tripmate-b" + BUILD;
const MAALCACHE = "tripmate-maal";   // chatten et varsel peker til

const SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-180.png",
  "styles.css?v=" + BUILD,
  "vendor/supabase.js?v=" + BUILD,
  "js/config.js?v=" + BUILD,
  "js/templates.js?v=" + BUILD,
  "js/api.js?v=" + BUILD,
  "js/parse.js?v=" + BUILD,
  "js/ui.js?v=" + BUILD
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(
        SHELL.map(u => c.add(new Request(u, { cache: "reload" })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      // MAALCACHE er ikke gamle filer, men chatten et varsel peker til.
      // Kommer en ny versjon i det du trykker på varselet, skal målet
      // fortsatt være der når appen våkner.
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== MAALCACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ───────────────── varsler ─────────────────
   Dette er den eneste delen av appen som kjører når appen er lukket.
   Serveren sender en kort tekst hit, og vi viser den. Innholdet er
   allerede kryptert på veien, og ligger aldri hos Apple eller Google i
   lesbar form. */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* tomt varsel */ }

  e.waitUntil((async () => {
    // Sitter du med appen framme, skal ikke telefonen pipe — du ser jo
    // meldingen komme. Da sier vi fra til siden i stedet, og den avgjør
    // selv om det er verdt en liten stripe på skjermen.
    const vinduer = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const framme = vinduer.find(v => v.visibilityState === "visible");
    if (framme) {
      framme.postMessage({ varsel: d });
      return;
    }

    return self.registration.showNotification(d.t || "TripMate", {
      body: d.b || "",
      tag: d.tag || "tripmate",        // nytt varsel om samme chat erstatter det gamle
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { url: d.u || "./" }
    });
  })());
});

/* Trykker du på varselet, skal du havne i riktig chat.
   Det skjer på tre måter samtidig, fordi telefonene gjør dette ulikt:
   målet legges igjen et sted appen leser når den våkner, det sendes
   direkte til vinduet hvis det finnes, og adressen brukes hvis appen må
   startes. Én av dem treffer alltid. */
async function leggIgjenMaal(maal) {
  try {
    const c = await caches.open(MAALCACHE);
    await c.put("maal", new Response(maal));
  } catch { /* uten mellomlager får de to andre veiene klare seg */ }
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const maal = (e.notification.data && e.notification.data.url) || "./";

  e.waitUntil((async () => {
    const hjemme = new URL(self.registration.scope);
    const adresse = new URL(maal, hjemme).href;

    await leggIgjenMaal(maal);

    const vinduer = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const v of vinduer) {
      if (!new URL(v.url).pathname.startsWith(hjemme.pathname)) continue;
      v.postMessage({ aapne: maal });
      try { await v.focus(); return; } catch { /* prøv å åpne i stedet */ }
    }
    return self.clients.openWindow(adresse);
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Selve siden kom tidligere alltid over nettet, og da ventet alle på
  // nettet hver eneste gang appen ble åpnet. Nå vises den lagrede med en
  // gang, og den ferske hentes i bakgrunnen. Ny versjon når likevel
  // fram: siden spør etter ny sw.js ved hver start og hver gang den
  // hentes fram igjen, og laster seg selv på nytt når den har tatt over.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const lagret = await cache.match("index.html", { ignoreSearch: true })
                  || await cache.match("./");
      const nett = fetch(new Request(req.url, { cache: "reload" }))
        .then(res => {
          if (res && res.ok) cache.put("index.html", res.clone());
          return res;
        })
        .catch(() => null);
      return lagret || (await nett) || Response.error();
    })());
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // API og skrifter går rett på nett

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const nett = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || nett;
      })
    )
  );
});
