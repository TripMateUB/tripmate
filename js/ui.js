/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* ui.js — skjermer, navigasjon og alt som tegnes. */

const UI = (() => {

  const S = { trip: null, tab: "idag", day: null, openChat: null, loadingChat: false, trips: [], turerHentet: false, edit: false, offline: false, svarTil: null, kart: {}, sisteChat: null, tilBunn: false,
    nye: 0, sistAntall: 0, beholdSkroll: null, sveiper: false,
    side: null, varselStatus: null, varselEnheter: null, varselTest: null,
    folk: null, folkFeil: false, sisteVisning: null,
    pakk: null, pakkFeil: false, setekart: null, seteFeil: false,
    megTall: null,                          // tallene som står til høyre i Meg
    sideChat: null, chatFolk: null, ventende: 0, vedlegg: null, sender: false, sisteComposer: null };

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const clock = iso => new Date(iso).toLocaleTimeString("nb-NO", { hour:"2-digit", minute:"2-digit" });

  function shortStamp(iso) {
    const d = new Date(iso);
    if (d.toDateString() === new Date().toDateString()) return clock(iso);
    const dager = Math.round((Date.now() - d) / 86400000);
    if (dager < 7) return d.toLocaleDateString("nb-NO", { weekday: "short" }).replace(".", "");
    return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }).replace(".", "");
  }
  function dayStamp(iso) {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? clock(iso)
      : d.toLocaleDateString("nb-NO", { weekday:"short", day:"numeric", month:"short" }) + " " + clock(iso);
  }
  function daysUntil(date) {
    return Math.round((new Date(date + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
  }
  /* Nettadresser til steder kommer fra PDF-er vi ikke har skrevet selv.
     Bare vanlige nettlenker slipper gjennom — «javascript:» og liknende
     ville kjørt kode i appen hvis noen la det inn i et hefte. */
  const trygLenke = u => /^https?:\/\//i.test(String(u || "").trim());

  /* Skriver noen en lenke i chatten, skal den gå an å trykke på. Teksten
     escapes først og gjøres om til lenker etterpå — aldri omvendt, ellers
     kunne en melding smugle inn egen HTML. Bare http og https blir lenker;
     «javascript:» og liknende forblir tekst. */
  function medLenker(tekst) {
    return esc(tekst).replace(/(https?:\/\/|www\.)[^\s<]+/gi, treff => {
      // Punktum og parentes til slutt hører til setningen, ikke til lenken.
      const hale = treff.match(/[.,!?;:)\]]+$/);
      const selve = hale ? treff.slice(0, -hale[0].length) : treff;
      const url = (selve.startsWith("www.") ? "https://" + selve : selve).replace(/&amp;/g, "&");
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${selve}</a>${hale ? hale[0] : ""}`;
    });
  }

  /* Reisemåten følger med i lenka: uten den gjetter kartappen selv, og
     Apple gjetter bil — som ingen i klassen har. */
  const GOOGLEMODUS = { fots: "walking", kollektiv: "transit", bil: "driving" };
  const APPLEMODUS  = { fots: "w",       kollektiv: "r",       bil: "d" };

  const mapsGoogle = p => "https://www.google.com/maps/dir/?api=1&destination="
    + encodeURIComponent(p.name + ", " + p.addr) + "&travelmode=" + GOOGLEMODUS[Api.reisemaate()];
  const mapsApple  = p => "https://maps.apple.com/?daddr="
    + encodeURIComponent(p.name + ", " + p.addr) + "&dirflg=" + APPLEMODUS[Api.reisemaate()];

  /* Én knapp, ikke to. Hvilket kart som åpnes velger du én gang under
     Meg — det er ikke noe du skal ta stilling til hver gang du skal et
     sted, midt i at bussen går. */
  const kartLenke = p => (Api.kartValg() === "apple" ? mapsApple : mapsGoogle)(p);
  const kartKnapp = (p, klasse) =>
    `<a class="btn ${klasse}" href="${kartLenke(p)}" target="_blank" rel="noopener">${ICON.nav} Veibeskrivelse</a>`;

  const ICON = {
    hjem:'<svg viewBox="0 0 24 24"><path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 10v9.5h11.6V10"/></svg>',
    pin:'<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    nav:'<svg viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-7-8-3Z"/></svg>',
    spark:'<svg viewBox="0 0 24 24"><path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.3 6.3l3 3M14.7 14.7l3 3M17.7 6.3l-3 3M9.3 14.7l-3 3"/></svg>',
    cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    chat:'<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-4.4A8 8 0 1 1 21 12Z"/></svg>',
    prog:'<svg viewBox="0 0 24 24"><path d="M4 6h10M4 12h16M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="18" r="2"/></svg>',
    me:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    bilde:'<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="14" rx="2.5"/><circle cx="12" cy="12.5" r="3.4"/><path d="M8 5.5 9.2 3h5.6l1.2 2.5"/></svg>',
    bibliotek:'<svg viewBox="0 0 24 24"><rect x="7.5" y="3" width="13.5" height="13.5" rx="2.5"/><path d="M16.5 20.5H5.5A2.5 2.5 0 0 1 3 18V7"/><path d="m9 13 2.9-3.1 2.2 2.4 1.8-1.9L21 14"/></svg>',
    tilbake:'<svg viewBox="0 0 24 24"><path d="M15 4.5 7.5 12l7.5 7.5"/></svg>',
    last:'<svg viewBox="0 0 24 24"><path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4.5 17.5v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5"/></svg>',
    send:'<svg viewBox="0 0 24 24"><path d="M4 12 20 4l-7 16-2-7-7-1Z"/></svg>',
    chevL:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="m15 6-6 6 6 6"/></svg>',
    hake:'<svg viewBox="0 0 24 24"><path d="M5 12.6l4.6 4.6L19 7.4"/></svg>',
    folk:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.4 20c.5-3.3 2.8-5.2 5.6-5.2s5.1 1.9 5.6 5.2"/><path d="M16.2 6.2a3 3 0 0 1 0 5.6M17.6 14.3c2 .7 3.2 2.3 3.5 4.4"/></svg>',
    bjelle:'<svg viewBox="0 0 24 24"><path d="M6.5 16V10a5.5 5.5 0 0 1 11 0v6l1.6 2.4H4.9L6.5 16Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg>',
    blyant:'<svg viewBox="0 0 24 24"><path d="M15.6 4.8l3.6 3.6L8.6 19H5v-3.6L15.6 4.8Z"/></svg>',
    nokkel:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16.5 16.5l2-2M14 14l2-2"/></svg>',
    koffert:'<svg viewBox="0 0 24 24"><rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.5V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7.5"/></svg>',
    post:'<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7.2l8 5.4 8-5.4"/></svg>',
    kart:'<svg viewBox="0 0 24 24"><path d="M9 3.6 3.5 5.8v14.6L9 18.2l6 2.2 5.5-2.2V3.6L15 5.8 9 3.6Z"/><path d="M9 3.6v14.6M15 5.8v14.6"/></svg>',
    info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/></svg>',
    sekk:'<svg viewBox="0 0 24 24"><path d="M5.5 10a6.5 6.5 0 0 1 13 0v8.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V10Z"/><path d="M9.2 9.2V6.4a2.8 2.8 0 0 1 5.6 0v2.8"/><path d="M9 14.5h6"/></svg>',
    sete:'<svg viewBox="0 0 24 24"><path d="M7 4.5h7.5a2 2 0 0 1 2 2.2l-.8 7.3H7.8L7 4.5Z"/><path d="M6.5 14h11.2a1.8 1.8 0 0 1 1.8 1.8v.7H6.5V14Z"/><path d="M8 16.5v3M18 16.5v3"/></svg>',
    chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>'
  };

  /* Kameraknappen hører hjemme på en telefon. På en PC ville den åpnet
     nøyaktig samme filvelger som knappen ved siden av, og to like knapper
     er ingen hjelp. */
  const harKamera = () => navigator.maxTouchPoints > 0;

  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const prikker = () => '<span class="prikker"><i></i><i></i><i></i></span>';
  const venter = tekst => `<div class="venter">${prikker()} ${esc(tekst)}</div>`;

  /* Stripa nederst. Får den et mål, kan den trykkes på — det brukes når
     en melding kommer inn mens du ser på noe annet i appen. */
  function toast(text, maal) {
    const t = $("toast");
    t.textContent = text; t.hidden = false;
    t.classList.toggle("klikkbar", Boolean(maal));
    t.onclick = maal ? () => { t.hidden = true; aapneFraVarsel(maal); } : null;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; t.onclick = null; }, maal ? 6000 : 3000);
  }

  /* ───────────────── varsel → riktig chat ─────────────────
     Trykker du på et varsel, følger tur og chat med i adressen. Vi tar
     dem ut og fjerner dem igjen, så de ikke blir stående og styre hvor
     appen åpner neste gang. */
  function lenkemaal(sok) {
    const p = new URLSearchParams(sok || location.search);
    const maal = { tur: p.get("tur"), chat: p.get("chat") };
    if ((maal.tur || maal.chat) && !sok) history.replaceState(null, "", location.pathname);
    return maal;
  }

  /* Service workeren legger igjen målet her når du trykker på et varsel.
     Vinduet kan ha vært sovende, eller meldingen kan ha kommet fram før
     appen var klar — da ligger målet her og venter i stedet for å gå tapt. */
  async function ventendeMaal() {
    if (!("caches" in window)) return null;
    // Navnet byttet da appen ble TripMate. Et varsel noen trykket på rett
    // før oppdateringen ligger fortsatt under det gamle navnet, så vi ser
    // i begge — ellers går det målet tapt.
    for (const navn of ["tripmate-maal", "tourflow-maal"]) {
      try {
        const c = await caches.open(navn);
        const r = await c.match("maal");
        if (!r) continue;
        await c.delete("maal");
        const t = (await r.text()).replace(/^[^?]*\??/, "");
        if (t) return lenkemaal(t);
      } catch { /* prøv neste navn */ }
    }
    return null;
  }

  async function aapneFraVarsel(maal) {
    if (!maal.tur && !maal.chat) return false;
    try {
      if (maal.tur && (!S.trip || S.trip.id !== maal.tur)) await openTrip(maal.tur);
      if (!S.trip) return false;
      if (maal.chat && S.trip.channels.some(c => c.id === maal.chat)) {
        S.tab = "chat";
        await openChat(maal.chat);
      } else render();
      return true;
    } catch { return false; }
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => {
      const adresse = e.data && e.data.aapne;
      if (adresse) return aapneFraVarsel(lenkemaal(adresse.replace(/^\?/, "")));

      // Varsel som kom mens appen var framme. Står du i chatten det
      // gjelder, ser du meldingen komme av seg selv — da er en stripe på
      // toppen bare støy. Ellers får du vite det, og kan trykke deg dit.
      const v = e.data && e.data.varsel;
      if (!v) return;
      if (S.openChat && v.tag === S.openChat) return;
      toast(v.b || "Ny melding", v.u ? lenkemaal(String(v.u).replace(/^\?/, "")) : null);
    });
  }

  /* Åpningsanimasjonen ligger over appen til det er noe å vise bak
     den. Dette er signalet om at det er det — turen, skjemaet,
     innloggingen eller en feilmelding. Uten dette ville den ligget til
     taket sitt og holdt appen skjult lenger enn nødvendig. */
  let harSagtKlar = false;
  function appKlar() {
    if (harSagtKlar) return;
    harSagtKlar = true;
    dispatchEvent(new Event("tripmate:klar"));
  }

  /* ───────────────── oppstart ───────────────── */
  async function boot() {
    if (!CONFIG.ready) return bootSetup();

    $("bootMsg").innerHTML = venter("Kobler til");
    const res = await Api.init();

    if (!res.ok) {
      const profile = Api.getProfile(), last = Api.getLastTrip();
      if (profile && last) {                       // prøv lagret kopi
        S.offline = true;
        return openTrip(last);
      }
      appKlar();
      $("bootMsg").innerHTML = `Fikk ikke kontakt med serveren.<br>
        <span style="font-size:13px;color:var(--ink-3)">${esc(res.error || res.reason)}</span><br>
        <button class="btn" style="margin-top:14px" onclick="location.reload()">Prøv igjen</button>`;
      return;
    }

    // Tegn paa nytt naar noe kommer inn utenfra - nye meldinger, reaksjoner
    // eller vaer. Tidligere gjaldt dette bare chatten, saa vaeret dukket
    // aldri opp i programmet for man byttet fane.
    // Kommer det noe utenfra — meldinger, reaksjoner, vær, eller et
    // program en reiseleder nettopp endret — tegner vi på nytt. Turen
    // hentes fra Api, for endrer programmet seg er den vi holder utdatert.
    Api.onChange(hendelse => {
      if (!S.trip) return;
      const fersk = Api.currentTrip();
      if (fersk && fersk.id === S.trip.id) S.trip = fersk;
      render();

      // Kom det en melding mens du har appen framme, sier appen fra selv.
      // Telefonen gjør det ikke — serveren dropper varselet når du er her.
      // Står du i chatten det gjelder, trenger du ingenting.
      const ny = hendelse && hendelse.nyMelding;
      if (!ny || ny.kanal === S.openChat) return;
      const chat = S.trip.channels.find(c => c.id === ny.kanal);
      toast(`${ny.hvem.split(" ")[0]} i ${chat ? chat.name : "en chat"}: ${ny.txt.slice(0, 60)}`,
            { tur: ny.tur, chat: ny.kanal });
    });

    // Kom du hit fra et varsel, skal du havne i chatten varselet gjaldt.
    const maal = lenkemaal();
    if ((maal.tur || maal.chat) && await aapneFraVarsel(maal)) return;

    const ventende = await ventendeMaal();
    if (ventende && await aapneFraVarsel(ventende)) return;

    const profile = Api.getProfile(), last = Api.getLastTrip();
    if (profile && last) {
      try { return await openTrip(last, Api.lagretTur(last)); }
      catch { /* turen finnes ikke lenger */ }
    }

    // Innlogget uten lagret «siste tur» på denne telefonen: spør basen om
    // du er med på noe, i stedet for å anta at du ikke er det.
    if (!Api.erAnonym()) {
      try {
        const turer = await Api.myTrips();
        S.trips = turer;
        if (turer.length) return await openTrip(turer[0].id);
      } catch { /* uten nett får vi svare med skjemaet */ }
      return showJoin();
    }
    visAuth("start");
  }

  function bootSetup() {
    $("bootMsg").innerHTML = `
      <b style="font-family:"DM Sans",sans-serif">Appen mangler serveroppsett</b><br>
      <span style="font-size:14px;color:var(--ink-2)">Fyll inn prosjektadresse og anon-nøkkel i
      <code>js/config.js</code>, og kjør <code>supabase/schema.sql</code> i Supabase-prosjektet.
      Framgangsmåten står i README.</span>`;
  }

  function showJoin() {
    appKlar();
    $("bootScreen").hidden = true;
    $("appScreen").hidden = true;
    $("authScreen").hidden = true;
    $("joinScreen").hidden = false;

    const p = Api.getProfile();
    if (p) { $("fFirst").value = p.first; $("fLast").value = p.last; }

    // Er du innlogget, men uten turer, ser skjermen ut som forste gang.
    // Si fra at du faktisk er logget inn, saa du ikke tror det feilet.
    const tilbake = $("joinTilbake");
    if (tilbake) tilbake.hidden = !(S.fraStart && Api.erAnonym());

    const linje = $("joinKonto");
    const epost = Api.minEpost && Api.minEpost();
    if (epost) {
      linje.innerHTML = `Innlogget som <b>${esc(epost)}</b>. Du er ikke med på noen tur ennå — skriv turkoden under.`;
      linje.hidden = false;
    } else linje.hidden = true;
  }


  /* Venter på at reiselederen slipper deg inn. Du ser navnet på turen,
     men ingenting av innholdet — det sørger reglene i basen for. */
  function visVenter(trip) {
    appKlar();
    $("joinScreen").hidden = true;
    $("appScreen").hidden = true;
    $("bootScreen").hidden = true;
    $("authScreen").hidden = false;

    $("authInner").innerHTML = `
      <div class="mark" aria-hidden="true">
        <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/><path d="M24 13v11l7 5"/></svg>
      </div>
      <h1>Venter på godkjenning</h1>
      <p class="lede">Du har bedt om å bli med på <b>${esc(trip.name)}</b>.
        Reiselederen må slippe deg inn før du ser programmet og chatten.</p>
      <button class="btn primary big" id="sjekkIgjen">Sjekk om jeg er godkjent</button>
      <button class="btn" style="width:100%;margin-top:10px" id="venterAnnen">Velg en annen tur</button>`;

    $("sjekkIgjen").addEventListener("click", async e => {
      const b = e.currentTarget;
      b.disabled = true; b.innerHTML = prikker() + " Sjekker";
      try { await openTrip(trip.id); }
      catch { b.disabled = false; b.textContent = "Sjekk om jeg er godkjent"; }
      if (!$("authScreen").hidden) {
        b.disabled = false; b.textContent = "Sjekk om jeg er godkjent";
        toast("Ikke godkjent ennå.");
      }
    });

    $("venterAnnen").addEventListener("click", () => { S.trip = null; S.fraStart = true; showJoin(); });
  }
  /* Du er ikke med lenger. Si det rett ut, og send folk videre — enten
     til en annen tur de er med på, eller til skjemaet. Alt appen hadde
     liggende om turen er allerede slettet fra enheten. */
  async function utmeldt(melding) {
    S.trip = null; S.openChat = null; S.side = null;
    try { S.trips = await Api.myTrips(); } catch { S.trips = []; }

    if (S.trips.length) {
      await openTrip(S.trips[0].id);
      toast(melding || "Du er ikke med på turen lenger.");
      return;
    }
    S.fraStart = false;
    showJoin();
    toast(melding || "Du er ikke med på turen lenger.");
  }

  /* «lagret» er turen slik den lå på telefonen fra sist. Får vi den
     med, tegnes appen med én gang og det ferske hentes i bakgrunnen —
     i stedet for at alle skal se på en spinner mens seks spørringer går
     over nettet. */
  async function openTrip(tripId, lagret) {
    let trip = lagret;
    if (!trip) {
      $("bootMsg").innerHTML = venter("Henter turen");
      try { trip = await Api.loadTrip(tripId); }
      catch (e) {
        // Fjernet fra turen: da skal ikke appen bli stående med en gammel
        // kopi og se ut som om nettet er nede. Kopien er alt slettet.
        if (e && e.utmeldt) return utmeldt(e.message);
        throw e;
      }
    }
    if (!trip) throw new Error("Fant ikke turen");

    // Venter du på godkjenning, slipper du ikke inn i appen ennå.
    if (trip.venter) { S.trip = null; return visVenter(trip); }

    S.trip = trip;
    hentMegTall();
    S.offline = Boolean(trip.stale);
    Api.setLastTrip(tripId);
    // Sto du på torsdag og rettet et klokkeslett, skal du fortsatt stå på
    // torsdag etterpå. Appen henter turen på nytt etter hver endring, og
    // før denne linja begynte den da forfra på dagens dato hver gang.
    const sammeDag = S.day && trip.days.some(d => d.date === S.day) && S.trip && S.trip.id === tripId;
    S.day = sammeDag ? S.day : (Parse.baseDate(trip) || (trip.days[0] ? trip.days[0].date : null));

    // Bytter du tur, lukkes samtalen og sidene du hadde åpne.
    S.openChat = null;
    S.side = null;
    S.nye = 0; S.sistAntall = 0;
    Api.unsubscribeChannel();

    $("bootScreen").hidden = true;
    $("joinScreen").hidden = true;
    $("appScreen").hidden = false;

    const p = Api.getProfile();
    $("avatarText").textContent = p ? p.initials : "–";

    render();
    appKlar();
    if (!S.offline) {
      Api.subscribeTrip(tripId);
      Api.loadRecent(tripId).then(() => { if (S.tab === "chat" && !S.openChat) render(); }).catch(() => {});
      Api.lastVaer(tripId);
      Api.lastVarselvalg(tripId).catch(() => {});
      Api.lastPaameldinger(tripId);
      Api.erHer(tripId, null);
      if (trip.role === "leader") {
        Api.antallVentende(tripId).then(n => { if (n !== S.ventende) { S.ventende = n; render(); } });
        Api.ryddGamleBilder();
      } else S.ventende = 0;
      // Statusen trengs på Meg-fanen, ikke bare inne på varselsiden.
      Api.varselStatus().then(s => { if (s !== S.varselStatus) { S.varselStatus = s; render(); } });
      S.svarTil = null;
    }
    // Uten tegningen her ble «Henter turene dine…» stående for alltid
    // på Meg: lista kom, men ingen ba skjermen om å vise den.
    Api.myTrips().then(t => {
      S.trips = t;
      S.turerHentet = true;
      if (S.trip && S.tab === "meg" && !S.side) render();
    }).catch(() => { S.turerHentet = true; });

    if (lagret) {
      // Den lagrede kopien kan være gammel. Det ferske byttes inn uten
      // at noen ser en spinner — og er du kastet ut av turen imens, sier
      // appen fra i stedet for å vise en kopi som om alt var som før.
      Api.loadTrip(tripId).then(fersk => {
        if (!fersk || !S.trip || S.trip.id !== fersk.id) return;
        S.trip = fersk;
        S.offline = Boolean(fersk.stale);
        render();
      }).catch(e => { if (e && e.utmeldt) utmeldt(e.message); });
    }
  }

  /* Byen dagen foregår i. Navnet på overnattingsstedet er ikke et
     stedsnavn — «Hotel Bedford» ble til «Torsdag i Hotel». Adressen vet
     hvor man er: postnummeret står foran byen, og det er det eneste
     som holder på tvers av land. Finner vi den ikke, sier vi bare
     hvilken dag det er, i stedet for å gjette. */
  function byen(sted) {
    if (!sted || !sted.addr) return null;
    const deler = String(sted.addr).split(",").map(s => s.trim()).filter(Boolean);
    for (const d of deler) {
      const m = d.match(/^\d{4,6}\s+(.+)$/);
      if (m) return m[1].trim();
    }
    return deler.length > 1 ? deler[1] : null;
  }

  /* ───────────────── program ───────────────── */
  /* ───────────────── I dag ─────────────────
     Hjemskjermen. Den svarer på det ene spørsmålet alle har hele tiden:
     hva skjer nå, og hvor. Programmet for hele turen ligger én fane
     unna; her står bare dagen du er i. */
  function viewIDag() {
    const trip = S.trip;
    const ne = nextEvent(trip);
    const idag = trip.days.find(x => x.date === today());
    const naa = new Date().toTimeString().slice(0, 5);

    /* Dagstripa: dagen som en avgangstavle. Logoens oransje prikk er
       «nå» — merket og tidspunktet er den samme tingen. */
    let stripe = "";
    if (idag && idag.items.filter(i => i.t).length > 1) {
      const med = idag.items.filter(i => i.t);
      const naaIdx = med.findIndex(i => i.t > naa);
      const gaatt = naaIdx < 0 ? 1 : (med.length > 1 ? naaIdx / (med.length - 1) : 0);
      stripe = `<div class="stripe" aria-label="Dagen i oversikt">
        <div class="akse"></div>
        <div class="gaatt" style="transform:scaleX(${gaatt.toFixed(3)})"></div>
        <div class="punkter">
          ${med.map((i, k) => `
            <div class="pk ${i.t <= naa ? "ferdig" : ""} ${k === naaIdx ? "aktiv" : ""}">
              <span class="kl">${esc(i.t)}</span><span class="mk"></span>
              <span class="nvn">${esc(i.title.split(/[\s,]+/)[0])}</span>
            </div>`).join("")}
        </div>
      </div>`;
    }

    /* Hilsenen navngir dagen og dagens ene faktum. */
    const dagnavn = idag
      ? cap(new Date(idag.date).toLocaleDateString("nb-NO", { weekday: "long" }))
      : "Turen";
    const nr = idag ? trip.days.findIndex(x => x.date === idag.date) + 1 : 0;
    const sted = idag ? dagensSted(idag) : null;
    const by = sted ? byen(trip.places[sted]) : null;
    const tittel = by ? `${dagnavn} i ${by}` : dagnavn;

    let kort = "";
    if (ne) {
      const p = ne.item.place ? trip.places[ne.item.place] : null;
      kort = `<section class="naakort">
        <div class="merk"><i></i>${ne.naa ? "Nå" : ne.day.date === today() ? "Nå snart" : "Neste · " + esc(ne.day.label)}</div>
        <div class="kl">${ne.item.t ? esc(tidTekst(ne.item)) : "—"}</div>
        <div class="hva">${esc(ne.item.title)}${vaerMerke(ne.item.place, ne.day.date, ne.item.t, dagensSted(ne.day))}</div>
        ${p ? `<div class="hvor">${esc(p.name)}${p.addr ? " · " + esc(p.addr) : ""}</div>` : ""}
        <div class="knapper">
          ${p ? kartKnapp(p, "primar") : ""}
          <button class="btn" data-tab="program">Hele dagen</button>
        </div>
      </section>`;
    } else {
      kort = `<section class="naakort"><div class="merk"><i></i>Ferdig</div>
        <div class="hva" style="margin-top:2px">Turen er over</div>
        <div class="hvor">Programmet ligger her så lenge du er med.</div></section>`;
    }

    const senere = idag ? idag.items.filter(i => !i.t || i.t > naa) : [];

    return `
      <div>
        <h1 class="daghilsen">${esc(tittel)}</h1>
        <p class="dagunder">${idag ? `Dag ${nr} av ${trip.days.length}` : esc(trip.name)}</p>
      </div>
      ${stripe}
      ${kort}
      ${senere.length ? `
        <div>
          <div class="eyebrow" style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
            <span>Senere i dag</span>
            <button class="linkbtn" style="font-size:12.5px" data-tab="program">Hele programmet</button>
          </div>
          ${senere.map(i => {
            const p = i.place ? trip.places[i.place] : null;
            return `<button class="post" data-item="${esc(i.id)}">
              <span class="t">${i.t ? esc(i.t) : "—"}</span>
              <span><span class="h">${esc(i.title)}</span>
                ${p ? `<span class="s">${esc(p.name)}</span>` : (i.note ? `<span class="s">${esc(i.note)}</span>` : "")}</span>
              <span class="pil">${ICON.chev}</span></button>`;
          }).join("")}
        </div>` : ""}
      ${praktisk()}`;
  }

  /* Pakkelista og setekartet: turens to praktiske lister. Tallene til
     høyre hentes én gang, og raden står der uansett — en tom verdi er
     bedre enn en rad som dukker opp etterpå og flytter alt nedover. */
  /* Med flere kjøretøy er det ikke ett setenavn å vise. Det som betyr
     noe er om du mangler en plass et sted. */
  function setetekst(tall) {
    if (!tall) return "";
    if (!tall.kjoretoy) return "Ikke satt opp";
    const mangler = tall.kjoretoy - tall.mineSeter;
    return mangler > 0 ? `Mangler ${mangler}` : "Alt valgt";
  }

  function praktisk() {
    const tall = S.megTall;
    const trip = S.trip;
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Praktisk</div>
      <div class="gruppe"><div class="list">
        <button class="listrow" data-side="pakk">
          <span class="rikon mose">${ICON.sekk}</span>
          <div class="grow"><div class="nm">Pakkeliste</div></div>
          <span class="verdi">${tall
            ? (tall.pakkTotalt ? `${tall.pakkKrysset} av ${tall.pakkTotalt}` : "Ingen punkter")
            : ""}</span>
          <span class="chev">${ICON.chev}</span></button>

        <button class="listrow" data-side="seter">
          <span class="rikon">${ICON.sete}</span>
          <div class="grow"><div class="nm">Sitteplasser</div></div>
          <span class="verdi">${setetekst(tall)}</span>
          <span class="chev">${ICON.chev}</span></button>
      </div></div>
    </div>`;
  }

  /* ───────── varighet ─────────
     Et punkt uten varighet er et tidspunkt. Et punkt med varighet er et
     tidsrom, og da kan to ting foregå samtidig — programmet er ikke
     lenger en rekkefølge, og det må leses av skjermen. */
  const minutt = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

  function slutt(i) {
    if (!i.t || !i.minutter) return null;
    const s = minutt(i.t) + i.minutter;
    if (s >= 24 * 60) return "23:59";          // går det over midnatt, stopper vi ved døgnet
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  const tidTekst = i => { const s = slutt(i); return s ? i.t + "–" + s : i.t; };

  /* Hvilke punkter deler tid med et annet. To uten varighet teller som
     samtidige bare hvis de starter på samme klokkeslett. */
  function samtidige(items) {
    const med = items.filter(i => i.t);
    const sett = new Set();
    for (let x = 0; x < med.length; x++) for (let y = x + 1; y < med.length; y++) {
      const A = med[x], B = med[y];
      const a0 = minutt(A.t), a1 = a0 + (A.minutter || 0);
      const b0 = minutt(B.t), b1 = b0 + (B.minutter || 0);
      if (a0 === b0 || (a0 < b1 && b0 < a1)) { sett.add(A.id); sett.add(B.id); }
    }
    return sett;
  }

  /* Varigheten skrives som sluttklokke, fordi det er den reiselederen
     har i papirene: «omvisning 10–12», ikke «omvisning varer 120 minutter».
     Minuttene er bare måten vi lagrer det på. */
  function minutterTil(start, sluttTid) {
    if (!start || !sluttTid) return null;
    const d = minutt(sluttTid) - minutt(start);
    if (d === 0) return null;                 // samme klokke = ingen varighet
    // shortcut: et punkt kan ikke gå over midnatt. Skal det det, deles
    // det i to punkter. Oppgraderes først hvis nattbusser blir vanlig.
    if (d < 0) throw new Error("Slutt-tiden er før start-tiden.");
    return d;
  }

  function nextEvent(trip) {
    const t = new Date().toTimeString().slice(0, 5);
    const d = trip.days.find(x => x.date === today());
    if (d) {
      // Noe som foregår akkurat nå er viktigere enn noe som kommer.
      const paagaar = d.items.find(i => { const s = slutt(i); return i.t && i.t <= t && s && s > t; });
      if (paagaar) return { day: d, item: paagaar, naa: true };
      const item = d.items.find(i => i.t && i.t > t);
      if (item) return { day: d, item };
      const nd = trip.days.find(x => x.date > today());
      const f = nd && nd.items.find(i => i.t);
      return f ? { day: nd, item: f } : null;
    }
    const up = trip.days.find(x => x.date >= today());
    const forste = up && up.items.find(i => i.t);
    return forste ? { day: up, item: forste } : null;
  }


  /* Yr svarer med koder som «partlycloudy_day». Vi viser et tegn og
     temperaturen — ikke mer, for det skal stå ved siden av programmet
     uten å ta oppmerksomheten fra det. */
  function vaerTegn(kode) {
    if (!kode) return "";
    const k = String(kode);
    const natt = k.endsWith("_night");
    if (k.startsWith("clearsky")) return natt ? "🌙" : "☀️";
    if (k.startsWith("fair")) return natt ? "🌙" : "🌤️";
    if (k.startsWith("partlycloudy")) return "⛅";
    if (k.startsWith("cloudy")) return "☁️";
    if (k.includes("thunder")) return "⛈️";
    if (k.includes("sleet")) return "🌨️";
    if (k.includes("snow")) return "❄️";
    if (k.includes("rain") || k.includes("shower")) return "🌧️";
    if (k.startsWith("fog")) return "🌫️";
    return "";
  }



  /* Hvilket sted representerer dagen når punktet selv ikke har ett med
     koordinater? Hotellet om det er satt, ellers det første stedet på
     dagen som faktisk har en værmelding. Samme by, samme vær. */
  function dagensSted(d) {
    if (d.hotel && Api.vaerFor(d.hotel)) return d.hotel;
    const m = d.items.find(i => i.place && Api.vaerFor(i.place));
    return m ? m.place : (d.hotel || null);
  }
  /* Dagens vær, vist ved siden av datoen: formiddag og ettermiddag der
     gruppen bor eller skal være. Det er «været der du skal den dagen». */
  function dagensVaer(d) {
    const sted = dagensSted(d);
    if (!sted) return "";
    const f = Api.vaerPunkt(sted, d.date, "09:00");
    const e = Api.vaerPunkt(sted, d.date, "15:00");
    if (!f && !e) return "";
    const del = (v, nar) => v
      ? `<span class="dagdel"><em>${nar}</em> ${vaerTegn(v.sym)}${v.temp == null ? "" : ` <b>${Math.round(v.temp)}°</b>`}</span>`
      : "";
    return `<div class="dagvaer">${del(f, "formiddag")}${del(e, "ettermiddag")}</div>`;
  }
  /* Har ikke punktet et sted med koordinater, bruker vi hotellet den dagen.
     Vaeret er stort sett det samme i samme by, og det er byen folk lurer paa. */
  function vaerMerke(placeId, dato, tid, reserve) {
    let v = placeId ? Api.vaerPunkt(placeId, dato, tid) : null;
    if (!v && reserve && reserve !== placeId) v = Api.vaerPunkt(reserve, dato, tid);
    if (!v) return "";
    const tegn = vaerTegn(v.sym);
    const grader = v.temp == null ? "" : `${Math.round(v.temp)}°`;
    if (!tegn && !grader) return "";
    return `<span class="vaer" title="Værmelding fra Yr">${tegn}${grader ? ` <b>${grader}</b>` : ""}</span>`;
  }
  function viewProgram() {
    const trip = S.trip;
    const leader = trip.role === "leader";

    if (!trip.days.length) {
      return `<div class="card pad" style="padding:22px;text-align:center">
        <div class="eyebrow">Tomt program</div>
        <p class="muted" style="margin:10px 0 16px;color:var(--ink-2)">
          ${leader ? "Legg inn dagene i turen, så bygger appen resten." : "Reiselederen har ikke lagt inn programmet ennå."}</p>
        ${leader ? `<div class="stack"><button class="btn primary" data-sheet="addday">Legg til første dag</button>
          <button class="btn" data-sheet="importpdf">Les inn program fra PDF</button></div>` : ""}
      </div>
      ${leader ? `<p class="muted">Del turkoden <b class="mono">${esc(trip.code)}</b> med deltakerne så de kan bli med.</p>` : ""}`;
    }

    const ne = nextEvent(trip);
    const started = trip.days.some(d => d.date <= today());
    let head = "";

    if (!ne) {
      head = `<div class="countdown"><div class="eyebrow">Turen er ferdig</div>
        <p class="muted" style="margin-top:6px">Programmet ligger her så lenge du er med på turen.</p></div>`;
    } else if (!started) {
      const n = daysUntil(trip.days[0].date);
      head = `<div class="countdown"><div class="eyebrow">Avreise</div>
        <b>${n === 0 ? "I dag" : n === 1 ? "I morgen" : "Om " + n + " dager"}</b>
        <p class="muted" style="margin-top:4px;color:var(--ink-2)">Første punkt: ${esc(trip.days[0].items[0] ? trip.days[0].items[0].title : "ikke lagt inn")}</p></div>`;
    } else {
      const p = ne.item.place ? trip.places[ne.item.place] : null;
      head = `<div class="nextup">
        <div class="lbl">${ne.day.date === today() ? "Neste i dag" : "Neste · " + esc(ne.day.label)}</div>
        <div class="t">${esc(ne.item.t)}</div>
        <div class="w">${esc(ne.item.title)}${vaerMerke(ne.item.place, ne.day.date, ne.item.t, dagensSted(ne.day))}</div>
        <div class="p">${p ? esc(p.name) : esc(ne.item.note || "")}</div>
        ${p ? `<div class="acts">
          ${kartKnapp(p, "solid")}
          <button class="btn" data-sheet="place" data-place="${esc(ne.item.place)}">Detaljer</button>
        </div>` : ""}
      </div>`;
    }

    const d = trip.days.find(x => x.date === S.day) || trip.days[0];
    const chips = trip.days.map(x =>
      `<button class="chip" aria-pressed="${x.date === d.date}" data-day="${esc(x.date)}">${esc(x.chip)}<span>${esc(x.num)}</span></button>`
    ).join("") + (leader ? `<button class="chip" data-sheet="addday" style="border-style:dashed">+ Dag<span>ny dato</span></button>` : "");

    const hotel = d.hotel ? trip.places[d.hotel] : null;
    const reserveSted = dagensSted(d);
    const samtidig = samtidige(d.items);
    const rows = d.items.length ? d.items.map((i, k) => {
      const p = i.place ? trip.places[i.place] : null;
      const isNext = ne && ne.day.date === d.date && ne.item.id === i.id && d.date === today();
      const sl = slutt(i);
      return `<div class="ev ${isNext ? "now" : ""}" data-item="${esc(i.id)}" role="button" tabindex="0">
        <div class="time">${i.t ? esc(i.t) : '<span style="color:var(--ink-3)">—</span>'}${
          sl ? `<small>${esc(sl)}</small>` : ""}${isNext ? "<em>neste</em>" : ""}</div>
        <div>
          <div class="title">${esc(i.title)}${vaerMerke(i.place, d.date, i.t, reserveSted)}${
            samtidig.has(i.id) ? '<span class="samtidigmerke">samtidig</span>' : ""}</div>
          ${i.paamelding ? (() => {
            const folk = Api.paameldte(i.id);
            const jeg = folk.some(p => p.meg);
            return `<div class="paamerke${jeg ? " min" : ""}">${jeg ? "✓ påmeldt" : "Påmelding"}
              · ${folk.length}${i.plasser ? "/" + i.plasser : ""}</div>`;
          })() : ""}
          <div class="place">${p ? ICON.pin + esc(p.name) : `<span style="color:var(--ink-3)">${esc(i.note || "Ikke stedfestet")}</span>`}</div>
          ${S.edit ? `<div class="redigerrad">
            <span class="draha" data-drag aria-label="Dra for å flytte">⠿</span>
            <button class="minibtn fare" data-delitem="${esc(i.id)}">Slett</button>
          </div>` : ""}
        </div>
      </div>`;
    }).join("") : `<p class="muted" style="padding:16px 0;text-align:center">Ingen punkter denne dagen.</p>`;

    return `
      ${head}
      <div class="chips">${chips}</div>
      <div>
        <div class="eyebrow" style="margin-bottom:7px;display:flex;justify-content:space-between;gap:8px;align-items:center">
          <span>${esc(d.label)}${hotel ? " · bor på " + esc(hotel.name) : ""}</span>
          ${leader ? `<button class="linkbtn" style="font-size:11px" data-edit>${S.edit ? "Ferdig" : "Rediger"}</button>` : ""}
        </div>
        ${dagensVaer(d)}
        <div class="card pad"><div class="tl">${rows}</div></div>
      </div>
      ${leader ? `<div class="stack">
        <button class="btn primary" data-sheet="additem" data-day="${esc(d.id)}">Legg til programpunkt</button>
        <button class="btn" data-sheet="importpdf">Les inn program fra PDF</button>
        <button class="btn" data-sheet="hotel" data-day="${esc(d.id)}">${hotel ? "Bytt hotell denne dagen" : "Sett hotell denne dagen"}</button>
        ${S.edit ? `<button class="btn danger" data-delday="${esc(d.id)}">Slett hele dagen</button>` : ""}
      </div>` : ""}`;
  }

  /* Dra et programpunkt til en ny plass, slik man flytter i en spilleliste.
     Radene bytter plass i DOM-en mens du drar, og rekkefølgen lagres når du
     slipper. Uten touch-action:none ville telefonen skrollet i stedet. */
  function settOppDraing() {
    const tl = $("screen").querySelector(".tl");
    if (tl && S.edit) draRekkefolge(tl, "ev", r => r.dataset.item, lagreRekkefolge);

    // Pakkelista har sin egen liste, og den kan dras uten redigeringsmodus:
    // å sortere pakkelista er ikke en farlig handling.
    for (const liste of $("screen").querySelectorAll(".pkliste")) {
      draRekkefolge(liste, "pkrad", r => r.dataset.pid,
        ids => lagrePakkRekkefolge(liste.dataset.egen === "1", ids));
    }
  }

  function draRekkefolge(tl, radklasse, idAv, lagre) {

    let rad = null, startY = 0, ramme = null, hvile = null;

    // Der raden ligger når den ikke er dratt noe sted. Måles på nytt hver
    // gang den bytter plass, ellers regner vi grensene ut fra en posisjon
    // den ikke har lenger.
    const maal = () => {
      ramme = tl.getBoundingClientRect();
      hvile = rad.getBoundingClientRect();
    };

    tl.addEventListener("pointerdown", e => {
      const hank = e.target.closest("[data-drag]");
      if (!hank) return;
      rad = hank.closest("." + radklasse);
      if (!rad) return;
      e.preventDefault();
      startY = e.clientY;
      rad.style.transform = "";
      maal();
      rad.classList.add("drar");
      try { hank.setPointerCapture(e.pointerId); } catch {}
    });

    tl.addEventListener("pointermove", e => {
      if (!rad) return;
      e.preventDefault();

      // Raden flyttes i lista, ikke rundt på hele skjermen: den stopper
      // ved første og siste punkt.
      const dy = Math.max(ramme.top - hvile.top,
                 Math.min(e.clientY - startY, ramme.bottom - hvile.bottom));
      rad.style.transform = `translateY(${dy}px)`;

      // Bare naboen i den retningen du drar vurderes, og først når raden
      // har passert midten av den. Ellers bytter raden plass med seg selv.
      const midt = hvile.top + dy + hvile.height / 2;
      const nabo = dy > 0 ? rad.nextElementSibling : dy < 0 ? rad.previousElementSibling : null;
      if (!nabo || !nabo.classList.contains(radklasse)) return;

      const r = nabo.getBoundingClientRect();
      const passert = dy > 0 ? midt > r.top + r.height / 2 : midt < r.top + r.height / 2;
      if (!passert) return;

      if (dy > 0) nabo.after(rad); else nabo.before(rad);
      startY = e.clientY;              // nytt utgangspunkt, ellers hopper raden
      rad.style.transform = "";
      maal();
    }, { passive: false });

    async function slipp() {
      if (!rad) return;
      rad.style.transform = "";
      rad.classList.remove("drar");
      rad = null;
      const ids = [...tl.querySelectorAll("." + radklasse)].map(idAv);
      await lagre(ids);
    }
    tl.addEventListener("pointerup", slipp);
    tl.addEventListener("pointercancel", slipp);
  }

  async function lagreRekkefolge(ids) {
    const dag = S.trip.days.find(d => d.items.some(i => ids.includes(i.id)));
    if (!dag) return;
    const gammel = dag.items.map(i => i.id).join();
    if (gammel === ids.join()) return;          // ingenting flyttet seg

    dag.items = ids.map(id => dag.items.find(i => i.id === id)).filter(Boolean);
    try {
      for (let n = 0; n < dag.items.length; n++) {
        await Api.updateItem(dag.items[n].id, { sort: (n + 1) * 10 });
      }
      await openTrip(S.trip.id);
    } catch {
      toast("Klarte ikke lagre rekkefølgen.");
      await openTrip(S.trip.id);
    }
  }

  /* ───────────────── chat ───────────────── */
  /* Kartforslaget er en smal stripe som glir ut ved siden av meldingen.
     Den trekker seg sammen til et lite merke etter noen sekunder, så den
     ikke stjeler plass i samtalen — men forsvinner aldri helt. Trykker du
     på den, blir den stående åpen til du lukker den selv. */
  const kartTimere = new Set();

  /* Animasjonene skal spille én gang — når boksen faktisk skifter form.
     Chatten tegnes på nytt hver gang det kommer en melding, og uten denne
     lista ville alle kartbokser i samtalen hoppe til hver gang. */
  const kartNy = new Set();
  const roligBevegelse = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Bytter tilstand. Når boksen blir mindre, får den gamle formen
     animere seg ut først; den nye merkes så den glir inn ved neste
     tegning. Å åpne skal derimot kjennes umiddelbart. */
  function settKart(id, tilstand) {
    const fra = S.kart[id] || "vis";
    if (fra === tilstand) return;
    const ferdig = () => { S.kart[id] = tilstand; kartNy.add(id + ":" + tilstand); render(); };

    const boks = $("screen").querySelector(`.kartboks[data-kart="${CSS.escape(id)}"]`);
    const ut = tilstand !== "liten" ? null : fra === "apen" ? "lukker" : "krymper";
    if (!boks || !ut || roligBevegelse()) return ferdig();

    boks.classList.add(ut);
    setTimeout(ferdig, ut === "lukker" ? 170 : 220);
  }

  function actionCard(a, msgId) {
    const p = S.trip.places[a.place];
    if (!p) return "";
    const day = Parse.dayOf(S.trip, a.date);
    if (!(msgId in S.kart)) { S.kart[msgId] = "vis"; kartNy.add(msgId + ":vis"); }
    const tilstand = S.kart[msgId];
    const ny = kartNy.delete(msgId + ":" + tilstand) ? " ny" : "";

    return `<div class="kartboks ${tilstand}${ny}" data-kart="${esc(msgId)}">
      <button class="kartmerke" data-kartapne="${esc(msgId)}" aria-label="Vis veibeskrivelse">${ICON.pin}</button>

      <button class="kartstripe" data-kartapne="${esc(msgId)}">
        ${ICON.pin}
        <span class="kartnavn">${esc(p.name)}</span>
        ${a.time ? `<span class="karttid mono">${esc(a.time)}</span>` : ""}
      </button>

      <div class="kartkort">
        <div class="kartkorthode">
          <div>
            <div class="dest">${esc(p.name)}</div>
            <div class="meta">${a.time ? `<span class="mono">${esc(a.time)}</span> · ` : ""}${esc(day ? day.label : a.date)}<br>${esc(p.addr)}</div>
          </div>
          <button class="kartlukk" data-kartlukk="${esc(msgId)}" aria-label="Lukk">✕</button>
        </div>
        <div class="why">${esc(a.why)}</div>
        <div class="acts">
        ${kartKnapp(p, "primary")}
        </div>
      </div>
    </div>`;
  }

  /* Start nedtellingen for kartstriper som nettopp dukket opp. Én gang
     per melding — ellers ville hver ny tegning gitt den nye sekunder. */
  function startKarttimere() {
    for (const boks of $("screen").querySelectorAll(".kartboks.vis")) {
      const id = boks.dataset.kart;
      if (kartTimere.has(id)) continue;
      kartTimere.add(id);
      setTimeout(() => {
        if ((S.kart[id] || "vis") === "vis") settKart(id, "liten");
      }, 6000);
    }
  }

  /* Chatten har to nivåer, som i Snapchat: en liste, og én åpen samtale.
     S.openChat holder hvilken samtale som er framme; null betyr lista. */
  function viewChatList() {
    const recent = Api.lastByChannel();
    const rows = S.trip.channels.map(c => {
      const last = recent[c.id];
      const ulest = Api.erUlest(S.trip.id, c.id);
      const initials = c.name.split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
      return `<button class="chatrow${ulest ? " ulest" : ""}" data-openchat="${esc(c.id)}">
        <span class="ava ${c.private ? "locked" : ""}">${c.private ? "&#128274;" : esc(initials)}</span>
        <span class="grow" style="min-width:0">
          <span class="nm">${esc(c.name)}</span>
          <span class="last">${last
            ? `<em>${esc(last.mine ? "Du" : last.who.split(" ")[0])}:</em> ${esc(last.txt)}`
            : `<em>${esc(c.sub || "Ingen meldinger ennå")}</em>`}</span>
        </span>
        <span class="hoyre">
          <span class="when">${last ? esc(shortStamp(last.ts)) : ""}</span>
          ${ulest ? '<span class="ulestprikk" aria-label="Uleste meldinger"></span>' : ""}
        </span>
      </button>`;
    }).join("");

    return `<div class="chatlist">${rows}</div>
      <button class="btn" data-sheet="newchannel" style="width:100%">Ny chat</button>
      <p class="muted">En chat er enten åpen for hele turen, eller privat for dem du legger til.</p>`;
  }

  const EMOJIER = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  function viewConversation() {
    const msgs = Api.messages(S.openChat);

    // Adressene til bildene varer en time og hentes for mange om gangen.
    // Når de er klare, tegnes samtalen på nytt av seg selv.
    const stier = msgs.filter(m => m.bilde && !Api.bildeAdresse(m.bilde)).map(m => m.bilde);
    if (stier.length) Api.bildeUrl(stier).catch(() => {});
    if (!msgs.length && S.loadingChat) return venter("Henter meldinger");
    if (!msgs.length) {
      return `<p class="muted" style="text-align:center;padding:30px 0">Ingen meldinger her ennå. Skriv den første.</p>`;
    }

    const body = msgs.map(m => {
      const svarPaa = m.replyTo ? msgs.find(x => x.id === m.replyTo) : null;
      const rea = Api.reactions(S.openChat, m.id);

      return `<div class="msg ${m.mine ? "me" : ""}" id="msg-${esc(m.id)}" data-msg="${esc(m.id)}">
        ${m.mine ? "" : `<div class="who">${esc(m.who)}${m.role ? ` <b>· ${esc(m.role)}</b>` : ""}</div>`}
        ${m.replyTo ? `<button class="svarpaa" data-hopp="${esc(m.replyTo)}">
            <span class="svargrow">
              <span class="svarnavn">${esc(svarPaa ? (svarPaa.mine ? "Deg" : svarPaa.who) : "Slettet melding")}</span>
              <span class="svartekst">${esc(svarPaa
                  ? (svarPaa.txt || (svarPaa.bilde ? "Bilde" : ""))
                  : "meldingen finnes ikke lenger")}</span>
            </span>
            ${svarPaa && svarPaa.bilde && Api.bildeAdresse(svarPaa.bilde)
              ? `<img class="svarbilde" src="${esc(Api.bildeAdresse(svarPaa.bilde))}" alt="">` : ""}
          </button>` : ""}
        ${m.bilde ? `<button class="bildeboks" data-bilde="${esc(m.bilde)}">
            ${Api.bildeAdresse(m.bilde)
              ? `<img src="${esc(Api.bildeAdresse(m.bilde))}" alt="Bilde i chatten" loading="lazy">`
              : `<span class="bildelaster">${prikker()}</span>`}
          </button>` : ""}
        ${m.txt ? `<div class="bubble">${medLenker(m.txt)}</div>` : ""}
        <button class="msgmeny" data-msgmeny="${esc(m.id)}" aria-label="Svar eller reager">⋯</button>
        ${rea.length ? `<div class="reaksjoner" data-rea="${esc(m.id)}">
            ${rea.map(r => `<button class="rea ${r.min ? "min" : ""}" data-emoji="${esc(r.emoji)}" data-pa="${esc(m.id)}">
              ${esc(r.emoji)}<span>${r.navn.length}</span></button>`).join("")}
          </div>` : ""}
        <div class="stamp">${esc(dayStamp(m.ts))}</div>
        ${m.action ? actionCard(m.action, m.id) : ""}
      </div>`;
    }).join("");

    // Chatten holder de 300 nyeste. Ligger det mer bak, hentes det når
    // du ber om det — ikke hver gang samtalen åpnes.
    const eldre = Api.harEldre(S.openChat)
      ? `<button class="eldreknapp" data-eldre="1">Hent eldre meldinger</button>` : "";

    return `<div class="msgs" id="msgs">${eldre}${body}</div>`;
  }

  /* Sveip en melding mot høyre for å svare, hold inne for å reagere.
     Begge gestene ligger på samme element, så en bevegelse avbryter
     holdet — ellers ville et sveip også åpnet emojivelgeren. */
  let avbrytGest = null;         // stopper sveip og hold naar lista blar

  let sisteHold = 0;

  /* Sant i det korte øyeblikket mellom at vi ber om tilbake selv, og at
     nettleseren svarer. Da skal tilbakelytteren holde fingrene av fatet. */
  let egenTilbake = false;
  const gaaTilbake = () => {
    egenTilbake = true;
    // Finnes det ikke noe å gå tilbake til, kommer svaret aldri. Da skal
    // ikke flagget bli stående og sluke neste ekte tilbake.
    setTimeout(() => { egenTilbake = false; }, 400);
    history.back();
  };

  function settOppMeldingsgester() {
    const boks = $("screen").querySelector(".msgs");
    if (!boks) return;

    let rad = null, startX = 0, startY = 0, holder = null, sveiper = false;

    const avbrytHold = () => { clearTimeout(holder); holder = null; };

    boks.addEventListener("pointerdown", e => {
      // Med mus skal man kunne merke tekst; der finnes knappen på
      // meldingen i stedet for sveip og hold.
      if (e.pointerType === "mouse") return;
      // Bildet er også en knapp, men et hold på det skal gi valgene —
      // lagre, reagere, svare — på samme måte som et hold på teksten.
      if (e.target.closest("button, a") && !e.target.closest(".bildeboks")) return;
      rad = e.target.closest(".msg");
      if (!rad) return;
      const del = e.target.closest(".bildeboks") ? "bilde"
                : e.target.closest(".bubble") ? "tekst" : null;
      startX = e.clientX; startY = e.clientY; sveiper = false;
      holder = setTimeout(() => {
        holder = null;
        rad.classList.remove("sveiper");
        rad.style.transform = "";
        const id = rad.dataset.msg;
        rad = null;
        if (navigator.vibrate) navigator.vibrate(12);
        // Holdt du på et bilde, kommer det et trykk etterpå som ellers
        // ville åpnet bildet i full skjerm oppå valgene du nettopp fikk.
        sisteHold = Date.now();
        sheetEmoji(id, del);
      }, 450);
    });

    boks.addEventListener("pointermove", e => {
      if (!rad) return;
      const dx = e.clientX - startX, dy = Math.abs(e.clientY - startY);
      if (!sveiper) {
        if (Math.abs(dx) > 8 || dy > 8) avbrytHold();
        if (dx > 12 && dy < 26) { sveiper = true; rad.classList.add("sveiper"); }
        else return;
      }
      e.preventDefault();
      rad.style.transform = `translateX(${Math.min(Math.max(dx, 0), 90)}px)`;
    }, { passive: false });

    function slipp() {
      avbrytHold();
      if (!rad) return;
      const dx = Number((rad.style.transform.match(/translateX\((\d+(?:\.\d+)?)px\)/) || [0, 0])[1]);
      rad.classList.remove("sveiper");
      rad.style.transform = "";
      const id = rad.dataset.msg;
      rad = null;
      if (sveiper && dx > 55) startSvar(id);
    }
    boks.addEventListener("pointerup", slipp);
    boks.addEventListener("pointercancel", slipp);

    // Begynner lista å bla, er det ikke et hold lenger. Uten dette kunne
    // emojivelgeren sprette opp midt i at du bladde bakover i samtalen.
    // Selve lytteren ligger ett sted, utenfor — denne tegnes på nytt
    // hver gang det kommer en melding.
    avbrytGest = () => {
      if (!rad) return;
      avbrytHold();
      rad.classList.remove("sveiper");
      rad.style.transform = "";
      rad = null;
    };
  }

  /* Eldre meldinger legges foran i lista. Da vokser innholdet oppover, og
     skjermen ville hoppet — vi legger til nøyaktig den høyden som kom. */
  async function hentEldre() {
    const sc = $("screen");
    const hoyde = sc.scrollHeight, topp = sc.scrollTop;
    try {
      const n = await Api.loadMoreMessages(S.openChat);
      if (!n) return toast("Ikke flere meldinger.");
    } catch { return toast("Klarte ikke hente eldre meldinger."); }
    S.beholdSkroll = { hoyde, topp };
    render();
  }

  function startSvar(id) {
    const m = Api.messages(S.openChat).find(x => x.id === id);
    if (!m) return;
    S.svarTil = { id: m.id, who: m.mine ? "deg selv" : m.who, txt: m.txt || "", bilde: m.bilde || null };
    render();
    const inn = $("msgInput");
    if (inn) inn.focus();
  }

  function hoppTil(id) {
    const el = document.getElementById("msg-" + id);
    if (!el) return toast("Meldingen finnes ikke lenger.");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("blink");
    void el.offsetWidth;            // start animasjonen på nytt
    el.classList.add("blink");
  }

  /* Bildet og teksten er to ting, selv om de kom i samme melding. Holder
     du på bildet, handler menyen om bildet; holder du på teksten, handler
     den om teksten. «del» sier hvilken av dem du tok tak i — uten den
     vises begge, som når du bruker de tre prikkene. */
  function sheetEmoji(id, del) {
    const m = Api.messages(S.openChat).find(x => x.id === id);
    const rea = Api.reactions(S.openChat, id);
    const bilde = m && m.bilde;
    const txt = (m && m.txt) || "";
    const viserBilde = bilde && del !== "tekst";
    const viserTekst = txt && del !== "bilde";
    const kanSlette = m && (m.mine || S.trip.role === "leader");
    if (viserBilde) forberedBlob(bilde);

    // Er det bare den ene delen igjen etterpå, er det ikke noe igjen av
    // meldingen heller — da slettes hele.
    const slettBildet = `<button class="btn danger" ${txt
      ? `data-slettbilde="${esc(bilde)}"` : `data-delmsg="${esc(id)}"`}>Slett bildet</button>`;
    const slettTeksten = `<button class="btn danger" ${bilde
      ? `data-deltekst="${esc(id)}"` : `data-delmsg="${esc(id)}"`}>Slett ${bilde ? "teksten" : "meldingen"}</button>`;
    const slettvalg = !kanSlette ? ""
      : del === "bilde" ? (bilde ? slettBildet : slettTeksten)
      : del === "tekst" ? (txt ? slettTeksten : slettBildet)
      : (bilde ? slettBildet : "") + (txt ? slettTeksten : "");

    openSheet(`<h3>${viserBilde && !viserTekst ? "Bilde" : "Melding"}</h3>
      ${viserBilde ? `<div class="sheetbilde"><img src="${esc(Api.bildeAdresse(bilde) || "")}" alt=""></div>` : ""}
      ${viserTekst ? `<p class="muted" style="margin:6px 0 14px">${esc(txt.slice(0, 90))}${txt.length > 90 ? "…" : ""}</p>` : ""}
      <div class="emojirad">
        ${EMOJIER.map(e => `<button class="emojiknapp" data-emoji="${e}" data-pa="${esc(id)}">${e}</button>`).join("")}
      </div>
      ${rea.length ? `<div class="eyebrow" style="margin:18px 0 8px">Hvem har reagert</div>
        <div class="memberlist">${rea.map(r => `<div class="person">
          <span>${esc(r.emoji)} ${esc(r.navn.join(", "))}</span></div>`).join("")}</div>` : ""}
      <div class="stack" style="margin-top:14px">
        <button class="btn" data-svar="${esc(id)}">Svar på ${viserBilde && !viserTekst ? "bildet" : "meldingen"}</button>
        ${viserBilde ? `<button class="btn" data-lagrebilde="${esc(bilde)}">${ICON.last} Lagre bildet</button>` : ""}
        ${viserTekst ? `<button class="btn" data-kopimeld="${esc(txt)}">Kopier teksten</button>` : ""}
        ${slettvalg}
      </div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  async function reager(id, emoji) {
    try {
      await Api.toggleReaction(S.openChat, id, emoji);
      render();
    } catch { toast("Klarte ikke lagre reaksjonen."); }
  }

  function viewChat() {
    return S.openChat ? viewConversation() : viewChatList();
  }

  /* ───────────────── meg ───────────────── */

  /* Ting reiselederen bør ordne. Alt her er noe som gjør at appen ikke
     kan gjøre jobben sin — et sted uten posisjon gir ingen veibeskrivelse,
     en dag uten hotell gjør at «møt på hotellet» ikke kan slås opp. */
  function oppgaver(taMedSkjulte) {
    if (!S.trip || S.trip.role !== "leader") return [];
    const ut = [];

    for (const d of S.trip.days) {
      if (d.hotel) continue;
      if (d.ignorerHotell && !taMedSkjulte) continue;
      ut.push({
        hva: `${cap(d.label)} mangler hotell`,
        hvorfor: "«Møt på hotellet» kan ikke slås opp denne dagen",
        sheet: "hotel", slag: "day", id: d.id, skjult: !!d.ignorerHotell
      });
    }

    for (const p of Object.values(S.trip.places)) {
      const harPosisjon = p.lat != null && p.lon != null;
      if (p.addr && harPosisjon) continue;
      if (p.ignorer && !taMedSkjulte) continue;
      ut.push({
        hva: p.addr ? `Fant ikke posisjonen til ${p.name}` : `${p.name} mangler adresse`,
        hvorfor: p.addr
          ? "Prøv en mer nøyaktig adresse — gate, postnummer og land"
          : "Ingen veibeskrivelse og ingen værmelding",
        sheet: "place", slag: "place", id: p.id, skjult: !!p.ignorer
      });
    }

    return ut;
  }

  async function skjulOppgave(slag, id, skjul) {
    try {
      await Api.setIgnorer(slag, id, skjul);
      await openTrip(S.trip.id);
      S.tab = "meg"; render();
      toast(skjul ? "Skjult. Du finner den under «Skjulte»." : "Tatt fram igjen.");
    } catch {
      toast("Klarte ikke lagre. Har du kjørt siste SQL?");
    }
  }

  function sheetSkjulte() {
    const skjulte = oppgaver(true).filter(o => o.skjult);
    openSheet(`<h3>Skjulte oppgaver</h3>
      <p class="muted" style="margin:6px 0 14px">Ting du har krysset av som unødvendige.
      De teller ikke med i merket på fanen.</p>
      ${skjulte.length ? `<div class="memberlist">${skjulte.map(o => `<div class="person">
          <span>${esc(o.hva)}</span>
          <button class="linkbtn" data-vis="${esc(o.slag)}" data-visid="${esc(o.id)}">ta fram igjen</button>
        </div>`).join("")}</div>` : `<p class="muted">Ingenting er skjult.</p>`}
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* Har du ikke slått på varsler, er det verdt et lite merke — ellers
     sitter folk og lurer på hvorfor telefonen er stille. Det vises bare
     når det faktisk går an å gjøre noe med. */
  const varslerErAv = () => S.varselStatus === "av" || S.varselStatus === "avslaatt";

  /* Appen hører hjemme på hjemskjermen: der får den hele skjermen, den
     husker deg, og på iPhone er det eneste måten varsler i det hele tatt
     virker. Hintet står til du legger den dit — eller sier du ikke vil. */
  let installValg = null;                    // Chrome sin egen forespørsel
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    installValg = e;
    if (S.trip) render();
  });
  addEventListener("appinstalled", () => { installValg = null; render(); });

  const paaHjemskjerm = () =>
    matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function installkort() {
    if (paaHjemskjerm()) return "";
    try { if (localStorage.getItem("tk.skjulInstall")) return ""; } catch { /* uviktig */ }

    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hvordan = installValg
      ? `<button class="btn primary" style="margin-top:12px" id="installKnapp">Legg til appen</button>`
      : iOS
      ? `<p style="margin:9px 0 0;font-size:13.5px;color:var(--ink-2)">
           Trykk delingsknappen nederst i Safari, og velg <b>Legg til på Hjem-skjerm</b>.</p>`
      : `<p style="margin:9px 0 0;font-size:13.5px;color:var(--ink-2)">
           I nettlesermenyen finner du <b>Installer</b> eller <b>Legg til på startsiden</b>.</p>`;

    return `<div class="card pad" style="padding-block:15px;border-left:3px solid var(--blue)">
      <b style="font-family:"DM Sans",sans-serif;font-size:14.5px">Legg TripMate på hjemskjermen</b>
      <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">
        Da åpnes den som en app, husker deg${iOS
          ? ", og varsler begynner å virke — på iPhone finnes de bare for apper på hjemskjermen"
          : " og kan gi deg varsler"}.</p>
      ${hvordan}
      <button class="linkbtn" style="font-size:13px" id="skjulInstall">Ikke nå</button>
    </div>`;
  }

  function viewMe() {
    const p = Api.getProfile();
    const tall = S.megTall;              // null til de er hentet
    const trip = S.trip;
    const varslerAv = varslerErAv();
    const varselTekst = varslerAv
      ? (S.varselStatus === "avslaatt" ? "Blokkert i nettleseren" : "Ikke slått på her")
      : S.varselStatus === "umulig" ? "Ikke mulig i denne nettleseren"
      : ({ alt: "Alt", viktig: "Det viktige", ingen: "Ingenting" })[Api.varselNiva(null)] || "På";
    const rows = S.trips.length
      ? S.trips.map(t => `<button class="listrow" data-opentrip="${esc(t.id)}" aria-current="${t.id === trip.id}">
          <div class="grow"><div class="nm">${esc(t.name)}</div>
            <div class="sub">${esc([t.org, t.dates].filter(Boolean).join(" · "))}${t.role === "leader" ? " · du er reiseleder" : ""}</div></div>
          <span class="chev">${ICON.chev}</span></button>`).join("")
      : S.turerHentet
      ? `<p class="muted" style="padding:12px 0">Fant ingen andre turer.</p>`
      : `<p class="muted" style="padding:12px 0">Henter turene dine…</p>`;

    return `
      ${(() => {
        const o = oppgaver();
        const skjulte = oppgaver(true).filter(x => x.skjult);
        if (!o.length && !skjulte.length) return "";

        const skjultLenke = skjulte.length
          ? `<button class="linkbtn" style="font-size:13px" data-sheet="skjulte">
               ${skjulte.length} skjult${skjulte.length === 1 ? "" : "e"} — se dem</button>`
          : "";

        // Er alt ordnet, skal lenken til de skjulte fortsatt stå igjen.
        // Ellers forsvinner veien tilbake sammen med selve lista.
        if (!o.length) {
          return `<div>
            <div class="eyebrow" style="margin-bottom:8px;color:var(--moss)">Alt er i orden</div>
            <div class="card pad" style="padding-block:14px;border-left:3px solid var(--moss)">
              <p class="muted" style="margin:0">${skjulte.length
                ? "Ingenting venter på deg. Det du har krysset av ligger under."
                : "Alle steder har adresse, og alle dager har hotell."}</p>
            </div>
            ${skjultLenke}
          </div>`;
        }

        return `<div>
          <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Må ordnes · ${o.length}</div>
          <div class="card pad" style="border-left:3px solid var(--amber)">
            <div class="list">${o.map(x => `<div class="oppgave">
              <button class="listrow" data-sheet="${x.sheet}" data-place="${esc(x.id)}" data-day="${esc(x.id)}">
                <div class="grow"><div class="nm">${esc(x.hva)}</div><div class="sub">${esc(x.hvorfor)}</div></div>
                <span class="chev">${ICON.chev}</span>
              </button>
              <button class="linkbtn skjulknapp" data-skjul="${esc(x.slag)}" data-skjulid="${esc(x.id)}">ikke nødvendig</button>
            </div>`).join("")}</div>
          </div>
          ${o.some(x => /Fant ikke posisjonen/.test(x.hva))
            ? `<button class="linkbtn" style="font-size:13px" data-vaerigjen="1">Slå opp adressene på nytt</button>`
            : ""}
          ${skjultLenke}
        </div>`;

      })()}
      ${installkort()}

      <div class="megkort">
        <span class="megava">${esc(p ? p.initials : "–")}</span>
        <span class="grow">
          <b>${esc(p ? p.name : "Du")}</b>
          <small>${trip.role === "leader" ? "Reiseleder" : "Deltaker"} på ${esc(trip.name)}</small>
        </span>
        ${Api.erAnonym() ? '<span class="tag amber">gjest</span>' : ""}
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Turen</div>
        <div class="gruppe"><div class="list">
          <button class="listrow" data-sheet="deltakere">
            <span class="rikon">${ICON.folk}</span>
            <div class="grow"><div class="nm">Deltakere${S.ventende ? '<span class="prikkmerke"></span>' : ""}</div></div>
            <span class="verdi"${S.ventende ? ' style="color:var(--amber)"' : ""}>${S.ventende
              ? `${S.ventende} venter` : ""}</span>
            <span class="chev">${ICON.chev}</span></button>

          <button class="listrow" data-sheet="varsler">
            <span class="rikon gul">${ICON.bjelle}</span>
            <div class="grow"><div class="nm">Varsler${varslerAv ? '<span class="prikkmerke"></span>' : ""}</div></div>
            <span class="verdi"${varslerAv ? ' style="color:var(--amber)"' : ""}>${esc(varselTekst)}</span>
            <span class="chev">${ICON.chev}</span></button>


          ${trip.role === "leader" ? `<button class="listrow" data-sheet="endretur">
            <span class="rikon grunn">${ICON.blyant}</span>
            <div class="grow"><div class="nm">Navn og dato</div></div>
            <span class="verdi">${esc(trip.dates || trip.name)}</span>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          <button class="listrow" data-copy="${esc(trip.code)}">
            <span class="rikon grunn">${ICON.nokkel}</span>
            <div class="grow"><div class="nm">Turkode</div>
              <div class="sub">Trykk for å kopiere</div></div>
            <b class="mono" style="font-size:17px;letter-spacing:.09em">${esc(trip.code)}</b></button>
        </div></div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Dine turer</div>
        <div class="gruppe"><div class="list">
          ${rows}
          <button class="listrow" data-sheet="jointrip">
            <span class="rikon grunn">${ICON.nav}</span>
            <div class="grow"><div class="nm">Bli med på en ny tur</div></div>
            <span class="chev">${ICON.chev}</span></button>
          <button class="listrow" data-sheet="newtrip">
            <span class="rikon grunn">${ICON.koffert}</span>
            <div class="grow"><div class="nm">Lag en ny tur</div></div>
            <span class="chev">${ICON.chev}</span></button>
        </div></div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Kontoen din</div>
        <div class="gruppe"><div class="list">
          <button class="listrow" data-sheet="koblepost">
            <span class="rikon">${ICON.post}</span>
            <div class="grow"><div class="nm">${Api.erAnonym() ? "Sikre kontoen" : "E-postadresse"}</div></div>
            <span class="verdi">${Api.erAnonym() ? "Bare i denne nettleseren" : esc(Api.minEpost() || "Innlogget")}</span>
            <span class="chev">${ICON.chev}</span></button>
          <button class="listrow" data-sheet="kartvalg">
            <span class="rikon mose">${ICON.kart}</span>
            <div class="grow"><div class="nm">Kart</div></div>
            <span class="verdi">${Api.kartValg() === "apple" ? "Apple Kart" : "Google Maps"} · ${
              Api.reisemaate() === "fots" ? "til fots" : Api.reisemaate() === "kollektiv" ? "kollektivt" : "bil"}</span>
            <span class="chev">${ICON.chev}</span></button>
          <button class="listrow" data-sheet="about">
            <span class="rikon grunn">${ICON.info}</span>
            <div class="grow"><div class="nm">Om appen og personvern</div></div>
            <span class="chev">${ICON.chev}</span></button>
        </div></div>
        ${Api.erAnonym() ? `<p class="muted" style="margin-top:7px">Bytter du telefon eller tømmer
          nettleserdata mens du er gjest, er turene borte.</p>` : ""}

        <div class="gruppe" style="margin-top:14px"><div class="list">
          <button class="listrow bar fare" data-leave="${esc(trip.id)}">Meld deg av ${esc(trip.name)}</button>
          ${trip.erEier || trip.erAdmin
            ? `<button class="listrow bar fare" data-deltrip="${esc(trip.id)}">Slett hele turen</button>` : ""}
          <button class="listrow bar fare" id="resetBtn">Logg ut på denne enheten</button>
        </div></div>
      </div>`;
  }

  /* ───────────────── tegning ───────────────── */
  function render() {
    if (!S.trip) return;
    const side = S.side;                      // egen side inni appen
    const conv = !side && S.tab === "chat" && S.openChat
      ? S.trip.channels.find(c => c.id === S.openChat) : null;

    // Når en samtale eller en egen side er åpen, bytter toppen til dens
    // egen overskrift med en pil tilbake.
    $("apphead").hidden = Boolean(conv || side);
    $("convhead").hidden = !(conv || side);
    $("convWho").hidden = Boolean(side);
    // Navnet i samtaletoppen er en knapp inn til chatsiden. På de andre
    // sidene er det bare en overskrift.
    $("convhead").classList.toggle("trykkbar", Boolean(conv));
    $("convhead").querySelector(".t").dataset.chatside = conv ? conv.id : "";

    if (side) {
      const sidenavn = { deltakere: "Deltakere og roller", varsler: "Varsler", chat: "Om chatten",
                         pakk: "Pakkeliste", seter: "Sitteplasser" };
      $("convName").textContent = sidenavn[side] || "";
      $("convSub").textContent = S.trip.name;
    } else if (conv) {
      $("convName").textContent = conv.name;
      $("convSub").textContent = conv.private ? "Privat · bare de som er lagt til"
        : conv.bareLedere ? "Oppslagstavle · reiselederne skriver"
        : "Åpen for alle på turen";
      $("convWho").dataset.members = conv.id;
    } else {
      $("tripName").textContent = S.trip.name;
      $("tripSub").textContent = [S.trip.org, S.trip.dates].filter(Boolean).join(" · ") || ("Kode " + S.trip.code);
    }

    $("banner").innerHTML = S.offline
      ? `<div class="offlinebar">Ingen forbindelse — viser sist lagrede program. Meldinger sendes ikke.</div>` : "";

    const chipsFor = $("screen").querySelector(".chips");
    const chipsScroll = chipsFor ? chipsFor.scrollLeft : 0;

    // Står du nederst i samtalen, følger du med videre. Leser du lenger
    // oppe, skal ikke en melding fra noen andre rykke deg ned igjen — og
    // med hundre på samme tur skjer det hele tiden.
    const sk = $("screen");
    const byttetChat = !conv || S.sisteChat !== conv.id;
    const naerBunn = byttetChat || S.tilBunn ||
      (sk.scrollHeight - sk.scrollTop - sk.clientHeight) < 140;
    S.sisteChat = conv ? conv.id : null;

    // Leser du lenger opp, teller vi hva som har kommet i mellomtiden i
    // stedet for å dra deg ned. Eldre meldinger du selv har hentet, er
    // ikke nye — de legger seg foran, ikke bak.
    if (conv) {
      const msgs = Api.messages(conv.id);
      const antall = msgs.length;
      if (naerBunn) S.nye = 0;
      else if (!S.beholdSkroll && antall > S.sistAntall) S.nye += antall - S.sistAntall;
      S.sistAntall = antall;
      // Har du samtalen framme, er den lest.
      if (antall) Api.settLest(S.trip.id, conv.id, msgs[antall - 1].ts);
    }

    // Bytter du skjermbilde, skal du begynne på toppen av det nye — ikke
    // stå midt nede fordi du var langt nede i det forrige.
    const visning = side || S.tab + (S.openChat || "");
    const byttetVisning = visning !== S.sisteVisning;
    S.sisteVisning = visning;

    $("screen").innerHTML = side === "varsler" ? viewVarsler()
                          : side === "chat" ? viewChatside()
                          : side === "pakk" ? viewPakk()
                          : side === "seter" ? viewSeter()
                          : side === "deltakere" ? viewDeltakere()
                          : visningFor(S.tab);
    if (side === "varsler") settOppVarsler();
    if (byttetVisning && !conv) $("screen").scrollTop = 0;

    const slot = $("composerSlot");
    // Skrivefeltet bygges opp på nytt hver gang noe tegnes. Det du har
    // skrevet, men ikke sendt, skal ikke forsvinne fordi det kom en
    // melding fra noen andre imens — eller fordi du valgte et bilde.
    const gammeltFelt = $("msgInput");
    const utkast = gammeltFelt && S.sisteComposer === S.openChat ? gammeltFelt.value : "";
    const haddeFokus = gammeltFelt && document.activeElement === gammeltFelt;
    const markor = haddeFokus ? gammeltFelt.selectionStart : null;
    S.sisteComposer = S.openChat;

    if (conv && !S.offline && !kanSkrive(conv)) {
      slot.innerHTML = `<p class="bareledere">${ICON.info} Bare reiseledere skriver i denne chatten.</p>`;
      const sc0 = $("screen");
      if (naerBunn) sc0.scrollTop = sc0.scrollHeight;
    } else if (conv && !S.offline) {
      slot.innerHTML = `
        ${S.nye ? `<button class="nyepill" data-nye="1">${S.nye} ny${S.nye === 1 ? " melding" : "e meldinger"} ↓</button>` : ""}
        ${S.svarTil ? `<div class="svarforhaand">
          ${S.svarTil.bilde && Api.bildeAdresse(S.svarTil.bilde)
            ? `<img class="svarbilde" src="${esc(Api.bildeAdresse(S.svarTil.bilde))}" alt="">` : ""}
          <div class="svarinfo">
            <b>Svarer ${esc(S.svarTil.who)}</b>
            <span>${esc(S.svarTil.txt.slice(0, 80) || (S.svarTil.bilde ? "Bilde" : ""))}${S.svarTil.txt.length > 80 ? "…" : ""}</span>
          </div>
          <button class="minibtn" id="avbrytSvar" aria-label="Avbryt svaret">✕</button>
        </div>` : ""}
        ${S.vedlegg ? `<div class="vedlegg">
          <img src="${esc(S.vedlegg.url)}" alt="">
          <div class="vedleggtekst">
            <b>${S.sender ? "Sender bildet…" : "Bilde klart"}</b>
            <span>${S.sender ? "Vent litt." : "Skriv gjerne noe til det, og trykk send."}</span>
          </div>
          ${S.sender ? prikker() : `<button class="minibtn" id="fjernVedlegg" aria-label="Fjern bildet">✕</button>`}
        </div>` : ""}
        <form class="composer" id="composer">
          ${S.trip.bilder ? `${harKamera() ? `<label class="bildeknapp" aria-label="Ta bilde">
            ${ICON.bilde}
            <input type="file" accept="image/*" capture="environment" id="kameraInput">
          </label>` : ""}
          <label class="bildeknapp" aria-label="Velg bilde fra bildene dine">
            ${ICON.bibliotek}
            <input type="file" accept="image/*" id="bildeInput">
          </label>` : ""}
          <input id="msgInput" placeholder="${S.svarTil ? "Skriv svaret…" : "Melding til " + esc(conv.name) + "…"}" autocomplete="off" enterkeyhint="send" maxlength="2000">
          <button class="send" type="submit" aria-label="Send melding" ${S.sender ? "disabled" : ""}>${ICON.send}</button>
        </form>`;
      $("composer").addEventListener("submit", onSend);
      for (const id of ["bildeInput", "kameraInput"]) {
        const felt = $(id);
        if (felt) felt.addEventListener("change", velgBilde);
      }
      const bortVedlegg = $("fjernVedlegg");
      if (bortVedlegg) bortVedlegg.addEventListener("click", fjernVedlegg);

      const nyttFelt = $("msgInput");
      if (nyttFelt && utkast) nyttFelt.value = utkast;
      if (nyttFelt && haddeFokus) {
        nyttFelt.focus();
        try { nyttFelt.setSelectionRange(markor, markor); } catch {}
      }
      const avbryt = $("avbrytSvar");
      if (avbryt) avbryt.addEventListener("click", () => { S.svarTil = null; render(); });
      settOppMeldingsgester();
      const sc = $("screen");
      if (S.beholdSkroll) {
        sc.scrollTop = S.beholdSkroll.topp + (sc.scrollHeight - S.beholdSkroll.hoyde);
      } else if (naerBunn) sc.scrollTop = sc.scrollHeight;
    } else slot.innerHTML = "";
    S.tilBunn = false;
    S.beholdSkroll = null;

    settOppDraing();
    startKarttimere();

    // Dagsvelgeren skal stå der du forlot den, ikke hoppe til mandag.
    const chipsEtter = $("screen").querySelector(".chips");
    if (chipsEtter) {
      chipsEtter.scrollLeft = chipsScroll;
      const valgt = chipsEtter.querySelector('[aria-pressed="true"]');
      if (valgt) {
        // Rull akkurat så langt at knappen så vidt er inne, ikke til midten.
        const v = valgt.getBoundingClientRect(), c = chipsEtter.getBoundingClientRect();
        const marg = 14;
        if (v.left < c.left + marg) chipsEtter.scrollLeft -= (c.left + marg) - v.left;
        else if (v.right > c.right - marg) chipsEtter.scrollLeft += v.right - (c.right - marg);
      }
    }

    // Dagstripa blas sidelengs når dagen har mange punkter. Da skal nå
    // være synlig uten at man må dra, ellers ser dagen tom ut.
    const stripa = $("screen").querySelector(".stripe .punkter");
    if (stripa) {
      const naa = stripa.querySelector(".pk.aktiv") || stripa.querySelector(".pk:not(.ferdig)");
      if (naa) {
        const v = naa.getBoundingClientRect(), c = stripa.getBoundingClientRect();
        const marg = 20;
        if (v.left < c.left + marg) stripa.scrollLeft -= (c.left + marg) - v.left;
        else if (v.right > c.right - marg) stripa.scrollLeft += v.right - (c.right - marg);
      }
    }

    // Fanerada er i veien når du skriver i en samtale.
    $("tabbar").hidden = Boolean(conv);
    tegnFaner();
    maalOey();
  }

  /* ───────────────── øya ─────────────────
     Fanelinja flyter over innholdet som en kapsel, slik Apple beskriver
     fanelinja i iOS 26. Den bygges én gang og oppdateres etterpå:
     bygde vi den på nytt for hver tegning, fantes det ikke noe for
     pilla å gli fra — og det er pilla som viser hvor du kom fra og hvor
     du havnet. */
  const FANER = [["idag","I dag","hjem"], ["program","Program","cal"],
                 ["chat","Chat","chat"], ["meg","Meg","me"]];

  function tegnFaner() {
    const bar = $("tabbar");
    if (!bar.firstElementChild) {
      bar.innerHTML = `<span class="pille" aria-hidden="true"></span>` +
        FANER.map(([id, navn, ikon]) =>
          `<button role="tab" data-tab="${id}" aria-selected="false">
             <span class="ikon">${ICON[ikon]}<span class="varsel" hidden></span></span>
             <span>${navn}</span></button>`).join("");
      dragbarOey(bar);
    }
    // Merket på Meg teller både ting reiselederen må ordne og at varsler
    // ikke er slått på — begge deler er noe som venter på deg.
    const tall = {
      meg: oppgaver().length + (varslerErAv() ? 1 : 0) + (S.ventende ? 1 : 0),
      chat: Api.antallUleste(S.trip.id)
    };
    visFane(S.tab);
    FANER.forEach(([id], i) => {
      const m = bar.children[i + 1].querySelector(".varsel");
      m.hidden = !tall[id];
      if (tall[id]) m.textContent = tall[id];
    });
  }

  /* Flytter pilla og fargen, og ingenting annet. Brukes både når en fane
     er valgt og mens fingeren drar langs øya. */
  function visFane(id) {
    const bar = $("tabbar");
    FANER.forEach(([fid], i) => {
      const valgt = fid === id;
      bar.children[i + 1].setAttribute("aria-selected", String(valgt));
      if (valgt) bar.style.setProperty("--oy-i", String(i));
    });
  }

  /* Øya ligger over lista, så lista må ha plass til å bli blad helt ned.
     Høyden måles i stedet for å regnes ut: forsøket med calc() og
     safe-area traff ikke likt i alle nettlesere. */
  function maalOey() {
    const app = $("appScreen"), bar = $("tabbar");
    const plass = bar.hidden ? 0
      : Math.max(0, Math.round(app.getBoundingClientRect().bottom - bar.getBoundingClientRect().top) + 8);
    app.style.setProperty("--oy-plass", plass + "px");
    app.style.setProperty("--oy-slor", bar.hidden ? "0" : "1");
  }

  /* Du kan dra langs øya: pilla følger fingeren, og fanen byttes først
     når du slipper. Samme oppførsel som en segmentkontroll på iOS — og
     grunnen til at teksten på øya ikke kan markeres. Et langt trykk der
     er et tak i baren, ikke en markering. */
  function dragbarOey(bar) {
    let nede = false, pekt = null;
    const faneVed = (x, y) => {
      const r = bar.getBoundingClientRect();
      // Drar du langt vekk fra baren og slipper, har du ombestemt deg.
      if (y < r.top - 56 || y > r.bottom + 56) return null;
      const i = Math.floor(((x - r.left - 6) / (r.width - 12)) * FANER.length);
      return FANER[Math.min(FANER.length - 1, Math.max(0, i))][0];
    };
    const flytt = e => {
      if (!nede) return;
      const id = faneVed(e.clientX, e.clientY);
      if (id === pekt) return;
      pekt = id;
      visFane(id || S.tab);
    };
    bar.addEventListener("pointerdown", e => {
      if (!e.target.closest("button")) return;
      nede = true; pekt = null;
      try { bar.setPointerCapture(e.pointerId); } catch { /* ikke viktig */ }
      flytt(e);
    });
    bar.addEventListener("pointermove", flytt);
    const slipp = () => {
      if (!nede) return;
      nede = false;
      if (pekt && pekt !== S.tab) byttFane(pekt);
      else visFane(S.tab);
      pekt = null;
    };
    bar.addEventListener("pointerup", slipp);
    bar.addEventListener("pointercancel", slipp);
  }

  /* Tallene til høyre i «Meg» er tre tellinger i basen. De hentes når
     fana vises, ikke ved oppstart, og bare én gang — med mindre noe
     som endrer dem har skjedd imens. */
  function hentMegTall(tvang) {
    if (!S.trip || (S.megTall && !tvang)) return;
    Api.megTall(S.trip.id).then(t => {
      S.megTall = t;
      if (S.trip && (S.tab === "meg" || S.tab === "idag") && !S.side && !S.openChat) render();
    }).catch(() => {});
  }

  function byttFane(id) {
    if (id === "meg" || id === "idag") hentMegTall();
    if (S.tab === id && !S.openChat && !S.side) return;
    S.tab = id; S.openChat = null; S.side = null;
    render();
  }

  /* ───────────────── åpne og lukke en samtale ───────────────── */
  async function openChat(channelId, fromHistory) {
    S.openChat = channelId;
    S.loadingChat = true;
    S.nye = 0; S.sistAntall = 0;
    Api.setLastChannel(S.trip.id, channelId);
    render();
    if (!fromHistory) history.pushState({ chat: channelId }, "");
    // Reaksjoner strømmes bare for samtalen du faktisk ser på. Samtidig
    // vekkes varselfunksjonen, så den er klar når du har skrevet ferdig.
    if (!S.offline) { Api.subscribeChannel(channelId); Api.varmVarsler(); Api.erHer(S.trip.id, channelId); }
    try { await Api.loadMessages(S.trip.id, channelId); }
    catch { toast("Klarte ikke hente meldingene."); }
    S.loadingChat = false;
    render();
  }

  function closeChat(fromHistory) {
    if (!S.openChat) return false;
    S.openChat = null;
    if (S.vedlegg) { URL.revokeObjectURL(S.vedlegg.url); S.vedlegg = null; }
    S.sender = false;
    S.nye = 0;
    Api.unsubscribeChannel();
    Api.erHer(S.trip.id, null);
    render();
    if (!fromHistory && history.state && history.state.chat) gaaTilbake();
    return true;
  }

  window.addEventListener("popstate", () => {
    // Gikk vi tilbake selv — fordi du lukket bildet eller siden — er
    // jobben alt gjort. Uten dette gikk turen videre nedover: bildet
    // lukket seg, og så lukket chatten seg like etter.
    if (egenTilbake) { egenTilbake = false; return; }
    if (lukkBilde(true)) return;
    if (S.side) return lukkSide(true);
    if (S.openChat) closeChat(true);
  });

  /* Ligger appen i bakgrunnen, kobler vi fra strømmen av meldinger.
     En telefon i lomma trenger den ikke, og hver pålogget teller: én
     melding til hundre påloggede er hundre meldinger gjennom Supabase.
     Vi venter et halvt minutt, så et raskt bytte til kartet ikke koster
     en ny tilkobling — og henter igjen det vi gikk glipp av når appen
     kommer fram. */
  let bakgrunnstimer = null;
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(bakgrunnstimer);
      Api.ikkeHer();
      bakgrunnstimer = setTimeout(() => Api.kobleFra(), 30000);
      return;
    }
    clearTimeout(bakgrunnstimer); bakgrunnstimer = null;
    if (!S.trip || S.offline) return;

    // Kom appen fram fordi du trykket på et varsel, ligger målet og venter.
    const ventende = await ventendeMaal();
    if (ventende && await aapneFraVarsel(ventende)) return;

    Api.subscribeTrip(S.trip.id);
    Api.erHer(S.trip.id, S.openChat);

    // Har du vært i innstillingene og skrudd på varsler, skal appen se
    // det når du kommer tilbake — ikke stå og påstå at de er blokkert.
    Api.varselStatus().then(s => { if (s !== S.varselStatus) { S.varselStatus = s; render(); } });
    if (S.openChat) {
      Api.subscribeChannel(S.openChat);
      await Api.loadMessages(S.trip.id, S.openChat).catch(() => {});
    }
    await Api.loadRecent(S.trip.id).catch(() => {});
    try { S.trip = (await Api.loadTrip(S.trip.id)) || S.trip; } catch {}
    Api.lastVaer(S.trip.id);
    render();
  });


  /* Bildet legger seg over skrivefeltet og blir liggende der til du
     trykker send. Da rekker du å skrive noe til det, se at du valgte
     riktig bilde, eller ombestemme deg — i stedet for at et feiltrykk
     ryker ut til hele klassen. */
  function velgBilde(e) {
    const felt = e.target;
    const fil = felt.files && felt.files[0];
    felt.value = "";                       // samme bilde skal kunne velges igjen
    if (!fil || !S.openChat) return;
    if (S.vedlegg) URL.revokeObjectURL(S.vedlegg.url);
    S.vedlegg = { fil, url: URL.createObjectURL(fil) };
    render();
    const inn = $("msgInput");
    if (inn) inn.focus();
  }

  function fjernVedlegg() {
    if (!S.vedlegg) return;
    URL.revokeObjectURL(S.vedlegg.url);
    S.vedlegg = null;
    render();
  }

  /* Trykker du på et bilde, fyller det skjermen — ikke et ark med bildet
     nedskalert inni. Tilbakeknappen øverst til venstre, og telefonens egen
     tilbakebevegelse, går ut igjen. */
  function visBilde(sti, fraHistorikk) {
    const url = Api.bildeAdresse(sti);
    if (!url) return toast("Bildet lastes fortsatt.");
    const m = Api.messages(S.openChat).find(x => x.bilde === sti);

    lukkBilde(true);
    const el = document.createElement("div");
    el.className = "bildevisning";
    el.id = "bildevisning";
    el.dataset.sti = sti;
    el.innerHTML = `
      <div class="bvtopp">
        <button class="bvknapp" data-bvlukk aria-label="Tilbake">${ICON.tilbake}</button>
        <span class="bvnavn">${m ? esc(m.mine ? "Deg" : m.who) + " · " + esc(dayStamp(m.ts)) : ""}</span>
        ${m ? `<button class="bvknapp" data-bvmeny="${esc(m.id)}" aria-label="Flere valg">⋯</button>`
            : `<span class="bvknapp" aria-hidden="true"></span>`}
      </div>
      <img src="${esc(url)}" alt="Bilde i chatten">`;
    document.body.appendChild(el);
    dragNedForAaLukke(el);
    forberedBlob(sti);
    if (!fraHistorikk) history.pushState({ bilde: sti }, "");
  }

  function lukkBilde(fraHistorikk) {
    const el = $("bildevisning");
    if (!el) return false;
    // Id-en fjernes med en gang, så alt annet regner bildet som lukket
    // mens det fortsatt toner ut.
    el.id = "";
    if (el.style.opacity !== "0") {
      el.style.transition = "opacity .16s ease-out";
      el.style.opacity = "0";
    }
    setTimeout(() => el.remove(), 240);
    if (!fraHistorikk && history.state && history.state.bilde) gaaTilbake();
    return true;
  }

  /* Dra bildet nedover for å legge det bort, slik man gjør i bildeapper.
     Det følger fingeren og blekner, og slipper du langt nok nede, lukkes
     det. Angrer du på halvveien, sklir det på plass igjen. */
  function dragNedForAaLukke(el) {
    let startY = 0, dy = 0, drar = false;

    el.addEventListener("touchstart", e => {
      if (e.touches.length !== 1 || e.target.closest("button")) return;
      startY = e.touches[0].clientY; dy = 0; drar = true;
      el.style.transition = "none";
    }, { passive: true });

    el.addEventListener("touchmove", e => {
      if (!drar) return;
      dy = e.touches[0].clientY - startY;
      if (dy < 0) dy = dy / 4;                    // oppover gir etter, men lukker ikke
      el.style.transform = `translateY(${dy}px)`;
      el.style.background = `rgba(255,255,255,${Math.max(0.35, 1 - Math.abs(dy) / 500)})`;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const slipp = () => {
      if (!drar) return;
      drar = false;
      if (dy > 110) {
        // Bildet fortsetter veien det var på vei, i stedet for å blinke bort.
        el.style.transition = "transform .24s ease-out, opacity .24s ease-out";
        el.style.transform = `translateY(${Math.max(dy + 220, 320)}px)`;
        el.style.opacity = "0";
        return lukkBilde();
      }
      el.style.transition = "transform .26s cubic-bezier(.22,.61,.36,1), background .26s ease-out";
      el.style.transform = "";
      el.style.background = "";
    };
    el.addEventListener("touchend", slipp);
    el.addEventListener("touchcancel", slipp);
  }

  /* Bildet hentes ned i bakgrunnen med en gang du åpner det eller menyen.
     Deletjenesten på iPhone må startes i samme trykk som du gjorde, og da
     er det for sent å begynne å laste ned. */
  const bildefiler = new Map();
  async function forberedBlob(sti) {
    if (bildefiler.has(sti)) return bildefiler.get(sti);
    const url = Api.bildeAdresse(sti);
    if (!url) return null;
    try {
      const blob = await fetch(url).then(r => r.ok ? r.blob() : null);
      if (!blob) return null;
      const fil = new File([blob], "tripmate.jpg", { type: blob.type || "image/jpeg" });
      bildefiler.set(sti, fil);
      return fil;
    } catch { return null; }
  }

  /* «Lagre på kamerarull» finnes ikke som noe nettsider får lov til. Det
     nærmeste er delemenyen, der iPhone selv tilbyr «Lagre bilde». Har
     telefonen ikke den, laster vi ned fila i stedet. */
  async function lagreBilde(sti) {
    const fil = bildefiler.get(sti) || await forberedBlob(sti);
    if (!fil) return toast("Klarte ikke hente bildet.");

    if (navigator.canShare && navigator.canShare({ files: [fil] })) {
      try { await navigator.share({ files: [fil] }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(fil);
    a.download = "tripmate.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    toast("Bildet er lastet ned.");
  }

  /* ───────────────── send melding ───────────────── */
  async function onSend(e) {
    e.preventDefault();
    const inp = $("msgInput");
    const txt = inp.value.trim();
    const vedlegg = S.vedlegg;
    if ((!txt && !vedlegg) || S.busy) return;
    inp.value = "";
    // Uten bilde tolker vi teksten; med bilde er den en bildetekst, og en
    // bildetekst skal ikke plutselig lage et programpunkt.
    const action = vedlegg ? null : Parse.analyse(S.trip, txt);
    let sti = null;
    try {
      if (vedlegg) {
        S.sender = true; render();
        sti = await Api.lastOppBilde(S.trip.id, S.openChat, vedlegg.fil);
        URL.revokeObjectURL(vedlegg.url);
        S.vedlegg = null;
        await Api.bildeUrl([sti]).catch(() => {});
      }
      await Api.sendMessage(S.trip.id, S.openChat, txt, action, S.svarTil ? S.svarTil.id : null, sti);
      S.svarTil = null;
      S.sender = false;
      S.tilBunn = true;          // din egen melding skal du alltid se
      render();
    } catch (err) {
      S.sender = false;
      inp.value = txt;
      // Bildet legges tilbake så du kan prøve igjen — med mindre det alt
      // er lastet opp, og det bare var selve meldingen som ikke gikk.
      if (vedlegg && !sti) S.vedlegg = vedlegg;
      render();
      toast(err && err.kjent ? err.message
        : vedlegg ? "Bildet ble ikke sendt. Sjekk nettet." : "Meldingen ble ikke sendt. Sjekk nettet.");
    }
  }

  /* ───────────────── ark ───────────────── */
  function openSheet(html) {
    const s = $("sheet");
    s.innerHTML = `<div class="grabsone"><div class="grab"></div></div><div class="sheetbody">${html}</div>`;
    s.style.transform = "";
    const kropp0 = s.querySelector(".sheetbody");
    if (kropp0) kropp0.scrollTop = 0;
    $("sheetBg").hidden = false;
  }
  function closeSheet() {
    $("sheetBg").hidden = true;
    $("sheet").style.transform = "";
  }

  /* Dra arket nedover for å lukke det, slik man gjør i apper ellers.

     iOS gir oss ikke pekerbevegelser når fingeren havner i et felt som
     kan skrolle — nettleseren tar gesten selv. Derfor lyttes det på
     berøring direkte, der vi kan si fra at vi tar over. Mus håndteres
     for seg, siden den ikke sender berøringshendelser. */
  (function dragToClose() {
    const s = $("sheet");
    let startY = 0, dy = 0, drar = false, kandidat = false, iHandtak = false;

    const kroppen = () => s.querySelector(".sheetbody");
    const kontroll = el => el && el.closest("input, textarea, select, button, a, [contenteditable]");

    function start(mål, y) {
      iHandtak = !!(mål && mål.closest(".grabsone"));
      if (!iHandtak) {
        // Står du i et felt, skriver du — da skal ikke arket flytte seg.
        if (kontroll(mål)) return false;
        // Ellers: er du øverst, drar du hele arket, uansett hvor du tar
        // tak. Er du lenger nede, skroller du.
        const k = kroppen();
        if (k && k.scrollTop > 0) return false;
      }
      kandidat = true; drar = false; startY = y; dy = 0;
      return true;
    }

    function beveg(y, kanStoppe) {
      if (!kandidat) return false;
      const d = y - startY;
      if (!drar) {
        const terskel = iHandtak ? 3 : 10;
        if (d < terskel) { if (d < -terskel) kandidat = false; return false; }
        // Har innholdet rukket å skrolle i mellomtiden, er dette en skroll.
        const k = kroppen();
        if (!iHandtak && k && k.scrollTop > 0) { kandidat = false; return false; }
        drar = true;
        s.classList.add("dragging");
      }
      dy = Math.max(0, d);
      s.style.transform = `translateY(${dy}px)`;
      return kanStoppe;
    }

    /* Slipper du langt nok nede, skal arket gli ut av skjermen — ikke
       forsvinne i samme sekund. Bakgrunnen lysner i samme takt, så det
       ser ut som det legger seg fra deg. */
    function lukkArkAnimert() {
      const bg = $("sheetBg");
      s.style.transform = "translateY(100%)";
      bg.style.transition = "background .24s ease-out";
      bg.style.background = "rgba(9,15,22,0)";
      setTimeout(() => {
        closeSheet();
        bg.style.transition = "";
        bg.style.background = "";
      }, 230);
    }

    function slutt() {
      kandidat = false;
      if (!drar) return;
      drar = false;
      s.classList.remove("dragging");
      if (dy > 100) lukkArkAnimert();
      else s.style.transform = "";
    }

    // Berøring
    s.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) return;
      start(e.target, e.touches[0].clientY);
    }, { passive: true });

    s.addEventListener("touchmove", e => {
      if (beveg(e.touches[0].clientY, true) && e.cancelable) e.preventDefault();
    }, { passive: false });

    s.addEventListener("touchend", slutt);
    s.addEventListener("touchcancel", slutt);

    // Mus
    s.addEventListener("mousedown", e => { if (e.button === 0) start(e.target, e.clientY); });
    window.addEventListener("mousemove", e => { if (kandidat) beveg(e.clientY, false); });
    window.addEventListener("mouseup", slutt);
  })();

  function sheetPlace(id) {
    const p = S.trip.places[id];
    if (!p) return;
    const leder = S.trip.role === "leader";
    openSheet(`
      <div class="eyebrow">${esc(p.kind)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="addr">${esc(p.addr || "Ingen adresse lagt inn")}</div>
      ${trygLenke(p.url) ? `<div class="addr"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a></div>` : ""}
      ${p.addr ? `<div class="acts">
        ${kartKnapp(p, "primary")}
      </div>` : ""}
      ${leder ? `<form id="adrForm" style="margin-top:16px">
        <div class="field">
          <label for="adrInn">${p.addr ? "Endre adresse" : "Legg inn adresse"}</label>
          <input id="adrInn" value="${esc(p.addr)}" placeholder="Gate, postnummer, sted">
        </div>
        <button class="btn primary" style="width:100%" type="submit">Lagre adressen</button>
      </form>` : ""}
      <button class="btn close" data-close>Lukk</button>`);

    if (leder) $("adrForm").addEventListener("submit", async e => {
      e.preventDefault();
      try {
        await Api.updatePlace(id, { addr: $("adrInn").value.trim() });
        closeSheet();
        await openTrip(S.trip.id);
        toast("Adressen er lagret.");
      } catch { toast("Klarte ikke lagre adressen."); }
    });
  }

  /* Påmelding på ett punkt. Deltakerne ser hvem som skal, og hvor mange
     plasser som er igjen — det er det folk spør om i chatten ellers. */
  function paameldingsboks(it) {
    const folk = Api.paameldte(it.id);
    const jeg = folk.some(p => p.meg);
    const igjen = it.plasser == null ? null : it.plasser - folk.length;
    const fullt = igjen !== null && igjen <= 0 && !jeg;
    const chat = it.paaChat ? S.trip.channels.find(c => c.id === it.paaChat) : null;

    return `<div class="paaboks">
      <div class="paatopp">
        <div>
          <b>Påmelding</b>
          <small>${folk.length}${it.plasser ? " av " + it.plasser : ""} påmeldt${
            igjen !== null && igjen > 0 ? ` · ${igjen} ${igjen === 1 ? "plass" : "plasser"} igjen` : ""}</small>
        </div>
        ${jeg ? '<span class="tag moss">du er påmeldt</span>'
              : fullt ? '<span class="tag amber">fullt</span>' : ""}
      </div>

      ${folk.length ? `<div class="paafolk">${folk
        .map(p => `<span class="paanavn${p.meg ? " min" : ""}">${esc(p.navn)}</span>`).join("")}</div>`
        : `<p class="muted" style="margin:8px 0 0">Ingen har meldt seg på ennå.</p>`}

      ${chat && jeg ? `<button class="linkbtn" style="margin-top:10px" data-openchat="${esc(chat.id)}">
        Åpne chatten for de påmeldte ›</button>` : ""}

      <button class="btn ${jeg ? "" : "primary"}" style="width:100%;margin-top:12px"
        data-paa="${esc(it.id)}" data-av="${jeg ? "1" : ""}" ${fullt ? "disabled" : ""}>
        ${jeg ? "Meld deg av" : fullt ? "Fullt" : "Meld deg på"}</button>
      ${!jeg && chat ? `<p class="muted" style="margin-top:7px">Melder du deg på, blir du lagt til i
        chatten «${esc(chat.name)}».</p>` : ""}
    </div>`;
  }

  /* Ett programpunkt: kart for alle, og endring for reiseledere. */
  function sheetItem(itemId) {
    const dag = S.trip.days.find(d => d.items.some(i => i.id === itemId));
    const it = dag && dag.items.find(i => i.id === itemId);
    if (!it) return;
    const p = it.place ? S.trip.places[it.place] : null;
    const leder = S.trip.role === "leader";

    openSheet(`
      <div class="eyebrow">${esc(dag.label)}${it.t ? " · " + esc(tidTekst(it)) : ""}</div>
      <h3>${esc(it.title)}</h3>
      ${p ? `<div class="addr">${esc(p.name)}${p.addr ? " · " + esc(p.addr) : " · ingen adresse"}</div>` : ""}
      ${it.note ? `<div class="addr">${esc(it.note)}</div>` : ""}
      ${it.paamelding ? paameldingsboks(it) : ""}
      ${p && p.addr ? `<div class="acts">
        ${kartKnapp(p, "primary")}
      </div>` : ""}

      ${leder ? `
        <form id="itemForm" style="margin-top:18px;border-top:1px solid var(--line-soft);padding-top:16px">
          <div class="eyebrow" style="margin-bottom:10px">Endre punktet</div>
          <div class="field"><label for="eTid">Klokkeslett</label>
            <input id="eTid" type="time" value="${esc(it.t)}">
            <small style="color:var(--ink-3);display:block;margin-top:5px">La stå tomt hvis tiden ikke er bestemt.</small></div>
          <div class="field"><label for="eSlutt">Slutter</label><input id="eSlutt" type="time" value="${esc(slutt(it) || "")}"></div>
          <div class="field"><label for="eTittel">Hva skjer</label><input id="eTittel" value="${esc(it.title)}"></div>
          <div class="field"><label for="eSted">Sted</label>
            <select id="eSted" class="select">
              <option value="">Ingen / ikke stedfestet</option>
              ${placeOptions(it.place)}
              <option value="__new">+ Nytt sted…</option>
            </select></div>
          <div id="eNyttSted" hidden>
            <div class="field"><label for="eNavn">Navn på stedet</label><input id="eNavn"></div>
            <div class="field"><label for="eAdr">Adresse</label><input id="eAdr" placeholder="Gate, postnummer, sted"></div>
          </div>
          <div class="field"><label for="eNotat">Notat</label><input id="eNotat" value="${esc(it.note)}"></div>

          <label class="pick" style="margin-bottom:10px">
            <input type="checkbox" id="ePaa" ${it.paamelding ? "checked" : ""}>
            <span><b>Påmelding</b><br>
              <small>For punkter der ikke alle skal være med. Deltakerne melder seg på selv,
                og alle ser hvem som skal.</small></span>
          </label>

          <div id="ePaaValg" ${it.paamelding ? "" : "hidden"}>
            <div class="field"><label for="ePlasser">Plasser</label>
              <input id="ePlasser" type="number" min="1" max="999" inputmode="numeric"
                     value="${it.plasser == null ? "" : it.plasser}" placeholder="Ingen grense">
              <small style="display:block;margin-top:5px;font-size:12.5px;color:var(--ink-3)">
                La stå tomt hvis alle som vil kan bli med. Er det fullt, slipper ingen flere inn.</small>
            </div>
            <label class="pick" style="margin-bottom:10px">
              <input type="checkbox" id="ePaaChat" ${it.paaChat ? "checked" : ""}>
              <span><b>Egen chat for de påmeldte</b><br>
                <small>${it.paaChat
                  ? "Chatten finnes. Skrur du av, blir den stående, men nye påmeldte legges ikke til."
                  : "Lager en privat chat. Den som melder seg på blir lagt til, og tatt ut igjen hvis hen melder seg av."}</small></span>
            </label>
          </div>

          <p class="err" id="eErr" hidden></p>
          <button class="btn primary big" type="submit" id="eLagre">Lagre endringene</button>
        </form>
        <button class="btn danger" style="width:100%;margin-top:10px" data-delitem="${esc(it.id)}">Slett punktet</button>
      ` : ""}
      <button class="btn close" data-close>Lukk</button>`);

    if (!leder) return;

    $("eSted").addEventListener("change", e => {
      $("eNyttSted").hidden = e.target.value !== "__new";
    });

    $("ePaa").addEventListener("change", e => {
      $("ePaaValg").hidden = !e.target.checked;
    });

    $("itemForm").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = $("eLagre"), err = $("eErr");
      btn.disabled = true; btn.innerHTML = prikker() + " Lagrer";
      try {
        let placeId = $("eSted").value || null;
        if (placeId === "__new") {
          const navn = $("eNavn").value.trim();
          if (!navn) throw new Error("Stedet trenger et navn.");
          placeId = await Api.addPlace(S.trip.id, {
            name: navn, addr: $("eAdr").value.trim(), kind: "Sted"
          });
        }
        const paaPaa = $("ePaa").checked;
        const vilChat = paaPaa && $("ePaaChat").checked;

        // Chatten lages først når noen faktisk vil ha den, og bare én
        // gang — skrur man av og på igjen, skal den gamle brukes.
        let chatId = it.paaChat || null;
        let nyChat = null;
        if (vilChat && !chatId) {
          chatId = nyChat = await Api.addChannel(
            S.trip.id, ($("eTittel").value.trim() || it.title).slice(0, 60), "Påmeldte", true, []);
        }

        try {
          await Api.updateItem(it.id, {
            t: $("eTid").value,
            minutter: minutterTil($("eTid").value, $("eSlutt").value),
            title: $("eTittel").value.trim() || it.title,
            placeId,
            note: $("eNotat").value.trim(),
            paamelding: paaPaa,
            plasser: paaPaa ? $("ePlasser").value : null,
            paaChat: vilChat ? chatId : null
          });
        } catch (e3) {
          // Rakk vi å lage chatten før lagringen feilet, skal den ikke bli
          // stående igjen — ellers får man en ny for hvert forsøk.
          if (nyChat) await Api.deleteChannel(nyChat).catch(() => {});
          throw e3;
        }
        closeSheet();
        await openTrip(S.trip.id);
        toast("Punktet er oppdatert.");
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Lagre endringene";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }


  function sheetTrips() {
    const rader = () => S.trips.map(t => `<button class="listrow" data-opentrip="${esc(t.id)}" aria-current="${t.id === S.trip.id}">
      <div class="grow"><div class="nm">${esc(t.name)}</div><div class="sub">${esc(t.dates || t.org || "")}</div></div>
      <span class="chev">${ICON.chev}</span></button>`).join("");
    const rows = rader();

    // Er lista ikke hentet ennå, fylles den inn her når den kommer. Før
    // ble «Henter turene dine» stående til arket ble lukket.
    if (!rows) {
      Api.myTrips().then(t => { S.trips = t; })
        .catch(() => { /* uten nett har vi ingen liste å vise */ })
        .then(() => {
          S.turerHentet = true;
          const liste = $("turliste");
          if (!liste) return;
          liste.innerHTML = rader()
            || `<p class="muted" style="padding:12px 0">Fant ingen turer på denne kontoen.</p>`;
        });
    }

    openSheet(`<h3>Dine turer</h3>
      <div class="list" id="turliste" style="margin-top:8px">${rows || venter("Henter turene dine")}</div>
      <div class="stack" style="margin-top:12px">
        <button class="btn" data-sheet="jointrip">Bli med på en ny tur</button>
        <button class="btn" data-sheet="newtrip">Lag en ny tur</button>
      </div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  function sheetJoinTrip() {
    openSheet(`<h3>Bli med på en ny tur</h3>
      <p class="muted" style="margin:6px 0 14px">Skriv turkoden du fikk av reiselederen.</p>
      <form id="joinTripForm">
        <div class="field"><label for="jCode">Turkode</label>
          <input id="jCode" autocapitalize="characters" spellcheck="false" class="mono" style="text-transform:uppercase"></div>
        <p class="err" id="jErr" hidden></p>
        <button class="btn primary big" type="submit">Bli med</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("joinTripForm").addEventListener("submit", async e => {
      e.preventDefault();
      const p = Api.getProfile();
      try {
        const trip = await Api.joinByCode($("jCode").value, p ? p.name : "Deltaker");
        closeSheet();
        S.trips = await Api.myTrips().catch(() => S.trips);
        await openTrip(trip.id);
        toast("Du er med på " + trip.name);
      } catch (err) {
        $("jErr").textContent = err.message; $("jErr").hidden = false;
      }
    });
  }

  function sheetNewTrip() {
    const p = Api.getProfile();
    const tplOptions = TEMPLATES.map(t =>
      `<label class="pick"><input type="radio" name="tpl" value="${esc(t.key)}">
        <span><b>${esc(t.name)}</b> — ${esc(t.lengthLabel)}<br><small>${esc(t.blurb)}</small></span></label>`).join("");

    openSheet(`<h3>Lag en ny tur</h3>
      <p class="muted" style="margin:6px 0 14px">Du blir reiseleder og får en turkode å dele ut.</p>
      <form id="newTripForm">
        ${p ? "" : `<div class="field"><label for="tFirst">Ditt fornavn</label><input id="tFirst"></div>
                    <div class="field"><label for="tLast">Ditt etternavn</label><input id="tLast"></div>`}
        <div class="field"><label for="tName">Navn på turen</label><input id="tName" placeholder="Berlin 2027"></div>
        <div class="field"><label for="tOrg">Klasse eller gruppe</label><input id="tOrg" placeholder="2STB Nordvang vgs"></div>
        <div class="field">
          <label>Start med</label>
          <div class="picks">
            <label class="pick"><input type="radio" name="tpl" value="" checked>
              <span><b>Tomt program</b><br><small>Du legger inn dagene selv.</small></span></label>
            ${tplOptions}
          </div>
        </div>
        <p class="err" id="tErr" hidden></p>
        <button class="btn primary big" type="submit" id="tSubmit">Opprett turen</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("newTripForm").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = $("tSubmit");
      const err = $("tErr");
      let prof = Api.getProfile();
      if (!prof) {
        const f = $("tFirst").value.trim(), l = $("tLast").value.trim();
        if (!f || !l) { err.textContent = "Skriv navnet ditt."; err.hidden = false; return; }
        prof = Api.setProfile(f, l);
      }
      const name = $("tName").value.trim();
      if (!name) { err.textContent = "Turen trenger et navn."; err.hidden = false; return; }

      const key = (document.querySelector('input[name="tpl"]:checked') || {}).value;
      const tpl = TEMPLATES.find(t => t.key === key) || null;

      btn.disabled = true; btn.innerHTML = prikker() + (tpl ? " Lager turen og programmet" : " Lager turen");
      try {
        const plan = tpl ? templateDates(tpl) : null;

        const trip = await Api.createTrip({
          name, org: $("tOrg").value.trim(), dates: "", leaderName: prof.name
        });
        if (tpl) await Api.applyTemplate(trip.id, tpl, plan.dates);

        closeSheet();
        S.trips = await Api.myTrips().catch(() => S.trips);
        S.tab = "program";
        await openTrip(trip.id);
        toast("Turen er laget. Kode: " + trip.code);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Opprett turen";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  async function sheetNewChannel() {
    openSheet(`<h3>Ny chat i ${esc(S.trip.name)}</h3>
      <p class="muted" style="margin:6px 0 14px">For eksempel en gruppe som skal et annet sted enn resten.</p>
      <form id="newChForm">
        <div class="field"><label for="cName">Navn på chatten</label><input id="cName" placeholder="Gruppe Eiffeltårnet"></div>
        <div class="field"><label for="cSub">Kort beskrivelse</label><input id="cSub" placeholder="Onsdag"></div>
        <div class="field">
          <label>Hvem skal se den</label>
          <div class="picks">
            <label class="pick"><input type="radio" name="priv" value="" checked>
              <span><b>Hele turen</b><br><small>Alle som er med på turen kan lese og skrive.</small></span></label>
            <label class="pick"><input type="radio" name="priv" value="1">
              <span><b>Bare de jeg velger</b><br><small>Usynlig for alle andre — også for reiseledere.</small></span></label>
          </div>
        </div>
        <div class="field" id="memberPick" hidden>
          <label>Velg deltakere</label>
          <div id="memberList" class="memberlist">${venter("Henter deltakere")}</div>
        </div>
        <p class="err" id="chErr" hidden></p>
        <button class="btn primary big" type="submit" id="chSubmit">Opprett chat</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    let people = [];
    Api.tripMembers(S.trip.id).then(list => {
      people = list.filter(p => !p.me);
      const box = $("memberList");
      if (!box) return;
      box.innerHTML = people.length
        ? people.map(p => `<label class="person">
            <input type="checkbox" value="${esc(p.id)}">
            <span>${esc(p.name)}${p.role === "leader" ? ' <em>reiseleder</em>' : ""}</span></label>`).join("")
        : `<p class="muted" style="padding:10px">Ingen andre har blitt med på turen ennå. Du kan legge dem til senere.</p>`;
    }).catch(() => {
      const box = $("memberList");
      if (box) box.innerHTML = `<p class="muted" style="padding:10px">Klarte ikke hente deltakerlista.</p>`;
    });

    document.querySelectorAll('input[name="priv"]').forEach(r =>
      r.addEventListener("change", () => {
        $("memberPick").hidden = !document.querySelector('input[name="priv"]:checked').value;
      }));

    $("newChForm").addEventListener("submit", async e => {
      e.preventDefault();
      const name = $("cName").value.trim();
      const err = $("chErr"), btn = $("chSubmit");
      if (!name) { err.textContent = "Chatten trenger et navn."; err.hidden = false; return; }
      const isPrivate = Boolean(document.querySelector('input[name="priv"]:checked').value);
      const ids = isPrivate
        ? [...document.querySelectorAll("#memberList input:checked")].map(c => c.value)
        : [];
      btn.disabled = true; btn.textContent = "Oppretter…";
      try {
        const id = await Api.addChannel(S.trip.id, name, $("cSub").value.trim(), isPrivate, ids);
        Api.setLastChannel(S.trip.id, id);
        closeSheet();
        await openTrip(S.trip.id);
        S.tab = "chat"; await openChat(id);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Opprett chat";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  /* Samme regel som i basen: en åpen chat hører til reiselederen, en
     privat til dem som er med i den. Appen viser bare knappen til dem
     det gjelder — basen nekter uansett. */
  const kanDoppe = ch =>
    Boolean(ch) && (ch.private ? true : S.trip.role === "leader");

  /* En oppslagstavle har ikke et skrivefelt for dem som ikke skal
     skrive. Et felt som avviser deg når du trykker send er verre enn
     ingen felt: du har alt skrevet meldingen. */
  const kanSkrive = ch =>
    Boolean(ch) && (!ch.bareLedere || S.trip.role === "leader");


  function sheetAddDay() {
    const last = S.trip.days[S.trip.days.length - 1];
    let suggested = today();
    if (last) { const d = new Date(last.date + "T12:00:00"); d.setDate(d.getDate() + 1); suggested = d.toISOString().slice(0, 10); }

    openSheet(`<h3>Legg til dag</h3>
      <form id="addDayForm">
        <div class="field"><label for="dDate">Dato</label><input id="dDate" type="date" value="${suggested}"></div>
        <p class="err" id="dErr" hidden></p>
        <button class="btn primary big" type="submit">Legg til</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("addDayForm").addEventListener("submit", async e => {
      e.preventDefault();
      const date = $("dDate").value;
      if (!date) return;
      try {
        await Api.addDay(S.trip.id, date);
        closeSheet();
        S.day = date;
        await openTrip(S.trip.id);
      } catch (err) {
        $("dErr").textContent = String(err.message).includes("duplicate") ? "Den datoen finnes allerede." : err.message;
        $("dErr").hidden = false;
      }
    });
  }

  function placeOptions(selected) {
    return Object.values(S.trip.places)
      .sort((a, b) => a.name.localeCompare(b.name, "nb"))
      .map(p => `<option value="${esc(p.id)}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join("");
  }

  function sheetAddItem(dayId) {
    const day = S.trip.days.find(d => d.id === dayId);
    openSheet(`<h3>Nytt programpunkt</h3>
      <p class="muted" style="margin:6px 0 14px">${esc(day ? day.label : "")}</p>
      <form id="addItemForm">
        <div class="field"><label for="iTime">Klokkeslett</label><input id="iTime" type="time" value="09:00"></div>
        <div class="field"><label for="iSlutt">Slutter</label><input id="iSlutt" type="time">
          <small style="display:block;margin-top:5px;font-size:12.5px;color:var(--ink-3)">
            Valgfritt. Overlapper to punkter i tid, merker appen dem som samtidige.</small></div>
        <div class="field"><label for="iTitle">Hva skjer</label><input id="iTitle" placeholder="Omvisning Berlinmuren"></div>
        <div class="field">
          <label for="iPlace">Sted</label>
          <select id="iPlace" class="select">
            <option value="">Ingen / ikke stedfestet</option>
            ${placeOptions(null)}
            <option value="__new">+ Nytt sted…</option>
          </select>
        </div>
        <div id="newPlaceFields" hidden>
          <div class="field"><label for="pName">Navn på stedet</label><input id="pName" placeholder="Gedenkstätte Berliner Mauer"></div>
          <div class="field"><label for="pAddr">Adresse</label><input id="pAddr" placeholder="Bernauer Straße 111, 13355 Berlin"></div>
          <div class="field"><label for="pKind">Type</label>
            <select id="pKind" class="select">
              <option>Sted</option><option>Hotell</option><option>Museum</option>
              <option>Attraksjon</option><option>Stasjon</option><option>Flyplass</option><option>Restaurant</option>
            </select></div>
          <p class="muted" style="margin:-4px 0 14px">Adressen er det kartet navigerer til — skriv den så nøyaktig du kan.</p>
        </div>
        <div class="field"><label for="iNote">Notat (valgfritt)</label><input id="iNote" placeholder="Møtes igjen 13:45"></div>
        <p class="err" id="iErr" hidden></p>
        <button class="btn primary big" type="submit" id="iSubmit">Legg til punktet</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("iPlace").addEventListener("change", e => {
      $("newPlaceFields").hidden = e.target.value !== "__new";
    });

    $("addItemForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("iErr"), btn = $("iSubmit");
      const title = $("iTitle").value.trim();
      if (!title) { err.textContent = "Skriv hva som skjer."; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Lagrer…";
      try {
        let placeId = $("iPlace").value || null;
        if (placeId === "__new") {
          const pn = $("pName").value.trim();
          if (!pn) throw new Error("Stedet trenger et navn.");
          placeId = await Api.addPlace(S.trip.id, {
            name: pn, addr: $("pAddr").value.trim(), kind: $("pKind").value
          });
        }
        await Api.addItem(S.trip.id, dayId, {
          t: $("iTime").value, title, placeId, note: $("iNote").value.trim(),
          minutter: minutterTil($("iTime").value, $("iSlutt").value)
        });
        closeSheet();
        await openTrip(S.trip.id);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Legg til punktet";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  function sheetHotel(dayId) {
    const day = S.trip.days.find(d => d.id === dayId);
    openSheet(`<h3>Hotell ${esc(day ? day.label : "")}</h3>
      <p class="muted" style="margin:6px 0 14px">Dette er stedet appen mener når noen skriver «hotellet» denne dagen.</p>
      <form id="hotelForm">
        <div class="field">
          <label for="hPlace">Velg sted</label>
          <select id="hPlace" class="select">
            <option value="">Ingen</option>
            ${placeOptions(day ? day.hotel : null)}
            <option value="__new">+ Nytt hotell…</option>
          </select>
        </div>
        <div id="hNewFields" hidden>
          <div class="field"><label for="hName">Navn</label><input id="hName" placeholder="Hotel Moabit Plaza"></div>
          <div class="field"><label for="hAddr">Adresse</label><input id="hAddr" placeholder="Stromstraße 62, 10551 Berlin"></div>
        </div>
        <p class="err" id="hErr" hidden></p>
        <button class="btn primary big" type="submit">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("hPlace").addEventListener("change", e => { $("hNewFields").hidden = e.target.value !== "__new"; });

    $("hotelForm").addEventListener("submit", async e => {
      e.preventDefault();
      try {
        let id = $("hPlace").value || null;
        if (id === "__new") {
          const n = $("hName").value.trim();
          if (!n) throw new Error("Hotellet trenger et navn.");
          id = await Api.addPlace(S.trip.id, { name: n, addr: $("hAddr").value.trim(), kind: "Hotell" });
        }
        await Api.setHotel(dayId, id);
        closeSheet();
        await openTrip(S.trip.id);
      } catch (e2) { $("hErr").textContent = e2.message; $("hErr").hidden = false; }
    });
  }

  /* ───────────────── les program fra PDF ───────────────── */
  let forslag = null;   // siste forslag fra serveren, venter på godkjenning

  function sheetImportPdf() {
    openSheet(`<h3>Les inn program fra PDF</h3>
      <p class="muted" style="margin:6px 0 14px">
        Velg programmet, bussplanen eller billettene. Appen leser dem og viser et forslag
        du må godkjenne før noe legges inn.</p>
      <form id="pdfForm">
        <div class="field">
          <label for="pdfFiles">PDF-filer</label>
          <input id="pdfFiles" type="file" accept="application/pdf" multiple>
        </div>
        <p class="muted" style="margin:-4px 0 14px">Maks 5 filer, 8 MB hver.</p>
        <p class="err" id="pdfErr" hidden></p>
        <button class="btn primary big" type="submit" id="pdfSubmit">Les filene</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("pdfForm").addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("pdfFiles"), err = $("pdfErr"), btn = $("pdfSubmit");
      const valgte = [...(input.files || [])];
      if (!valgte.length) { err.textContent = "Velg minst én fil."; err.hidden = false; return; }

      err.hidden = true;
      btn.disabled = true; btn.innerHTML = prikker() + " Leser filene";
      try {
        const filer = [];
        for (const f of valgte) filer.push({ navn: f.name, data: await tilBase64(f) });
        const svar = await Api.lesProgramFraPdf(S.trip.id, filer);
        forslag = svar.forslag;
        visForslag(svar);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Les filene";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  function tilBase64(fil) {
    return new Promise((ok, feil) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(",")[1]);
      r.onerror = () => feil(new Error("Klarte ikke lese " + fil.name));
      r.readAsDataURL(fil);
    });
  }

  function visForslag(svar) {
    const dager = (forslag.dager || []).filter(d => d.dato);
    const utenDato = (forslag.dager || []).length - dager.length;
    const advarsler = (forslag.usikkert || []).slice();
    if (utenDato) advarsler.push(`${utenDato} dag(er) manglet dato og er utelatt.`);

    if (!dager.length) {
      openSheet(`<h3>Fant ikke noe program</h3>
        <p class="muted" style="margin:10px 0">Filen inneholdt ingen datoer.
        Er det en skannet PDF som bare er bilder, klarer ikke appen å lese den.</p>
        ${advarsler.length ? `<div class="card pad" style="padding-block:12px"><div class="eyebrow">Merknader</div>
          <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:var(--ink-2)">
            ${advarsler.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
        <button class="btn close" data-close>Lukk</button>`);
      return;
    }

    let utenTid = 0;
    let foreslatt = 0;
    const bolker = dager.map((d, i) => {
      const dag = Api.fmtDay(d.dato);

      const punkter = (d.punkter || []).map((p, j) => {
        if (!p.tid) utenTid++;
        if (p.adresseForslag && !p.stedAdresse) foreslatt++;
        return `<div class="imprad">
          <label class="impvelg">
            <input type="checkbox" data-punkt="${i}-${j}" checked>
            <span class="imptxt">
              ${p.tid ? `<b class="mono">${esc(p.tid)}</b> ` : ""}${esc(p.tittel)}
              ${p.stedNavn ? `<small>${esc(p.stedNavn)}${p.adresseForslag && !p.stedAdresse
                ? ` · <b style="color:var(--amber)">adresse foreslått</b>` : ""}</small>` : ""}
            </span>
          </label>
          ${p.tid ? "" : `<div class="imptid">
            <label for="tid-${i}-${j}">Klokkeslett — sto ikke i filen</label>
            <input type="time" id="tid-${i}-${j}" data-tid="${i}-${j}">
          </div>`}
        </div>`;
      }).join("");

      // Bare hotellet trenger adresse med én gang — det er det «hotellet»
      // i chatten slår opp mot. Andre steder kan fylles inn etterpå.
      const hotell = d.hotellNavn ? `
        <div class="hotellboks">
          <div class="hotellnavn">
            <span>${esc(d.hotellNavn)}</span>
            <button type="button" class="btn quiet" data-kopi="${esc(d.hotellNavn)}">Kopier navn</button>
          </div>
          ${d.hotellAdresse
            ? `<small>${esc(d.hotellAdresse)}</small>`
            : d.hotellAdresseForslag
            // Forslaget kom fra modellen, ikke fra heftet. Det står i feltet
            // så det er lett å godta — men merket, så ingen tror det er lest
            // ut av dokumentet.
            ? `<input data-hoteladr="${i}" value="${esc(d.hotellAdresseForslag)}">
               <small><b style="color:var(--amber)">Foreslått av appen</b> — sto ikke i filen.
               Sjekk at den stemmer før du godtar den, eller tøm feltet.</small>`
            : `<input data-hoteladr="${i}" placeholder="Lim inn adressen her">
               <small>Filen oppga ${d.hotellNettside ? "bare en nettlenke" : "ingen adresse"}.
               Kopier navnet, søk det opp i kart, og lim adressen inn her — ellers virker ikke veibeskrivelsen.</small>`}
        </div>` : "";

      return `<div style="margin-bottom:20px">
        <div class="eyebrow" style="margin-bottom:7px">${esc(dag.label)}</div>
        ${hotell}
        <div class="memberlist">${punkter || '<p class="muted" style="padding:10px">Ingen punkter.</p>'}</div>
      </div>`;
    }).join("");

    const antall = dager.reduce((n, d) => n + (d.punkter || []).length, 0);

    openSheet(`<h3>Forslag fra filen</h3>
      <p class="muted" style="margin:6px 0 14px">
        ${dager.length} dager og ${antall} punkter, i samme rekkefølge som i filen.</p>
      ${foreslatt ? `<div class="card pad" style="padding-block:12px;margin-bottom:14px;border-left:3px solid var(--amber)">
        <div class="eyebrow" style="color:var(--amber)">${foreslatt} adresser er foreslått av appen</div>
        <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">De sto ikke i filen. Appen har
        fylt dem inn for steder den mener er kjente nok til at adressen er sikker — men den kan ta
        feil, og da sender veibeskrivelsen folk feil sted. De er merket i lista under.</p></div>` : ""}
      ${utenTid ? `<div class="card pad" style="padding-block:12px;margin-bottom:14px;border-left:3px solid var(--blue)">
        <div class="eyebrow" style="color:var(--blue-ink)">${utenTid} punkter uten klokkeslett</div>
        <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">Filen oppga ingen tid for disse.
        De beholder rekkefølgen sin uansett. Du kan fylle inn tid nå, eller senere.</p></div>` : ""}
      ${advarsler.length ? `<div class="card pad" style="padding-block:12px;margin-bottom:16px;border-left:3px solid var(--amber)">
        <div class="eyebrow" style="color:var(--amber)">Appen er usikker på</div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">
          ${advarsler.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
      ${bolker}
      <p class="err" id="impErr" hidden></p>
      <button class="btn primary big" id="impSubmit">Legg inn i programmet</button>
      <button class="btn close" data-close>Avbryt</button>`);

    $("impSubmit").addEventListener("click", () => leggInnForslag(dager));
  }

  async function leggInnForslag(dager) {
    const btn = $("impSubmit"), err = $("impErr");
    const GENERISK = /^(hotellet|hotell|lobbyen|lobby|resepsjonen|rommet|bussen|egen hånd|ukjent)$/i;

    btn.disabled = true; btn.innerHTML = prikker() + " Legger inn";
    try {
      const kjente = {};
      for (const p of Object.values(S.trip.places)) kjente[p.name.toLowerCase()] = p.id;

      const stedId = async (navn, adresse, type, url) => {
        if (!navn || GENERISK.test(navn.trim())) return null;
        const n = navn.toLowerCase();
        if (kjente[n]) return kjente[n];
        const id = await Api.addPlace(S.trip.id, {
          name: navn, addr: adresse || "", kind: type || "Sted", url: url || ""
        });
        kjente[n] = id;
        return id;
      };

      for (let i = 0; i < dager.length; i++) {
        const d = dager[i];
        const valgte = (d.punkter || [])
          .map((p, j) => ({ p, j }))
          .filter(({ j }) => {
            const boks = document.querySelector(`[data-punkt="${i}-${j}"]`);
            return boks && boks.checked;
          });
        if (!valgte.length && !d.hotellNavn) continue;

        let dagId = (S.trip.days.find(x => x.date === d.dato) || {}).id;
        if (!dagId) dagId = await Api.addDay(S.trip.id, d.dato);

        if (d.hotellNavn) {
          const skrevet = document.querySelector(`[data-hoteladr="${i}"]`);
          const adr = d.hotellAdresse || (skrevet ? skrevet.value.trim() : "");
          const hid = await stedId(d.hotellNavn, adr, "Hotell", d.hotellNettside);
          if (hid) await Api.setHotel(dagId, hid);
        }

        // Rekkefølgen fra filen beholdes — den bærer mening når tiden mangler.
        let n = 10;
        for (const { p, j } of valgte) {
          const tidFelt = document.querySelector(`[data-tid="${i}-${j}"]`);
          const tid = p.tid || (tidFelt ? tidFelt.value : "");
          // Sto adressen i filen, vinner den. Ellers tar vi forslaget —
          // det er merket i lista du nettopp godkjente.
          const sid = await stedId(p.stedNavn, p.stedAdresse || p.adresseForslag, "Sted");
          await Api.addItem(S.trip.id, dagId, {
            t: /^\d{2}:\d{2}$/.test(tid) ? tid : null,
            title: p.tittel || "Programpunkt",
            placeId: sid,
            note: p.notat || "",
            sort: n
          });
          n += 10;
        }
      }

      forslag = null;
      closeSheet();
      await openTrip(S.trip.id);
      toast("Programmet er lagt inn.");
    } catch (e) {
      btn.disabled = false; btn.textContent = "Legg inn i programmet";
      err.textContent = e.message || "Klarte ikke legge inn alt.";
      err.hidden = false;
    }
  }




  /* Deltakere på turen, og hvem som er reiseleder. Egen side, ikke et
     ark: lista blir lang i en klasse på hundre, og et ark man kan dra ned
     midt i en rulling er bare i veien. */
  async function aapneDeltakere(fraHistorikk) {
    S.side = "deltakere";
    S.folk = null;
    S.folkFeil = false;
    if (!fraHistorikk) history.pushState({ side: "deltakere" }, "");
    render();

    try { S.folk = await Api.tripMembers(S.trip.id); }
    catch { S.folk = []; S.folkFeil = true; }
    if (S.side === "deltakere") render();
  }

  /* ───────── pakkeliste og sitteplasser ─────────
     Begge er egne sider, ikke ark: lista blir lang, og et setekart man
     skal sikte på er dårlig å ha i noe som kan dras ned. */
  /* En tur sitter ikke på én måte. Ned med fly, hjem med tog, og to
     busser mellom — hvert kjøretøy har sin egen bredde og sin egen
     midtgang, og derfor sitt eget kart. Typen er det eneste vi spør
     om; resten følger av den. */
  const TYPER = {
    buss:     { navn: "Buss",     bredde: 4, gang: 2 },
    minibuss: { navn: "Minibuss", bredde: 3, gang: 1 },
    bil:      { navn: "Bil",      bredde: 2, gang: 1 },
    tog:      { navn: "Tog",      bredde: 4, gang: 2 },
    fly:      { navn: "Fly",      bredde: 6, gang: 3 },
    baat:     { navn: "Båt",      bredde: 4, gang: 2 },
    annet:    { navn: "Annet",    bredde: 4, gang: 0 }
  };
  const oppsett = typ => TYPER[typ] || TYPER.annet;
  const setenavn = (nr, bredde) => Math.ceil(nr / bredde) + "ABCDEF"[(nr - 1) % bredde];

  /* Det er plass til ett ord i et sete. Fornavnet er det som skiller
     folk fra hverandre i en klasse, og det er det man leter etter. */
  const fornavn = navn => {
    const f = String(navn || "").trim().split(/\s+/)[0] || "";
    return f.length > 9 ? f.slice(0, 8) + "…" : f;
  };

  async function aapnePakk(fraHistorikk) {
    S.side = "pakk"; S.pakk = null; S.pakkFeil = false;
    if (!fraHistorikk) history.pushState({ side: "pakk" }, "");
    render();
    try { S.pakk = await Api.pakkeliste(S.trip.id); }
    catch { S.pakk = []; S.pakkFeil = true; }
    if (S.side === "pakk") render();
  }

  async function aapneSeter(fraHistorikk) {
    S.side = "seter"; S.setekart = null; S.seteFeil = false;
    if (!fraHistorikk) history.pushState({ side: "seter" }, "");
    render();
    try { S.setekart = await Api.setekart(S.trip.id); }
    catch { S.setekart = []; S.seteFeil = true; }
    if (S.side === "seter") render();
  }

  /* To deler, fordi de svarer på to ting. Reiselederens del er den samme
     for alle og sier hva turen krever. Din del er din egen, og ingen
     andre ser den — heller ikke reiselederen. Begge kan dras i den
     rekkefølgen du vil ha dem, så du kan samle klærne for seg. */
  function viewPakk() {
    const leder = S.trip.role === "leader";
    const liste = S.pakk;
    if (S.pakkFeil) return '<p class="muted">Klarte ikke hente pakkelista. Sjekk nettet og prøv igjen.</p>';
    if (!liste) return venter("Henter pakkelista");

    const alle = liste.felles.concat(liste.egne);
    const klart = alle.filter(p => p.kryss).length;

    const rad = (p, egen) => `<div class="pkrad" data-pid="${esc(p.id)}">
      <button class="pkhake ${p.kryss ? "av" : ""}" data-pakk="${esc(p.id)}"
        ${egen ? 'data-egen="1"' : ""} aria-pressed="${p.kryss}"
        aria-label="${p.kryss ? "Fjern krysset for" : "Kryss av"} ${esc(p.txt)}">${p.kryss ? ICON.hake : ""}</button>
      <span class="pknavn ${p.kryss ? "av" : ""}">${esc(p.txt)}</span>
      ${egen || leder ? `<button class="minibtn fare" data-slettpakk="${esc(p.id)}"
        ${egen ? 'data-egen="1"' : ""} aria-label="Slett ${esc(p.txt)}">✕</button>` : ""}
      <span class="draha" data-drag aria-label="Dra for å flytte">⠿</span>
    </div>`;

    const del = (tittel, under, punkter, egen, knapp) => `<div>
      <div class="eyebrow" style="margin-bottom:8px">${esc(tittel)}</div>
      ${punkter.length
        ? `<div class="gruppe"><div class="list pkliste" data-egen="${egen ? 1 : 0}">
            ${punkter.map(p => rad(p, egen)).join("")}</div></div>`
        : `<p class="muted" style="margin:0 0 10px">${esc(under)}</p>`}
      ${knapp}</div>`;

    return `
      <p class="muted" style="margin:0">${alle.length
        ? `${klart} av ${alle.length} klart. Det du krysser av er ditt — ingen andre ser det.`
        : leder ? "Lag lista her. Alle på turen ser punktene og krysser av for seg selv."
                : "Reiselederen har ikke lagt inn noe ennå. Du kan legge inn dine egne ting under."}</p>

      ${del("Fra reiselederen", leder
        ? "Ingen felles punkter ennå."
        : "Reiselederen har ikke lagt inn noe ennå.", liste.felles, false,
        leder ? `<button class="btn" style="width:100%" data-sheet="nyttpakk">Legg til felles punkt</button>` : "")}

      ${del("Mine egne ting", "Ingenting her ennå.", liste.egne, true,
        `<button class="btn" style="width:100%" data-sheet="nyttpakk" data-egen="1">Legg til mitt eget</button>`)}`;
  }

  async function lagrePakkRekkefolge(egen, ider) {
    const del = egen ? S.pakk.egne : S.pakk.felles;
    if (del.map(p => p.id).join() === ider.join()) return;   // ingenting flyttet seg
    const ny = ider.map(id => del.find(p => p.id === id)).filter(Boolean);
    if (egen) S.pakk.egne = ny; else S.pakk.felles = ny;
    try { await Api.pakkRekkefolge(ider, egen); }
    catch { toast("Klarte ikke lagre rekkefølgen."); await aapnePakk(true); }
  }

  function viewSeter() {
    const leder = S.trip.role === "leader";
    if (S.seteFeil) return '<p class="muted">Klarte ikke hente setekartene. Sjekk nettet og prøv igjen.</p>';
    const kart = S.setekart;
    if (!kart) return venter("Henter setekartene");

    const nyknapp = leder
      ? `<button class="btn big" data-nykj="1">Legg til kjøretøy</button>`
      : "";

    if (!kart.length) return `
      <p class="muted" style="margin:0">${leder
        ? "Legg inn hvert kjøretøy turen bruker — en buss, et fly, to minibusser. Alle velger sin egen plass i hvert av dem."
        : "Reiselederen har ikke satt opp noe setekart ennå."}</p>
      ${nyknapp}`;

    // Mangler du plass et sted, er det det eneste du trenger å vite her.
    const uten = kart.filter(k => !k.seter.some(s2 => s2.meg));
    return `
      <p class="muted" style="margin:0">${uten.length
        ? `Du mangler plass i ${uten.length === kart.length && kart.length === 1
            ? "kartet under" : `${uten.length} av ${kart.length}`}. Trykk på et ledig sete.`
        : "Du har plass i alle. Trykk på et ledig sete for å bytte."}</p>
      ${kart.map(k => kjoretoykort(k, leder)).join("")}
      ${nyknapp}`;
  }

  /* Ett kjøretøy: navnet, din plass, og kartet. Midtgangen tegnes som
     et tomrom i raden, ikke som et sete — ellers teller man feil når
     man leter etter 12C. */
  function kjoretoykort(k, leder) {
    const o = oppsett(k.typ);
    const tatt = new Map(k.seter.map(s2 => [s2.nr, s2]));
    const mitt = k.seter.find(s2 => s2.meg);
    const rader = Math.ceil(k.plasser / o.bredde);

    const rad = r => {
      const ut = [];
      for (let c = 0; c < o.bredde; c++) {
        const nr = r * o.bredde + c + 1;
        if (o.gang && c === o.gang) ut.push('<span class="gang" aria-hidden="true"></span>');
        if (nr > k.plasser) { ut.push('<span class="setet tom" aria-hidden="true"></span>'); continue; }
        const s2 = tatt.get(nr), min = Boolean(s2 && s2.meg);
        const plass = setenavn(nr, o.bredde);
        const hvem = min ? "Deg" : s2 ? fornavn(s2.hvem) : "";
        ut.push(`<button class="setet ${min ? "min" : s2 ? "tatt" : ""}"
          data-sete="${nr}" data-kj="${esc(k.id)}" ${s2 && !min ? "disabled" : ""}
          aria-label="${plass} i ${esc(k.navn)} — ${s2 ? esc(min ? "deg" : s2.hvem) : "ledig"}"
          ><b>${plass}</b>${hvem ? `<small>${esc(hvem)}</small>` : ""}</button>`);
      }
      return `<div class="seterad">${ut.join("")}</div>`;
    };

    // Din plass hører til i undertittelen, ikke i en egen kolonne: med et
    // langt kjøretøynavn ble de tre tingene stående og slåss om bredden.
    const status = mitt
      ? `du har ${setenavn(mitt.nr, o.bredde)}`
      : `${k.seter.length} tatt`;

    return `<div class="kjkort">
      <div class="kjtopp">
        <div class="grow"><b>${esc(k.navn)}</b>
          <small>${esc(o.navn)} · ${k.plasser} plasser · ${esc(status)}</small></div>
        ${leder ? `<button class="minibtn" data-endrekj="${esc(k.id)}"
          aria-label="Endre ${esc(k.navn)}">${ICON.blyant}</button>` : ""}
      </div>
      <div class="setekart">${Array.from({ length: rader }, (_, r) => rad(r)).join("")}</div>
    </div>`;
  }

  function sheetNyttPakk(egen) {
    openSheet(`<h3>${egen ? "Noe du selv må huske" : "Nytt felles punkt"}</h3>
      <p class="lede">${egen
        ? "Bare du ser dette punktet."
        : "Alle på turen får punktet i lista si."}</p>
      <form id="pakkForm">
        <div class="field"><label for="pkTxt">Hva skal med?</label>
          <input id="pkTxt" type="text" maxlength="80" placeholder="Pass" autocomplete="off"></div>
        <p class="err" id="pkErr" hidden></p>
        <button class="btn primary big" type="submit">Legg til</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("pakkForm").addEventListener("submit", async e => {
      e.preventDefault();
      const txt = $("pkTxt").value.trim();
      if (!txt) return;
      const del = (egen ? S.pakk.egne : S.pakk.felles) || [];
      const neste = del.reduce((h, p) => Math.max(h, p.sort || 0), 0) + 10;
      try {
        await Api.nyttPakkPunkt(S.trip.id, txt, neste, egen);
        closeSheet();
        await aapnePakk(true);
      } catch (err) {
        const e2 = $("pkErr"); e2.textContent = err.message; e2.hidden = false;
      }
    });
  }

  function sheetKjoretoy(id) {
    const k = id && (S.setekart || []).find(x => x.id === id);
    const typ = k ? k.typ : "buss";
    openSheet(`<h3>${k ? "Endre kjøretøy" : "Nytt kjøretøy"}</h3>
      <p class="lede">Typen bestemmer hvor bredt kartet står og hvor midtgangen går.</p>
      <form id="kjForm">
        <div class="field"><label for="kjNavn">Navn</label>
          <input id="kjNavn" type="text" maxlength="40" placeholder="Buss 1"
            value="${k ? esc(k.navn) : ""}" autocomplete="off"></div>
        <div class="field"><label for="kjTyp">Type</label>
          <select id="kjTyp" class="select">
            ${Object.entries(TYPER).map(([v, o]) =>
              `<option value="${v}"${v === typ ? " selected" : ""}>${o.navn} — ${o.bredde} i bredden</option>`).join("")}
          </select></div>
        <div class="field"><label for="kjAnt">Antall plasser</label>
          <input id="kjAnt" type="number" min="1" max="400" inputmode="numeric" value="${k ? k.plasser : 56}">
        </div>
        <p class="err" id="kjErr" hidden></p>
        <button class="btn primary big" type="submit" id="kjLagre">Lagre</button>
      </form>
      ${k ? `<button class="btn danger" style="width:100%;margin-top:10px"
        data-slettkj="${esc(k.id)}">Slett kjøretøyet</button>` : ""}
      <button class="btn close" data-close>Avbryt</button>`);

    $("kjForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("kjErr"), btn = $("kjLagre");
      const navn = $("kjNavn").value.trim();
      const plasser = parseInt($("kjAnt").value, 10);
      if (!navn) { err.textContent = "Gi kjøretøyet et navn."; err.hidden = false; return; }
      if (!plasser || plasser < 1 || plasser > 400) {
        err.textContent = "Antall plasser må være mellom 1 og 400."; err.hidden = false; return;
      }
      const felter = { navn, typ: $("kjTyp").value, plasser };
      btn.disabled = true; btn.textContent = "Lagrer…";
      try {
        if (k) await Api.endreKjoretoy(k.id, felter);
        else await Api.nyttKjoretoy(S.trip.id, felter);
        closeSheet();
        await aapneSeter(true);
        hentMegTall(true);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Lagre";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  function viewDeltakere() {
    const leder = S.trip.role === "leader";
    const folk = S.folk;

    const topp = `
      <p class="muted" style="margin:0">
        ${leder
          ? "Reiseledere kan endre programmet og lese inn PDF-er. Du kan gi rollen videre."
          : "Reiseledere kan endre programmet."}</p>
      ${leder ? `<label class="pick" style="margin-top:14px">
        <input type="checkbox" id="bilderPaa" ${S.trip.bilder ? "checked" : ""}>
        <span><b>Tillat bilder i chattene</b><br>
          <small>Bildene slettes automatisk 30 dager etter siste programdag.</small></span>
      </label>
      <label class="pick" style="margin-top:10px">
        <input type="checkbox" id="krevGodkjenning" ${S.trip.krevGodkjenning ? "checked" : ""}>
        <span><b>Krev godkjenning for å bli med</b><br>
          <small>Nye deltakere må slippes inn av en reiseleder. Turkoden alene holder ikke.</small></span>
      </label>` : ""}`;

    if (S.folkFeil) return `<div>${topp}</div><p class="muted">Klarte ikke hente deltakerlista.</p>`;
    if (!folk) return `<div>${topp}</div>${venter("Henter deltakere")}`;

    const ventende = folk.filter(p => p.venter);
    const med = folk.filter(p => !p.venter);
    const ledere = med.filter(p => p.role === "leader");

    return `
      <div>${topp}</div>

      ${ventende.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Venter på svar · ${ventende.length}</div>
        <div class="memberlist">${ventende.map(p => `
          <div class="person">
            <span>${esc(p.name)}</span>
            <span style="display:flex;gap:10px;flex:none">
              <button class="linkbtn" data-godkjenn="${esc(p.id)}">slipp inn</button>
              <button class="linkbtn" style="color:var(--danger)" data-avvis="${esc(p.id)}">avvis</button>
            </span>
          </div>`).join("")}</div>
      </div>` : ""}

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Med på turen · ${med.length}</div>
        <div class="memberlist">${med.map(p => `
          <div class="person">
            <span>${esc(p.name)}${p.me ? " <em>deg</em>" : ""}${p.role === "leader" ? ' <em>reiseleder</em>' : ""}</span>
            ${leder && !p.me && !p.skjult ? `<span style="display:flex;gap:10px;flex:none">
              ${p.role === "leader"
                ? (ledere.length > 1 ? `<button class="linkbtn" data-rolle="${esc(p.id)}" data-til="member">fjern rolle</button>` : "")
                : `<button class="linkbtn" data-rolle="${esc(p.id)}" data-til="leader">gjør til leder</button>`}
              <button class="linkbtn" style="color:var(--danger)" data-fjern="${esc(p.id)}" data-navn="${esc(p.name)}">fjern</button>
            </span>` : ""}
          </div>`).join("")}</div>
        ${leder ? `<p class="muted" style="margin-top:10px">Den som laget turen beholder lederrollen,
          og turen må alltid ha minst én.</p>` : ""}
      </div>`;
  }
  /* ───────────────── innlogging med e-post ─────────────────
     Egen side, ikke et ark: skjemaet er kort, men tastaturet tar halve
     skjermen på telefon, og i et ark lå overskriften under draghåndtaket.

     «start» er skjermen man møter først. E-post er hovedveien, fordi det
     er den eneste identiteten som overlever en ny telefon. Gjest ligger
     under — den krever ingenting, men bor bare i denne nettleseren. */
  function visAuth(modus) {
    appKlar();
    const start = modus === "start";
    const kobler = modus === "koble";
    const harAlt = kobler && !Api.erAnonym();

    $("joinScreen").hidden = true;
    $("appScreen").hidden = true;
    $("bootScreen").hidden = true;
    $("authScreen").hidden = false;

    $("authInner").innerHTML = `
      ${start ? `<div class="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path class="stamme" d="M11.5 8V21"/><path d="M5.8 10C7.1 9.6 8.1 8.8 11.4 8.05C13.7 7.5 15.6 5.9 17.8 4.85"/><circle cx="17.83" cy="4.83" r="1.83" fill="var(--merke)" stroke="none"/></svg>
        </div>` : `<button class="tilbake" id="authTilbake">${ICON.chevL} Tilbake</button>`}

      <h1>${start ? "TripMate" : harAlt ? "Bytt e-postadresse" : kobler ? "Sikre kontoen" : "Logg inn"}</h1>
      <p class="lede">${start
        ? "Program, beskjeder og veibeskrivelse for klasseturen."
        : harAlt
        ? `Du er innlogget som <b>${esc(Api.minEpost() || "")}</b>. Skriv den nye adressen, så sender vi en kode dit.`
        : kobler
        ? "Du beholder turene og rollene dine. Med e-post kan du logge inn på en annen telefon, og mister ikke alt om denne blir borte."
        : "Vi sender en kode på e-post. Ingen passord å huske."}</p>

      <form id="authForm" novalidate>
        <div class="field">
          <label for="aPost">E-post</label>
          <input id="aPost" type="email" inputmode="email" autocomplete="email"
                 autocapitalize="none" spellcheck="false" placeholder="navn@eksempel.no">
          <small style="display:block;margin-top:6px;font-size:12.5px;color:var(--ink-3)">
            Bruk en privat adresse — skolemailen blokkerer ofte koden.</small>
        </div>
        <p class="err" id="aFeil" hidden></p>
        <button class="btn primary big" type="submit" id="aSend">
          ${start ? "Fortsett med e-post" : "Send kode"}</button>
      </form>

      ${start ? `
        <div class="skille"><span>eller</span></div>
        <button class="btn" style="width:100%" id="gjestKnapp">Fortsett som gjest</button>
        <p class="muted" style="margin-top:9px;text-align:center">
          Som gjest bor kontoen bare på denne telefonen.</p>
        <p style="text-align:center;margin-top:22px;font-size:14.5px;color:var(--ink-2)">
          Er du reiseleder? <button type="button" class="linkbtn" id="gjestOgLag">Lag en ny tur</button>
        </p>` : ""}`;

    if (!start) setTimeout(() => $("aPost") && $("aPost").focus(), 100);

    const gjest = $("gjestKnapp");
    if (gjest) gjest.addEventListener("click", () => { S.fraStart = true; showJoin(); });

    const lagTur = $("gjestOgLag");
    if (lagTur) lagTur.addEventListener("click", () => { S.fraStart = true; showJoin(); sheetNewTrip(); });

    $("authForm").addEventListener("submit", async e => {
      e.preventDefault();
      const epost = $("aPost").value.trim();
      const feil = $("aFeil"), knapp = $("aSend");
      if (!epost.includes("@") || !epost.includes(".")) {
        feil.textContent = "Skriv en gyldig e-postadresse."; feil.hidden = false; return;
      }
      feil.hidden = true;
      knapp.disabled = true; knapp.innerHTML = prikker() + " Sender";
      try {
        if (kobler) await Api.koblePaaEpost(epost);
        else await Api.sendKode(epost);
        visAuthKode(epost, kobler);
      } catch (e2) {
        knapp.disabled = false; knapp.textContent = start ? "Fortsett med e-post" : "Send kode";
        feil.textContent = e2.message; feil.hidden = false;
      }
    });
  }

  function visAuthKode(epost, kobler) {
    $("authInner").innerHTML = `
      <button class="tilbake" id="authTilbake">${ICON.chevL} Bruk en annen adresse</button>
      <h1>Sjekk e-posten</h1>
      <p class="lede">Vi sendte en kode til <b>${esc(epost)}</b>. Den er gyldig i en time.</p>
      <p class="soppelpost"><b>Finner du den ikke?</b> Se i søppelpost. Skolemailen blokkerer
        ofte engangskoder, eller legger dem der — bruk heller Gmail, iCloud eller Outlook.</p>

      <form id="kodeForm" novalidate>
        <div class="field">
          <label for="aKode">Kode</label>
          <input id="aKode" inputmode="numeric" autocomplete="one-time-code" maxlength="8"
                 class="kodefelt" placeholder="00000000" enterkeyhint="go">
        </div>
        <p class="err" id="kFeil" hidden></p>
        <button class="btn primary big" type="submit" id="kSend">Logg inn</button>
      </form>`;

    setTimeout(() => $("aKode") && $("aKode").focus(), 100);

    // Åtte sifre med luft mellom seg blir bredere enn skjermen på en
    // liten telefon. Feltet krymper skriften heller enn å klippe koden.
    const kodefelt = $("aKode");
    kodefelt.addEventListener("input", () => {
      const rent = kodefelt.value.replace(/\D/g, "").slice(0, 8);
      if (rent !== kodefelt.value) kodefelt.value = rent;
      kodefelt.style.fontSize = rent.length > 6 ? "21px" : "";
      kodefelt.style.letterSpacing = rent.length > 6 ? ".22em" : "";
    });

    $("kodeForm").addEventListener("submit", async e => {
      e.preventDefault();
      // Limer du inn fra e-posten, følger det ofte med mellomrom eller
      // et linjeskift. Vi plukker ut sifrene og lar resten ligge.
      const kode = $("aKode").value.replace(/\D/g, "");
      const feil = $("kFeil"), knapp = $("kSend");
      if (kode.length < 6) { feil.textContent = "Skriv hele koden fra e-posten."; feil.hidden = false; return; }
      feil.hidden = true;
      knapp.disabled = true; knapp.innerHTML = prikker() + " Sjekker";
      try {
        if (kobler) {
          await Api.bekreftKobling(epost, kode);
          lukkAuth();
          toast("Kontoen er sikret med " + epost);
        } else {
          if (!(await gjestenGaarTapt())) {
            knapp.disabled = false; knapp.textContent = "Logg inn";
            return;
          }
          await Api.bekreftKode(epost, kode);
          $("authScreen").hidden = true;
          await etterInnlogging();
        }
      } catch (e2) {
        knapp.disabled = false; knapp.textContent = "Logg inn";
        feil.textContent = e2.message; feil.hidden = false;
      }
    });
  }

  /* Logger du inn som deg selv, blir gjestekontoen på telefonen slettet.
     Har den ingen turer, merker du ingenting. Har den turer, skal du få
     vite det før du mister dem — det finnes en annen vei, «Sikre kontoen
     med e-post», som beholder alt. */
  async function gjestenGaarTapt() {
    if (!Api.erAnonym()) return true;
    let turer = [];
    try { turer = await Api.myTrips(); } catch { return true; }
    if (!turer.length) return true;

    const ledet = turer.filter(t => t.role === "leader").length;
    return confirm(
      `Som gjest er du med på ${turer.length} tur${turer.length === 1 ? "" : "er"}` +
      (ledet ? `, og reiseleder for ${ledet} av dem` : "") + ".\n\n" +
      "Logger du inn med e-post nå, slettes gjestekontoen, og turene følger ikke med — " +
      "du må bli med på nytt med turkoden.\n\n" +
      "Vil du beholde dem, avbryt her og bruk «Sikre kontoen med e-post» på Meg-fanen i stedet."
    );
  }

  /* Tilbake dit man kom fra: appen om man er inne i en tur, ellers join. */
  function lukkAuth() {
    $("authScreen").hidden = true;
    if (S.trip) { $("appScreen").hidden = false; render(); }
    else showJoin();
  }

  async function etterInnlogging() {
    let p = Api.getProfile();
    if (!p) {
      const navn = await Api.hentNavnFraTurer().catch(() => null);
      if (navn) {
        const deler = navn.split(" ");
        p = Api.setProfile(deler[0] || navn, deler.slice(1).join(" "));
      }
    }
    const turer = await Api.myTrips().catch(() => []);
    S.trips = turer;
    if (turer.length) {
      await openTrip(Api.getLastTrip() && turer.some(t => t.id === Api.getLastTrip())
        ? Api.getLastTrip() : turer[0].id);
      toast("Velkommen tilbake.");
    } else {
      showJoin();
      toast("Du er logget inn. Bli med på en tur med turkoden.");
    }
  }
  /* ───────────────── varsler ─────────────────
     Tre nivåer, fordi «alt» er uutholdelig i en tur med hundre deltakere
     og «ingenting» gjør at du går glipp av oppmøtetidene. Standard er
     midt imellom: reiseledere, svar på dine egne meldinger, og meldinger
     som avtaler et møtested. Hver chat kan settes for seg. */
  const NIVAER = [
    ["alt", "Alt", "Hver eneste melding"],
    ["viktig", "Det viktige", "Reiseledere, svar til deg, og møtesteder"],
    ["ingen", "Ingenting", "Ingen varsler herfra"]
  ];

  /* Varsler har fått sin egen side, ikke et ark: her er det mange valg og
     en feilsøkingsdel, og et ark man kan dra ned midt i en liste med
     nedtrekksmenyer blir bare i veien. */
  async function aapneVarsler(fraHistorikk) {
    S.side = "varsler";
    // Statusen beholdes mens den sjekkes på nytt, så siden ikke blinker
    // gjennom et «henter» hver gang du åpner den.
    S.varselEnheter = null;
    S.varselTest = null;
    if (!fraHistorikk) history.pushState({ side: "varsler" }, "");
    render();

    S.varselStatus = await Api.varselStatus();
    try { await Api.lastVarselvalg(S.trip.id); } catch {}
    try { S.varselEnheter = await Api.varselEnheter(); } catch {}
    if (S.side === "varsler") render();
  }

  function lukkSide(fraHistorikk) {
    if (!S.side) return false;
    const forrige = S.side;
    S.side = null;
    if (forrige === "pakk" || forrige === "seter") hentMegTall(true);
    render();
    if (!fraHistorikk && history.state && history.state.side) gaaTilbake();
    return true;
  }

  /* Alt om én chat på ett sted: hvem som er med, hva den heter, og hva
     du vil varsles om herfra. Du kommer hit ved å trykke på navnet
     øverst i samtalen — der man leter etter det. */
  async function aapneChatside(channelId, fraHistorikk) {
    S.side = "chat";
    S.sideChat = channelId;
    S.chatFolk = null;
    if (!fraHistorikk) history.pushState({ side: "chat", chat: channelId }, "");
    render();

    try {
      const [alle, iChatten] = await Promise.all([
        Api.tripMembers(S.trip.id),
        Api.channelMembers(channelId).catch(() => null)
      ]);
      const ch = S.trip.channels.find(c => c.id === channelId);
      S.chatFolk = ch && ch.private && iChatten
        ? { med: alle.filter(p => iChatten.includes(p.id)), andre: alle.filter(p => !iChatten.includes(p.id)) }
        : { med: alle.filter(p => !p.venter), andre: [] };
    } catch { S.chatFolk = { med: [], andre: [], feil: true }; }
    if (S.side === "chat") render();
  }

  function viewChatside() {
    const ch = S.trip.channels.find(c => c.id === S.sideChat);
    if (!ch) return `<p class="muted">Fant ikke chatten.</p>`;
    const folk = S.chatFolk;
    const valg = Api.varselvalg();

    return `
      <div class="megkort">
        <span class="megava" style="background:${ch.private ? "var(--amber)" : "var(--blue)"}">
          ${ch.private ? "&#128274;" : ICON.chat}</span>
        <span class="grow">
          <b>${esc(ch.name)}</b>
          <small>${ch.private
            ? "Privat chat — bare de som står under, ser den"
            : ch.bareLedere
            ? "Oppslagstavle — alle på turen leser, reiseledere skriver"
            : "Åpen chat — alle på turen kan lese og skrive"}</small>
        </span>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Om chatten</div>
        <div class="card pad"><div class="list">
          ${kanDoppe(ch) ? `<button class="listrow" data-sheet="doppchat" data-chat="${esc(ch.id)}">
            <div class="grow"><div class="nm">Endre navn</div><div class="sub">${esc(ch.name)}</div></div>
            <span class="chev">${ICON.chev}</span></button>` : ""}
          ${S.trip.role === "leader" && !ch.private ? `<label class="listrow" style="cursor:pointer">
            <div class="grow"><div class="nm">Bare reiseledere kan skrive</div>
              <div class="sub">Alle leser. Deltakerne får ikke skrivefelt.</div></div>
            <input type="checkbox" class="bryter" data-chatskriv="${esc(ch.id)}"
              ${ch.bareLedere ? "checked" : ""}></label>` : ""}
          <div class="listrow" style="cursor:default">
            <div class="grow"><div class="nm">Varsler herfra</div>
              <div class="sub">Egne varsler for denne chatten</div></div>
            <select class="select minivalg" data-chatniva="${esc(ch.id)}">
              <option value="folg" ${!valg.chat[ch.id] ? "selected" : ""}>Standard</option>
              ${NIVAER.map(([v, tittel]) => `<option value="${v}"
                ${valg.chat[ch.id] === v ? "selected" : ""}>${tittel}</option>`).join("")}
            </select>
          </div>
        </div></div>
      </div>

      <div>
        <div class="eyebrow" style="margin-bottom:8px">
          ${ch.private ? "Med i chatten" : "Med på turen"}${folk ? " · " + folk.med.length : ""}</div>
        ${!folk ? venter("Henter deltakere") : folk.feil
          ? `<p class="muted">Klarte ikke hente deltakerlista.</p>`
          : `<div class="memberlist">${folk.med.map(p => `<div class="person">
              <span>${esc(p.name)}${p.me ? " <em>deg</em>" : ""}${p.role === "leader" ? ' <em>reiseleder</em>' : ""}</span>
              ${ch.private && !p.me ? `<button class="linkbtn" data-cmdel="${esc(p.id)}">fjern</button>` : ""}
            </div>`).join("")}</div>`}
      </div>

      ${folk && folk.andre.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px">Andre på turen</div>
        <div class="memberlist">${folk.andre.map(p => `<div class="person">
          <span>${esc(p.name)}${p.role === "leader" ? ' <em>reiseleder</em>' : ""}</span>
          <button class="linkbtn" data-cmadd="${esc(p.id)}">legg til</button>
        </div>`).join("")}</div>
      </div>` : ""}

      <div class="stack">
        ${ch.private ? `<button class="btn danger" data-cmleave="${esc(ch.id)}">Gå ut av chatten</button>` : ""}
        ${ch.min || (!ch.private && S.trip.role === "leader")
          ? `<button class="btn danger" data-slettchat="${esc(ch.id)}">Slett chatten</button>` : ""}
      </div>`;
  }

  function viewVarsler() {
    const st = S.varselStatus;
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const paaHjem = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const turNiva = Api.varselNiva(null);
    const valg = Api.varselvalg();

    const topp = st === null
      ? venter("Sjekker")
      : iOS && !paaHjem
      ? `<div class="card pad" style="padding-block:14px;border-left:3px solid var(--amber)">
           <b style="font-family:"DM Sans",sans-serif;font-size:14px">Legg appen på hjemskjermen først</b>
           <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">
             På iPhone kan bare apper som ligger på hjemskjermen gi varsler — det er Apple som
             bestemmer det. Trykk delingsknappen nederst i Safari, velg
             <b>Legg til på Hjem-skjerm</b>, og åpne TripMate derfra. Da dukker knappen opp her.</p>
         </div>`
      : st === "umulig"
      ? `<div class="card pad" style="padding-block:14px">
           <p class="muted" style="margin:0">Denne nettleseren kan ikke vise varsler.</p></div>`
      : st === "avslaatt"
      ? `<div class="card pad" style="padding-block:14px;border-left:3px solid var(--amber)">
           <b style="font-family:"DM Sans",sans-serif;font-size:14px">Varsler er blokkert</b>
           <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">
             Du har sagt nei én gang, og da spør ikke nettleseren igjen. Det må slås på
             der appen ble lagt til fra:</p>
           <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">
             <li><b>iPhone:</b> Innstillinger → Varsler → TripMate.</li>
             <li><b>Android:</b> både i nettleseren appen ble lagt til fra
               (innstillinger → nettstedsinnstillinger → varsler → ${esc(location.host)})
               <i>og</i> for nettleseren selv under Android-innstillinger → Apper.</li>
           </ul>
           <p style="margin:9px 0 0;font-size:13.5px;color:var(--ink-2)">
             Har du alt sagt ja, trykk under. Sitter «blokkert» fortsatt, må appen fjernes
             fra hjemskjermen og legges til på nytt — den husker svaret fra den gangen den
             ble lagt til.</p>
           <button class="btn" style="width:100%;margin-top:12px" id="sjekkTillatelse">Sjekk på nytt</button>
         </div>`
      : `<label class="bryterrad">
           <span class="grow">
             <b>Varsler på denne enheten</b>
             <small>${st === "paa"
               ? "Har du flere enheter, må hver av dem slås på for seg."
               : "Gjelder bare denne enheten. Valgene under følger kontoen din."}</small>
           </span>
           <input type="checkbox" id="varselBryter" ${st === "paa" ? "checked" : ""}>
           <span class="bryter" aria-hidden="true"></span>
         </label>`;

    const nivaliste = (navn, aktiv, data) => `<div class="picks">
      ${NIVAER.map(([v, tittel, forklaring]) => `<label class="pick">
        <input type="radio" name="${navn}" value="${v}" ${aktiv === v ? "checked" : ""} ${data || ""}>
        <span><b>${tittel}</b><br><small>${forklaring}</small></span></label>`).join("")}
    </div>`;

    // Feilsøking: hvert ledd i kjeden, slik at det går an å se hvor det
    // stopper i stedet for å gjette.
    const linje = (navn, ok, tekst) =>
      `<div class="sjekkrad"><span class="${ok === null ? "sjekkmidt" : ok ? "sjekkja" : "sjekknei"}">
         ${ok === null ? "–" : ok ? "✓" : "✕"}</span><span>${navn}<small>${esc(tekst)}</small></span></div>`;

    const enheter = S.varselEnheter;

    // Er alt i orden, skal ikke feilsøkingen stå og ta plass. Den hører
    // hjemme når noe er galt, ikke som en fast del av siden.
    const altVirker = st === "paa" && enheter !== null && enheter.length > 0 && (!iOS || paaHjem);

    return `
      ${topp}

      <div>
        <div class="eyebrow" style="margin:20px 0 4px;display:flex;align-items:center;gap:7px">
          <span>Standard for alle chatter</span>
          <button class="infoknapp" data-sheet="varselinfo" aria-label="Hva betyr valgene?">i</button>
        </div>
        <p class="muted" style="margin:0 0 9px">Gjelder hver chat i turen som ikke har
          sitt eget valg lenger nede.</p>
        ${nivaliste("turniva", turNiva, "")}
      </div>

      <div>
        <div class="eyebrow" style="margin:20px 0 8px;display:flex;align-items:center;gap:7px">
          <span>Chattene på turen</span>
          <button class="infoknapp" data-sheet="varselinfo" aria-label="Hva betyr valgene?">i</button>
        </div>
        <div class="card pad" style="padding:0">
          <div class="memberlist">
            ${S.trip.channels.map(c => `<div class="person">
              <span class="chatnavn">
                <span class="chatikon">${c.private ? "&#128274;" : ICON.chat}</span>
                <span class="chattekst">
                  <b>${esc(c.name)}</b>
                  <small>${c.private ? "Privat chat" : "Åpen for alle på turen"}</small>
                </span>
              </span>
              <select class="select minivalg" data-chatniva="${esc(c.id)}">
                <option value="folg" ${!valg.chat[c.id] ? "selected" : ""}>Standard</option>
                ${NIVAER.map(([v, tittel]) => `<option value="${v}"
                  ${valg.chat[c.id] === v ? "selected" : ""}>${tittel}</option>`).join("")}
              </select>
            </div>`).join("")}
          </div>
        </div>
        <p class="muted" style="margin-top:7px">Dette er gruppechattene i turen. En chat som
          følger turen, endrer seg med valget over.</p>
      </div>

      ${!altVirker ? "" : `<div style="margin-top:18px">
        <button class="linkbtn" id="testServer" style="font-size:13px">Send et testvarsel hit</button>
        ${S.varselTest ? `<div class="card pad" style="padding-block:12px;margin-top:8px;
             border-left:3px solid var(--${S.varselTest.ok ? "moss" : "amber"})">
           <p style="margin:0;font-size:13.5px;color:var(--ink-2)">${esc(S.varselTest.tekst)}</p></div>` : ""}
      </div>`}

      ${altVirker ? "" : `<div>
        <div class="eyebrow" style="margin:20px 0 8px">Virker det?</div>
        <div class="card pad" style="padding-block:6px">
          ${linje("Nettleseren kan varsle", st !== "umulig", st === "umulig" ? "Ikke støttet her" : "Ja")}
          ${iOS ? linje("Ligger på hjemskjermen", paaHjem, paaHjem ? "Ja" : "Kreves på iPhone") : ""}
          ${linje("Du har sagt ja", st === "paa",
                  st === "paa" ? "Ja" : st === "avslaatt" ? "Nei, blokkert" : "Ikke slått på")}
          ${linje("Enheten er lagret i basen",
                  enheter === null ? null : enheter.length > 0,
                  enheter === null ? "Sjekker" : enheter.length + " enhet(er) på kontoen din")}
        </div>
        <div class="stack" style="margin-top:10px">
          <button class="btn" id="testLokalt">Vis et varsel fra telefonen</button>
          <button class="btn" id="testServer">Send testvarsel via serveren</button>
        </div>
        ${S.varselTest ? `<div class="card pad" style="padding-block:12px;margin-top:10px;
             border-left:3px solid var(--${S.varselTest.ok ? "moss" : "amber"})">
           <p style="margin:0;font-size:13.5px;color:var(--ink-2)">${esc(S.varselTest.tekst)}</p></div>` : ""}
        <p class="muted" style="margin-top:8px">
          Den første viser at telefonen kan vise varsler. Den andre går hele veien om serveren,
          og er den som avslører om noe mangler der. Du får aldri varsel om dine egne meldinger.</p>
      </div>`}`;
  }

  function settOppVarsler() {
    const sjekk = $("sjekkTillatelse");
    if (sjekk) sjekk.addEventListener("click", async () => {
      sjekk.disabled = true; sjekk.innerHTML = prikker() + " Sjekker";
      const foer = S.varselStatus;
      await aapneVarsler(true);
      if (S.varselStatus === foer) {
        toast("Nettleseren svarer fortsatt nei. Prøv å legge appen til på hjemskjermen på nytt.");
      }
    });

    const bryter = $("varselBryter");
    if (bryter) bryter.addEventListener("change", async () => {
      const paa = S.varselStatus === "paa";
      bryter.disabled = true;
      try {
        if (paa) { await Api.slaaAvVarsler(); toast("Varsler er av på denne enheten."); }
        else { await Api.slaaPaaVarsler(); toast("Varsler er på."); }
      } catch (e) {
        bryter.checked = paa;                  // si nei, og bryteren går tilbake
        toast(e.message || "Det gikk ikke.");
      }
      aapneVarsler(true);
    });

    const lokal = $("testLokalt");
    if (lokal) lokal.addEventListener("click", async () => {
      try {
        if (Notification.permission !== "granted") throw new Error("Slå på varsler først.");
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("TripMate", {
          body: "Slik ser et varsel ut.", icon: "icons/icon-192.png", tag: "test"
        });
        S.varselTest = { ok: true, tekst: "Telefonen viste varselet. Da virker alt på denne enheten — står det stille likevel når andre skriver, ligger feilen på serveren." };
      } catch (e) {
        S.varselTest = { ok: false, tekst: e.message || "Telefonen klarte ikke vise varselet." };
      }
      render();
    });

    const server = $("testServer");
    if (server) server.addEventListener("click", async () => {
      server.disabled = true; server.innerHTML = prikker() + " Sender";
      try {
        const r = await Api.testVarsel();
        const s = ms => (ms / 1000).toFixed(1).replace(".", ",") + " s";
        const tider = r.ms
          ? ` Hele kallet tok ${s(r.totalt)}: ${s(r.ms.database)} i databasen, ` +
            `${s(r.ms.sending)} ut til Apple eller Google, og ` +
            `${s(Math.max(0, r.totalt - r.ms.database - r.ms.sending))} på å starte opp hos Supabase.`
          : "";
        S.varselTest = r.sendt
          ? { ok: true, tekst: `Serveren sendte til ${r.sendt} av ${r.enheter} enhet(er).` + tider }
          : { ok: false, tekst: r.feil || "Serveren nådde ingen enheter." };
      } catch (e) {
        S.varselTest = { ok: false, tekst: e.message || "Testen nådde ikke serveren." };
      }
      render();
    });
  }


  /* Hva de fire valgene faktisk betyr. Ordene «alt» og «det viktige»
     sier lite før noen har sagt hva som er hva. */
  /* Navn og klasse på turen. Bare reiseledere — og turkoden står i ro,
     det passer en regel i basen på. */
  function sheetEndreTur() {
    const t = S.trip;
    openSheet(`<h3>Endre turen</h3>
      <p class="muted" style="margin:6px 0 14px">Navn, klasse og når turen starter.
        Turkoden endrer seg ikke.</p>
      <form id="turForm">
        <div class="field"><label for="tuNavn">Navn på turen</label>
          <input id="tuNavn" value="${esc(t.name)}" maxlength="80"></div>
        <div class="field"><label for="tuOrg">Klasse eller gruppe</label>
          <input id="tuOrg" value="${esc(t.org || "")}" maxlength="80" placeholder="2STB Tryggheim"></div>
        ${t.days.length ? `<div class="field"><label for="tuDato">Første dag</label>
          <input id="tuDato" type="date" value="${esc(t.days[0].date)}">
          <small style="display:block;margin-top:5px;font-size:12.5px;color:var(--ink-3)">
            Flyttes turen, forskyves hele programmet like mange dager. Punktene følger dagen sin.</small>
        </div>` : ""}
        <p class="err" id="tuFeil" hidden></p>
        <button class="btn primary big" type="submit" id="tuLagre">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("turForm").addEventListener("submit", async e => {
      e.preventDefault();
      const navn = $("tuNavn").value.trim();
      if (!navn) { $("tuFeil").textContent = "Turen trenger et navn."; $("tuFeil").hidden = false; return; }
      const knapp = $("tuLagre");
      knapp.disabled = true; knapp.innerHTML = prikker() + " Lagrer";
      try {
        await Api.updateTrip(t.id, { name: navn, org: $("tuOrg").value.trim() });
        const nyDato = $("tuDato") && $("tuDato").value;
        if (nyDato && t.days.length && nyDato !== t.days[0].date) {
          await Api.flyttTur(t.id, nyDato);
        }
        closeSheet();
        await openTrip(t.id);
        S.trips = await Api.myTrips().catch(() => S.trips);
        S.tab = "meg"; render();
        toast("Turen er oppdatert.");
      } catch (err) {
        knapp.disabled = false; knapp.textContent = "Lagre";
        $("tuFeil").textContent = err.message; $("tuFeil").hidden = false;
      }
    });
  }

  /* Døp om en chat. Hvem som får lov, avgjør basen — appen viser bare
     knappen til dem det gjelder. */
  function sheetDoppChat(channelId) {
    const c = S.trip.channels.find(x => x.id === channelId);
    if (!c) return;
    openSheet(`<h3>Endre navn</h3>
      <p class="muted" style="margin:6px 0 14px">${c.private
        ? "Alle som er med i denne chatten kan endre navnet."
        : "Chatten er åpen for hele turen, så det er reiselederne som styrer navnet."}</p>
      <form id="chatNavnForm">
        <div class="field"><label for="cnNavn">Navn på chatten</label>
          <input id="cnNavn" value="${esc(c.name)}" maxlength="60"></div>
        <p class="err" id="cnFeil" hidden></p>
        <button class="btn primary big" type="submit" id="cnLagre">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("chatNavnForm").addEventListener("submit", async e => {
      e.preventDefault();
      const navn = $("cnNavn").value.trim();
      if (!navn) { $("cnFeil").textContent = "Chatten trenger et navn."; $("cnFeil").hidden = false; return; }
      const knapp = $("cnLagre");
      knapp.disabled = true; knapp.innerHTML = prikker() + " Lagrer";
      try {
        await Api.doppChat(channelId, navn);
        closeSheet();
        await openTrip(S.trip.id);
        if (S.openChat === channelId) S.tab = "chat";
        render();
        toast("Navnet er endret.");
      } catch (err) {
        knapp.disabled = false; knapp.textContent = "Lagre";
        $("cnFeil").textContent = err.message; $("cnFeil").hidden = false;
      }
    });
  }

  /* Hvilket kart som åpnes. Et valg per enhet: du har ikke nødvendigvis
     samme kart på PC-en som på telefonen. */
  function sheetKartvalg() {
    const naa = Api.kartValg();
    const reise = Api.reisemaate();
    openSheet(`<h3>Kart</h3>
      <p class="muted" style="margin:6px 0 14px">Veibeskrivelser åpnes i appen du velger her.
        Valget gjelder denne enheten.</p>
      <div class="picks">
        <label class="pick"><input type="radio" name="kartvalg" value="google" ${naa === "google" ? "checked" : ""}>
          <span><b>Google Maps</b><br><small>Virker på både iPhone og Android</small></span></label>
        <label class="pick"><input type="radio" name="kartvalg" value="apple" ${naa === "apple" ? "checked" : ""}>
          <span><b>Apple Kart</b><br><small>Bare på iPhone, iPad og Mac</small></span></label>
      </div>

      <div class="eyebrow" style="margin:20px 0 8px">Hvordan dere kommer dit</div>
      <div class="picks">
        <label class="pick"><input type="radio" name="reisemaate" value="fots" ${reise === "fots" ? "checked" : ""}>
          <span><b>Til fots</b><br><small>De siste hundre meterne fra bussen</small></span></label>
        <label class="pick"><input type="radio" name="reisemaate" value="kollektiv" ${reise === "kollektiv" ? "checked" : ""}>
          <span><b>Kollektivt</b><br><small>Metro, tog og buss</small></span></label>
        <label class="pick"><input type="radio" name="reisemaate" value="bil" ${reise === "bil" ? "checked" : ""}>
          <span><b>Bil</b><br><small>Hvis dere kjører selv</small></span></label>
      </div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  function sheetVarselInfo() {
    openSheet(`<h3>Hva betyr valgene?</h3>
      <p class="muted" style="margin:6px 0 16px">Varsler kommer bare når du ikke har appen
        framme. Sitter du i appen, sier den fra selv — og står du i chatten det gjelder,
        ser du jo meldingen komme.</p>

      <div class="memberlist">
        <div class="person" style="align-items:flex-start">
          <span class="chattekst"><b>Alt</b>
            <small>Hver eneste melding i chatten. Greit i en liten gruppe, men i en chat
              med hele klassen blir det mange.</small></span>
        </div>
        <div class="person" style="align-items:flex-start">
          <span class="chattekst"><b>Det viktige</b>
            <small>Tre ting: meldinger fra reiseledere, svar på dine egne meldinger, og
              meldinger som avtaler et møtested — som «møt på hotellet kl 18:30».
              Dette er utgangspunktet.</small></span>
        </div>
        <div class="person" style="align-items:flex-start">
          <span class="chattekst"><b>Ingenting</b>
            <small>Ingen varsler herfra. Meldingene kommer fortsatt; du må bare se etter
              dem selv.</small></span>
        </div>
        <div class="person" style="align-items:flex-start">
          <span class="chattekst"><b>Standard</b>
            <small>Bare på enkeltchatter: chatten gjør det samme som standardvalget øverst.
              Endrer du standarden, følger den med.</small></span>
        </div>
      </div>

      <p class="muted" style="margin-top:14px">I tillegg varsles du alltid hvis en reiseleder
        endrer programmet for <b>i dag</b> — ny tid, ny rekkefølge eller en ny dag. Endringer
        som gjelder senere, varsles ikke.</p>
      <button class="btn close" data-close>Lukk</button>`);
  }

  function sheetAbout() {
    openSheet(`<h3>Om appen</h3>
      <p style="margin:10px 0;font-size:14.5px;color:var(--ink-2)">
        TripMate samler program, beskjeder og veibeskrivelser for én klassetur. Når noen avtaler
        et møtested i chatten, kobler appen det mot programmet og finner riktig adresse for den dagen.</p>
      <div class="card pad" style="padding-block:12px;margin-top:6px">
        <dl class="kv">
          <dt>Lagring</dt><dd>Program og meldinger ligger i en database. Du ser bare turer du er medlem av.</dd>
          <dt>Pålogging</dt><dd>Enheten din får en anonym identitet. Navnet er selvvalgt.</dd>
          <dt>Kart</dt><dd>Adressen åpnes i Google Maps eller Apple Maps.</dd>
        </dl>
      </div>
      <p class="muted" style="margin-top:12px">Turkoden er en nøkkel til et rom. Alle som har den kan bli
      med og lese alt som skrives i turen — del den bare med dem som skal være med, og lag en ny tur
      hvis koden kommer på avveie.</p>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* ───────────────── hendelser ───────────────── */
  document.addEventListener("change", async e => {
    const bryter = e.target.closest("[data-chatskriv]");
    if (!bryter) return;
    const id = bryter.dataset.chatskriv, paa = bryter.checked;
    try { await Api.settChatSkriving(id, paa); render(); }
    catch { bryter.checked = !paa; toast("Klarte ikke lagre. Har du kjørt siste SQL?"); }
  });

  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-tab],[data-side],[data-pakk],[data-slettpakk],[data-sete],[data-nykj],[data-endrekj],[data-slettkj],[data-vaerigjen],[data-day],[data-channel],[data-sheet],[data-opentrip],[data-close],[data-copy],[data-edit],[data-delitem],[data-delday],[data-delmsg],[data-leave],[data-deltrip],[data-members],[data-openchat],[data-item],[data-kopi],[data-skjul],[data-vis],[data-kartapne],[data-kartlukk],[data-nye],[data-eldre],[data-msgmeny],[data-chat],[data-paa],[data-slettchat],[data-bilde],[data-slettbilde],[data-bvlukk],[data-bvmeny],[data-lagrebilde],[data-kopimeld],[data-deltekst],[data-chatside],[data-cmadd],[data-cmdel],[data-cmleave],[data-rolle],[data-godkjenn],[data-avvis],[data-fjern],#authTilbake,#joinTilbake,[data-emoji],[data-hopp],[data-svar],#tripBtn,#meBtn,#resetBtn,#backBtn,#skjulInstall,#installKnapp");
    if (!t) return;

    if (t.id === "joinTilbake") { S.fraStart = false; return visAuth("start"); }
    if (t.id === "authTilbake") {
      // Paa kodesteget betyr tilbake "bruk en annen adresse", ikke ut.
      return $("authInner").querySelector("#kodeForm") ? visAuth(S.trip && !Api.erAnonym() ? "koble" : "logginn") : lukkAuth();
    }
    if (t.hasAttribute("data-close")) return closeSheet();
    if (t.id === "backBtn") return S.side ? lukkSide() : closeChat();
    if (t.id === "tripBtn") return sheetTrips();
    if (t.id === "meBtn") { S.tab = "meg"; return render(); }
    if (t.hasAttribute("data-edit")) { S.edit = !S.edit; return render(); }

    if (t.id === "skjulInstall") {
      try { localStorage.setItem("tk.skjulInstall", "1"); } catch { /* uviktig */ }
      return render();
    }

    if (t.id === "installKnapp") {
      if (!installValg) return toast("Bruk nettlesermenyen for å legge den til.");
      installValg.prompt();
      const valg = installValg; installValg = null;
      valg.userChoice.finally(() => render());
      return;
    }

    if (t.id === "resetBtn") {
      const gjest = Api.erAnonym();
      const sporsmaal = gjest
        ? "Logge ut? Du er gjest, så kontoen finnes bare her — den slettes, og du kommer inn igjen med turkoden."
        : "Logge ut på denne enheten? Turene ligger igjen i basen, og du logger inn igjen med e-posten din.";
      if (confirm(sporsmaal)) {
        // Vent: utloggingen rydder gjestekontoen, og det må rekke å skje
        // før siden lastes på nytt.
        await Api.signOutLocal();
        location.reload();
      }
      return;
    }

    if (t.dataset.copy) {
      try { await navigator.clipboard.writeText(t.dataset.copy); toast("Turkoden er kopiert."); }
      catch { toast("Kopiering ble blokkert — merk koden manuelt."); }
      return;
    }

    if (t.dataset.opentrip) { closeSheet(); S.tab = "program"; return openTrip(t.dataset.opentrip).catch(() => toast("Klarte ikke åpne turen.")); }
    if (t.dataset.tab) return byttFane(t.dataset.tab);

    if (t.dataset.side) {
      closeSheet();
      return t.dataset.side === "pakk" ? aapnePakk() : aapneSeter();
    }

    // Krysset settes med en gang på skjermen. Går det galt, settes det
    // tilbake — ellers står det et kryss som ikke finnes i basen.
    if (t.dataset.pakk) {
      const egen = t.dataset.egen === "1";
      const p = ((egen ? S.pakk.egne : S.pakk.felles) || []).find(x => x.id === t.dataset.pakk);
      if (!p) return;
      const foer = p.kryss;
      p.kryss = !foer; render();
      try { await Api.kryssPakk(p.id, p.kryss, egen); }
      catch { p.kryss = foer; render(); toast("Krysset ble ikke lagret."); }
      return;
    }

    if (t.dataset.slettpakk) {
      const egen = t.dataset.egen === "1";
      if (!confirm(egen ? "Slette dette punktet?" : "Slette dette punktet for alle på turen?")) return;
      try { await Api.slettPakkPunkt(t.dataset.slettpakk, egen); await aapnePakk(true); }
      catch { toast("Klarte ikke slette punktet."); }
      return;
    }

    if (t.dataset.sete && t.dataset.kj) {
      const nr = parseInt(t.dataset.sete, 10);
      const k = (S.setekart || []).find(x => x.id === t.dataset.kj);
      if (!k) return;
      const mitt = k.seter.find(x => x.meg);
      const navn = setenavn(nr, oppsett(k.typ).bredde);
      try {
        if (mitt && mitt.nr === nr) {
          if (!confirm(`Slippe plassen ${navn} i ${k.navn}?`)) return;
          await Api.slippSete(k.id);
        } else {
          await Api.taSete(k.id, nr);
        }
        await aapneSeter(true);
        hentMegTall(true);
      } catch (err) { toast(err.message); await aapneSeter(true); }
      return;
    }

    if (t.hasAttribute("data-nykj")) return sheetKjoretoy(null);
    if (t.dataset.endrekj) return sheetKjoretoy(t.dataset.endrekj);

    if (t.dataset.slettkj) {
      const k = (S.setekart || []).find(x => x.id === t.dataset.slettkj);
      if (!confirm(`Slette ${k ? k.navn : "kjøretøyet"}? Plassene alle har valgt forsvinner.`)) return;
      try {
        await Api.slettKjoretoy(t.dataset.slettkj);
        closeSheet();
        await aapneSeter(true);
        hentMegTall(true);
      } catch { toast("Klarte ikke slette kjøretøyet."); }
      return;
    }

    // Adressene slås opp på serveren, og et sted som bommet i går kan
    // treffe i dag. Uten denne knappen var eneste vei å endre adressen
    // til noe annet og tilbake igjen.
    if (t.hasAttribute("data-vaerigjen")) {
      toast("Slår opp adressene…");
      try {
        await Api.lastVaer(S.trip.id, true);
        await openTrip(S.trip.id);
        S.tab = "meg"; render();
        const igjen = oppgaver().filter(o => /Fant ikke posisjonen/.test(o.hva)).length;
        toast(igjen ? `${igjen} står fortsatt uten posisjon.` : "Alle stedene har posisjon nå.");
      } catch { toast("Klarte ikke slå opp. Sjekk nettet."); }
      return;
    }
    // Kommer du fra et ark eller fra programmet, må arket lukkes og
    // fanen byttes — ellers åpnes chatten bak det du står i, og det ser
    // ut som om knappen ikke gjorde noe.
    if (t.dataset.openchat) {
      closeSheet();
      S.side = null;
      S.tab = "chat";
      return openChat(t.dataset.openchat);
    }

    if (t.dataset.delitem) {
      if (!confirm("Slette dette punktet?")) return;
      try { await Api.deleteItem(t.dataset.delitem); await openTrip(S.trip.id); }
      catch { toast("Klarte ikke slette."); }
      return;
    }
    if (t.dataset.delday) {
      if (!confirm("Slette hele dagen med alle punktene?")) return;
      try { await Api.deleteDay(t.dataset.delday); S.day = null; await openTrip(S.trip.id); }
      catch { toast("Klarte ikke slette."); }
      return;
    }
    if (t.dataset.delmsg) {
      const m = Api.messages(S.openChat).find(x => x.id === t.dataset.delmsg);
      const harBilde = m && m.bilde;
      if (!confirm(harBilde && !(m.txt)
        ? "Slette bildet for alle? Det kan ikke angres."
        : "Slette meldingen for alle? Det kan ikke angres.")) return;
      try {
        // Bildefila ligger for seg selv i lageret, og blir ikke med i
        // dragsuget når meldingen forsvinner. Den må ryddes først.
        if (harBilde) await Api.slettBilde(m.bilde).catch(() => {});
        await Api.deleteMessage(t.dataset.delmsg, S.openChat);
        closeSheet();
        lukkBilde();
        render();
      }
      catch { toast("Klarte ikke slette meldingen."); }
      return;
    }
    if (t.dataset.deltrip) {
      const trip = S.trip;
      if (!confirm(`Slette «${trip.name}» for alle? Program, chatter og meldinger forsvinner for godt.`)) return;
      if (prompt("Skriv turkoden for å bekrefte:") !== trip.code) return toast("Koden stemte ikke. Ingenting er slettet.");
      try {
        await Api.deleteTrip(t.dataset.deltrip);
        S.trips = await Api.myTrips().catch(() => []);
        if (S.trips.length) { S.tab = "program"; await openTrip(S.trips[0].id); }
        else { Api.setLastTrip(null); showJoin(); }
        toast("Turen er slettet.");
      } catch { toast("Klarte ikke slette turen."); }
      return;
    }
    if (t.dataset.leave) {
      if (!confirm("Melde deg av turen? Du kommer inn igjen med turkoden.")) return;
      try {
        await Api.leaveTrip(t.dataset.leave);
        S.trips = await Api.myTrips().catch(() => []);
        if (S.trips.length) { S.tab = "program"; await openTrip(S.trips[0].id); }
        else { Api.setLastTrip(null); showJoin(); }
      } catch { toast("Klarte ikke melde deg av."); }
      return;
    }

    // ark
    if (t.dataset.members) return aapneChatside(t.dataset.members);
    if (t.dataset.chatside) return aapneChatside(t.dataset.chatside);
    if (t.dataset.skjul) return skjulOppgave(t.dataset.skjul, t.dataset.skjulid, true);
    if (t.dataset.vis) { closeSheet(); return skjulOppgave(t.dataset.vis, t.dataset.visid, false); }
    // Chatsiden: legg til, fjern, eller gå ut selv.
    if (t.dataset.cmadd || t.dataset.cmdel || t.dataset.cmleave) {
      const kanal = S.sideChat;
      try {
        if (t.dataset.cmadd) await Api.addChannelMember(kanal, t.dataset.cmadd);
        else if (t.dataset.cmdel) await Api.removeChannelMember(kanal, t.dataset.cmdel);
        else {
          if (!confirm("Gå ut av chatten? Du mister tilgangen til meldingene.")) return;
          await Api.removeChannelMember(kanal, null);
          S.side = null; S.openChat = null;
          await openTrip(S.trip.id);
          S.tab = "chat";
          return render();
        }
        return aapneChatside(kanal, true);
      } catch (e) { return toast(e.message || "Det gikk ikke."); }
    }

    // Deltakersiden: roller, godkjenning og fjerning.
    if (t.dataset.rolle || t.dataset.godkjenn || t.dataset.avvis || t.dataset.fjern) {
      // Å fjerne noen er ikke til å angre på, så vi spør først. Meldingene
      // deres blir stående, men tilgangen forsvinner med én gang.
      if (t.dataset.fjern &&
          !confirm(`Fjerne ${t.dataset.navn} fra turen? Da mister de tilgangen til program og chatter, og trenger turkoden på nytt for å komme inn igjen.`)) return;
      try {
        if (t.dataset.godkjenn) await Api.godkjennDeltaker(S.trip.id, t.dataset.godkjenn);
        else if (t.dataset.avvis) await Api.avvisDeltaker(S.trip.id, t.dataset.avvis);
        else if (t.dataset.fjern) await Api.fjernDeltaker(S.trip.id, t.dataset.fjern);
        else await Api.setMemberRole(S.trip.id, t.dataset.rolle, t.dataset.til);
        await openTrip(S.trip.id);
        return aapneDeltakere(true);
      } catch (e) { return toast(e.message || "Klarte ikke endre."); }
    }

    if (t.dataset.bilde) {
      if (Date.now() - sisteHold < 700) return;   // holdt, ikke trykket
      return visBilde(t.dataset.bilde);
    }
    if (t.hasAttribute("data-bvlukk")) return lukkBilde();
    if (t.dataset.bvmeny) return sheetEmoji(t.dataset.bvmeny, "bilde");
    if (t.dataset.lagrebilde) return lagreBilde(t.dataset.lagrebilde);
    if (t.dataset.deltekst) {
      if (!confirm("Slette teksten for alle? Bildet blir stående.")) return;
      try { await Api.slettTekst(t.dataset.deltekst, S.openChat); closeSheet(); render(); }
      catch { toast("Klarte ikke slette teksten. Har du kjørt siste SQL?"); }
      return;
    }
    if (t.dataset.kopimeld) {
      closeSheet();
      try { await navigator.clipboard.writeText(t.dataset.kopimeld); toast("Teksten er kopiert."); }
      catch { toast("Kopiering ble blokkert."); }
      return;
    }

    if (t.dataset.slettbilde) {
      if (!confirm("Slette bildet for alle? Det kan ikke angres.")) return;
      try {
        await Api.slettBilde(t.dataset.slettbilde);
        closeSheet();
        lukkBilde();
        await Api.loadMessages(S.trip.id, S.openChat);
        render();
        toast("Bildet er slettet.");
      } catch (e) { toast(e.message || "Klarte ikke slette bildet."); }
      return;
    }

    if (t.dataset.slettchat) {
      const c = S.trip.channels.find(x => x.id === t.dataset.slettchat);
      if (!confirm(`Slette «${c ? c.name : "chatten"}» for alle? Meldingene forsvinner for godt.`)) return;
      try {
        await Api.deleteChannel(t.dataset.slettchat);
        S.side = null; S.openChat = null;
        await openTrip(S.trip.id);
        S.tab = "chat"; render();
        toast("Chatten er slettet.");
      } catch (e) { toast(e.message || "Klarte ikke slette chatten."); }
      return;
    }

    if (t.dataset.paa) {
      const av = Boolean(t.dataset.av);
      t.disabled = true; t.innerHTML = prikker() + (av ? " Melder av" : " Melder på");
      try {
        if (av) await Api.meldAv(t.dataset.paa); else await Api.meldPaa(t.dataset.paa);
        await Api.lastPaameldinger(S.trip.id);
        await openTrip(S.trip.id);
        sheetItem(t.dataset.paa);
        toast(av ? "Du er meldt av." : "Du er påmeldt.");
      } catch (e) {
        toast(e.message || "Det gikk ikke.");
        await Api.lastPaameldinger(S.trip.id);
        sheetItem(t.dataset.paa);
      }
      return;
    }

    if (t.dataset.nye) { S.nye = 0; S.tilBunn = true; return render(); }
    if (t.dataset.eldre) return hentEldre();
    if (t.dataset.kartapne) return settKart(t.dataset.kartapne, "apen");
    if (t.dataset.kartlukk) return settKart(t.dataset.kartlukk, "liten");
    if (t.dataset.emoji) { closeSheet(); return reager(t.dataset.pa, t.dataset.emoji); }
    if (t.dataset.msgmeny) return sheetEmoji(t.dataset.msgmeny);
    if (t.dataset.hopp) return hoppTil(t.dataset.hopp);
    if (t.dataset.svar) { closeSheet(); lukkBilde(); return startSvar(t.dataset.svar); }
    if (t.dataset.item) return sheetItem(t.dataset.item);
    if (t.dataset.kopi) {
      try { await navigator.clipboard.writeText(t.dataset.kopi); toast("Kopiert: " + t.dataset.kopi); }
      catch { toast("Kopiering ble blokkert — merk teksten manuelt."); }
      return;
    }
    if (t.dataset.sheet === "place") return sheetPlace(t.dataset.place);
    if (t.dataset.sheet === "jointrip") return sheetJoinTrip();
    if (t.dataset.sheet === "newtrip") return sheetNewTrip();
    if (t.dataset.sheet === "newchannel") return sheetNewChannel();
    if (t.dataset.sheet === "addday") return sheetAddDay();
    if (t.dataset.sheet === "additem") return sheetAddItem(t.dataset.day);
    if (t.dataset.sheet === "hotel") return sheetHotel(t.dataset.day);
    if (t.dataset.sheet === "deltakere") { closeSheet(); return aapneDeltakere(); }
    if (t.dataset.sheet === "varsler") { closeSheet(); return aapneVarsler(); }
    if (t.dataset.sheet === "varselinfo") return sheetVarselInfo();
    if (t.dataset.sheet === "kartvalg") return sheetKartvalg();
    if (t.dataset.sheet === "endretur") return sheetEndreTur();
    if (t.dataset.sheet === "doppchat") return sheetDoppChat(t.dataset.chat);
    if (t.dataset.sheet === "logginn") return visAuth("logginn");
    if (t.dataset.sheet === "koblepost") { closeSheet(); return visAuth("koble"); }
    if (t.dataset.sheet === "nyttpakk") return sheetNyttPakk(t.dataset.egen === "1");
    if (t.dataset.sheet === "skjulte") return sheetSkjulte();
    if (t.dataset.sheet === "about") return sheetAbout();
    if (t.dataset.sheet === "importpdf") return sheetImportPdf();

    if (t.dataset.day) { S.day = t.dataset.day; return render(); }
  });

  /* Valg som lagres i det du endrer dem. Lytteren ligger på dokumentet,
     ikke på skjermen: sidene tegnes på nytt hver gang noe kommer inn
     utenfra, og en lytter per tegning ville blitt til hundre. */
  document.addEventListener("change", async e => {
    const m = e.target;
    if (!S.trip) return;

    if (m.name === "reisemaate") {
      Api.settReisemaate(m.value);
      closeSheet();
      render();
      return toast(m.value === "fots" ? "Veibeskrivelser viser gangvei nå."
        : m.value === "kollektiv" ? "Veibeskrivelser viser kollektivt nå."
        : "Veibeskrivelser viser kjørerute nå.");
    }

    if (m.name === "kartvalg") {
      Api.settKartValg(m.value);
      closeSheet();
      render();
      return toast("Veibeskrivelser åpnes nå i " + (m.value === "apple" ? "Apple Kart." : "Google Maps."));
    }

    if (m.id === "bilderPaa") {
      try {
        await Api.setBilderPaa(S.trip.id, m.checked);
        S.trip.bilder = m.checked;
        render();
        toast(m.checked ? "Bilder er tillatt i chattene." : "Bilder er slått av for turen.");
      } catch {
        m.checked = !m.checked;
        toast("Klarte ikke lagre. Har du kjørt siste SQL?");
      }
      return;
    }

    if (m.id === "krevGodkjenning") {
      try {
        await Api.setKrevGodkjenning(S.trip.id, m.checked);
        S.trip.krevGodkjenning = m.checked;
        toast(m.checked ? "Nye må nå godkjennes." : "Alle med koden slipper inn.");
      } catch {
        m.checked = !m.checked;
        toast("Klarte ikke lagre. Har du kjørt siste SQL?");
      }
      return;
    }

    try {
      if (m.name === "turniva") {
        await Api.settVarselNiva(S.trip.id, null, m.value);
        toast("Lagret for hele turen.");
        render();
      } else if (m.dataset && m.dataset.chatniva) {
        await Api.settVarselNiva(S.trip.id, m.dataset.chatniva, m.value);
        toast("Lagret for chatten.");
      }
    } catch (err) { toast(err.message || "Klarte ikke lagre."); }
  });

  // Blar du deg selv ned til bunnen, er meldingene ikke nye lenger.
  $("screen").addEventListener("scroll", () => {
    if (avbrytGest) avbrytGest();
    if (!S.nye || !S.openChat) return;
    const sc = $("screen");
    if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140) { S.nye = 0; render(); }
  }, { passive: true });

  $("sheetBg").addEventListener("click", e => { if (e.target.id === "sheetBg") closeSheet(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("sheetBg").hidden) return closeSheet();
    if (lukkBilde()) return;
    if (S.side) return lukkSide();
    closeChat();
  });

  $("joinForm").addEventListener("submit", async e => {
    e.preventDefault();
    const first = $("fFirst").value.trim(), last = $("fLast").value.trim();
    const err = $("joinErr"), btn = $("joinSubmit");
    if (!first || !last) { err.textContent = "Skriv både fornavn og etternavn."; err.hidden = false; return; }
    err.hidden = true; btn.disabled = true; btn.innerHTML = prikker() + " Blir med";
    try {
      Api.setProfile(first, last);
      const trip = await Api.joinByCode($("fCode").value, `${first} ${last}`);
      S.trips = await Api.myTrips().catch(() => []);
      await openTrip(trip.id);
    } catch (e2) {
      err.textContent = e2.message; err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Bli med på turen";
    }
  });

  /* Skjermen til én fane. Trengs to steder: når fanen tegnes, og når
     naboen skal ligge klar ved siden av under et sveip. */
  function visningFor(fane) {
    return fane === "idag" ? viewIDag()
         : fane === "program" ? viewProgram()
         : fane === "chat" ? viewChat()
         : viewMe();
  }

  /* ───────────────── sveip mellom fanene ─────────────────
     Fanene ligger ved siden av hverandre, og du kan dra deg mellom dem.
     Siden følger fingeren hele veien, og slipper du halvveis, glir den
     tilbake dit den kom fra. Det er direkte manipulasjon slik Apple
     beskriver den: ingenting avgjøres før du har bestemt deg, og du kan
     ombestemme deg underveis.

     Bevegelsen er motivert av at fanene faktisk ligger side om side.
     Derfor sveiper du ikke når en samtale eller en egen side er åpen:
     da ligger det ingenting ved siden av. Og ytterst i rekka gir det
     etter i stedet for å flytte seg — strikken sier at her er det
     slutt, uten at det må skrives. */
  function settOppSveip() {
    const skjerm = $("screen"), app = $("appScreen");
    let startX = 0, startY = 0, dx = 0, retning = 0;
    let drar = false, avklart = false, skygge = null, bredde = 0, t0 = 0;

    const kanSveipe = () => Boolean(S.trip) && !S.openChat && !S.side && !S.sveiper;
    const naboIndeks = r => FANER.findIndex(([f]) => f === S.tab) + r;

    const rydd = () => {
      drar = false; avklart = false; retning = 0; dx = 0;
      skjerm.style.transition = ""; skjerm.style.transform = "";
      if (skygge) { skygge.remove(); skygge = null; }
    };

    // Naboen tegnes i en kopi av skjermen, lagt nøyaktig der skjermen
    // ligger. Er det ingen nabo, er det ingenting å legge fram.
    const lagSkygge = r => {
      const i = naboIndeks(r);
      if (i < 0 || i >= FANER.length) return null;
      const rk = skjerm.getBoundingClientRect(), ra = app.getBoundingClientRect();
      const el = document.createElement("main");
      el.className = "screen skygge";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = visningFor(FANER[i][0]);
      el.style.top = (rk.top - ra.top) + "px";
      el.style.left = (rk.left - ra.left) + "px";
      el.style.width = rk.width + "px";
      el.style.height = rk.height + "px";
      app.insertBefore(el, skjerm.nextSibling);
      return el;
    };

    skjerm.addEventListener("touchstart", e => {
      if (e.touches.length !== 1 || !kanSveipe()) return;
      const t = e.touches[0];
      // iOS har sin egen kantsveip tilbake. Den skal ikke slåss med vår.
      if (t.clientX < 24) return;
      // Et punkt som dras til en ny plass, og noe som selv kan blas
      // sidelengs, eier bevegelsen sin.
      if (e.target.closest("[data-drag]")) return;
      for (let n = e.target; n && n !== skjerm; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 1) return;
      }
      startX = t.clientX; startY = t.clientY; t0 = Date.now();
      dx = 0; drar = true; avklart = false; retning = 0;
    }, { passive: true });

    skjerm.addEventListener("touchmove", e => {
      if (!drar || e.touches.length !== 1) return;
      const t = e.touches[0];
      const ddx = t.clientX - startX, ddy = t.clientY - startY;

      if (!avklart) {
        const ax = Math.abs(ddx), ay = Math.abs(ddy);
        // Mer opp og ned enn sidelengs: dette er blaing, ikke et sveip.
        if (ay > 10 && ay >= ax) { drar = false; return; }
        // Et vanlig trykk flytter fingeren noen piksler. Skal det bli et
        // sveip, må det være tydelig sidelengs — ellers spiser sveipet
        // trykket, og raden under ser ut som om den ikke virker.
        if (ax < 18 || ax < ay * 1.4) return;
        avklart = true;
        retning = ddx < 0 ? 1 : -1;            // mot venstre = neste fane
        bredde = skjerm.getBoundingClientRect().width;
        skygge = lagSkygge(retning);
        skjerm.style.transition = "none";
        if (skygge) skygge.style.transition = "none";
      }

      // Bare den veien du valgte. Er det ingen nabo, gir det etter.
      let x = retning === 1 ? Math.min(0, ddx) : Math.max(0, ddx);
      if (!skygge) x = x / 4;
      dx = x;
      skjerm.style.transform = "translateX(" + x + "px)";
      if (skygge) skygge.style.transform = "translateX(" + (x + retning * bredde) + "px)";
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    const slipp = () => {
      if (!drar) return;
      drar = false;
      if (!avklart) return rydd();

      // Enten langt nok, eller fort nok. Et raskt kast skal telle like
      // mye som et langt drag — ellers må man dra hele veien hver gang.
      const fart = Math.abs(dx) / Math.max(1, Date.now() - t0);
      const ja = Boolean(skygge) && (Math.abs(dx) > bredde * 0.28 || fart > 0.5);

      if (!ja) {
        const tid = 240;
        skjerm.style.transition = "transform " + tid + "ms var(--ease-ut)";
        skjerm.style.transform = "translateX(0px)";
        if (skygge) {
          skygge.style.transition = skjerm.style.transition;
          skygge.style.transform = "translateX(" + (retning * bredde) + "px)";
        }
        setTimeout(rydd, tid + 20);
        return;
      }

      // Resten av veien, i tid som står til det som er igjen: slipper du
      // nesten framme, skal det ikke bruke like lang tid som fra midten.
      S.sveiper = true;
      const ny = FANER[naboIndeks(retning)][0];
      const igjen = Math.max(0, bredde - Math.abs(dx));
      const tid = Math.max(140, Math.min(320, Math.round((igjen / bredde) * 320)));
      skjerm.style.transition = "transform " + tid + "ms var(--ease-skuff)";
      skjerm.style.transform = "translateX(" + (-retning * bredde) + "px)";
      skygge.style.transition = skjerm.style.transition;
      skygge.style.transform = "translateX(0px)";
      // Pilla på øya glir samtidig, ikke etterpå: baren og siden hører
      // sammen og skal bevege seg som én ting.
      visFane(ny);
      setTimeout(() => {
        S.sveiper = false;
        rydd();
        byttFane(ny);
      }, tid + 20);
    };

    skjerm.addEventListener("touchend", slipp);
    skjerm.addEventListener("touchcancel", slipp);
  }
  settOppSveip();

  /* Snur telefonen seg, eller kommer tastaturet opp, flytter øya seg —
     og da stemmer ikke plassen under lista lenger. */
  addEventListener("resize", () => { if (S.trip) maalOey(); });

  return { boot };
})();

UI.boot();
