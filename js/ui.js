/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* ui.js — skjermer, navigasjon og alt som tegnes. */

const UI = (() => {

  const S = { trip: null, tab: "program", day: null, openChat: null, loadingChat: false, trips: [], turerHentet: false, edit: false, offline: false, svarTil: null, kart: {}, sisteChat: null, tilBunn: false,
    nye: 0, sistAntall: 0, beholdSkroll: null, sveiper: false,
    side: null, varselStatus: null, varselEnheter: null, varselTest: null,
    folk: null, folkFeil: false, sisteVisning: null,
    vaerJobber: false,
    rom: null, romFeil: false,
    pakk: null, pakkFeil: false, setekart: null, seteFeil: false,
    kontakt: null, kontaktFeil: false, opprop: null, oppropFeil: false,
    omvis: null,                            // {rolle, i} mens omvisningen gaar
    megTall: null,                          // tallene som står til høyre i Meg
    sideChat: null, chatFolk: null, ventende: 0, vedlegg: null, sender: false, sisteComposer: null };

  const $ = id => document.getElementById(id);
  /* Navneregler (L2). Bokstaver fra alle språk, mellomrom, bindestrek og
     apostrof: «Anne-Marie», «O'Brien» og «Nguyễn» går, «Ole123» og «@ola»
     gjør det ikke. Tullenavn stoppes ikke av regler — det gjør «Krev
     godkjenning» og at reiselederen kan rette navnet. Basen sjekker det
     samme (navn_ok, Utvidelse 30). */
  const navnDel = /^\p{L}[\p{L}\p{M}' ’.-]*$/u;
  function navnFeil(first, last) {
    const f = String(first || "").trim(), l = String(last || "").trim();
    if (!f || !l) return "Skriv både fornavn og etternavn.";
    const ord = (f + " " + l).split(/\s+/);
    if (!ord.every(o => navnDel.test(o))) return "Navnet kan ha bokstaver, mellomrom, bindestrek og apostrof — ikke tall eller andre tegn.";
    if ((f + " " + l).length > 60) return "Navnet er for langt.";
    return null;
  }
  // Stor bokstav først i hvert navn og etter bindestrek: «anne-marie» blir
  // «Anne-Marie». Resten står slik det ble skrevet, så «McDonald» og
  // «O'Brien» ikke blir ødelagt.
  const storForbokstav = s => String(s || "").trim().replace(/\s+/g, " ")
    .replace(/(^|[\s-])(\p{L})/gu, (_, foran, b) => foran + b.toLocaleUpperCase("nb"));

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  /* Datoen der telefonen er. toISOString() gir datoen i UTC, og da trodde
     appen at det var i går mellom midnatt og kl 01–02 i Norge, og at det
     var i morgen fra kl 19–20 om kvelden i New York. */
  const lokalDato = (d = new Date()) => d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => lokalDato();
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
    svar:'<svg viewBox="0 0 24 24"><path d="M9.5 6 4 11.5 9.5 17"/><path d="M4.5 11.5H14a6 6 0 0 1 6 6V19"/></svg>',
    flagg:'<svg viewBox="0 0 24 24"><path d="M5.5 21V4.5"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/></svg>',
    stopp:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
    soppel:'<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10.5v6M14 10.5v6"/></svg>',
    mer:'<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
    kopi:'<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></svg>',
    nokkel:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16.5 16.5l2-2M14 14l2-2"/></svg>',
    koffert:'<svg viewBox="0 0 24 24"><rect x="3" y="7.5" width="18" height="12.5" rx="2.5"/><path d="M9 7.5V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7.5"/></svg>',
    post:'<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7.2l8 5.4 8-5.4"/></svg>',
    kart:'<svg viewBox="0 0 24 24"><path d="M9 3.6 3.5 5.8v14.6L9 18.2l6 2.2 5.5-2.2V3.6L15 5.8 9 3.6Z"/><path d="M9 3.6v14.6M15 5.8v14.6"/></svg>',
    info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/></svg>',
    sekk:'<svg viewBox="0 0 24 24"><path d="M5.5 10a6.5 6.5 0 0 1 13 0v8.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V10Z"/><path d="M9.2 9.2V6.4a2.8 2.8 0 0 1 5.6 0v2.8"/><path d="M9 14.5h6"/></svg>',
    sete:'<svg viewBox="0 0 24 24"><path d="M7 4.5h7.5a2 2 0 0 1 2 2.2l-.8 7.3H7.8L7 4.5Z"/><path d="M6.5 14h11.2a1.8 1.8 0 0 1 1.8 1.8v.7H6.5V14Z"/><path d="M8 16.5v3M18 16.5v3"/></svg>',
    telefon:'<svg viewBox="0 0 24 24"><path d="M7.2 3.8h2.3l1.4 3.5-1.9 1.4a11 11 0 0 0 4.9 4.9l1.4-1.9 3.5 1.4v2.3a2.4 2.4 0 0 1-2.6 2.4A14.6 14.6 0 0 1 4.8 6.4a2.4 2.4 0 0 1 2.4-2.6Z"/></svg>',
    opprop:'<svg viewBox="0 0 24 24"><path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.5 6.3 1.4 1.4 2.3-2.4M3.5 11.8l1.4 1.4 2.3-2.4M3.5 17.3l1.4 1.4 2.3-2.4"/></svg>',
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

  /* Stripa som teller ned før deltakerne varsles om at dagens program er
     endret. Varselet går av seg selv; vil reiselederen ikke sende det,
     er det ett trykk. Nedtellingen her er bare til visning — den som
     teller, er serveren. */
  let stripeTimer = null;
  function visProgramStripe({ tripId, sekunder }) {
    let el = $("programstripe");
    if (!el) {
      el = document.createElement("div");
      el.id = "programstripe"; el.className = "programstripe";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    clearInterval(stripeTimer);
    let igjen = sekunder;
    const tegn = () => {
      el.innerHTML = `<span>Deltakerne varsles om at dagens program er endret om <b>${igjen} s</b></span>
        <button type="button" id="stoppVarsel">Ikke varsle</button>`;
      $("stoppVarsel").onclick = async () => {
        clearInterval(stripeTimer);
        el.innerHTML = `<span>${prikker()} Stopper varselet</span>`;
        try { await Api.avlysProgramVarsel(tripId); el.innerHTML = "<span>Deltakerne blir ikke varslet.</span>"; }
        catch (e) { el.innerHTML = `<span>${esc(e.message)}</span>`; }
        setTimeout(() => el.remove(), 2500);
      };
    };
    tegn();
    stripeTimer = setInterval(() => {
      igjen -= 1;
      if (igjen > 0) return tegn();
      clearInterval(stripeTimer);
      el.innerHTML = "<span>Varselet går ut til deltakerne nå.</span>";
      setTimeout(() => el.remove(), 2500);
    }, 1000);
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
    if (maal.deltakere && S.trip) { aapneDeltakere(); return true; }
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
  /* Skjelettet i oppstartsskjermen (index.html). Det skal vekk så snart
     skjermen har en melding å vise, ellers ligger meldingen skjult bak. */
  const skjelett = paa => document.documentElement.classList.toggle("skjelett", paa);

  function appKlar() {
    if (harSagtKlar) return;
    harSagtKlar = true;
    dispatchEvent(new Event("tripmate:klar"));
  }

  /* ───────────────── oppstart ───────────────── */
  /* Lenken fra «Del turkoden» har ?kode=XXXXXX (L3). Koden tas ut av
     adressen, så den ikke blir stående, og fylles inn der du blir med. */
  const innKode = (() => {
    try {
      const p = new URLSearchParams(location.search);
      const k = (p.get("kode") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      if (p.has("kode")) {
        p.delete("kode");
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
      }
      return k || null;
    } catch { return null; }
  })();

  async function boot() {
    iosTekststorrelse();
    if (innKode) setTimeout(() => {
      // Står du på skjemaet, fylles koden inn der. Er du alt inne i en
      // tur, åpnes «Bli med på en ny tur» med koden.
      if (!$("joinScreen").hidden) $("fCode").value = innKode;
      else if (!$("appScreen").hidden && S.trip && !S.trip.code.includes(innKode)) sheetJoinTrip(innKode);
    }, 1500);
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
      skjelett(false);
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
      if (hendelse && hendelse.programVarsel) return visProgramStripe(hendelse.programVarsel);
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
    skjelett(false);
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
    if (innKode && !$("fCode").value) $("fCode").value = innKode;

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
        Reiselederen må slippe deg inn før du ser programmet og chatten.
        Appen åpner turen av seg selv når du er sluppet inn.</p>
      <button class="btn primary big" id="sjekkIgjen">Sjekk nå</button>
      <button class="btn" style="width:100%;margin-top:10px" id="venterAnnen">Velg en annen tur</button>`;

    // Spør stille om igjen hvert sjette sekund, og med en gang appen
    // kommer fram igjen. Da slipper man å trykke for å se om det har skjedd.
    const sjekk = async stille => {
      if (sjekker) return;
      sjekker = true;
      try {
        const t = await Api.loadTrip(trip.id);
        if (t && !t.venter) { stoppVenting(); await openTrip(trip.id, t); return true; }
      } catch (e) {
        // Avvist: da finnes ikke medlemsraden lenger.
        if (e && e.utmeldt) { stoppVenting(); sjekker = false; utmeldt("Du ble ikke sluppet inn på turen."); return true; }
        /* ellers nettet: prøver igjen om litt */
      }
      finally { sjekker = false; }
      if (!stille) toast("Ikke sluppet inn ennå.");
      return false;
    };
    let sjekker = false;
    stoppVenting();
    ventetimer = setInterval(() => { if (!document.hidden) sjekk(true); }, 6000);
    ventesynlig = () => { if (!document.hidden) sjekk(true); };
    document.addEventListener("visibilitychange", ventesynlig);

    $("sjekkIgjen").addEventListener("click", async e => {
      const b = e.currentTarget;
      b.disabled = true; b.innerHTML = prikker() + " Sjekker";
      const inne = await sjekk(false);
      if (!inne) { b.disabled = false; b.textContent = "Sjekk nå"; }
    });

    $("venterAnnen").addEventListener("click", () => { stoppVenting(); S.trip = null; S.fraStart = true; showJoin(); });
  }
  let ventetimer = null, ventesynlig = null;
  function stoppVenting() {
    if (ventetimer) { clearInterval(ventetimer); ventetimer = null; }
    if (ventesynlig) { document.removeEventListener("visibilitychange", ventesynlig); ventesynlig = null; }
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
    // Hvem du har blokkert, hentes før meldingene vises.
    await Api.lastBlokkerte().catch(() => {});
    let trip = lagret;
    if (!trip) {
      $("bootMsg").innerHTML = venter("Henter turen");
      skjelett(true);
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
    // Kommer du fra «Venter på godkjenning», ligger den skjermen over
    // appen. Uten denne linja ble den liggende, og det så ut som om du
    // ikke var sluppet inn.
    $("authScreen").hidden = true;
    stoppVenting();
    $("appScreen").hidden = false;

    const p = Api.getProfile();
    $("avatarText").textContent = p ? p.initials : "–";

    render();

    /* Omvisningen første gang, og bare da. Den kommer etter at appen er
       tegnet: et ark over en tom skjerm forklarer ingenting, og det er
       verdt å se hva det snakkes om bak det. Blir en deltaker reiseleder
       senere, får hen reiselederens omvisning — det er en annen app å
       bruke. */
    if (!omvisningSett(trip.role === "leader" ? "leader" : "member")) {
      setTimeout(() => { if (S.trip && S.trip.id === tripId && !S.side) startOmvisning(); }, 700);
    }
    appKlar();
    if (!S.offline) {
      Api.subscribeTrip(tripId);
      Api.loadRecent(tripId).then(() => { if (S.tab === "chat" && !S.openChat) render(); }).catch(() => {});
      Api.lastVaer(tripId);
      Api.lastVarselvalg(tripId).catch(() => {});
      Api.lastPaameldinger(tripId);
      Api.erHer(tripId, null);
      if (trip.role === "leader") {
        sjekkVentende(tripId, false);
        Api.ryddGamleBilder();
      } else {
        S.ventende = 0;
        // Står navnet ditt på romlista, spør appen om det er deg.
        setTimeout(() => spoerOmRomplass(tripId).catch(() => {}), 1200);
      }
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

  /* ───────────────── program ─────────────────
     Én skjerm, ikke to. «I dag» og «Program» svarte på det samme med
     litt ulik innpakning — nå-kortet sto begge steder, dagens punkter
     sto begge steder — og da måtte man vite hvilken av de to som var
     stedet å se. Nå er det ett sted: nå-kortet øverst, dagsvelgeren
     under, og hele dagen i full lengde.

     Står du på en annen dag enn i dag, forsvinner nå-kortet. «Nå» er
     ikke om lørdag, og et kort om torsdag over lørdagens program ville
     sagt noe det ikke mente. */

  const fmtKortDato = dato => new Date(dato + "T12:00:00").toLocaleDateString("nb-NO", { day: "numeric", month: "long" });

  /* Hilsenen navngir dagen og dagens ene faktum: hvilken by den er i. */
  function dagTopp(d) {
    const trip = S.trip;
    const dagnavn = d
      ? cap(new Date(d.date + "T12:00:00").toLocaleDateString("nb-NO", { weekday: "long" }))
      : "Turen";
    const nr = d ? trip.days.findIndex(x => x.date === d.date) + 1 : 0;
    const sted = d ? dagensSted(d) : null;
    const by = sted ? byen(trip.places[sted]) : null;
    return `<div>
      <h1 class="daghilsen">${esc(by ? `${dagnavn} i ${by}` : dagnavn)}</h1>
      <p class="dagunder">${d ? `Dag ${nr} av ${trip.days.length} · ${esc(fmtKortDato(d.date))}` : esc(trip.name)}</p>
    </div>`;
  }

  /* Nå-kortet: det ene spørsmålet alle har hele tiden. Hva skjer nå,
     og hvor. */
  function naaKort() {
    const trip = S.trip;
    const ne = nextEvent(trip);
    const naa = new Date().toTimeString().slice(0, 5);

    let kort = "";
    if (ne) {
      const p = ne.item.place ? trip.places[ne.item.place] : null;
      // Skjer to ting på én gang, er ikke den ene mer «nå» enn den andre.
      // Kortet viste bare den første, og da sto halve dagen usynlig på
      // den skjermen folk faktisk ser om morgenen.
      const ogsaa = samtidigeMed(ne.day, ne.item, naa, Boolean(ne.naa));
      kort = `<section class="naakort">
        <div class="merk"><i></i>${ne.naa ? "Nå" + esc(sidenTekst(ne.item, naa))
          : ne.day.date === today() ? esc(tilNeste(ne.item, naa)) : "Neste · " + esc(ne.day.label)}</div>
        <div class="kl">${ne.item.t ? esc(tidTekst(ne.item)) : "—"}</div>
        <div class="hva">${esc(ne.item.title)}${vaerMerke(ne.item.place, ne.day.date, ne.item.t, dagensSted(ne.day))}</div>
        ${p ? `<div class="hvor">${esc(p.name)}${p.addr ? " · " + esc(p.addr) : ""}</div>` : ""}
        ${ogsaa.length ? `<div class="ogsaa">
          <div class="ogsaatopp">Samtidig</div>
          ${ogsaa.map(x => {
            const q = x.place ? trip.places[x.place] : null;
            return `<button class="ogsaarad" data-item="${esc(x.id)}">
              <span class="t">${esc(tidTekst(x))}</span>
              <span class="grow"><span class="h">${esc(x.title)}</span>
                ${q ? `<span class="s">${esc(q.name)}</span>` : ""}</span>
              <span class="ogsaavaer">${vaerMerke(x.place, ne.day.date, x.t, dagensSted(ne.day))}</span>
              <span class="pil">${ICON.chev}</span></button>`;
          }).join("")}
        </div>` : ""}
        <div class="knapper">
          ${p ? kartKnapp(p, "primar") : ""}
          ${ne.day.date !== today() && trip.days.some(x => x.date === ne.day.date)
            ? `<button class="btn" data-day="${esc(ne.day.date)}">Se den dagen</button>` : ""}
        </div>
      </section>`;
    } else {
      // «Turen er over» bare når siste dag er forbi. Før sto det der også
      // på en tur som nettopp var laget, eller når dagens siste punkt var
      // ferdig og turen fortsatte i morgen.
      const sisteDato = trip.days.reduce((m, d) => d.date > m ? d.date : m, "");
      const ingenPunkter = trip.days.every(d => !d.items.length);
      if (ingenPunkter) {
        // Lista under sier alt at dagen er tom. Et kort til med det samme
        // budskapet var to tomme meldinger over hverandre.
        kort = "";
      } else if (trip.days.every(d => d.date > today())) {
        const forste = trip.days.reduce((m, d) => !m || d.date < m ? d.date : m, "");
        kort = `<section class="naakort"><div class="merk"><i></i>Snart</div>
          <div class="hva" style="margin-top:2px">Turen starter ${esc(fmtKortDato(forste))}</div></section>`;
      } else if (sisteDato && sisteDato >= today()) {
        kort = `<section class="naakort"><div class="merk"><i></i>I dag</div>
          <div class="hva" style="margin-top:2px">Ikke mer på programmet i dag</div></section>`;
      } else {
        kort = `<section class="naakort"><div class="merk"><i></i>Ferdig</div>
          <div class="hva" style="margin-top:2px">Turen er over</div>
          <div class="hvor">Programmet ligger her så lenge du er med.</div></section>`;
      }
    }
    return kort;
  }

  /* ───────── det som venter på deg ─────────
     «I dag» er dagen. Praktisk lå nederst her før, og på en dag med
     tolv punkter sto det under bretten — man måtte vite at det var der
     for å finne det. Listene bor nå i Meg, og dette er det eneste som
     fortsatt hører hjemme på hjemskjermen: de tingene som venter på at
     du gjør noe. Venter ingenting, står det ingenting. */
  function ventePaaDeg() {
    const tall = S.megTall;
    if (!tall) return "";                    // ikke hentet ennå
    const leder = S.trip.role === "leader";
    const rader = [];

    const bytter = (tall.byttSeter || 0) + (tall.byttRom || 0);
    if (bytter) {
      rader.push({
        side: tall.byttSeter ? "seter" : "rom",
        hva: `${bytter} ${bytter === 1 ? "bytte venter" : "bytter venter"} på svar`,
        hvorfor: leder ? "Noen vil bytte plass eller rom" : "Noen har spurt deg"
      });
    }

    // Én rad per reise du mangler plass på, og bare der du kan velge selv.
    // Fordeler reiselederen, er det ikke noe du kan gjøre. «Fredag og
    // søndag» sier hva som mangler; «2 kjøretøy» sa det ikke.
    const reiser = har("seter") ? (tall.seteGrupper || []) : [];
    const mangler = reiser.filter(g => g.fritt && !g.harPlass);
    if (mangler.length) {
      rader.push({
        side: "seter",
        hva: reiser.length === 1 ? "Velg sitteplass"
          : `Velg sitteplass for ${oppramsing(mangler.map(g => reisenavn(g, reiser)))}`,
        hvorfor: "Sitteplasser"
      });
    }

    // Har reiselederen fordelingen, er det ikke noe du kan gjøre, og da
    // er det ikke noe som venter på deg heller.
    if (har("rom") && tall.rom && !tall.harRom && S.trip.romFritt) {
      rader.push({ side: "rom", hva: "Du har ikke valgt rom", hvorfor: "Rom" });
    }

    const igjen = (tall.pakkTotalt || 0) - (tall.pakkKrysset || 0);
    // Når turen har startet, er det for sent å pakke. Da maser ikke lista.
    const startet = S.trip.days.length && S.trip.days[0].date <= today();
    if (har("pakk") && igjen > 0 && !startet) {
      rader.push({
        side: "pakk",
        hva: `${igjen} ${igjen === 1 ? "ting" : "ting"} står ukrysset`,
        hvorfor: "Pakkeliste"
      });
    }

    if (!rader.length) return "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Venter på deg · ${rader.length}</div>
      <div class="card pad venterkompakt" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
        <div class="list">${rader.map(r => `<button class="listrow" data-side="${r.side}">
          <div class="grow"><div class="nm">${esc(r.hva)}</div></div>
          <span class="chev">${ICON.chev}</span></button>`).join("")}</div>
      </div></div>`;
  }

  /* Turens praktiske lister, samlet i Meg: pakkelista, plassen din,
     rommet ditt og nummeret man ringer. Tallene til høyre hentes én
     gang, og raden står der uansett — en tom verdi er bedre enn en rad
     som dukker opp etterpå og flytter alt nedover. */
  /* Med flere kjøretøy er det ikke ett setenavn å vise. Det som betyr
     noe er om du mangler en plass et sted. */
  function setetekst(tall) {
    if (!tall) return "";
    if (!tall.kjoretoy) return S.trip.role === "leader" ? "Ikke satt opp" : "";
    const reiser = tall.seteGrupper || [];
    const liste = tall.mineSeterListe || [];
    const mangler = reiser.filter(g => g.fritt && !g.harPlass).length;
    if (mangler) return reiser.length === 1 ? "Velg plass" : `Velg plass (${mangler})`;
    if (liste.length === 1) return plassnavn(liste[0].k, liste[0].nr);
    if (!liste.length) return "Ikke fordelt ennå";
    return reiser.every(g => g.harPlass) ? "Alt valgt" : `${liste.length} plasser`;
  }

  /* «fredag 20. nov.», eller «hele turen». Har samme dag både buss og tog,
     sier vi hvilken. */
  function reisenavn(g, alle) {
    const dag = g.dato
      ? new Date(g.dato + "T12:00").toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "short" })
      : "hele turen";
    const flere = alle.filter(x => x.dato === g.dato).length > 1;
    return flere && g.slag ? `${dag} (${g.slag === "tog" ? "tog" : "buss og bil"})` : dag;
  }
  const oppramsing = d => d.length < 2 ? (d[0] || "") : d.slice(0, -1).join(", ") + " og " + d[d.length - 1];

  /* Delene en tur kan ha (utvidelse-34). Program og chat har alle turer.
     Det som er av, vises ikke for noen, så en tur uten buss og rom ikke
     står full av tomme knapper. */
  const FUNKSJONER = [
    ["pakk", "Pakkeliste", "Felles liste. Hver deltaker krysser av for seg selv."],
    ["seter", "Sitteplasser", "Setekart for buss, tog og biler."],
    ["rom", "Rom", "Hvem som bor på hvilket rom."],
    ["dokumenter", "Dokumenter", "Billetter, heftet og forsikring."],
    ["kontakt", "Nødnummer", "Numre alle på turen kan ringe."],
    ["paaroerende", "Nærmeste pårørende", "Hver deltaker oppgir én person. Bare reiselederne ser det."],
    ["bilder", "Bilder i chatten", "Slettes 30 dager etter siste programdag."],
    ["opprop", "Opprop", "Hak av at alle er med. Bare for reiseledere."]
  ];
  // pårørende og bilder ligger i egne kolonner fra før, resten i funksjoner.
  function har(k) {
    const t = S.trip;
    if (!t) return true;
    if (k === "paaroerende") return t.paaroerende === true;
    if (k === "bilder") return t.bilder !== false;
    return !t.funksjoner || t.funksjoner[k] !== false;
  }

  function praktisk() {
    const tall = S.megTall;
    const leder = S.trip.role === "leader";
    const rad = (side, ikon, farge, navn, verdi) => `<button class="listrow" data-side="${side}">
          <span class="rikon${farge ? " " + farge : ""}">${ikon}</span>
          <div class="grow"><div class="nm">${navn}</div></div>
          ${verdi ? `<span class="verdi">${verdi}</span>` : ""}
          <span class="chev">${ICON.chev}</span></button>`;
    const rader = [
      har("pakk") && rad("pakk", ICON.sekk, "mose", "Pakkeliste",
        tall ? (tall.pakkTotalt ? `${tall.pakkKrysset} av ${tall.pakkTotalt}` : "") : ""),
      har("seter") && rad("seter", ICON.sete, "", "Sitteplasser", setetekst(tall)),
      har("rom") && rad("rom", ICON.nokkel, "grunn", "Rom", romtekst(tall)),
      (har("kontakt") || har("paaroerende")) && rad("kontakt", ICON.telefon, "gul", "Telefonnumre", ""),
      har("dokumenter") && rad("dokumenter", ICON.post, "", "Dokumenter", ""),
      leder && har("opprop") && rad("opprop", ICON.opprop, "", "Opprop", "")
    ].filter(Boolean);
    if (!rader.length) return "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Praktisk</div>
      <div class="gruppe"><div class="list">${rader.join("")}</div></div>
    </div>`;
  }

  /* Rommet er ett navn eller ingen. Reiselederen får vite hvor mange som
     mangler seng i stedet — det er hens spørsmål, ikke «hvor bor jeg». */
  function romtekst(tall) {
    if (!tall) return "";
    if (!tall.rom) return "Ikke satt opp";
    if (S.trip.role === "leader") return tall.romNavn ? `${tall.romNavn} · ${tall.rom} rom` : `${tall.rom} rom`;
    return tall.harRom ? (tall.romNavn || "Du har rom") : "Ikke tildelt";
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

  /* «Avreise 08:00» har ingen sluttid, men det skjer jo noe der. Uten en
     varighet er punktet et punkt uten utstrekning, og 08:00 holdt opp å
     være «nå» i samme sekund som klokka slo — kortet hoppet videre til
     neste mens folk fortsatt sto og gikk om bord. Derfor varer et punkt
     uten sluttid fem minutter. Det er bare for å avgjøre hva som skjer
     nå; i programmet står det fortsatt som ett klokkeslett. */
  const UTEN_SLUTT_MIN = 5;
  const sluttMinutt = i => minutt(i.t) + (i.minutter || UTEN_SLUTT_MIN);
  const paagaarNaa = (i, naa) => Boolean(i.t) && i.t <= naa && sluttMinutt(i) > minutt(naa);

  /* Hvor lenge til neste punkt i dag. «Nå snart» sto der også når det var
     timer igjen (E12). Under en time: minuttene. Ellers: klokkeslettet. */
  function tilNeste(i, naa) {
    if (!i.t) return "Neste";
    const d = minutt(i.t) - minutt(naa);
    if (d <= 1) return "Nå";
    if (d < 60) return `Om ${d} min`;
    return `Neste kl ${i.t}`;
  }

  /* «startet for 3 minutter siden», så det går an å se om man er sent ute. */
  function sidenTekst(i, naa) {
    const d = minutt(naa) - minutt(i.t);
    if (d <= 0) return "";
    return ` · startet for ${d} ${d === 1 ? "minutt" : "minutter"} siden`;
  }

  /* De andre punktene som deler tid med dette ene. «samtidige» svarer
     for hele dagen; her trengs naboene til ett punkt. */
  function samtidigeMed(dag, i, naa, paagaar) {
    if (!i.t) return [];
    if (paagaar) {
      // Kortet handler om dette oeyeblikket. Da er «samtidig» det som
      // faktisk kjoerer naa — ikke noe som overlapper, men ikke har
      // begynt. Et punkt uten varighet er et tidspunkt og paagaar aldri.
      return dag.items.filter(x => x.id !== i.id && paagaarNaa(x, naa));
    }
    // Ingenting paagaar: da er «samtidig» det som begynner i samme
    // oeyeblikk som det neste — to grupper som gaar hver sin vei 09:30.
    return dag.items.filter(x => x.id !== i.id && x.t && x.t === i.t);
  }

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
      const paagaar = d.items.find(i => paagaarNaa(i, t));
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


  /* Yr svarer med koder som «partlycloudy_day», og symbolene til Yr har
     nøyaktig de kodene som filnavn (MET Norway, MIT-lisens — se
     icons/vaer/LICENSE). Koden brukes rett, men bare hvis den ser ut som
     en kode: den kommer fra serveren og havner i en adresse. */
  const vaerKode = k => (/^[a-z_]{3,60}$/.test(String(k || "")) ? String(k) : null);

  /* Hva symbolet betyr, med ord. Står som alt-tekst, og i pillen når
     været er dårlig. */
  function vaerOrd(kode) {
    const k = String(kode || "");
    const lett = k.startsWith("light"), kraftig = k.startsWith("heavy");
    if (k.includes("thunder")) return "Torden";
    if (k.includes("sleet")) return lett ? "Litt sludd" : kraftig ? "Kraftig sludd" : "Sludd";
    if (k.includes("snow")) return lett ? "Litt snø" : kraftig ? "Kraftig snø" : "Snø";
    if (k.includes("showers")) return lett ? "Lette byger" : kraftig ? "Kraftige byger" : "Regnbyger";
    if (k.includes("rain")) return lett ? "Litt regn" : kraftig ? "Kraftig regn" : "Regn";
    if (k.startsWith("fog")) return "Tåke";
    if (k.startsWith("clearsky")) return "Klart";
    if (k.startsWith("fair")) return "Lettskyet";
    if (k.startsWith("partlycloudy")) return "Delvis skyet";
    if (k.startsWith("cloudy")) return "Skyet";
    return "Vær";
  }

  /* Vær som krever noe av deg: regn, torden, sludd og snø. Det får farge
     og ord. Alt annet står grått og stille ved siden av programmet. */
  function vaerSlag(kode) {
    const k = String(kode || "");
    if (k.includes("thunder")) return "storm";
    if (k.includes("snow") || k.includes("sleet")) return "snoe";
    if (k.includes("rain") || k.includes("showers")) return "regn";
    return null;
  }

  function vaerIkon(kode) {
    const k = vaerKode(kode);
    if (!k) return "";
    return `<img class="vaerikon" src="icons/vaer/${k}.svg" alt="${esc(vaerOrd(k))}" width="22" height="22" loading="lazy">`;
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
    const f = sted ? Api.vaerPunkt(sted, d.date, "09:00") : null;
    const e = sted ? Api.vaerPunkt(sted, d.date, "15:00") : null;
    if (!f && !e) {
      // Yr har varsel omtrent ti dager fram. Lenger fram er radene uten
      // vær, og det skal ikke se ut som om noe er galt.
      const harPosisjon = Object.values(S.trip.places).some(p => p.lat != null && p.lon != null);
      return harPosisjon && daysUntil(d.date) > 8
        ? `<p class="utenvarsel">Været kommer omtrent ti dager før, når Yr har varsel for dagen.</p>` : "";
    }
    const del = (v, nar) => v
      ? `<span class="dagdel"><em>${nar}</em> ${vaerIkon(v.sym)}${v.temp == null ? "" : ` <b>${Math.round(v.temp)}°</b>`}</span>`
      : "";
    return `<div class="dagvaer">${del(f, "formiddag")}${del(e, "ettermiddag")}</div>`;
  }
  /* Har ikke punktet et sted med koordinater, bruker vi hotellet den dagen.
     Vaeret er stort sett det samme i samme by, og det er byen folk lurer paa. */
  function vaerMerke(placeId, dato, tid, reserve) {
    let v = placeId ? Api.vaerPunkt(placeId, dato, tid) : null;
    if (!v && reserve && reserve !== placeId) v = Api.vaerPunkt(reserve, dato, tid);
    if (!v) return "";
    const ikon = vaerIkon(v.sym);
    const grader = v.temp == null ? "" : `${Math.round(v.temp)}°`;
    if (!ikon && !grader) return "";
    // Godt vær står grått og stille. Dårlig vær blir en pille med ord, så
    // det ikke drukner blant solsymbolene (variant B fra gjennomgangen).
    const slag = vaerSlag(v.sym);
    if (slag) {
      return `<span class="vaer daarlig ${slag}" title="Værmelding fra Yr">${ikon}<span>${esc(vaerOrd(v.sym))}</span>${
        grader ? ` <b>${grader}</b>` : ""}</span>`;
    }
    return `<span class="vaer" title="Værmelding fra Yr">${ikon}${grader ? `<b>${grader}</b>` : ""}</span>`;
  }
  // Den som venter på å bli sluppet inn, står øverst også her: Program
  // er fanen reiselederen åpner appen på.
  const viewProgram = () => venterkort() + viewProgramInnhold();
  function viewProgramInnhold() {
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

    const d = trip.days.find(x => x.date === S.day) || trip.days[0];
    const ne = nextEvent(trip);
    const idag = trip.days.find(x => x.date === today());
    const staarPaaIDag = Boolean(idag) && d.date === idag.date;
    const started = trip.days.some(x => x.date <= today());

    /* Toppen avhenger av hvor i turen du er, og hvilken dag du ser på.
       Før avreise er nedtellingen det eneste som betyr noe. Under turen,
       på dagens dato, er det nå-kortet. Står du på en annen dag, er det
       bare den dagen — «nå» hører ikke hjemme over lørdagens program. */
    let head = "";
    if (!started) {
      const n = daysUntil(trip.days[0].date);
      head = `<div class="countdown"><div class="eyebrow">Avreise</div>
        <b>${n === 0 ? "I dag" : n === 1 ? "I morgen" : "Om " + n + " dager"}</b>
        <p class="muted" style="margin-top:4px;color:var(--ink-2)">Første punkt: ${esc(trip.days[0].items[0] ? trip.days[0].items[0].title : "ikke lagt inn")}</p></div>`;
    } else if (staarPaaIDag) {
      head = naaKort() + ventePaaDeg();
    }

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
      // Det som er over i dag, dempes (E13). Det som gjenstår, er det man
      // leter etter.
      const naaKl = new Date().toTimeString().slice(0, 5);
      const over = d.date === today() && i.t && !isNext && sluttMinutt(i) <= minutt(naaKl);
      return `<div class="ev ${isNext ? "now" : ""}${over ? " over" : ""}" data-item="${esc(i.id)}" role="button" tabindex="0">
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
          ${p ? `<div class="place">${ICON.pin + esc(p.name)}</div>`
            : i.note ? `<div class="place"><span style="color:var(--ink-3)">${esc(i.note)}</span></div>` : ""}
          ${S.edit ? `<div class="redigerrad">
            <span class="draha" data-drag aria-label="Dra for å flytte">⠿</span>
            <button class="minibtn fare" data-delitem="${esc(i.id)}">Slett</button>
          </div>` : ""}
        </div>
      </div>`;
    }).join("") : `<p class="muted" style="padding:16px 0;text-align:center">${
      trip.role !== "leader" && trip.days.every(x => !x.items.length)
        ? "Reiselederen har ikke lagt inn programmet ennå." : "Ingen punkter denne dagen."}</p>`;

    return `
      ${dagTopp(d)}
      ${head}
      <div class="chips">${chips}</div>
      <div>
        <div class="eyebrow" style="margin-bottom:7px;display:flex;justify-content:space-between;gap:8px;align-items:center">
          <span>${hotel ? "Bor på " + esc(hotel.name) : ""}</span>
          <span style="display:flex;gap:16px">
            ${trip.days.some(x => x.items.some(i => i.t)) && !S.edit ? `<button class="linkbtn" style="font-size:11px" data-kalender="1">Til kalender</button>` : ""}
            ${leader ? `<button class="linkbtn" style="font-size:11px" data-edit>${S.edit ? "Ferdig" : "Rediger"}</button>` : ""}
          </span>
        </div>
        ${dagensVaer(d)}
        ${S.edit ? `<p class="muted" style="margin:0 0 9px;font-size:13px">Punkter med klokkeslett står alltid etter tiden. Dra for å flytte punkter uten tid, eller punkter som starter samtidig.</p>` : ""}
        <div class="card pad"><div class="tl">${rows}</div></div>
      </div>
      ${leader ? `<div class="stack">
        <button class="btn primary" data-sheet="additem" data-day="${esc(d.id)}">Legg til programpunkt</button>
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

  function actionCard(a, msgId, m) {
    const p = S.trip.places[a.place];
    if (!p) return "";
    const day = Parse.dayOf(S.trip, a.date);
    // Skrev en reiseleder møtestedet, får de andre lederne tilbud om å
    // legge det inn i programmet. Deltakerne ser bare veibeskrivelsen.
    const leder = S.trip.role === "leader";
    const fraLeder = m && m.role === "Reiseleder";
    const iProgrammet = m && m.iProgrammet;
    const tilbud = leder && fraLeder && !iProgrammet && day && !Api.erSkjultForslag(msgId)
      ? `<div class="kartprogram">
           <button class="btn" data-iprog="${esc(msgId)}">Legg i programmet</button>
           <button class="linkbtn" data-taned="${esc(msgId)}">Ta ned</button>
         </div>`
      : leder && iProgrammet ? `<div class="kartprogram"><span class="tag moss">I programmet</span></div>` : "";
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
        ${tilbud}
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

    return `<input type="search" id="sokFelt" class="sokfelt" placeholder="Søk i chattene" autocomplete="off" aria-label="Søk i chattene">
      <div id="sokTreff"></div>
      <div id="chatlistBoks">
      <div class="chatlist">${rows}</div>
      <button class="btn" data-sheet="newchannel" style="width:100%">Ny chat</button>

      </div>`;
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
        ${m.action ? actionCard(m.action, m.id, m) : ""}
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
  /* Valgene for en melding, slik Meldinger på iPhone gjør det: hold på
     meldingen, så løftes den fram, resten av samtalen blurres, emojiene
     står i en kapsel over meldingen og valgene i en liste under. Før var
     dette et ark med seks emojier og en stabel knapper.

     «del» sier om du holdt på bildet eller teksten i en melding med begge;
     da gjelder slettingen den delen. */
  function sheetEmoji(id, del) {
    const m = Api.messages(S.openChat).find(x => x.id === id);
    if (!m) return;
    const rea = Api.reactions(S.openChat, id);
    const bilde = m.bilde;
    const txt = m.txt || "";
    const viserBilde = bilde && del !== "tekst";
    const viserTekst = txt && del !== "bilde";
    const kanSlette = m.mine || S.trip.role === "leader";
    if (viserBilde) forberedBlob(bilde);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    // Er det bare den ene delen igjen etterpå, slettes hele meldingen.
    const valg = [];
    const rad = (tekst, ikon, attr, fare) => valg.push(
      `<button class="kmvalg${fare ? " fare" : ""}" ${attr}><span>${esc(tekst)}</span>${ikon}</button>`);
    rad("Svar", ICON.svar, `data-svar="${esc(id)}"`);
    if (viserTekst) rad("Kopier", ICON.kopi, `data-kopimeld="${esc(txt)}"`);
    if (viserBilde) rad("Lagre bildet", ICON.last, `data-lagrebilde="${esc(bilde)}"`);
    if (rea.length) rad("Se hvem som reagerte", ICON.folk, `data-reaksjoner="${esc(id)}"`);
    if (!m.mine && m.authorId) {
      rad("Rapporter", ICON.flagg, `data-rapporter="${esc(id)}"`);
      rad(`Blokker ${fornavn(m.who)}`, ICON.stopp, `data-blokker="${esc(m.authorId)}" data-navn="${esc(m.who)}"`, true);
    }
    if (kanSlette) {
      const slettBilde = () => rad("Slett bildet", ICON.soppel, txt ? `data-slettbilde="${esc(bilde)}"` : `data-delmsg="${esc(id)}"`, true);
      const slettTekst = () => rad(bilde ? "Slett teksten" : "Slett", ICON.soppel, bilde ? `data-deltekst="${esc(id)}"` : `data-delmsg="${esc(id)}"`, true);
      if (del === "bilde") (bilde ? slettBilde : slettTekst)();
      else if (del === "tekst") (txt ? slettTekst : slettBilde)();
      else { if (bilde) slettBilde(); if (txt) slettTekst(); }
    }

    const mine = new Set(rea.filter(r => r.min).map(r => r.emoji));
    const bg = document.createElement("div");
    bg.className = "kontekst-bg";
    bg.innerHTML = `
      <div class="kontekst${m.mine ? " meg" : ""}">
        <div class="kmemoji" role="group" aria-label="Reager">
          ${EMOJIER.map(e => `<button class="${mine.has(e) ? "valgt" : ""}" data-emoji="${e}" data-pa="${esc(id)}" aria-label="Reager med ${e}">${e}</button>`).join("")}
        </div>
        <div class="kmmelding"></div>
        <div class="kmliste" role="menu">${valg.join("")}</div>
      </div>`;
    document.body.appendChild(bg);

    // Meldingen selv, løftet fram der den sto. Står den ikke på skjermen
    // (valgene ble åpnet fra bildet i full skjerm), vises bare utdraget.
    const kilde = document.getElementById("msg-" + id);
    const holder = bg.querySelector(".kmmelding");
    const del2 = kilde && (viserBilde && !viserTekst ? kilde.querySelector(".bildeboks")
                        : viserTekst && !viserBilde ? kilde.querySelector(".bubble")
                        : kilde.querySelector(".bildeboks") || kilde.querySelector(".bubble"));
    const r0 = del2 ? del2.getBoundingClientRect() : null;
    if (del2 && r0.bottom > 0 && r0.top < innerHeight) {
      const kopi = del2.cloneNode(true);
      kopi.removeAttribute("data-bilde");
      kopi.style.width = r0.width + "px";
      holder.appendChild(kopi);
    } else {
      holder.innerHTML = `<div class="bubble">${esc(txt.slice(0, 160) || "Bilde")}${txt.length > 160 ? "…" : ""}</div>`;
    }

    /* Plassering: meldingen blir der den var, emojiene over og valgene
       under. Får ikke alt plass, skyves hele gruppa opp eller ned så den
       holder seg på skjermen — slik Meldinger gjør. */
    const gruppe = bg.querySelector(".kontekst");
    const plasser = () => {
      const h = gruppe.getBoundingClientRect().height;
      const emojiH = bg.querySelector(".kmemoji").getBoundingClientRect().height + 10;
      const topp = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-t")) || 0;
      const marg = 12;
      let y = r0 && del2 && holder.querySelector(".bildeboks, .bubble") === holder.firstElementChild && r0.top > 0
        ? r0.top - emojiH : (innerHeight - h) / 2;
      y = Math.max(topp + marg + 40, Math.min(y, innerHeight - h - marg - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-b")) || 0)));
      gruppe.style.top = y + "px";
      if (r0 && del2) {
        if (m.mine) gruppe.style.right = Math.max(10, innerWidth - r0.right) + "px";
        else gruppe.style.left = Math.max(10, r0.left) + "px";
      }
    };
    plasser();
    haptikk("tung");
    requestAnimationFrame(() => bg.classList.add("inne"));

    const lukk = () => {
      bg.classList.remove("inne");
      bg.classList.add("ut");
      setTimeout(() => bg.remove(), 220);
    };
    // Et valg gjør jobben sin i den vanlige klikkbehandleren (den ligger på
    // dokumentet og får klikket etterpå). Her lukkes bare menyen.
    // Slipper du fingeren etter holdet, lager telefonen et klikk der
    // fingeren var — og der ligger nå menyen. Det klikket skal ikke telle:
    // bare trykk som begynner etter at menyen kom fram.
    let klar = false;
    bg.addEventListener("pointerdown", () => { klar = true; });
    bg.addEventListener("click", e => {
      if (!klar) { e.stopPropagation(); e.preventDefault(); return; }
      if (e.target.closest("[data-emoji],[data-svar],[data-kopimeld],[data-lagrebilde],[data-reaksjoner],[data-rapporter],[data-reaksjoner],[data-blokker],[data-slettbilde],[data-deltekst],[data-delmsg]")) {
        lukk();
        return;
      }
      if (!e.target.closest(".kmliste, .kmemoji")) { e.stopPropagation(); lukk(); }
    });
    kontekstLukk = lukk;
  }
  let kontekstLukk = null;

  function sheetReaksjoner(id) {
    const rea = Api.reactions(S.openChat, id);
    openSheet(`<h3>Reaksjoner</h3>
      <div class="gruppe"><div class="list">${rea.map(r => `<div class="listrow bar">
        <span style="font-size:22px;line-height:1">${esc(r.emoji)}</span>
        <div class="grow"><div class="nm" style="white-space:normal">${esc(r.navn.join(", "))}</div></div>
      </div>`).join("")}</div></div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* ───────── rapportere og blokkere (Apple 1.2) ───────── */
  const GRUNNER = ["Trakassering eller mobbing", "Hat eller trusler", "Seksuelt innhold", "Noe annet som ikke hører hjemme her"];
  function sheetRapporter(id) {
    const m = Api.messages(S.openChat).find(x => x.id === id);
    if (!m) return;
    openSheet(`<h3>Rapporter</h3>
      <p class="lede">Rapporten går til reiselederne og til TripMate. Reiselederne ser ikke hvem som sendte den.</p>
      <form id="rpForm">
        <div class="stack">${GRUNNER.map((g, i) => `<label class="pick">
          <input type="radio" name="rpGrunn" value="${esc(g)}"${i === 0 ? " checked" : ""}><span><b>${esc(g)}</b></span></label>`).join("")}</div>
        <div class="field" style="margin-top:14px"><label for="rpMer">Mer du vil si (valgfritt)</label>
          <input id="rpMer" maxlength="300" autocomplete="off"></div>
        <p class="err" id="rpErr" hidden></p>
        <button class="btn primary big" type="submit" id="rpSend">Send rapport</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);
    $("rpForm").addEventListener("submit", async e => {
      e.preventDefault();
      const valgt = document.querySelector('input[name="rpGrunn"]:checked');
      const mer = $("rpMer").value.trim();
      const btn = $("rpSend"); btn.disabled = true; btn.textContent = "Sender…";
      try {
        await Api.rapporter({
          tripId: S.trip.id, messageId: m.id, gjelder: m.authorId, gjelderNavn: m.who,
          grunn: (valgt ? valgt.value : GRUNNER[3]) + (mer ? ": " + mer : ""),
          utdrag: m.txt || (m.bilde ? "[bilde]" : "")
        });
        closeSheet();
        // Rapporten er sendt; spør om personen også skal blokkeres, slik
        // man forventer etter å ha rapportert noe.
        if (await bekreft(`Takk. Rapporten er sendt, og blir sett på innen 24 timer.\n\nVil du også blokkere ${m.who}? Da ser du ikke meldingene deres lenger.`,
          { ja: `Blokker ${fornavn(m.who)}`, nei: "Nei takk", fare: true })) {
          await Api.blokker(m.authorId, m.who);
          render();
        }
      } catch (err) {
        btn.disabled = false; btn.textContent = "Send rapport";
        const e2 = $("rpErr"); e2.textContent = "Klarte ikke sende rapporten. Sjekk nettet og prøv igjen."; e2.hidden = false;
      }
    });
  }

  async function blokkerPerson(id, navn) {
    if (!await bekreft(`Blokkere ${navn}?\n\nDu ser ikke meldingene deres lenger, i noen tur. ${fornavn(navn)} får ikke vite det. Du kan oppheve det under Meg.`,
      { ja: "Blokker", fare: true })) return;
    try { await Api.blokker(id, navn); closeSheet(); render(); toast(`${navn} er blokkert.`); }
    catch { toast("Klarte ikke blokkere. Sjekk nettet og prøv igjen."); }
  }

  function sheetBlokkerte() {
    const liste = Api.blokkertListe();
    openSheet(`<h3>Blokkerte personer</h3>
      <p class="lede">Du ser ikke meldinger fra disse. De vet ikke at de er blokkert.</p>
      <div class="memberlist">${liste.map(p => `<div class="person"><span>${esc(p.navn || "Ukjent")}</span>
        <button class="linkbtn" data-opphevblokk="${esc(p.id)}">Opphev</button></div>`).join("")
        || '<p class="muted" style="padding:10px">Du har ikke blokkert noen.</p>'}</div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* Reiselederen får rapportene på turen sin, uten navnet på den som
     rapporterte. Tre utfall: slett meldingen, ta personen ut av turen,
     eller marker den som ferdig. */
  async function sheetRapportliste() {
    const liste = await Api.rapportListe(S.trip.id);
    S.rapporter = liste;
    openSheet(`<h3>Rapporter</h3>
      <p class="lede">Deltakere har rapportert dette. Se på det snart; TripMate lover svar innen 24 timer.</p>
      ${liste.map(r => `<div class="card pad" style="margin-bottom:10px">
        <div class="nm" style="font-weight:600">${esc(r.navn || "Ukjent")}</div>
        <div class="sub muted" style="font-size:13.5px;margin:2px 0 8px">${esc(r.grunn)}</div>
        ${r.utdrag ? `<p style="margin:0 0 12px;padding:10px 12px;background:var(--surface-2);border-radius:10px;font-size:14.5px">${esc(r.utdrag)}</p>` : ""}
        <div class="stack">
          ${r.messageId ? `<button class="btn danger" data-rappslett="${esc(r.id)}">Slett meldingen</button>` : '<p class="muted" style="margin:0;font-size:13.5px">Meldingen er alt slettet.</p>'}
          ${r.megSelv ? "" : `<button class="btn" data-rappfjern="${esc(r.id)}">Ta ${esc(fornavn(r.navn || "personen"))} ut av turen</button>`}
          <button class="btn" data-rappferdig="${esc(r.id)}">Ferdig, ingenting mer å gjøre</button>
        </div></div>`).join("") || '<p class="muted">Ingen rapporter venter.</p>'}
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

    /* En dag uten punkter er sjelden en tom dag — den er en dag som ikke
       er lagt inn ennå. Deltakeren ser «Ingen punkter denne dagen» og
       tror det er svaret.

       De tre oppgavene under kan ikke skjules: de forsvinner av seg selv
       i samme øyeblikk som de er gjort, og et skjul-flagg for dem måtte
       hatt en kolonne i basen å ligge i. */
    for (const d of S.trip.days) {
      if (d.items.length) continue;
      ut.push({
        hva: `${cap(d.label)} har ingen punkter`,
        hvorfor: "Deltakerne ser en tom dag",
        sheet: "additem", slag: "tomdag", id: d.id
      });
    }

    /* Det som venter på en avgjørelse fra deg, og det som ikke er
       fordelt. Tallene kommer fra Meg-tallene, så de står først når de
       er hentet — en oppgave som gjetter er verre enn en som venter. */
    const tall = S.megTall;
    if (tall) {
      const bytter = (tall.byttSeter || 0) + (tall.byttRom || 0);
      if (bytter) ut.push({
        hva: `${bytter} ${bytter === 1 ? "bytte" : "bytter"} venter på deg`,
        hvorfor: "Noen vil bytte plass eller rom",
        side: tall.byttSeter ? "seter" : "rom", slag: "bytte", id: "bytte"
      });

      if (tall.rom && tall.utenRom) ut.push({
        hva: `${tall.utenRom} uten seng`,
        hvorfor: "Turen har rom, men ikke alle har fått et",
        side: "rom", slag: "utenrom", id: "utenrom"
      });
    }

    return ut;
  }

  async function skjulOppgave(slag, id, skjul) {
    try {
      await Api.setIgnorer(slag, id, skjul);
      await openTrip(S.trip.id);
      S.tab = "turen"; render();
      toast(skjul ? "Skjult. Du finner den under «Skjulte»." : "Tatt fram igjen.");
    } catch {
      toast("Klarte ikke lagre. Prøv igjen om litt.");
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
    // I iOS-appen er TripMate alt en app. Et kort om Safari og hjemskjermen
    // ville vært feil der, og kan gi avslag hos Apple.
    if (paaHjemskjerm() || erNativ()) return "";
    try { if (localStorage.getItem("tk.skjulInstall")) return ""; } catch { /* uviktig */ }

    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const hvordan = installValg
      ? `<button class="btn primary" style="margin-top:12px" id="installKnapp">Legg til appen</button>`
      : iOS
      ? `<p style="margin:9px 0 0;font-size:13.5px;color:var(--ink-2)">
           Trykk delingsknappen nederst i Safari, og velg <b>Legg til på Hjem-skjerm</b>.</p>`
      : `<p style="margin:9px 0 0;font-size:13.5px;color:var(--ink-2)">
           I nettlesermenyen finner du <b>Installer</b> eller <b>Legg til på startsiden</b>.</p>`;

    return `<div class="card pad" style="padding-block:15px;border-color:color-mix(in srgb, var(--blue) 45%, var(--line))">
      <b style="font-family:"DM Sans",sans-serif;font-size:14.5px">Legg TripMate på hjemskjermen</b>
      <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">
        Da åpnes den som en app, husker deg${iOS
          ? ", og varsler begynner å virke — på iPhone finnes de bare for apper på hjemskjermen"
          : " og kan gi deg varsler"}.</p>
      ${hvordan}
      <button class="linkbtn" style="font-size:13px" id="skjulInstall">Ikke nå</button>
    </div>`;
  }

  /* Hva mangler i turen? Lista lå øverst i Meg, men den handler om
     turen og ikke om kontoen din, og den er reiselederens — derfor
     står den nå først på fanen Turen, der resten av det samme er. */
  function maaOrdnes() {
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
      return `<div class="ordnes">
        <div class="eyebrow" style="margin-bottom:8px;color:var(--moss)">Alt er i orden</div>
        <div class="card pad" style="padding-block:14px;border-color:color-mix(in srgb, var(--moss) 45%, var(--line))">
          <p class="muted" style="margin:0">${skjulte.length
            ? "Ingenting venter på deg. Det du har krysset av ligger under."
            : "Alle steder har adresse, og alle dager har hotell."}</p>
        </div>
        ${skjultLenke}
      </div>`;
    }

    return `<div class="ordnes">
      <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Må ordnes · ${o.length}</div>
      <div class="card pad" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
        <div class="list">${o.map(x => `<div class="oppgave">
          <button class="listrow" ${x.side
            ? `data-side="${esc(x.side)}"`
            : `data-sheet="${esc(x.sheet)}" data-place="${esc(x.id)}" data-day="${esc(x.id)}"`}>
            <div class="grow"><div class="nm">${esc(x.hva)}</div><div class="sub">${esc(x.hvorfor)}</div></div>
            <span class="chev">${ICON.chev}</span>
          </button>
          ${x.slag === "day" || x.slag === "place"
            ? `<button class="linkbtn skjulknapp" data-skjul="${esc(x.slag)}" data-skjulid="${esc(x.id)}">Ikke nødvendig</button>`
            : ""}
        </div>`).join("")}</div>
      </div>
      ${o.some(x => /Fant ikke posisjonen/.test(x.hva))
        ? S.vaerJobber
          ? `<p class="muted" style="margin:10px 0 0;font-size:13px">${prikker()} Slår opp adressene. Dette tar et halvt minutt — kartet tåler ett spørsmål i sekundet.</p>`
          : `<button class="linkbtn" style="font-size:13px" data-vaerigjen="1">Slå opp adressene på nytt</button>`
        : ""}
      ${skjultLenke}
    </div>`;
  }

  /* ───────────────── Turen ─────────────────
     Alt som gjelder turen, men ikke programmet: det praktiske, folkene,
     og koden som slipper dem inn. Det lå i Meg før, nederst mellom
     e-postadresse og kartvalg — og da måtte man vite at det var der.

     Må ordnes står øverst. Det er reiselederens liste over hva som
     mangler i turen, og den hører hjemme her og ikke blant kontoen. */
  /* Turen slettes av seg selv 60 dager etter siste programdag (L10). En
     uke før står det øverst for reiselederen, med to valg. */
  const sletteTekst = dato => cap(new Date(dato + "T12:00:00").toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" }));
  function slettekort() {
    const t = S.trip;
    if (!t || t.role !== "leader" || !t.slettes) return "";
    const n = daysUntil(t.slettes);
    if (n > 7) return "";
    return `<div class="card pad" style="padding-block:14px;border-color:color-mix(in srgb, var(--danger) 45%, var(--line))">
      <b style="font-family:"DM Sans",sans-serif;font-size:14.5px">${n <= 0 ? "Turen slettes i natt" : `Turen slettes om ${n} ${n === 1 ? "dag" : "dager"}`}</b>
      <p style="margin:6px 0 12px;font-size:13.5px;color:var(--ink-2)">${esc(sletteTekst(t.slettes))}. Program, chatter, bilder og
        deltakerlister forsvinner for alle. Trenger dere noe fra turen, kan du utsette.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-utsett="1">Utsett 30 dager</button>
        <button class="btn danger" data-deltrip="${esc(t.id)}">Slett nå</button>
      </div></div>`;
  }

  function sheetSletting() {
    const t = S.trip;
    openSheet(`<h3>Sletting etter turen</h3>
      <p class="lede">Turen slettes automatisk <b>${esc(sletteTekst(t.slettes))}</b>. Det er 60 dager etter siste
        programdag, eller datoen du har utsatt til. Bildene slettes alt 30 dager etter siste dag.</p>
      <p class="muted">Slik ligger det ikke igjen opplysninger om deltakerne lenger enn turen trenger.
        En uke før sletting står det øverst under Turen.</p>
      <div class="stack" style="margin-top:12px">
        <button class="btn" data-utsett="1">Utsett 30 dager</button>
        <button class="btn danger" data-deltrip="${esc(t.id)}">Slett turen nå</button>
      </div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* Noen venter på å bli sluppet inn. Før måtte reiselederen gå inn i
     Deltakere for å se det. Nå står det øverst i Program og Turen, og
     kommer det en ny mens appen er framme, sier appen fra. Lista sjekkes
     hvert tjuende sekund mens appen vises (varsler på telefonen kommer
     når push er på plass). */
  let ventetimerLeder = null;
  async function sjekkVentende(tripId, varsle) {
    if (!S.trip || S.trip.id !== tripId || S.trip.role !== "leader") return;
    const liste = await Api.ventendeListe(tripId).catch(() => null);
    if (!liste || !S.trip || S.trip.id !== tripId) return;
    const kjente = new Set((S.ventendeListe || []).map(x => x.id));
    const nye = liste.filter(x => !kjente.has(x.id));
    const endret = liste.length !== (S.ventendeListe || []).length || nye.length;
    S.ventendeListe = liste;
    S.ventende = liste.length;
    if (varsle && nye.length && S.side !== "deltakere") {
      toast(nye.length === 1 ? `${nye[0].navn} vil bli med på turen` : `${nye.length} vil bli med på turen`, { deltakere: true });
    }
    if (endret) {
      if (S.side === "deltakere") aapneDeltakere(true); else render();
    }
    clearTimeout(ventetimerLeder);
    ventetimerLeder = setTimeout(function igjen() {
      if (document.hidden) { ventetimerLeder = setTimeout(igjen, 20000); return; }
      sjekkVentende(tripId, true);
    }, 20000);
  }
  function venterkort() {
    const liste = S.ventendeListe || [];
    if (S.trip.role !== "leader" || !liste.length) return "";
    const tittel = liste.length === 1 ? `${liste[0].navn} venter på å bli med`
      : `${liste.length} venter på å bli med`;
    return `<div class="card venterkort">
        <button class="listrow" data-sheet="deltakere">
          <span class="rikon gul">${ICON.folk}</span>
          <div class="grow"><div class="nm">${esc(tittel)}</div>
            <div class="sub">Slipp inn eller avvis</div></div>
          <span class="chev">${ICON.chev}</span></button>
      </div>`;
  }

  function rapportkort() {
    const n = (S.rapporter || []).length;
    if (S.trip.role !== "leader" || !n) return "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px;color:var(--danger)">Rapportert · ${n}</div>
      <div class="card pad" style="border-color:color-mix(in srgb, var(--danger) 40%, var(--line))">
        <div class="list"><button class="listrow" data-sheet="rapporter">
          <div class="grow"><div class="nm">${n === 1 ? "En melding er rapportert" : `${n} meldinger er rapportert`}</div>
            <div class="sub">Se på det og bestem hva som skal skje</div></div>
          <span class="chev">${ICON.chev}</span></button></div>
      </div></div>`;
  }

  function viewTuren() {
    const trip = S.trip;
    const leder = trip.role === "leader";
    return `
      ${venterkort()}
      ${rapportkort()}
      ${slettekort()}
      ${maaOrdnes()}
      ${praktisk()}

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Turen</div>
        <div class="gruppe"><div class="list">
          <button class="listrow" data-sheet="deltakere">
            <span class="rikon">${ICON.folk}</span>
            <div class="grow"><div class="nm">Deltakere${S.ventende ? '<span class="prikkmerke"></span>' : ""}</div></div>
            <span class="verdi"${S.ventende ? ' style="color:var(--amber)"' : ""}>${S.ventende
              ? `${S.ventende} venter` : ""}</span>
            <span class="chev">${ICON.chev}</span></button>

          ${leder ? `<button class="listrow" data-sheet="importpdf">
            <span class="rikon">${ICON.last}</span>
            <div class="grow"><div class="nm">Les inn program fra PDF</div></div>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          ${leder ? `<button class="listrow" data-sheet="funksjoner">
            <span class="rikon mose">${ICON.koffert}</span>
            <div class="grow"><div class="nm">Funksjoner</div></div>
            <span class="verdi">${FUNKSJONER.filter(([k]) => har(k)).length} av ${FUNKSJONER.length}</span>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          ${leder ? `<button class="listrow" data-sheet="endretur">
            <span class="rikon grunn">${ICON.blyant}</span>
            <div class="grow"><div class="nm">Navn og dato</div></div>
            <span class="verdi">${esc(trip.dates || trip.name)}</span>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          <button class="listrow" data-side="turkode">
            <span class="rikon grunn">${ICON.nokkel}</span>
            <div class="grow"><div class="nm">Turkode</div></div>
            <span class="verdi mono" style="letter-spacing:.08em">${esc(trip.code)}</span>
            <span class="chev">${ICON.chev}</span></button>

          ${leder && trip.slettes ? `<button class="listrow" data-sheet="sletting">
            <span class="rikon grunn">${ICON.cal}</span>
            <div class="grow"><div class="nm">Slettes automatisk</div></div>
            <span class="verdi">${esc(sletteTekst(trip.slettes))}</span>
            <span class="chev">${ICON.chev}</span></button>` : ""}

        </div></div>
      </div>`;
  }

  function viewMe() {
    const p = Api.getProfile();
    const tall = S.megTall;              // null til de er hentet
    const trip = S.trip;
    const varslerAv = varslerErAv();
    const varselTekst = erNativ() ? "Kommer snart"
      : varslerAv
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
      ${installkort()}

      <button class="megkort" data-sheet="endrenavn" aria-label="Endre navnet ditt">
        <span class="megava">${esc(p ? p.initials : "–")}</span>
        <span class="grow">
          <b>${esc(p ? p.name : "Du")}</b>
          <small>${trip.role === "leader" ? "Reiseleder" : "Deltaker"} på ${esc(trip.name)} · trykk for å endre navn</small>
        </span>
        ${Api.erAnonym() ? '<span class="tag amber">gjest</span>' : ""}
      </button>


      <div>
        <div class="eyebrow" style="margin-bottom:8px">Appen</div>
        <div class="gruppe"><div class="list">
          <button class="listrow" data-sheet="varsler">
            <span class="rikon gul">${ICON.bjelle}</span>
            <div class="grow"><div class="nm">Varsler${varslerAv ? '<span class="prikkmerke"></span>' : ""}</div></div>
            <span class="verdi"${varslerAv ? ' style="color:var(--amber)"' : ""}>${esc(varselTekst)}</span>
            <span class="chev">${ICON.chev}</span></button>

          ${S.superadmin ? `<button class="listrow" data-side="tilgang">
            <span class="rikon mose">${ICON.nokkel}</span>
            <div class="grow"><div class="nm">Tilgangskoder</div></div>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          ${Api.blokkertListe().length ? `<button class="listrow" data-sheet="blokkerte">
            <span class="rikon grunn">${ICON.folk}</span>
            <div class="grow"><div class="nm">Blokkerte personer</div></div>
            <span class="verdi">${Api.blokkertListe().length}</span>
            <span class="chev">${ICON.chev}</span></button>` : ""}

          <button class="listrow" data-sheet="omvisning">
            <span class="rikon mose">${ICON.info}</span>
            <div class="grow"><div class="nm">Omvisning i appen</div></div>
            <span class="chev">${ICON.chev}</span></button>
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
            <span class="verdi">${Api.erAnonym() ? (erNativ() ? "Bare på denne telefonen" : "Bare i denne nettleseren") : esc(Api.minEpost() || "Innlogget")}</span>
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
        ${Api.erAnonym() ? `<p class="muted" style="margin-top:7px">${erNativ()
          ? "Bytter du telefon eller sletter appen mens du er gjest, er turene borte."
          : "Bytter du telefon eller tømmer nettleserdata mens du er gjest, er turene borte."}</p>` : ""}

        <div class="gruppe" style="margin-top:14px"><div class="list">
          <button class="listrow bar fare" data-leave="${esc(trip.id)}">Meld deg av ${esc(trip.name)}</button>
          ${trip.erEier || trip.erAdmin
            ? `<button class="listrow bar fare" data-deltrip="${esc(trip.id)}">Slett hele turen</button>` : ""}
          <button class="listrow bar fare" id="resetBtn">Logg ut på denne enheten</button>
        </div></div>

        <!-- Sletting av kontoen lå som den fjerde raden i en stabel med
             faregrep, rett under «Logg ut». Den kan ikke angres, og en
             som bladde nedover kunne treffe den i farta. Nå ligger den
             bak et ark som forteller hva som skjer før man kan trykke. -->
        <p style="text-align:center;margin:14px 0 0;font-size:14px;color:var(--ink-3)">
          <button type="button" class="linkbtn" data-sheet="slettkonto"
            style="color:var(--ink-3)">Slett kontoen min</button>
        </p>
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
      const sidenavn = { deltakere: "Deltakere og roller", varsler: "Varsler", chat: "Om chatten", rom: "Rom",
                         pakk: "Pakkeliste", seter: "Sitteplasser",
                         kontakt: "Telefonnumre", opprop: "Opprop", dokumenter: "Dokumenter",
                         tilgang: "Tilgangskoder", turkode: "Turkode" };
      const kj = side === "seter" && S.seteKj && S.setekart && S.setekart.kjoretoy.find(k => k.id === S.seteKj);
      $("convName").textContent = kj ? kj.navn : (sidenavn[side] || "");
      $("convSub").textContent = kj ? "Sitteplasser" : side === "tilgang" ? "For TripMate" : S.trip.name;
    } else if (conv) {
      $("convName").textContent = conv.name;
      $("convSub").textContent = conv.ledere ? "Bare reiseledere · følger lederrollen"
        : conv.private ? "Privat · bare de som er lagt til"
        : conv.bareLedere ? "Oppslagstavle · reiselederne skriver"
        : "Åpen for alle på turen";
      $("convWho").dataset.members = conv.id;
    } else {
      $("tripName").textContent = S.trip.name;
      // Turkoden hører hjemme på sin egen side, ikke øverst på skjermen.
      $("tripSub").textContent = [S.trip.org, S.trip.dates].filter(Boolean).join(" · ");
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
    const visning = side ? side + (side === "seter" ? S.seteKj || "" : "") : S.tab + (S.openChat || "");
    const byttetVisning = visning !== S.sisteVisning;
    S.sisteVisning = visning;

    $("screen").innerHTML = side === "varsler" ? viewVarsler()
                          : side === "chat" ? viewChatside()
                          : side === "pakk" ? viewPakk()
                          : side === "seter" ? viewSeter()
                          : side === "rom" ? viewRom()
                          : side === "kontakt" ? viewKontakt()
                          : side === "opprop" ? viewOpprop()
                          : side === "deltakere" ? viewDeltakere()
                          : side === "dokumenter" ? viewDokumenter()
                          : side === "tilgang" ? viewTilgang()
                          : side === "turkode" ? viewTurkode()
                          : visningFor(S.tab);
    if (side === "varsler") settOppVarsler();
    if (byttetVisning && !conv) $("screen").scrollTop = 0;
    sjekkTopp();

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
          <input id="msgInput" placeholder="${S.svarTil ? "Skriv svaret…" : "Melding…"}" autocomplete="off" enterkeyhint="send" maxlength="2000">
          <button class="send" type="submit" aria-label="Send melding" ${S.sender ? "disabled" : ""}>${ICON.send}</button>
        </form>`;
      $("composer").addEventListener("submit", onSend);
      for (const id of ["bildeInput", "kameraInput"]) {
        const felt = $(id);
        if (!felt) continue;
        felt.addEventListener("change", velgBilde);
        // I app-versjonen tar iOS over: vi stopper filvelgeren og åpner
        // telefonens egen i stedet. Feltet blir stående i markeringen,
        // så web-versjonen er uendret.
        if (erNativ() && felt.parentElement) {
          felt.parentElement.addEventListener("click", async ev => {
            ev.preventDefault();
            await velgBildeNativt(id === "kameraInput");
          });
        }
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

    // Fanerada er i veien når du skriver i en samtale.
    $("tabbar").hidden = Boolean(conv);
    tegnFaner();
    tegnOmvisning();
    maalOey();
  }

  /* ───────────────── øya ─────────────────
     Fanelinja flyter over innholdet som en kapsel, slik Apple beskriver
     fanelinja i iOS 26. Den bygges én gang og oppdateres etterpå:
     bygde vi den på nytt for hver tegning, fantes det ikke noe for
     pilla å gli fra — og det er pilla som viser hvor du kom fra og hvor
     du havnet. */
  /* Fire faner, og hver av dem svarer på sitt eget spørsmål: hva skjer,
     hva sier folk, hva gjelder for meg på turen, og hvem er jeg.

     «I dag» og «Program» var to faner om det samme, og plassen de ga
     fra seg gikk til «Turen» — der pakkeliste, plass, rom og nødnummer
     nå ligger, i stedet for nede i Meg mellom innstillingene. */
  const FANER = [["program","Program","cal"], ["chat","Chat","chat"],
                 ["turen","Turen","koffert"], ["meg","Meg","me"]];

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
      // Merket sitter der jobben er: det turen mangler hoerer til Turen,
      // og varslene som ikke er paa, til Meg.
      turen: oppgaver().length + (S.ventende ? 1 : 0) + (slettekort() ? 1 : 0),
      meg: varslerErAv() ? 1 : 0,
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
      else { visFane(S.tab); if (pekt === S.tab) tilStartenAvFanen(); }
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
    if (S.trip.role === "leader") Api.rapportListe(S.trip.id).then(r => { S.rapporter = r; }).catch(() => {});
    if (S.superadmin === undefined) Api.minTilgang().then(t => { S.superadmin = !!t.superadmin; }).catch(() => {});
    Api.megTall(S.trip.id).then(t => {
      S.megTall = t;
      if (S.trip && (S.tab === "meg" || S.tab === "turen" || S.tab === "program") && !S.side && !S.openChat) render();
    }).catch(() => {});
  }

  /* Trykk på fanen du alt står i, slik iOS gjør: står du inne på en
     side eller i en samtale, kommer du tilbake til starten av fanen. Står
     du alt der, ruller den til toppen. */
  function tilStartenAvFanen() {
    // To nivåer inne (ett kjøretøy under Sitteplasser): rett ut, i ett hopp.
    if (S.side === "seter" && S.seteKj && history.state && history.state.kj) {
      S.seteKj = null; S.side = null;
      hentMegTall(true);
      render();
      egenTilbake = true;
      setTimeout(() => { egenTilbake = false; }, 400);
      return history.go(-2);
    }
    if (S.side) { S.seteKj = null; return lukkSide(); }
    if (S.openChat) return closeChat();
    const sk = $("screen");
    if (sk.scrollTop > 0) sk.scrollTo({ top: 0, behavior: "smooth" });
  }

  function byttFane(id) {
    if (id === "meg" || id === "turen" || id === "program") hentMegTall();
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
  /* Kjører appen som ekte iOS-app, legger Capacitor seg på window og
     gir oss telefonens egne velgere. På web finnes det ikke, og da er
     alt som før. Ingen import: appen har ikke noe byggesteg, og
     Capacitor injiserer pluginene selv. */
  const erNativ = () =>
    Boolean(window.Capacitor && window.Capacitor.isNativePlatform &&
            window.Capacitor.isNativePlatform());
  const nativPlugin = navn =>
    (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[navn]) || null;

  /* Kopier til utklippstavla. Nettleserens måte først; virker den ikke
     (eldre Safari, eller trykket regnes ikke som ditt fordi appen ventet
     på noe først), merker vi teksten i et skjult felt og kopierer den. */
  async function kopier(tekst) {
    try { await navigator.clipboard.writeText(tekst); return; } catch { /* prøv neste */ }
    const f = document.createElement("textarea");
    f.value = tekst; f.setAttribute("readonly", "");
    f.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(f);
    f.select(); f.setSelectionRange(0, tekst.length);
    const ok = document.execCommand && document.execCommand("copy");
    f.remove();
    if (!ok) throw new Error("kopiering");
  }
  // Et lett dunk i telefonen når noe er gjort, som i iOS. Bare i appen.
  function haptikk(type) {
    const H = nativPlugin("Haptics");
    if (!H) return;
    (type === "valg" ? H.selectionChanged() : H.impact({ style: type === "tung" ? "MEDIUM" : "LIGHT" })).catch(() => {});
  }

  /* Tekststørrelsen fra iPhone-innstillingene (E17). Appen er skrevet i
     piksler, så den fulgte ikke «Større tekst». I app-versjonen måler vi
     systemets brødtekst (17 px på vanlig størrelse) og skalerer teksten
     like mye. Knipezoom står fortsatt av. På nett gjør vi ingenting —
     der har nettleseren sin egen tekststørrelse. */
  function iosTekststorrelse() {
    if (!erNativ()) return;
    try {
      const proeve = document.createElement("span");
      proeve.style.cssText = "font:-apple-system-body;position:absolute;visibility:hidden";
      proeve.textContent = "A";
      document.body.appendChild(proeve);
      const px = parseFloat(getComputedStyle(proeve).fontSize) || 17;
      proeve.remove();
      const skala = Math.max(0.9, Math.min(1.6, px / 17));
      const prosent = Math.round(skala * 100) + "%";
      document.documentElement.style.webkitTextSizeAdjust = prosent;
      document.body.style.webkitTextSizeAdjust = prosent;
    } catch { /* vanlig størrelse */ }
  }

  function settVedlegg(fil) {
    if (!fil || !S.openChat) return;
    if (S.vedlegg) URL.revokeObjectURL(S.vedlegg.url);
    S.vedlegg = { fil, url: URL.createObjectURL(fil) };
    render();
    const inn = $("msgInput");
    if (inn) inn.focus();
  }

  function velgBilde(e) {
    const felt = e.target;
    const fil = felt.files && felt.files[0];
    felt.value = "";                       // samme bilde skal kunne velges igjen
    settVedlegg(fil);
  }

  /* iOS' egen bildevelger i stedet for nettleserens filvelger. Apple
     regner nettleserfelt som et tegn på at appen bare er en nettside i
     en ramme (retningslinje 4.2), og telefonens egen velger er dessuten
     den brukerne kjenner. */
  async function velgBildeNativt(fraKamera) {
    const Camera = nativPlugin("Camera");
    if (!Camera) return false;
    try {
      const foto = await Camera.getPhoto({
        quality: 85,
        resultType: "base64",
        source: fraKamera ? "CAMERA" : "PHOTOS",
        // Appen krymper bildet selv i lastOppBilde(). Lar vi iOS beskjære
        // det først, mister folk kantene av bildet uten å ha bedt om det.
        allowEditing: false
      });
      if (!foto || !foto.base64String) return true;   // avbrutt
      const bin = atob(foto.base64String);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const type = "image/" + (foto.format === "png" ? "png" : "jpeg");
      settVedlegg(new File([buf], "bilde." + (foto.format || "jpg"), { type }));
    } catch {
      // Avbryter man velgeren, kaster plugin-en. Det er ikke en feil.
    }
    return true;
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

  /* Delemenyen i app-versjonen. Share-plugin-en vil ha en fil på disk,
     ikke en blob i minnet, så bildet skrives til hurtiglageret først.
     iOS rydder det selv.

     Returnerer false hvis noe mangler, så den som kalte kan falle
     tilbake til nedlasting — en knapp som ikke gjør noe er verre enn en
     knapp som gjør det nest beste. */
  async function delNativt(fil) {
    const Fs = nativPlugin("Filesystem"), Share = nativPlugin("Share");
    if (!Fs || !Share) return false;
    try {
      const b64 = await new Promise((ok, nei) => {
        const l = new FileReader();
        l.onload = () => ok(String(l.result).split(",")[1]);
        l.onerror = nei;
        l.readAsDataURL(fil);
      });
      // Fila beholder navnet og endelsen sin. Før ble alt kalt .jpg, så
      // kalenderfila kom fram som et bilde Kalender ikke ville åpne. Hver
      // deling får sin egen mappe, så like navn ikke krasjer.
      const egen = /\.[a-z0-9]{2,5}$/i.test(fil.name || "") ? fil.name.replace(/[\/\\]/g, "") : "tripmate.jpg";
      const navn = `deling/${Date.now()}/${egen}`;
      await Fs.writeFile({ path: navn, data: b64, directory: "CACHE", recursive: true });
      const { uri } = await Fs.getUri({ path: navn, directory: "CACHE" });
      await Share.share({ files: [uri] });
      return true;
    } catch {
      // Avbrutt deling kaster også. Da er vi ferdige uansett — en
      // nedlasting etterpå ville kommet som en overraskelse.
      return true;
    }
  }

  /* «Lagre på kamerarull» finnes ikke som noe nettsider får lov til. Det
     nærmeste er delemenyen, der iPhone selv tilbyr «Lagre bilde». Har
     telefonen ikke den, laster vi ned fila i stedet. */
  async function lagreBilde(sti) {
    const fil = bildefiler.get(sti) || await forberedBlob(sti);
    if (!fil) return toast("Klarte ikke hente bildet.");

    // I app-versjonen går bildet gjennom iOS' egen delemeny, der «Lagre
    // bilde» ligger. navigator.share finnes ikke i en WKWebView.
    if (erNativ() && await delNativt(fil)) return;

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
  /* Apple 1.2: et filter som stopper det verste før det sendes. Bare
     tydelige skjellsord, hets og oppfordringer til selvskading — ikke
     vanlig banning, som ville gitt falske treff i helt greie meldinger. */
  const FORBUDT = [
    // Disse stoppes også inne i et lengre ord («horeHei»), siden ingen
    // vanlige norske ord begynner slik.
    /\bhore/i, /\bfitt[ae]/i, /\bneger/i, /\bcunt/i, /\bwhore/i, /\bnegre/i, /\bn[i1!]gg/i, /\bfaggot/i, /\bretard/i,
    // Disse kan være begynnelsen på helt vanlige ord, så de må stå alene.
    /\bhor(?:a|en|er|ene)\b/i, /\bpikk(?:en|er)?\b/i, /\bkuk(?:en|er|ene)?\b/i, /\bslut\b/i, /\bsoperi?\b/i, /\bmongo(?:er|en)?\b/i,
    /\b(?:kys|drep) deg selv\b/i, /\bkill yourself\b/i, /\bkys\b(?=\W*$)/i
  ];
  const harForbudtOrd = t => FORBUDT.some(r => r.test(t));

  /* Første gang du skriver, godtar du reglene for chatten. Svaret huskes
     på telefonen. Versjonen i nøkkelen gjør at vi kan spørre på nytt om
     reglene endres. */
  const REGLER_NOKKEL = "tm.chatregler.v1";
  async function godtattChatregler() {
    try { if (localStorage.getItem(REGLER_NOKKEL)) return true; } catch {}
    // Tastaturet ned først: reglene skal leses, ikke skrives i.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const regel = (ikon, tekst) => `<li><span class="rikon">${ikon}</span><span>${tekst}</span></li>`;
    const ok = await helside({
      tittel: "Regler for chatten",
      innhold: `
        <h2 class="helside-h">Før du skriver første gang</h2>
        <p class="lede">TripMate er for hele gruppa. Reglene gjelder i alle chatter og for alle bilder.</p>
        <ul class="regelliste">
          ${regel(ICON.folk, "Ingen trakassering, mobbing, trusler eller hets.")}
          ${regel(ICON.bilde, "Ikke seksuelt innhold, og ikke bilder av andre uten at de har sagt ja.")}
          ${regel(ICON.info, "Du kan rapportere meldinger og blokkere personer. Rapporter blir sett på innen 24 timer.")}
          ${regel(ICON.nokkel, "Den som bryter reglene, kan bli tatt ut av turen og utestengt.")}
        </ul>
        <a class="linkbtn" style="display:inline-block;margin-top:10px;font-size:15px" href="${VILKAAR_URL}" target="_blank" rel="noopener">Les hele vilkårene</a>`,
      ja: "Jeg godtar"
    });
    if (ok) { try { localStorage.setItem(REGLER_NOKKEL, new Date().toISOString()); } catch {} }
    return ok;
  }

  /* En helside som glir opp over appen, som et skjermbilde i iOS som
     åpnes «over» det du holdt på med. Brukes når noe skal leses og
     svares på, ikke bare bekreftes: Avbryt øverst til venstre, svaret
     nederst. Svarer med true eller false. */
  function helside({ tittel, innhold, ja }) {
    return new Promise(svar => {
      const gammel = document.querySelector(".helside");
      if (gammel) gammel.remove();
      const el = document.createElement("div");
      el.className = "helside";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", tittel);
      el.innerHTML = `
        <header class="helside-topp">
          <button class="helside-avbryt" type="button">Avbryt</button>
          <b>${esc(tittel)}</b><span aria-hidden="true"></span>
        </header>
        <div class="helside-innhold">${innhold}</div>
        <div class="helside-bunn"><button class="btn primary big" type="button">${esc(ja)}</button></div>`;
      $("appScreen").appendChild(el);
      requestAnimationFrame(() => el.classList.add("inne"));
      const lukk = v => {
        el.classList.remove("inne");
        el.classList.add("ut");
        setTimeout(() => el.remove(), 320);
        svar(v);
      };
      el.querySelector(".helside-avbryt").addEventListener("click", () => lukk(false));
      el.querySelector(".helside-bunn .btn").addEventListener("click", () => lukk(true));
    });
  }

  async function onSend(e) {
    e.preventDefault();
    const inp = $("msgInput");
    const txt = inp.value.trim();
    const vedlegg = S.vedlegg;
    if ((!txt && !vedlegg) || S.busy) return;
    if (txt && harForbudtOrd(txt)) {
      toast("Meldingen ble ikke sendt. Den inneholder ord som ikke er lov i TripMate.");
      return;
    }
    if (!await godtattChatregler()) return;
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
  /* Har du skrevet eller valgt noe i et skjema i arket, skal det ikke
     forsvinne fordi du dro arket ned eller trykket ved siden av. Da
     spør appen først, som iOS gjør: «Forkast endringene» eller «Fortsett».
     Lagre og Avbryt lukker som før; det er bare de utilsiktede veiene ut
     som stoppes. */
  let arkEndret = false;
  $("sheet").addEventListener("input", e => { if (e.target.closest("form")) arkEndret = true; });
  $("sheet").addEventListener("change", e => { if (e.target.closest("form")) arkEndret = true; });
  function forsokLukkArk() {
    if (!arkEndret) return closeSheet();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    visForkastValg().then(forkast => { if (forkast) closeSheet(); });
  }
  // Handlingsarket ligger over arket, så det du har skrevet, blir stående.
  function visForkastValg() {
    return new Promise(svar => {
      const el = document.createElement("div");
      el.className = "handlingsark-bg";
      el.innerHTML = `<div class="handlingsark" role="alertdialog" aria-label="Forkaste endringene?">
          <div class="handlingsgruppe">
            <p class="handlingstekst">Du har endringer som ikke er lagret.</p>
            <button class="handling fare" data-v="1">Forkast endringene</button>
          </div>
          <div class="handlingsgruppe"><button class="handling fet" data-v="0">Fortsett å redigere</button></div>
        </div>`;
      document.body.appendChild(el);
      requestAnimationFrame(() => el.classList.add("inne"));
      const ferdig = v => { el.classList.remove("inne"); setTimeout(() => el.remove(), 260); svar(v); };
      el.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if (b) return ferdig(b.dataset.v === "1");
        if (e.target === el) ferdig(false);
      });
    });
  }

  function openSheet(html) {
    arkEndret = false;
    const s = $("sheet");
    s.innerHTML = `<div class="grabsone"><div class="grab"></div></div><div class="sheetbody">${html}</div>`;
    s.style.transform = "";
    const kropp0 = s.querySelector(".sheetbody");
    if (kropp0) kropp0.scrollTop = 0;
    $("sheetBg").hidden = false;
  }
  function closeSheet() {
    arkEndret = false;
    $("sheetBg").hidden = true;
    $("sheet").style.transform = "";
    // Lukkes et bekreftelsesark uten svar (dratt ned, trykket utenfor),
    // er svaret nei.
    if (ventendeSvar) { const r = ventendeSvar; ventendeSvar = null; r(false); }
  }

  /* Bekreftelser i et ark i stedet for nettleserens vindu (E11). Vinduet
     så ut som en nettside, og passet ikke med resten av appen. Knappen
     sier hva som skjer, og er rød når noe forsvinner. */
  let ventendeSvar = null;
  function bekreft(tekst, valg = {}) {
    return new Promise(svar => {
      const fare = valg.fare != null ? valg.fare : /slett|fjern|forsvinner|kan ikke angres|logge ut|skru av/i.test(tekst);
      const ja = valg.ja || (/^slette/i.test(tekst) ? "Slett" : /^fjerne/i.test(tekst) ? "Fjern"
        : /^logge ut/i.test(tekst) ? "Logg ut" : /^gå ut/i.test(tekst) ? "Gå ut" : /^skru av/i.test(tekst) ? "Skru av" : "Ja");
      if (ventendeSvar) { const r = ventendeSvar; ventendeSvar = null; r(false); }
      openSheet(`<p style="margin:4px 0 18px;font-size:16px;line-height:1.45;color:var(--ink);white-space:pre-line">${esc(tekst)}</p>
        <button class="btn ${fare ? "danger" : "primary"} big" id="bkJa">${esc(ja)}</button>
        ${valg.bare ? "" : `<button class="btn close" id="bkNei">${esc(valg.nei || "Avbryt")}</button>`}`);
      ventendeSvar = svar;
      $("bkJa").addEventListener("click", () => { ventendeSvar = null; closeSheet(); svar(true); });
      const nei = $("bkNei");
      if (nei) nei.addEventListener("click", () => closeSheet());
    });
  }
  const melding = tekst => bekreft(tekst, { bare: true, ja: "OK", fare: false });

  /* Sletting med «Angre» i fem sekunder. Det som slettes, skjules med en
     gang, og slettes først når tiden er ute. Angrer du, kommer det
     tilbake, og ingenting er sendt til serveren. */
  function medAngre(tekst, utfoer, skjul) {
    if (skjul) skjul(true);
    const t = $("toast");
    clearTimeout(toast._t);
    t.onclick = null;
    t.classList.remove("klikkbar");
    t.innerHTML = `<span>${esc(tekst)}</span> <button type="button" class="angreknapp">Angre</button>`;
    t.hidden = false;
    let angret = false;
    t.querySelector(".angreknapp").onclick = ev => {
      ev.stopPropagation(); angret = true; t.hidden = true;
      if (skjul) skjul(false);
    };
    toast._t = setTimeout(async () => {
      t.hidden = true;
      if (angret) return;
      try { await utfoer(); }
      catch { if (skjul) skjul(false); toast("Klarte ikke slette."); }
    }, 5000);
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
        // Står tastaturet oppe, legger første drag bort tastaturet
        // (js/native.js). Arket blir der det er.
        if (document.documentElement.classList.contains("tastatur")) return false;
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
      // Med ulagrede endringer gir arket etter, men bare litt: det viser
      // at det kan lukkes, uten å lukke seg.
      const vis = arkEndret ? Math.min(90, dy * 0.35) : dy;
      s.style.transform = `translateY(${vis}px)`;
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
      if (dy > 100 && arkEndret) { s.style.transform = ""; forsokLukkArk(); }
      else if (dy > 100) lukkArkAnimert();
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
      ${(() => { const v = vaerMerke(it.place, dag.date, it.t, dagensSted(dag));
        return v ? `<div class="arkvaer">Været: ${v}</div>` : ""; })()}
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

  function sheetJoinTrip(kode) {
    openSheet(`<h3>Bli med på en ny tur</h3>
      <p class="muted" style="margin:6px 0 14px">Skriv turkoden du fikk av reiselederen.</p>
      <form id="joinTripForm">
        <div class="field"><label for="jCode">Turkode</label>
          <input id="jCode" autocapitalize="characters" spellcheck="false" class="mono" style="text-transform:uppercase" value="${esc(kode || "")}"></div>
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

  /* Ny tur. Eksempelturene er borte (F2): de fylte en ekte tur med et
     oppdiktet program. Spørsmålene under har ingen svar valgt på forhånd
     (L2) — en reiseleder skal ta stilling til dem, ikke arve et valg hen
     aldri så. Alt kan endres senere. */
  /* Å lage en tur krever tilgang fra TripMate (utvidelse-34). Har du
     ingen, ber arket om tilgangskoden. Har du, viser det grensene. */
  async function sheetNewTrip() {
    openSheet(`<h3>Lag en ny tur</h3>${venter("Sjekker tilgangen")}<button class="btn close" data-close>Avbryt</button>`);
    const tilgang = await Api.minTilgang().catch(() => ({ gammel: true }));
    if (!tilgang.gammel && !tilgang.kanLage) return sheetTilgangskode(tilgang);
    sheetTurSkjema(tilgang);
  }

  function sheetTilgangskode(tilgang) {
    const brukt = (tilgang.koder || []).length > 0;
    openSheet(`<h3>Lag en ny tur</h3>
      <p class="lede">${brukt
        ? "Tilgangen din har ingen turer igjen. Har du fått en ny kode fra TripMate, skriv den her."
        : "For å lage turer trenger du en tilgangskode fra TripMate."}</p>
      <form id="tkForm" novalidate>
        <div class="field"><label for="tkKode">Tilgangskode</label>
          <input id="tkKode" class="kodefelt" placeholder="TM-XXXX-XXXX" autocapitalize="characters"
            autocorrect="off" spellcheck="false" autocomplete="off"></div>
        <p class="err" id="tkErr" hidden></p>
        <button class="btn primary big" type="submit" id="tkOk">Bruk koden</button>
      </form>
      ${Api.erAnonym() ? `<p class="muted" style="font-size:13.5px;margin:12px 0 0">Du er gjest. Koden hører til kontoen på denne telefonen.
        Logger du inn med e-post først, beholder du tilgangen på en ny telefon.</p>` : ""}
      <button class="btn close" data-close>Avbryt</button>`);
    $("tkForm").addEventListener("submit", async e => {
      e.preventDefault();
      const kode = $("tkKode").value.trim(), btn = $("tkOk"), err = $("tkErr");
      if (!kode) { err.textContent = "Skriv koden."; err.hidden = false; return; }
      btn.disabled = true; btn.innerHTML = prikker() + " Sjekker";
      try { await Api.losInnTilgang(kode); sheetNewTrip(); }
      catch (e2) { btn.disabled = false; btn.textContent = "Bruk koden"; err.textContent = e2.message; err.hidden = false; }
    });
  }

  function sheetTurSkjema(tilgang) {
    const p = Api.getProfile();
    // Spørsmålet er en setning, ikke en overskrift. Korte svar (Ja/Nei)
    // står side om side.
    const sporsmaal = (navn, tittel, under, valg) => `<fieldset class="spm" id="spm_${navn}">
      <legend>${tittel}</legend>
      ${under ? `<small>${under}</small>` : ""}
      <div class="picks${valg.every(x => !x[2]) ? " to" : ""}">${valg.map(([v, t, f]) => `<label class="pick"><input type="radio" name="${navn}" value="${v}">
        <span><b>${t}</b>${f ? `<br><small>${f}</small>` : ""}</span></label>`).join("")}</div>
    </fieldset>`;
    // Har kontoen en grense, står den øverst, så ingen blir overrasket
    // når nummer 51 ikke kommer inn.
    const k = (tilgang.koder || []).find(x => x.turerIgjen === null || x.turerIgjen > 0);
    const grense = !tilgang.superadmin && k ? `<p class="muted" style="margin:0 0 14px">${k.maksDeltakere === null ? "Ingen grense på antall personer" : `Opptil ${k.maksDeltakere} personer per tur`}${
      k.turerIgjen === null ? "" : ` · ${k.turerIgjen === 1 ? "1 tur" : k.turerIgjen + " turer"} igjen`}.</p>` : "";

    openSheet(`<h3 style="margin-bottom:14px">Lag en ny tur</h3>
      ${grense}
      <form id="newTripForm" novalidate>
        ${p ? "" : `<div class="field"><label for="tFirst">Ditt fornavn</label><input id="tFirst" autocapitalize="words" autocorrect="off" spellcheck="false" autocomplete="given-name"></div>
                    <div class="field"><label for="tLast">Ditt etternavn</label><input id="tLast" autocapitalize="words" autocorrect="off" spellcheck="false" autocomplete="family-name"></div>`}
        <div class="field"><label for="tName">Navn på turen</label><input id="tName" placeholder="Barcelona 2027"></div>
        <div class="field"><label for="tOrg">Gruppe</label><input id="tOrg" placeholder="Sandnes IL G16, salgsavdelingen eller 10B"></div>
        ${sporsmaal("tProgram", "Hvordan vil du lage programmet?", "", [
          ["pdf", "Les inn fra PDF", "Appen leser PDF-en og viser et forslag."],
          ["selv", "Jeg legger det inn selv", ""]])}
        <fieldset class="spm"><legend>Hva skal turen ha?</legend>
          <small>Program og chat har alle turer. Resten kan endres senere under Turen.</small>
          <div class="gruppe" style="margin-top:10px"><div class="list">${funksjonsrader(() => false, "nf_")}</div></div>
        </fieldset>
        ${sporsmaal("tFordel", "Hvem velger seter og rom?", "", [
          ["selv", "Deltakerne selv", ""], ["leder", "Jeg fordeler", ""]])}
        ${sporsmaal("tGodkjenn", "Skal du slippe inn hver deltaker selv?", "", [
          ["ja", "Ja", ""], ["nei", "Nei, turkoden holder", ""]])}
        <p class="err" id="tErr" hidden></p>
        <button class="btn primary big" type="submit" id="tSubmit">Lag turen</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    // Seter og rom-spørsmålet står bare når turen har en av delene.
    const valgt = k2 => $("nf_" + k2).checked;
    const visFordeling = () => { $("spm_tFordel").hidden = !(valgt("seter") || valgt("rom")); };
    visFordeling();
    $("nf_seter").addEventListener("change", visFordeling);
    $("nf_rom").addEventListener("change", visFordeling);

    $("newTripForm").addEventListener("submit", async e => {
      e.preventDefault();
      const btn = $("tSubmit"), err = $("tErr");
      const vis = t => { err.textContent = t; err.hidden = false; err.scrollIntoView({ block: "center" }); };
      const svar = navn => (document.querySelector(`input[name="${navn}"]:checked`) || {}).value;
      let prof = Api.getProfile();
      if (!prof) {
        const f = storForbokstav($("tFirst").value), l = storForbokstav($("tLast").value);
        const feil = navnFeil(f, l);
        if (feil) return vis(feil);
        prof = Api.setProfile(f, l);
      }
      const name = $("tName").value.trim();
      if (!name) return vis("Turen trenger et navn.");
      const trengerFordeling = valgt("seter") || valgt("rom");
      const mangler = [["tProgram", "hvordan programmet skal lages"],
        trengerFordeling && ["tFordel", "hvem som velger seter og rom"],
        ["tGodkjenn", "om du slipper inn deltakerne selv"]]
        .filter(Boolean).filter(([n]) => !svar(n)).map(([, t]) => t);
      if (mangler.length) return vis("Svar på: " + mangler.join(", ") + ".");

      btn.disabled = true; btn.innerHTML = prikker() + " Lager turen";
      try {
        const trip = await Api.createTrip({ name, org: $("tOrg").value.trim(), dates: "", leaderName: prof.name });
        const fritt = svar("tFordel") !== "leder";
        const f = {};
        for (const [k2] of FUNKSJONER) if (k2 !== "paaroerende" && k2 !== "bilder") f[k2] = valgt(k2);
        // Innstillingene settes etter at turen finnes. Feiler én av dem,
        // finnes turen likevel, og valget kan tas igjen under Turen.
        await Promise.all([
          Api.settFunksjoner(trip.id, f),
          Api.setKrevGodkjenning(trip.id, svar("tGodkjenn") === "ja"),
          Api.setBilderPaa(trip.id, valgt("bilder")),
          Api.settRomvalg(trip.id, { fritt }),
          Api.setSeterFritt(trip.id, fritt),
          valgt("paaroerende") ? Api.settPaaroerende(trip.id, true) : null
        ].map(x => Promise.resolve(x).catch(() => null)));

        closeSheet();
        S.trips = await Api.myTrips().catch(() => S.trips);
        S.tab = "program";
        await openTrip(trip.id);
        toast("Turen er laget. Kode: " + trip.code);
        if (svar("tProgram") === "pdf") sheetImportPdf();
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Lag turen";
        if (e2 && /tilgangskode/.test(e2.message || "")) return sheetTilgangskode({ koder: [] });
        vis(e2.message);
      }
    });
  }

  /* Bryterne for funksjonene. Samme rader når turen lages og når den
     endres senere. */
  const funksjonsrader = (paa, prefiks) => FUNKSJONER.map(([k, navn, under]) => `
    <label class="listrow" style="cursor:pointer">
      <div class="grow"><div class="nm">${navn}</div><div class="sub">${under}</div></div>
      <input type="checkbox" class="bryter" id="${prefiks}${k}" data-funk="${k}"${paa(k) ? " checked" : ""}></label>`).join("");

  function sheetFunksjoner() {
    openSheet(`<h3>Funksjoner</h3>
      <p class="lede">Det som er av, vises ikke for noen på turen.</p>
      <div class="gruppe"><div class="list">${funksjonsrader(har, "fu_")}</div></div>
      <p class="err" id="fuErr" hidden></p>
      <button class="btn primary big" id="fuLagre" style="margin-top:14px">Lagre</button>
      <button class="btn close" data-close>Avbryt</button>`);
    $("fuLagre").addEventListener("click", async e => {
      const b = e.currentTarget;
      const valgt = k => $("fu_" + k).checked;
      if (har("paaroerende") && !valgt("paaroerende") &&
          !await bekreft("Skru av nærmeste pårørende? Alt deltakerne har lagt inn, slettes.")) return sheetFunksjoner();
      b.disabled = true; b.innerHTML = prikker() + " Lagrer";
      try {
        const f = {};
        for (const [k] of FUNKSJONER) if (k !== "paaroerende" && k !== "bilder") f[k] = valgt(k);
        await Api.settFunksjoner(S.trip.id, f);
        if (valgt("bilder") !== har("bilder")) await Api.setBilderPaa(S.trip.id, valgt("bilder"));
        if (valgt("paaroerende") !== har("paaroerende")) await Api.settPaaroerende(S.trip.id, valgt("paaroerende"));
        S.trip.funksjoner = Object.assign({}, S.trip.funksjoner, f);
        S.trip.bilder = valgt("bilder");
        S.trip.paaroerende = valgt("paaroerende");
        closeSheet();
        render();
        toast("Lagret.");
      } catch (err) {
        b.disabled = false; b.textContent = "Lagre";
        const e2 = $("fuErr"); e2.textContent = err.message || "Klarte ikke lagre."; e2.hidden = false;
      }
    });
  }

  /* Nærmeste pårørende (L5). Frivillig å bruke for reiselederen, og det
     deltakeren fyller inn, ser bare reiselederne. Samtykket er en
     avkrysning som må være på før noe lagres. */
  async function sheetPaaroerende() {
    openSheet(`<h3>Nærmeste pårørende</h3>${venter("Henter")}<button class="btn close" data-close>Lukk</button>`);
    let mitt = null;
    try { mitt = await Api.minPaaroerende(S.trip.id); } catch { /* tomt skjema */ }
    openSheet(`<h3>Nærmeste pårørende</h3>
      <p class="lede">Hvem skal reiselederne ringe hvis noe skjer deg på turen?</p>
      <div class="card pad" style="padding-block:12px;margin-bottom:14px">
        <dl class="kv">
          <dt>Hvem ser det</dt><dd>Bare reiselederne på ${esc(S.trip.name)}. Ikke de andre deltakerne.</dd>
          <dt>Hvor lenge</dt><dd>Til du sletter det, går ut av turen, eller turen slettes.</dd>
        </dl>
      </div>
      <form id="paForm" novalidate>
        <div class="field"><label for="paNavn">Navn</label><input id="paNavn" autocapitalize="words" autocorrect="off" spellcheck="false" maxlength="80" autocomplete="off" value="${esc(mitt ? mitt.navn : "")}" placeholder="Kari Nordmann"></div>
        <div class="field"><label for="paTlf">Telefon</label><input id="paTlf" type="tel" inputmode="tel" maxlength="30" autocomplete="off" value="${esc(mitt ? mitt.telefon : "")}" placeholder="+47 900 00 000"></div>
        <label class="pick" style="margin-bottom:12px"><input type="checkbox" id="paSamtykke" ${mitt ? "checked" : ""}>
          <span><b>Det er greit at reiselederne ser dette</b><br>
            <small>Er du under 13 år, må en foresatt si ja for deg.</small></span></label>
        <p class="err" id="paErr" hidden></p>
        <button class="btn primary big" type="submit" id="paLagre">Lagre</button>
      </form>
      ${mitt ? `<button class="btn danger" style="width:100%;margin-top:10px" id="paSlett">Slett opplysningene mine</button>` : ""}
      <button class="btn close" data-close>Lukk</button>`);

    $("paForm").addEventListener("submit", async e => {
      e.preventDefault();
      const navn = $("paNavn").value.trim(), telefon = $("paTlf").value.trim(), err = $("paErr");
      const feil = !navn ? "Skriv navnet." : telnummer(telefon).length < 5 ? "Skriv et telefonnummer."
        : !$("paSamtykke").checked ? "Kryss av for at det er greit at reiselederne ser dette." : null;
      if (feil) { err.textContent = feil; err.hidden = false; return; }
      try { await Api.lagrePaaroerende(S.trip.id, { navn, telefon }); closeSheet(); toast("Lagret. Bare reiselederne ser det."); if (S.side === "kontakt") aapneKontakt(true); }
      catch (e2) { err.textContent = e2.message; err.hidden = false; }
    });
    const slett = $("paSlett");
    if (slett) slett.addEventListener("click", async () => {
      try { await Api.slettPaaroerende(S.trip.id); closeSheet(); toast("Opplysningene er slettet."); if (S.side === "kontakt") aapneKontakt(true); }
      catch (e2) { toast(e2.message || "Klarte ikke slette."); }
    });
  }

  /* Endre navnet ditt (L2). Gjelder alle turene du er med på. */
  function sheetEndreNavn() {
    const p = Api.getProfile() || {};
    openSheet(`<h3>Endre navnet ditt</h3>
      <p class="lede">Navnet vises for alle på turene dine. Det endres på alle turene samtidig.</p>
      <form id="enForm" novalidate>
        <div class="field"><label for="enFirst">Fornavn</label><input id="enFirst" autocapitalize="words" autocorrect="off" spellcheck="false" value="${esc(p.first || "")}" autocomplete="given-name"></div>
        <div class="field"><label for="enLast">Etternavn</label><input id="enLast" autocapitalize="words" autocorrect="off" spellcheck="false" value="${esc(p.last || "")}" autocomplete="family-name"></div>
        <p class="err" id="enErr" hidden></p>
        <button class="btn primary big" type="submit" id="enLagre">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);
    $("enForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = storForbokstav($("enFirst").value), l = storForbokstav($("enLast").value);
      const feil = navnFeil(f, l), err = $("enErr");
      if (feil) { err.textContent = feil; err.hidden = false; return; }
      const b = $("enLagre"); b.disabled = true; b.innerHTML = prikker() + " Lagrer";
      try {
        const prof = await Api.endreNavn(f, l);
        $("avatarText").textContent = prof.initials;
        closeSheet();
        await openTrip(S.trip.id);
        toast("Navnet er endret.");
      } catch (e2) {
        b.disabled = false; b.textContent = "Lagre";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  /* Reiselederen retter navnet til en deltaker på denne turen (L2). */
  function sheetRettNavn(id, navn) {
    const deler = String(navn || "").trim().split(/\s+/);
    openSheet(`<h3>Rett navnet</h3>
      <p class="lede">Gjelder bare denne turen.</p>
      <form id="rnForm" novalidate>
        <div class="field"><label for="rnFirst">Fornavn</label><input id="rnFirst" autocapitalize="words" autocorrect="off" spellcheck="false" value="${esc(deler.slice(0, -1).join(" ") || deler[0] || "")}"></div>
        <div class="field"><label for="rnLast">Etternavn</label><input id="rnLast" autocapitalize="words" autocorrect="off" spellcheck="false" value="${esc(deler.length > 1 ? deler[deler.length - 1] : "")}"></div>
        <p class="err" id="rnErr" hidden></p>
        <button class="btn primary big" type="submit" id="rnLagre">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);
    $("rnForm").addEventListener("submit", async e => {
      e.preventDefault();
      const f = storForbokstav($("rnFirst").value), l = storForbokstav($("rnLast").value);
      const feil = navnFeil(f, l), err = $("rnErr");
      if (feil) { err.textContent = feil; err.hidden = false; return; }
      try {
        await Api.rettNavn(S.trip.id, id, `${f} ${l}`);
        closeSheet();
        await aapneDeltakere(true);
        toast("Navnet er rettet.");
      } catch (e2) { err.textContent = e2.message; err.hidden = false; }
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
    if (last) { const d = new Date(last.date + "T12:00:00"); d.setDate(d.getDate() + 1); suggested = lokalDato(d); }

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

  /* «forh» fyller ut skjemaet på forhånd — fra et møtested i chatten:
     { t, title, placeId, fraMelding }. */
  function sheetAddItem(dayId, forh) {
    const day = S.trip.days.find(d => d.id === dayId);
    const f = forh || {};
    openSheet(`<h3>Nytt programpunkt</h3>
      <p class="muted" style="margin:6px 0 14px">${esc(day ? day.label : "")}</p>
      <form id="addItemForm">
        <div class="field"><label for="iTime">Klokkeslett</label><input id="iTime" type="time" value="${esc(f.t != null ? f.t : "09:00")}"></div>
        <div class="field"><label for="iSlutt">Slutter</label><input id="iSlutt" type="time">
          <small style="display:block;margin-top:5px;font-size:12.5px;color:var(--ink-3)">
            Valgfritt. Overlapper to punkter i tid, merker appen dem som samtidige.</small></div>
        <div class="field"><label for="iTitle">Hva skjer</label><input id="iTitle" placeholder="Omvisning Berlinmuren" value="${esc(f.title || "")}"></div>
        <div class="field">
          <label for="iPlace">Sted</label>
          <select id="iPlace" class="select">
            <option value="">Ingen / ikke stedfestet</option>
            ${placeOptions(f.placeId || null)}
            <option value="__new">+ Nytt sted…</option>
          </select>
        </div>
        <div id="newPlaceFields" hidden>
          <div class="field"><label for="pName">Navn på stedet</label><input id="pName" autocapitalize="words" autocorrect="off" spellcheck="false" placeholder="Gedenkstätte Berliner Mauer"></div>
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
        // Bakerst i heftets rekkefølge. Har punktet klokkeslett, finner det
        // plassen sin etter tiden uansett; har det ikke det, havner det
        // nederst på dagen i stedet for øverst.
        // Uten tid følger et punkt punktet med tid som står foran det i
        // heftet (se ordneDagen i api.js). Et nytt punkt uten tid skal stå
        // nederst, så det legges rett bak det siste punktet med tid.
        const punkter = day ? day.items : [];
        const sisteMedTid = punkter.filter(i => i.t).slice(-1)[0];
        const nesteSort = !$("iTime").value && sisteMedTid
          ? (sisteMedTid.sort || 0) + 1
          : punkter.reduce((m, i) => Math.max(m, i.sort || 0), 0) + 10;
        const nyId = await Api.addItem(S.trip.id, dayId, {
          t: $("iTime").value, title, placeId, note: $("iNote").value.trim(),
          minutter: minutterTil($("iTime").value, $("iSlutt").value),
          sort: nesteSort
        });
        // Kom punktet fra et møtested i chatten, får meldingen merket «I
        // programmet», og forslaget forsvinner for de andre lederne.
        if (f.fraMelding) await Api.merkIProgrammet(f.fraMelding, nyId).catch(() => {});
        closeSheet();
        // Kom du fra chatten, skal du bli stående i samtalen. openTrip lukker
        // den, så den åpnes igjen (uten nytt steg i tilbake-historikken).
        const varI = f.fraMelding ? S.openChat : null;
        await openTrip(S.trip.id);
        if (varI) { S.tab = "chat"; await openChat(varI, true); }
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
          <div class="field"><label for="hName">Navn</label><input id="hName" autocapitalize="words" autocorrect="off" spellcheck="false" placeholder="Hotel Moabit Plaza"></div>
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
          <label class="btn filknapp" for="pdfFiles">Velg PDF-filer</label>
          <input id="pdfFiles" type="file" accept="application/pdf" multiple class="skjultfil">
          <p class="muted" id="pdfValgt" style="margin:8px 0 0">Ingen filer valgt.</p>
        </div>
        <p class="muted" style="margin:-4px 0 14px">Maks 5 filer, 8 MB hver og 20 MB til sammen.</p>
        <p class="err" id="pdfErr" hidden></p>
        <button class="btn primary big" type="submit" id="pdfSubmit">Les filene</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("pdfFiles").addEventListener("change", e => {
      const f = [...(e.target.files || [])];
      $("pdfValgt").textContent = f.length ? f.map(x => x.name).join(", ") : "Ingen filer valgt.";
    });
    $("pdfForm").addEventListener("submit", async e => {
      e.preventDefault();
      const input = $("pdfFiles"), err = $("pdfErr"), btn = $("pdfSubmit");
      const valgte = [...(input.files || [])];
      if (!valgte.length) { err.textContent = "Velg minst én fil."; err.hidden = false; return; }

      // Grensene sjekkes her, før noe lastes opp. Før sendte appen alt
      // og ventet på at serveren sa nei — på mobilnett etter lang tid.
      // Til sammen 20 MB, fordi modellen tar imot 32 MB per forespørsel,
      // og filene blir en tredel større på veien.
      const MB = 1024 * 1024;
      const stor = valgte.find(f => f.size > 8 * MB);
      const ikkePdf = valgte.find(f => !/\.pdf$/i.test(f.name) && f.type !== "application/pdf");
      const sum = valgte.reduce((n, f) => n + f.size, 0);
      const stopp = valgte.length > 5 ? `Du valgte ${valgte.length} filer. Maks 5 om gangen.`
        : ikkePdf ? `«${ikkePdf.name}» er ikke en PDF.`
        : stor ? `«${stor.name}» er ${(stor.size / MB).toFixed(1).replace(".", ",")} MB. Maks 8 MB per fil.`
        : sum > 20 * MB ? `Filene er ${(sum / MB).toFixed(1).replace(".", ",")} MB til sammen. Maks 20 MB. Les dem inn i to omganger.`
        : null;
      if (stopp) { err.textContent = stopp; err.hidden = false; return; }

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
    // Dager uten dato blir med, med et felt der reiselederen velger datoen.
    // Før ble de kastet uten at noen fikk gjort noe med det (E9).
    const dager = (forslag.dager || []).filter(d => d.dato || (d.punkter || []).length || d.hotellNavn);
    const advarsler = (forslag.usikkert || []).slice();
    const fl = (n, en, flere) => `${n} ${n === 1 ? en : flere}`;

    if (!dager.length) {
      openSheet(`<h3>Fant ikke noe program</h3>
        <p class="muted" style="margin:10px 0">Appen fant ingen datoer i filen. Står året
        bare på forsiden, eller mangler datoene helt, kan du legge inn dagene selv.</p>
        ${advarsler.length ? `<div class="card pad" style="padding-block:12px"><div class="eyebrow">Merknader</div>
          <ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:var(--ink-2)">
            ${advarsler.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
        <button class="btn close" data-close>Lukk</button>`);
      return;
    }

    let utenTid = 0;
    let foreslatt = 0;
    const bolker = dager.map((d, i) => {
      const dag = d.dato ? Api.fmtDay(d.dato) : null;

      // Har dagen punkter fra før, skal ikke importen doble dem. Punkter
      // med samme tittel og tid som noe som finnes, krysses av fra
      // starten, og reiselederen velger hva som skjer med dagen.
      const fraFor = (S.trip.days.find(x => x.date === d.dato) || {}).items || [];
      const finnes = p => fraFor.some(x =>
        x.title.trim().toLowerCase() === String(p.tittel || "").trim().toLowerCase() &&
        (x.t || "") === (p.tid || ""));
      const valgDag = fraFor.length ? `<div class="impdag">
          <b>${fraFor.length} ${fraFor.length === 1 ? "punkt" : "punkter"} finnes alt denne dagen</b>
          <div class="impdagvalg">
            <label><input type="radio" name="modus-${i}" value="legg" checked> Legg til</label>
            <label><input type="radio" name="modus-${i}" value="erstatt"> Erstatt</label>
            <label><input type="radio" name="modus-${i}" value="hopp"> Hopp over</label>
          </div>
        </div>` : "";

      const punkter = (d.punkter || []).map((p, j) => {
        if (!p.tid) utenTid++;
        if (p.adresseForslag && !p.stedAdresse) foreslatt++;
        const dobbel = finnes(p);
        return `<div class="imprad">
          <label class="impvelg">
            <input type="checkbox" data-punkt="${i}-${j}" ${dobbel ? "" : "checked"}>
            <span class="imptxt">
              ${p.tid ? `<b class="mono">${esc(p.tid)}</b> ` : ""}${esc(p.tittel)}
              ${p.stedNavn ? `<small>${esc(p.stedNavn)}${p.adresseForslag && !p.stedAdresse
                ? ` · <b style="color:var(--amber)">adresse foreslått</b>` : ""}</small>` : ""}
              ${dobbel ? `<small><b>Finnes alt i programmet</b></small>` : ""}
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
      const kjent = d.hotellNavn && Object.values(S.trip.places)
        .find(p => p.name.trim().toLowerCase() === d.hotellNavn.trim().toLowerCase() && p.addr);
      const hotell = d.hotellNavn && kjent ? `
        <div class="hotellboks">
          <div class="hotellnavn"><span>${esc(d.hotellNavn)}</span></div>
          <small>Finnes alt i turen: ${esc(kjent.addr)}</small>
        </div>` : d.hotellNavn ? `
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
        ${dag ? `<div class="eyebrow" style="margin-bottom:7px">${esc(dag.label)}</div>`
          : `<div class="impdag"><b>Datoen sto ikke i filen</b>
              <label style="display:block;margin-top:6px">Velg dato for denne dagen
                <input type="date" data-dato="${i}" style="display:block;margin-top:4px"></label>
              <small>Uten dato blir dagen ikke lagt inn.</small></div>`}
        ${valgDag}
        ${hotell}
        <div class="memberlist">${punkter || '<p class="muted" style="padding:10px">Ingen punkter.</p>'}</div>
      </div>`;
    }).join("");

    const antall = dager.reduce((n, d) => n + (d.punkter || []).length, 0);

    const merknader = [
      foreslatt ? `${fl(foreslatt, "adresse er foreslått", "adresser er foreslått")} av appen og sto ikke i filen. Sjekk dem — er de feil, sender veibeskrivelsen folk feil sted.` : "",
      utenTid ? `${fl(utenTid, "punkt mangler", "punkter mangler")} klokkeslett. De beholder rekkefølgen fra filen, og du kan fylle inn tid nå eller senere.` : "",
      ...advarsler
    ].filter(Boolean);

    openSheet(`<h3>Forslag fra filen</h3>
      <p class="muted" style="margin:6px 0 14px">
        ${fl(dager.length, "dag", "dager")} og ${fl(antall, "punkt", "punkter")}, i samme rekkefølge som i filen.
        ${merknader.length ? `Se ${fl(merknader.length, "merknad", "merknader")} nederst.` : ""}</p>
      ${bolker}
      ${merknader.length ? `<div class="card pad" style="padding-block:12px;margin-bottom:16px;border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
        <div class="eyebrow" style="color:var(--amber)">Merknader</div>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--ink-2)">
          ${merknader.map(a => `<li>${esc(a)}</li>`).join("")}</ul></div>` : ""}
      <p class="err" id="impErr" hidden></p>
      <button class="btn primary big" id="impSubmit">Legg inn i programmet</button>
      <button class="btn close" data-close>Avbryt</button>`);

    $("impSubmit").addEventListener("click", () => leggInnForslag(dager));
  }

  /* Alt legges inn i én operasjon i basen (legg_inn_program, Utvidelse
     29). Før gikk det punkt for punkt: røk nettet midt i, lå halve
     programmet inne, og et nytt forsøk doblet resten. Nå går det helt,
     eller ikke i det hele tatt. */
  async function leggInnForslag(dager) {
    const btn = $("impSubmit"), err = $("impErr");
    const GENERISK = /^(hotellet|hotell|lobbyen|lobby|resepsjonen|rommet|bussen|egen hånd|ukjent)$/i;
    const sted = (navn, adresse, url) => !navn || GENERISK.test(navn.trim()) ? null
      : { navn: navn.trim(), adresse: adresse || "", url: url || "" };

    const pakke = [];
    dager.forEach((d, i) => {
      const modusFelt = document.querySelector(`input[name="modus-${i}"]:checked`);
      const modus = modusFelt ? modusFelt.value : "legg";
      if (modus === "hopp") return;
      const datoFelt = document.querySelector(`[data-dato="${i}"]`);
      const dato = d.dato || (datoFelt ? datoFelt.value : "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dato)) return;      // uten dato: hoppes over

      const punkter = (d.punkter || [])
        .map((p, j) => ({ p, j }))
        .filter(({ j }) => { const b = document.querySelector(`[data-punkt="${i}-${j}"]`); return b && b.checked; })
        .map(({ p, j }) => {
          const tidFelt = document.querySelector(`[data-tid="${i}-${j}"]`);
          const tid = p.tid || (tidFelt ? tidFelt.value : "");
          return {
            tid: /^\d{2}:\d{2}$/.test(tid) ? tid : "",
            tittel: p.tittel || "Programpunkt",
            notat: p.notat || "",
            // Sto adressen i filen, vinner den. Ellers forslaget, som er
            // merket i lista reiselederen nettopp godkjente.
            sted: sted(p.stedNavn, p.stedAdresse || p.adresseForslag)
          };
        });

      let hotell = null;
      if (d.hotellNavn) {
        const skrevet = document.querySelector(`[data-hoteladr="${i}"]`);
        hotell = sted(d.hotellNavn, d.hotellAdresse || (skrevet ? skrevet.value.trim() : ""), d.hotellNettside);
      }
      if (!punkter.length && !hotell && modus !== "erstatt") return;
      pakke.push({ dato, modus, hotell, punkter });
    });

    const manglerDato = dager.some((d, i) => !d.dato && !(document.querySelector(`[data-dato="${i}"]`) || {}).value);
    if (!pakke.length) {
      err.textContent = manglerDato ? "Velg dato for dagen som mangler det." : "Ingenting er valgt.";
      err.hidden = false; return;
    }

    btn.disabled = true; btn.innerHTML = prikker() + " Legger inn";
    try {
      const n = await Api.leggInnProgram(S.trip.id, pakke);
      forslag = null;
      closeSheet();
      await openTrip(S.trip.id);
      toast(`${n} ${n === 1 ? "punkt" : "punkter"} er lagt inn.`);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Legg inn i programmet";
      err.textContent = (e && e.message) || "Klarte ikke legge inn programmet. Ingenting ble lagt inn.";
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

    try {
      const [folk, paar] = await Promise.all([
        Api.tripMembers(S.trip.id),
        S.trip.role === "leader" && S.trip.paaroerende ? Api.paaroerendeListe(S.trip.id).catch(() => null) : null
      ]);
      S.folk = folk; S.paar = paar;
    }
    catch { S.folk = []; S.folkFeil = true; }
    if (S.side === "deltakere") render();
  }

  /* ───────── pakkeliste og sitteplasser ─────────
     Begge er egne sider, ikke ark: lista blir lang, og et setekart man
     skal sikte på er dårlig å ha i noe som kan dras ned. */
  /* En tur sitter ikke på én måte. Buss ned, tog hjem, og noen biler
     ved siden av — hvert kjøretøy har sin egen bredde og sin egen
     midtgang, og derfor sitt eget kart. Typen er det eneste vi spør
     om; resten følger av den. */
  /* Typen bestemmer tre ting: hvor bredt kartet står, hvor midtgangen
     går, og hva en plass heter.

     Navngivingen er ikke pynt. En buss nummererer radvis — 12C er rad 12,
     tredje sete. Et tog gjør det ikke: der står plassene 41, 42, 43
     gjennom hele vogna, og «11A» finnes ikke på billetten. I en bil er
     plassen et sted og ikke et nummer: fører, foran, bak til venstre.
     Sto det 2B på et bilsete, måtte alle oversette selv.

     Fly og båt fantes før og er tatt ut: setet på et fly deles ut av
     flyselskapet, og det er ingenting en deltaker kan velge i appen.
     Skal det inn igjen en gang, er det som en liste og ikke som et kart.
     En rad i basen med en type vi ikke kjenner, tegnes som «Annet». */
  const TYPER = {
    buss:     { navn: "Buss",     bredde: 4, gang: 2, navngiving: "rad" },
    minibuss: { navn: "Minibuss", bredde: 3, gang: 1, navngiving: "rad" },
    bil:      { navn: "Bil",      bredde: 2, gang: 1, navngiving: "bil" },
    tog:      { navn: "Tog (vogn)", bredde: 4, gang: 2, navngiving: "nummer" },
    annet:    { navn: "Annet",    bredde: 4, gang: 0, navngiving: "rad" }
  };
  const oppsett = typ => TYPER[typ] || TYPER.annet;

  /* Plassene i en bil, i den rekkefølgen de ligger: fører og passasjer
     foran, så bakover. Er bilen større enn fem, faller den tilbake til
     tall — en sjuseter har ingen navn alle er enige om. */
  const BILPLASS = ["Fører", "Foran", "Bak v.", "Bak midt", "Bak h."];

  /* Navnet på hver plass i ett kjøretøy. Det regnes ut fra radene og
     ikke fra plassnummeret alene: har bussen fem bak, ligger plass 57 i
     rad 14 og heter 14E — nr/bredde ville sagt rad 15, som ikke finnes.

     Kartet lages per tegning og huskes på kjøretøyet, så et setekart med
     femti plasser ikke regner det ut femti ganger. */
  const navnekart = new WeakMap();

  function plassnavn(k, nr) {
    let kart = navnekart.get(k);
    if (!kart) {
      const o = oppsett(k.typ);
      kart = new Map();
      seteRader(k).forEach((rad, r) => {
        for (let c = 0; c < rad.antall; c++) {
          const n = rad.fra + c;
          kart.set(n,
            o.navngiving === "nummer" ? String(n)
            : o.navngiving === "bil" ? (BILPLASS[n - 1] || "Plass " + n)
            : (r + 1) + "ABCDEFG"[Math.min(c, 6)]);
        }
      });
      navnekart.set(k, kart);
    }
    return kart.get(nr) || String(nr);
  }

  /* Plassen i klartekst der den står alene i en setning: «sete 12C»,
     «plass 41», «bak h.». Uten dette ville en knapp sagt «Be om Fører». */
  function plassOmtale(nr, k) {
    const o = oppsett(k.typ);
    const navn = plassnavn(k, nr);
    if (o.navngiving === "bil") return navn.toLowerCase();
    if (o.navngiving === "nummer") return "plass " + navn;
    return "sete " + navn;
  }

  /* Hvilken rad et sete ligger i, når den siste raden er bredere enn de
     andre. En buss har fem bak der resten har fire, og regner man bare
     nr/bredde, stemmer ikke numrene med bussen folk sitter i. */
  function seteRader(k) {
    const o = oppsett(k.typ);
    // «bakerst» er hvor mange flere plasser den siste raden har enn
    // bredden. En buss med fem bak har bakerst = 1.
    const ekstra = k.bakerst || 0;
    const bakRad = ekstra ? o.bredde + ekstra : 0;
    // Får ikke den brede raden plass, finnes den ikke: ett tall kan ikke
    // beskrive en buss med fire plasser og fem bakerst.
    const vanlige = bakRad && k.plasser > bakRad ? k.plasser - bakRad : k.plasser;
    const rader = [];
    for (let n = 1; n <= vanlige; n += o.bredde) {
      rader.push({ fra: n, antall: Math.min(o.bredde, vanlige - n + 1), bredde: o.bredde });
    }
    if (vanlige < k.plasser) {
      // Den brede bakerste raden har ingen midtgang: der sitter man på rad.
      rader.push({ fra: vanlige + 1, antall: k.plasser - vanlige,
                   bredde: k.plasser - vanlige, bakerst: true });
    }
    return rader;
  }

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

  async function aapneRom(fraHistorikk) {
    S.side = "rom"; S.rom = null; S.romFeil = false;
    if (!fraHistorikk) history.pushState({ side: "rom" }, "");
    render();
    try { S.rom = await Api.romkart(S.trip.id); }
    catch { S.rom = { rom: [], alle: [] }; S.romFeil = true; }
    if (S.side === "rom") render();
  }

  /* Telefonnumre: nødnummerene og nærmeste pårørende på ett sted. */
  async function aapneKontakt(fraHistorikk) {
    S.side = "kontakt"; S.kontakt = null; S.kontaktFeil = false; S.paarTlf = null;
    if (!fraHistorikk) history.pushState({ side: "kontakt" }, "");
    render();
    const leder = S.trip.role === "leader";
    const [k, p] = await Promise.all([
      har("kontakt") ? Api.kontakter(S.trip.id).catch(() => { S.kontaktFeil = true; return { liste: [] }; }) : { liste: [] },
      !har("paaroerende") ? null
        : leder ? Promise.all([Api.tripMembers(S.trip.id), Api.paaroerendeListe(S.trip.id)])
                    .then(([folk, kart]) => ({ folk, kart })).catch(() => ({ folk: [], kart: new Map() }))
        : Api.minPaaroerende(S.trip.id).then(mitt => ({ mitt })).catch(() => ({ mitt: null }))
    ]);
    S.kontakt = k; S.paarTlf = p;
    if (S.side === "kontakt") render();
  }

  async function aapneOpprop(fraHistorikk) {
    S.side = "opprop"; S.opprop = null; S.oppropFeil = false;
    if (!fraHistorikk) history.pushState({ side: "opprop" }, "");
    render();
    try { S.opprop = await Api.opprop(S.trip.id); }
    catch { S.opprop = { runde: null, folk: [] }; S.oppropFeil = true; }
    if (S.side === "opprop") render();
  }

  async function aapneSeter(fraHistorikk) {
    if (!fraHistorikk) S.seteKj = null;
    S.side = "seter"; S.setekart = null; S.seteFeil = false;
    if (!fraHistorikk) history.pushState({ side: "seter" }, "");
    render();
    try { S.setekart = await Api.setekart(S.trip.id); }
    catch { S.setekart = { kjoretoy: [], alle: [] }; S.seteFeil = true; }
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

    const alle = (liste.felles || []).concat(liste.egne || []);
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
      ${utenNett(liste)}
      <p class="muted" style="margin:0">${alle.length
        ? `${klart} av ${alle.length} klart. Bare du ser hva du har krysset av.`
        : leder ? "Alle ser punktene og krysser av for seg selv."
                : "Ingen punkter ennå. Du kan legge inn dine egne under."}</p>

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
    if (!S.setekart) return venter("Henter setekartene");
    const kart = S.setekart.kjoretoy;

    const nyknapp = leder
      ? `<button class="btn big" data-nykj="1">Legg til kjøretøy</button>`
      : "";

    if (!kart.length) return `
      ${utenNett(S.setekart)}
      <p class="muted" style="margin:0">${leder
        ? "Legg inn kjøretøyene og hvilken dag de kjører."
        : "Ikke satt opp ennå."}</p>
      ${nyknapp}`;

    // Ett kjøretøy åpnet: kartet for det alene, med byttene som gjelder det.
    const valgt = S.seteKj && kart.find(k => k.id === S.seteKj);
    if (valgt) return `
      ${utenNett(S.setekart)}
      ${bytteliste([valgt], leder)}
      ${kjoretoykort(valgt, leder)}`;

    return `
      ${utenNett(S.setekart)}
      ${bytteliste(kart, leder)}
      ${toppTekst(kart, leder)}
      ${kjoretoygrupper(kart, leder)}
      ${nyknapp}`;
  }

  /* Setekartet for ett kjøretøy er en egen side under Sitteplasser. Før
     sto alle kartene etter hverandre, og med en buss på 57 plasser måtte
     man bla tre skjermer for å finne bilen. Nå er lista en rad per
     kjøretøy, og kartet kommer når du trykker. */
  function aapneKjoretoy(id) {
    S.seteKj = id;
    history.pushState({ side: "seter", kj: id }, "");
    render();
  }
  // Rad i lista: navn, hvor fullt, og din plass eller hva du kan gjøre.
  function kjoretoyrad(k, leder) {
    const o = oppsett(k.typ);
    const mitt = k.seter.find(s2 => s2.meg);
    const ledige = k.plasser - k.seter.length;
    const verdi = leder ? `${ledige} ledige`
      : mitt ? plassnavn(k, mitt.nr)
      : k.fritt && ledige ? "Velg plass" : "";
    const venter = k.bytter.some(x => (x.tilMeg && x.status === "venter_andre") || (leder && x.status === "venter_leder"));
    return `<button class="listrow" data-kjside="${esc(k.id)}">
        <span class="rikon${mitt ? " mose" : ""}">${ICON.sete}</span>
        <div class="grow"><div class="nm">${esc(k.navn)}${venter ? '<span class="prikkmerke"></span>' : ""}</div>
          <div class="sub">${esc(o.navn)} · ${k.seter.length} av ${k.plasser} tatt</div></div>
        ${verdi ? `<span class="verdi"${!leder && !mitt ? ' style="color:var(--blue-ink)"' : ""}>${esc(verdi)}</span>` : ""}
        <span class="chev">${ICON.chev}</span></button>`;
  }

  /* Kjøretøyene står under dagen de går. «Buss ned» og «Buss hjem» var
     to kart uten noe som sa når, og deltakeren måtte selv vite hvilket
     som gjaldt i dag. Dagens står først og er åpen; resten står under
     sine datoer. Har ingen av dem en dato, er det ingen gruppe å vise og
     lista står som før. */
  function kjoretoygrupper(kart, leder) {
    // Én overskrift per dag, i dagens rekkefølge, og «Hele turen» sist.
    // Står bare ett kjøretøy uten dato, trengs ingen overskrift.
    if (kart.length === 1 && !kart[0].dato) return `<div class="gruppe"><div class="list">${kjoretoyrad(kart[0], leder)}</div></div>`;

    const datoer = Array.from(new Set(kart.map(k => k.dato || ""))).sort((a, b) =>
      a === "" ? 1 : b === "" ? -1 : a.localeCompare(b));
    // I dag først: det er det ene spørsmålet noen stiller setekartet
    // mens turen går.
    datoer.sort((a, b) => (b === today()) - (a === today()));

    return datoer.map(d => {
      const paaDagen = kart.filter(k => (k.dato || "") === d);
      const tittel = d === "" ? "Hele turen" : d === today() ? "I dag" : cap(Api.fmtDay(d).label);
      // Kjøretøy som kjører samtidig står sammen, med én linje som sier
      // at man sitter i ett av dem. Uten den så Bil 1 og Bil 2 ut som to
      // plasser man skulle ha.
      const deler = Api.samtidigGrupper(paaDagen).map(g => {
        const valg = g.kart.length > 1;
        const minI = g.kart.find(k => k.seter.some(x => x.meg));
        const hint = !valg ? "" : leder
          ? `<p class="muted kjhint">${g.kart.length} kjøretøy samtidig. Hver deltaker får plass i ett av dem.</p>`
          : `<p class="muted kjhint">${minI ? `Du sitter i ${esc(minI.navn)}.` : "Velg plass i ett av dem."}</p>`;
        return hint + `<div class="gruppe"><div class="list">${g.kart.map(k => kjoretoyrad(k, leder)).join("")}</div></div>`;
      }).join("");
      return `<div>
        <div class="eyebrow" style="margin-bottom:8px${d === today() ? ";color:var(--blue-ink)" : ""}">${esc(tittel)}</div>
        ${deler}
      </div>`;
    }).join("");
  }

  function toppTekst(kart, leder) {
    if (leder) {
      const tomme = kart.reduce((n, k) => n + (k.plasser - k.seter.length), 0);
      return `<p class="muted" style="margin:0">${kart.length} ${kart.length === 1 ? "kjøretøy" : "kjøretøy"} · ${tomme} ledige plasser til sammen.</p>`;
    }
    const reiser = Api.samtidigGrupper(kart);
    const mangler = reiser.filter(g => g.kart.some(k => k.fritt) && !g.kart.some(k => k.seter.some(x => x.meg)));
    if (!mangler.length) return "";
    const navn = mangler.map(g => reisenavn({ dato: g.dato, slag: g.slag }, reiser));
    return `<p class="muted" style="margin:0">${reiser.length === 1
      ? "Trykk på en ledig plass for å ta den."
      : `Du har ikke valgt plass for ${esc(oppramsing(navn))}. Trykk på en ledig plass.`}</p>`;
  }

  /* Forespørsler om bytte. Et bytte gjelder to personer, så det som
     venter på deg skal stå øverst — ikke gjemt inne i et setekart der
     man må lete etter den ene ruta som ser litt annerledes ut. */
  function bytteliste(kart, leder) {
    const rader = [];
    for (const k of kart) {
      for (const x of k.bytter) {
        const plass = plassnavn(k, x.nr);
        if (x.tilMeg && x.status === "venter_andre") {
          rader.push({
            hva: `${esc(x.fra)} vil bytte til plassen din ${plass} i ${esc(k.navn)}`,
            under: k.godkjenn ? "Sier du ja, går den videre til reiselederen." : "Sier du ja, er byttet gjort.",
            knapper: `<button class="btn primary" data-svarbytte="${esc(x.id)}" data-ja="1">Ja</button>
                      <button class="btn" data-svarbytte="${esc(x.id)}">Nei</button>`
          });
        } else if (leder && x.status === "venter_leder") {
          rader.push({
            hva: `${esc(x.fra)} vil ha ${plass} i ${esc(k.navn)}`,
            under: x.til ? `${esc(x.til)} har sagt ja.` : "Plassen står tom.",
            knapper: `<button class="btn primary" data-avgjorbytte="${esc(x.id)}" data-ja="1">Godkjenn</button>
                      <button class="btn" data-avgjorbytte="${esc(x.id)}">Avslå</button>`
          });
        } else if (x.fraMeg) {
          rader.push({
            hva: `Du har spurt om ${plass} i ${esc(k.navn)}`,
            under: x.status === "venter_andre"
              ? `Venter på svar fra ${esc(x.til || "den som sitter der")}.`
              : "Venter på reiselederen.",
            knapper: `<button class="btn" data-trekkbytte="${esc(x.id)}">Trekk</button>`
          });
        }
      }
    }
    if (!rader.length) return "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Bytter · ${rader.length}</div>
      <div class="card pad" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
        ${rader.map(r => `<div class="bytterad">
          <div class="nm">${r.hva}</div>
          <div class="sub">${r.under}</div>
          <div class="byttevalg">${r.knapper}</div>
        </div>`).join("")}
      </div></div>`;
  }

  /* Ett kjøretøy: navnet, din plass, og kartet. Midtgangen tegnes som
     et tomrom i raden, ikke som et sete — ellers teller man feil når
     man leter etter 12C. */
  function kjoretoykort(k, leder) {
    const o = oppsett(k.typ);
    const tatt = new Map(k.seter.map(s2 => [s2.nr, s2]));
    const mitt = k.seter.find(s2 => s2.meg);
    const spurt = new Set(k.bytter.map(x => x.nr));

    const rad = (r, i) => {
      const ut = [];
      for (let c = 0; c < r.antall; c++) {
        const nr = r.fra + c;
        // Midtgangen tegnes som et tomrom i raden, ikke som et sete —
        // ellers teller man feil når man leter etter 12C. Den brede
        // bakerste raden har ingen midtgang.
        if (o.gang && !r.bakerst && c === o.gang) ut.push('<span class="gang" aria-hidden="true"></span>');
        const s2 = tatt.get(nr), min = Boolean(s2 && s2.meg);
        const plass = plassnavn(k, nr);
        const hvem = min ? "Deg" : s2 ? fornavn(s2.hvem) : "";
        // Et sete kan trykkes av alle nå: reiselederen for å sette noen
        // der, deltakeren for å ta det eller spørre om det. Et sete som
        // ikke kan trykkes gir ingen beskjed om hvorfor.
        // Et ord står ikke der et nummer står: «Bak midt» trenger to
        // linjer og mindre skrift enn «12C».
        ut.push(`<button class="setet ${min ? "min" : s2 ? "tatt" : ""}${spurt.has(nr) ? " spurt" : ""}${
          o.navngiving === "bil" ? " ord" : ""}"
          data-sete="${nr}" data-kj="${esc(k.id)}"
          aria-label="${esc(plass)} i ${esc(k.navn)} — ${s2 ? esc(min ? "deg" : s2.hvem) : "ledig"}${
            spurt.has(nr) ? ", noen har spurt om den" : ""}"
          ><b>${esc(plass)}</b>${hvem ? `<small>${esc(hvem)}</small>` : ""}</button>`);
      }
      // Er raden kortere enn de over, fylles den ut så setene står i
      // kolonne. En rad som flyter fritt ser ut som en annen rad.
      const full = r.bakerst ? r.antall : r.bredde;
      for (let n = r.antall; n < full; n++) ut.push('<span class="setet tom" aria-hidden="true"></span>');
      return `<div class="seterad${r.bakerst ? " bakerst" : ""}">${ut.join("")}</div>`;
    };

    // Din plass hører til i undertittelen, ikke i en egen kolonne: med et
    // langt kjøretøynavn ble de tre tingene stående og slåss om bredden.
    // Én linje som svarer på det man lurer på: for deltakeren «hvor
    // sitter jeg», for reiselederen «hvor fullt er det». Hvem som velger,
    // står her fordi det avgjør hva et trykk gjør.
    const status = leder
      ? `${k.seter.length} av ${k.plasser} tatt · ${k.fritt ? "deltakerne velger selv" : "du fordeler"}`
      : mitt ? `Du har ${plassnavn(k, mitt.nr)}`
      : k.fritt ? `${k.plasser - k.seter.length} ledige` : "Reiselederen fordeler plassene";

    return `<div class="kjkort">
      <div class="kjtopp">
        <div class="grow"><b>${esc(k.navn)}</b>
          <small>${esc(o.navn)} · ${esc(status)}</small></div>
        ${leder ? `<button class="pilleknapp" data-endrekj="${esc(k.id)}">Rediger</button>` : ""}
      </div>
      <div class="setekart">${seteRader(k).map(rad).join("")}</div>
    </div>
    ${leder ? `<div class="gruppe"><div class="list">
        <button class="listrow" data-seteliste="${esc(k.id)}">
          <span class="rikon grunn">${ICON.folk}</span>
          <div class="grow"><div class="nm">Hvem sitter hvor</div></div>
          <span class="chev">${ICON.chev}</span></button>
        <button class="listrow" data-fyllseter="${esc(k.id)}">
          <span class="rikon gul">${ICON.spark}</span>
          <div class="grow"><div class="nm">Fyll ledige plasser</div></div></button>
      </div></div>` : ""}`;
  }

  /* Rom er ikke et setekart. Ingen midtgang, ingen nummerering man
     sikter på — bare navnet, hvor mange senger, og hvem som bor der.
     Derfor en liste og ikke et rutenett. */
  /* Navn fra en innlimt romliste. De som ikke har blitt med ennå, venter;
     de som har sagt «det er meg», står med hvem som bekreftet — og har
     flere sagt ja, står det også. Reiselederen kan angre eller fjerne. */
  function reservasjonsliste(liste) {
    if (!liste.length) return "";
    const venter = liste.filter(r => !r.bekreftetAv);
    const bekreftet = liste.filter(r => r.bekreftetAv);
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Fra romlista · ${liste.length}</div>
      <div class="memberlist">
        ${bekreftet.map(r => `<div class="person"><span>${esc(r.bekreftetAv)} er <b>${esc(r.navn)}</b>
            <em>${esc(r.romnavn)}</em>${r.andre.length
              ? `<br><small style="color:var(--amber)">Også sagt ja: ${esc(r.andre.join(", "))}</small>` : ""}</span>
          <button class="linkbtn" data-angrerom="${esc(r.id)}">angre</button></div>`).join("")}
        ${venter.map(r => `<div class="person"><span>${esc(r.navn)} <em>${esc(r.romnavn)}</em>
            <br><small>Ikke med ennå. Blir spurt når hen blir med.</small></span>
          <button class="linkbtn" data-fjernres="${esc(r.id)}">fjern</button></div>`).join("")}
      </div></div>`;
  }

  /* Romlista limes inn fra Excel, Word eller Sheets. Kopierte celler blir
     tekst med tabulator mellom kolonnene, og det leser vi uten noen
     modell: det er gratis og tar ikke feil. Tre måter å skrive den på:
       Rom 201 <tab> Ola Nordmann <tab> Kari Lund     (rom først, så folk)
       Ola Nordmann <tab> Rom 201                     (navn, så rom)
       Rom 201: Ola Nordmann, Kari Lund               (eller en blokk med
                                                       romnavn over navnene) */
  const normNavn = s => String(s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const navnLigner = (a, b) => {
    const A = normNavn(a).split(" "), B = normNavn(b).split(" ");
    return A.length > 1 && B.length > 1 && A[A.length - 1] === B[B.length - 1] && A[0].slice(0, 3) === B[0].slice(0, 3);
  };
  const serUtSomRom = c => /\d/.test(c) || /^(rom|room|hytte|leilighet)\b/i.test(c);

  function lesRomliste(tekst) {
    const rom = new Map();
    const legg = (romnavn, navn) => {
      const r = String(romnavn || "").trim(), n = String(navn || "").replace(/\s+/g, " ").trim();
      if (!r || !n || serUtSomRom(n)) return;
      if (!rom.has(r)) rom.set(r, []);
      if (!rom.get(r).some(x => normNavn(x) === normNavn(n))) rom.get(r).push(n);
    };
    let blokk = null;
    for (const linje of String(tekst || "").split(/\r?\n/)) {
      const l = linje.trim();
      if (!l) { blokk = null; continue; }
      const celler = l.split(/\t|;/).map(c => c.trim()).filter(Boolean);
      if (celler.length >= 2) {
        if (/^(rom|navn|room|name)$/i.test(celler[0]) && /^(rom|navn|room|name|deltaker)/i.test(celler[1])) continue;
        if (serUtSomRom(celler[0])) celler.slice(1).forEach(n => legg(celler[0], n));
        else if (serUtSomRom(celler[celler.length - 1])) celler.slice(0, -1).forEach(n => legg(celler[celler.length - 1], n));
        else celler.slice(1).forEach(n => legg(celler[0], n));
        blokk = null;
      } else if (l.includes(":")) {
        const [r, resten] = l.split(/:(.*)/s);
        resten.split(",").forEach(n => legg(r, n));
        blokk = r.trim();
      } else if (serUtSomRom(l)) {
        blokk = l;
      } else if (blokk) {
        l.split(",").forEach(n => legg(blokk, n));
      }
    }
    return [...rom.entries()].map(([navn, folk]) => ({ navn, folk }));
  }

  function sheetRomliste() {
    openSheet(`<h3>Lim inn romliste</h3>
      <p class="lede">Kopier rommene og navnene fra Excel, Word eller Sheets og lim dem inn her.
        Én rad per rom med navnene ved siden av, eller én rad per person med rommet ved siden av.</p>
      <div class="field"><label for="rlTekst">Romlista</label>
        <textarea id="rlTekst" rows="8" placeholder="Rom 201	Ola Nordmann	Kari Lund&#10;Rom 202	Per Hansen"></textarea></div>
      <p class="err" id="rlErr" hidden></p>
      <button class="btn primary big" id="rlLes">Les lista</button>
      <button class="btn close" data-close>Avbryt</button>`);

    $("rlLes").addEventListener("click", () => {
      const rom = lesRomliste($("rlTekst").value);
      if (!rom.length) {
        $("rlErr").textContent = "Fant ingen rom med navn i teksten. Sjekk at hvert rom har et navn eller nummer.";
        $("rlErr").hidden = false; return;
      }
      visRomliste(rom);
    });
  }

  /* Forslaget før noe lagres. Hvert navn er koblet til noen på turen,
     ligner på noen (da må reiselederen krysse av selv), eller venter. */
  function visRomliste(rom) {
    const alle = (S.rom && S.rom.alle) || [];
    let n = 0;
    const rader = rom.map((r, i) => `<div style="margin-bottom:16px">
      <div class="eyebrow" style="margin-bottom:7px">${esc(r.navn)} · ${r.folk.length}</div>
      <div class="memberlist">${r.folk.map((navn, j) => {
        const lik = alle.filter(p => normNavn(p.navn) === normNavn(navn));
        const ligner = lik.length ? [] : alle.filter(p => navnLigner(p.navn, navn));
        n++;
        if (lik.length === 1) return `<div class="person"><span>${esc(navn)}</span>
          <span class="tag moss" data-rl="${i}-${j}" data-bruker="${esc(lik[0].id)}">med på turen</span></div>`;
        if (ligner.length === 1) return `<label class="person"><span>${esc(navn)}<br>
          <small>Ligner på <b>${esc(ligner[0].navn)}</b>. Kryss av hvis det er hen.</small></span>
          <input type="checkbox" data-rl="${i}-${j}" data-bruker="${esc(ligner[0].id)}"></label>`;
        return `<div class="person"><span>${esc(navn)}<br><small>Ikke med ennå. Blir spurt når hen blir med.</small></span>
          <span class="tag" data-rl="${i}-${j}">venter</span></div>`;
      }).join("")}</div></div>`).join("");

    openSheet(`<h3>Romlista</h3>
      <p class="lede">${rom.length} rom og ${n} navn. Finnes rommet fra før, legges folk inn der.
        Har noen alt et rom, flyttes de.</p>
      ${rader}
      <p class="err" id="rlErr" hidden></p>
      <button class="btn primary big" id="rlLagre">Lagre romlista</button>
      <button class="btn close" data-close>Avbryt</button>`);

    $("rlLagre").addEventListener("click", async e => {
      const b = e.currentTarget;
      const pakke = rom.map((r, i) => ({
        navn: r.navn,
        folk: r.folk.map((navn, j) => {
          const el = $("sheet").querySelector(`[data-rl="${i}-${j}"]`);
          const bruker = el && el.dataset.bruker && (el.type !== "checkbox" || el.checked) ? el.dataset.bruker : null;
          return { user_id: bruker, navn };
        })
      }));
      b.disabled = true; b.innerHTML = prikker() + " Lagrer";
      try {
        const svar = await Api.lagreRomliste(S.trip.id, pakke);
        closeSheet();
        await aapneRom(true);
        hentMegTall(true);
        toast(`${svar.plassert || 0} plassert${svar.venter ? `, ${svar.venter} venter på å bli med` : ""}.`);
      } catch (err) {
        b.disabled = false; b.textContent = "Lagre romlista";
        $("rlErr").textContent = err.message; $("rlErr").hidden = false;
      }
    });
  }

  /* «Er du Per Ola Nordmann?» Spørres når en deltaker åpner turen og navnet
     ligner på et navn på romlista som ingen har bekreftet. Basen sjekker
     det samme en gang til når svaret kommer (Utvidelse 30). */
  const romSpurt = new Set();
  async function spoerOmRomplass(tripId) {
    const forslag = (await Api.mineRomforslag(tripId)).filter(f => !romSpurt.has(f.id));
    if (!forslag.length || !S.trip || S.trip.id !== tripId || S.omvis) return;
    const f = forslag[0];
    romSpurt.add(f.id);
    openSheet(`<h3>Er du ${esc(f.navn)}?</h3>
      <p class="lede">Reiselederen har satt <b>${esc(f.navn)}</b> på <b>${esc(f.rom)}</b>.
        Er det deg, får du sengen, og navnet ditt i appen blir som på lista.</p>
      <p class="err" id="rsErr" hidden></p>
      <button class="btn primary big" id="rsJa">Ja, det er meg</button>
      <button class="btn" style="width:100%;margin-top:10px" id="rsNei">Nei, det er ikke meg</button>`);
    $("rsJa").addEventListener("click", async e => {
      e.currentTarget.disabled = true;
      try {
        const romnavn = await Api.bekreftRomplass(f.id);
        closeSheet();
        await openTrip(tripId);
        toast(`Du bor på ${romnavn || f.rom}.`);
      } catch (err) { $("rsErr").textContent = err.message; $("rsErr").hidden = false; }
    });
    $("rsNei").addEventListener("click", async () => { closeSheet(); await Api.avvisRomforslag(f.id).catch(() => {}); });
  }

  function viewRom() {
    const leder = S.trip.role === "leader";
    if (S.romFeil) return '<p class="muted">Klarte ikke hente romfordelingen. Sjekk nettet og prøv igjen.</p>';
    if (!S.rom) return venter("Henter romfordelingen");
    const { rom, alle } = S.rom;
    const bytter = S.rom.bytter || [];

    const nyknapp = leder
      ? `<div class="stack"><button class="btn big" data-nyttrom="1">Legg til rom</button>
           <button class="btn" data-romliste="1">Lim inn romliste</button></div>`
      : "";

    if (!rom.length) return `
      ${utenNett(S.rom)}
      <p class="muted" style="margin:0">${leder
        ? "Legg inn rommene, så fordeler du folk på dem."
        : "Ikke satt opp ennå."}</p>
      ${nyknapp}`;

    const uten = alle.filter(p => !p.rom);
    const mitt = rom.find(r => r.folk.some(p => p.meg));

    return `
      ${utenNett(S.rom)}
      ${rombytteliste(bytter, leder)}
      <p class="muted" style="margin:0">${mitt
        ? `Du bor på <b>${esc(mitt.navn)}</b>.${S.trip.romFritt && !leder
            ? " Trykk på et annet rom for å spørre om å flytte." : ""}`
        : leder ? `${rom.length} rom · ${uten.length} uten seng.`
                : S.trip.romFritt
                  ? "Du har ikke rom ennå. Trykk på et rom med ledig seng."
                  : "Du har ikke fått rom ennå."}</p>

      ${leder ? romvalg() : ""}

      ${leder && uten.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Uten seng · ${uten.length}</div>
        <div class="card pad" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
          <div class="memberlist">${uten.map(p => `<div class="person">
            <span>${esc(p.navn)}${p.leder ? ' <em>reiseleder</em>' : ""}</span>
            <button class="linkbtn" data-settrom="${esc(p.id)}">gi rom</button>
          </div>`).join("")}</div>
        </div></div>` : ""}

      ${leder ? reservasjonsliste(S.rom.reservasjoner || []) : ""}

      ${romgrupper(rom, leder, bytter)}
      ${nyknapp}`;
  }

  /* Rommene står under hotellet de hører til. En tur med to hoteller
     hadde én flat liste før, og reiselederen måtte skrive hotellet inn i
     romnavnet selv. Har turen bare ett hotell — eller ingen som er satt —
     er det ingen gruppe å vise, og lista står som før. */
  function romgrupper(rom, leder, bytter) {
    const steder = Array.from(new Set(rom.map(r => r.sted).filter(Boolean)));
    if (steder.length < 2) return rom.map(r => romkort(r, leder, bytter)).join("");

    const navnet = id => {
      const p = S.trip.places[id];
      return p ? p.name : "Annet hotell";
    };
    const grupper = steder.map(s => ({ navn: navnet(s), rom: rom.filter(r => r.sted === s) }));
    const uten = rom.filter(r => !r.sted);
    if (uten.length) grupper.push({ navn: "Uten hotell", rom: uten });

    return grupper.map(g => `<div>
      <div class="eyebrow" style="margin-bottom:8px">${esc(g.navn)} · ${g.rom.length} rom</div>
      ${g.rom.map(r => romkort(r, leder, bytter)).join("")}
    </div>`).join("");
  }

  /* Ett rom. For reiselederen er det en liste å fordele i; for deltakeren
     er det et sted man kan spørre om — men bare når reiselederen har
     åpnet for det. Er rommet fullt, er det en person man spør, ikke en
     seng: ellers hadde noen blitt stående uten. */
  function romkort(r, leder, bytter) {
    const fritt = S.trip.romFritt;
    const mitt = r.folk.some(p => p.meg);
    const ledig = r.folk.length < r.plasser;
    const spurt = bytter.some(x => x.rom === r.id);
    const kanSpoerre = fritt && !leder && !mitt;
    // Har du ikke rom selv, har du ingenting å bytte bort, og den du
    // byttet med ville blitt stående uten seng. Da er det bare de ledige
    // sengene å be om.
    const jeg = (S.rom.alle || []).find(p => p.meg);
    const kanBytte = kanSpoerre && Boolean(jeg && jeg.rom);

    return `<div class="kjkort${spurt ? " spurt" : ""}">
      <div class="kjtopp">
        <div class="grow"><b>${esc(r.navn)}</b>
          <small>${r.folk.length} av ${r.plasser} senger${mitt ? " · du bor her" : ""}</small></div>
        ${leder ? `<button class="minibtn" data-endrerom="${esc(r.id)}"
          aria-label="Endre ${esc(r.navn)}">${ICON.blyant}</button>` : ""}
      </div>
      ${r.folk.length
        ? `<div class="memberlist">${r.folk.map(p => `<div class="person">
            <span>${esc(p.navn)}${p.meg ? " <em>deg</em>" : ""}</span>
            ${leder ? `<button class="linkbtn" data-utavrom="${esc(p.id)}">ta ut</button>`
              : kanBytte ? `<button class="linkbtn" data-bytterom="${esc(r.id)}"
                  data-person="${esc(p.id)}">bytt med</button>` : ""}
          </div>`).join("")}</div>`
        : `<p class="muted" style="margin:0">Ingen her ennå.</p>`}
      ${leder && ledig
        ? `<button class="btn" style="width:100%;margin-top:10px" data-fyllrom="${esc(r.id)}">Legg til noen</button>`
        : ""}
      ${kanSpoerre && ledig
        ? `<button class="btn" style="width:100%;margin-top:10px" data-bytterom="${esc(r.id)}">Be om ledig seng</button>`
        : ""}
    </div>`;
  }

  /* De samme to bryterne kjøretøyene har, men på turen: et bytte går
     mellom to rom, og én bryter per rom ville gitt to svar på samme
     spørsmål. */
  function romvalg() {
    return `<div class="gruppe"><div class="list">
      <label class="listrow" style="cursor:pointer">
        <div class="grow"><div class="nm">Deltakerne kan flytte seg selv</div>
          <div class="sub">${S.trip.romFritt ? "Hver deltaker velger seng selv." : "Bare du setter hvem som bor hvor."}</div></div>
        <input type="checkbox" class="bryter" data-romfritt="1" ${S.trip.romFritt ? "checked" : ""}></label>
      <label class="listrow" style="cursor:pointer">
        <div class="grow"><div class="nm">Jeg godkjenner bytter</div>
          <div class="sub">${S.trip.romGodkjenn ? "Et bytte gjelder først når du har sagt ja." : "Det holder at begge som bytter sier ja."}</div></div>
        <input type="checkbox" class="bryter" data-romgodkjenn="1" ${S.trip.romGodkjenn ? "checked" : ""}></label>
    </div></div>`;
  }

  /* Forespørsler om rombytte. Samme form som for setene, og av samme
     grunn: det som venter på et svar fra deg skal stå øverst, ikke
     gjemt inne i et romkort som ser litt annerledes ut enn de andre. */
  function rombytteliste(bytter, leder) {
    const rader = [];
    const romnavn = id => {
      const r = (S.rom.rom || []).find(x => x.id === id);
      return r ? r.navn : "rommet";
    };
    for (const x of bytter) {
      if (x.tilMeg && x.status === "venter_andre") {
        rader.push({
          hva: `${esc(x.fra)} vil bytte rom med deg`,
          under: `Du får ${esc(x.fraRom || "rommet deres")}.${S.trip.romGodkjenn
            ? " Sier du ja, går den videre til reiselederen." : " Sier du ja, er byttet gjort."}`,
          knapper: `<button class="btn primary" data-svarrombytte="${esc(x.id)}" data-ja="1">Ja</button>
                    <button class="btn" data-svarrombytte="${esc(x.id)}">Nei</button>`
        });
      } else if (leder && x.status === "venter_leder") {
        rader.push({
          hva: `${esc(x.fra)} vil inn på ${esc(romnavn(x.rom))}`,
          under: x.til ? `${esc(x.til)} har sagt ja til å bytte.` : "Det står en seng ledig.",
          knapper: `<button class="btn primary" data-avgjorrombytte="${esc(x.id)}" data-ja="1">Godkjenn</button>
                    <button class="btn" data-avgjorrombytte="${esc(x.id)}">Avslå</button>`
        });
      } else if (x.fraMeg) {
        rader.push({
          hva: `Du har spurt om ${esc(romnavn(x.rom))}`,
          under: x.status === "venter_andre"
            ? `Venter på svar fra ${esc(x.til || "den som bor der")}.`
            : "Venter på reiselederen.",
          knapper: `<button class="btn" data-trekkrombytte="${esc(x.id)}">Trekk</button>`
        });
      }
    }
    if (!rader.length) return "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Bytter · ${rader.length}</div>
      <div class="card pad" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
        ${rader.map(r => `<div class="bytterad">
          <div class="nm">${r.hva}</div>
          <div class="sub">${r.under}</div>
          <div class="byttevalg">${r.knapper}</div>
        </div>`).join("")}
      </div></div>`;
  }

  /* Listene som tåler å stå uten nett sier det selv. Uten denne linja
     ville en gammel kopi sett ut som sannheten. */
  function utenNett(data) {
    if (!data || !data.lagret) return "";
    return `<p class="bareledere">${ICON.info} Uten nett. Dette er listen slik den var sist du hadde dekning.</p>`;
  }

  /* ───────────────── nødnummer ─────────────────
     Det eneste i appen noen kommer til å lete etter i en situasjon der
     det haster. Derfor: ingen innpakning, nummeret står som en lenke
     man ringer med ett trykk, og lista ligger lagret så den er der uten
     dekning også.

     Nummeret skrives som reiselederen skrev det. Vi renser bare bort det
     telefonen ikke tåler i en tel:-lenke. */
  function viewKontakt() {
    const leder = S.trip.role === "leader";
    if (!S.kontakt) return venter("Henter nummerene");
    return utenNett(S.kontakt) + nodnummer(leder) + paaroerendeDel(leder);
  }

  function nodnummer(leder) {
    if (!har("kontakt")) return "";
    if (S.kontaktFeil) return '<p class="muted" style="margin:0">Klarte ikke hente nummerene. Sjekk nettet og prøv igjen.</p>';
    const liste = S.kontakt.liste || [];
    const nyknapp = leder ? `<button class="btn" data-nykontakt="1">Legg til nummer</button>` : "";
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Nødnummer</div>
      ${liste.length ? `<div class="gruppe"><div class="list">
        ${liste.map(c => `<a class="listrow" href="tel:${esc(telnummer(c.telefon))}">
          <span class="rikon gul">${ICON.telefon}</span>
          <div class="grow"><div class="nm">${esc(c.navn)}</div>
            <div class="sub">${esc([c.rolle, c.telefon, c.notat].filter(Boolean).join(" · "))}</div></div>
        </a>${leder ? `<div class="kontaktrad">
          <button class="linkbtn" data-endrekontakt="${esc(c.id)}">endre</button>
          <button class="linkbtn fare" data-slettkontakt="${esc(c.id)}">slett</button>
        </div>` : ""}`).join("")}
      </div></div>` : `<p class="muted" style="margin:0 0 10px">${leder
        ? "Legg inn deg selv, de andre reiselederne og et nummer hjemme." : "Ingen nummer ennå."}</p>`}
      ${nyknapp}
    </div>`;
  }

  /* Deltakeren ser sin egen pårørende. Reiselederen ser alle, med
     hvem som mangler. */
  function paaroerendeDel(leder) {
    if (!har("paaroerende") || !S.paarTlf) return "";
    if (!leder) {
      const m = S.paarTlf.mitt;
      return `<div>
        <div class="eyebrow" style="margin-bottom:8px">Din nærmeste pårørende</div>
        <div class="gruppe"><div class="list"><button class="listrow" data-sheet="paaroerende">
          <span class="rikon gul">${ICON.telefon}</span>
          <div class="grow"><div class="nm">${m ? esc(m.navn) : "Legg inn"}</div>
            ${m ? `<div class="sub">${esc(m.telefon)}</div>` : ""}</div>
          <span class="chev">${ICON.chev}</span></button></div></div>
      </div>`;
    }
    const { folk, kart } = S.paarTlf;
    const deltakere = (folk || []).filter(p => !p.skjult && !p.venter && !p.me);
    const med = deltakere.filter(p => kart.get(p.id));
    const uten = deltakere.filter(p => !kart.get(p.id));
    if (!deltakere.length) return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Pårørende</div>
      <p class="muted" style="margin:0">Deltakerne legger inn sin egen når de blir med.</p></div>`;
    return `<div>
      <div class="eyebrow" style="margin-bottom:8px">Pårørende · ${med.length} av ${deltakere.length}</div>
      ${med.length ? `<div class="gruppe"><div class="list">${med.map(p => {
        const r = kart.get(p.id);
        return `<a class="listrow" href="tel:${esc(telnummer(r.telefon))}">
          <div class="grow"><div class="nm">${esc(r.navn)}</div>
            <div class="sub">${esc(r.telefon)} · til ${esc(p.name)}</div></div></a>`;
      }).join("")}</div></div>` : ""}
      ${uten.length ? `<p class="muted" style="margin:10px 0 0;font-size:14px">Mangler: ${esc(uten.map(p => p.name).join(", "))}</p>` : ""}
    </div>`;
  }

  /* En tel:-lenke tåler tall, pluss og noen skilletegn. Mellomrom og
     parenteser som folk skriver nummer med, må bort. */
  const telnummer = t => String(t || "").replace(/[^\d+*#]/g, "");

  function sheetKontakt(id) {
    const c = id && ((S.kontakt || {}).liste || []).find(x => x.id === id);
    openSheet(`<h3>${c ? "Endre nummer" : "Nytt nummer"}</h3>
      <p class="lede">Alle på turen ser dette, også uten nett.</p>
      <form id="koForm">
        <div class="field"><label for="koNavn">Navn</label>
          <input id="koNavn" type="text" maxlength="60" placeholder="Kari Lund"
            value="${c ? esc(c.navn) : ""}" autocomplete="off"></div>
        <div class="field"><label for="koRolle">Rolle</label>
          <input id="koRolle" type="text" maxlength="40" placeholder="Reiseleder"
            value="${c ? esc(c.rolle) : ""}" autocomplete="off"></div>
        <div class="field"><label for="koTlf">Telefon</label>
          <input id="koTlf" type="tel" maxlength="30" inputmode="tel" placeholder="+47 900 00 000"
            value="${c ? esc(c.telefon) : ""}" autocomplete="off"></div>
        <div class="field"><label for="koNotat">Notat</label>
          <input id="koNotat" type="text" maxlength="200" placeholder="Ring denne først"
            value="${c ? esc(c.notat) : ""}" autocomplete="off"></div>
        <p class="err" id="koErr" hidden></p>
        <button class="btn primary big" type="submit" id="koLagre">Lagre</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);

    $("koForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("koErr"), btn = $("koLagre");
      const felter = {
        navn: $("koNavn").value.trim(), rolle: $("koRolle").value.trim(),
        telefon: $("koTlf").value.trim(), notat: $("koNotat").value.trim()
      };
      if (!felter.navn) { err.textContent = "Skriv et navn."; err.hidden = false; return; }
      if (telnummer(felter.telefon).length < 3) {
        err.textContent = "Skriv et telefonnummer."; err.hidden = false; return;
      }
      btn.disabled = true; btn.textContent = "Lagrer…";
      try {
        if (c) await Api.endreKontakt(c.id, felter);
        else await Api.nyKontakt(S.trip.id, felter);
        closeSheet();
        await aapneKontakt(true);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Lagre";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  /* ───────────────── opprop ─────────────────
     Førti elever på en rasteplass. En runde åpnes, navnene hakes av, og
     den lukkes. Bare reiseledere ser den: hvem som mangler er ikke noe
     hele bussen skal sitte og følge med på.

     De som ikke er haket av står øverst. Det er de man leter etter — og
     mot slutten av en runde er det de to siste navnene som betyr noe,
     ikke de trettiåtte som er på plass. */
  function viewOpprop() {
    if (S.oppropFeil) return '<p class="muted">Klarte ikke hente oppropet. Sjekk nettet og prøv igjen.</p>';
    if (!S.opprop) return venter("Henter oppropet");
    const { runde, folk } = S.opprop;

    if (!runde) return `
      <p class="muted" style="margin:0">Hak av navnene. Bare reiselederne ser oppropet.</p>
      <button class="btn primary big" data-nyttopprop="1">Start et opprop</button>`;

    // Gjelder runden ett kjøretøy, telles de som sitter der. De som ikke
    // har plass i noe kjøretøy den dagen, står for seg nederst, så ingen
    // faller ut av tellingen (L6).
    const iRunden = folk.filter(p => p.iKjoretoy);
    const utenPlass = runde.kjoretoy_id ? folk.filter(p => !p.iKjoretoy && p.utenPlass) : [];
    const mangler = iRunden.filter(p => !p.her);
    const her = iRunden.filter(p => p.her);
    const rad = p => `<div class="person">
      <button class="pkhake ${p.her ? "av" : ""}" data-hake="${esc(p.id)}"
        aria-pressed="${p.her}" aria-label="${p.her ? "Fjern haken for" : "Hak av"} ${esc(p.navn)}"
        >${p.her ? ICON.hake : ""}</button>
      <span class="grow">${esc(p.navn)}${p.leder ? ' <em>reiseleder</em>' : ""}</span>
    </div>`;

    return `
      <p class="muted" style="margin:0">${her.length} av ${iRunden.length} er med${
        runde.kjoretoyNavn ? ` i <b>${esc(runde.kjoretoyNavn)}</b>` : ""}${runde.navn ? ` · ${esc(runde.navn)}` : ""}.</p>

      ${mangler.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Mangler · ${mangler.length}</div>
        <div class="card pad" style="border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
          <div class="memberlist opprop">${mangler.map(rad).join("")}</div>
        </div></div>` : `<div class="card pad" style="border-color:color-mix(in srgb, var(--moss) 45%, var(--line))">
          <p class="muted" style="margin:0">Alle er med.</p></div>`}

      ${her.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px;color:var(--moss)">Med · ${her.length}</div>
        <div class="gruppe"><div class="memberlist opprop" style="padding:4px 14px">${her.map(rad).join("")}</div></div>
      </div>` : ""}

      ${utenPlass.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px">Uten plass i noe kjøretøy · ${utenPlass.length}</div>
        <div class="gruppe"><div class="memberlist opprop" style="padding:4px 14px">${utenPlass.map(rad).join("")}</div></div>
      </div>` : ""}

      <button class="btn big" data-lukkopprop="${esc(runde.id)}">Avslutt oppropet</button>`;
  }

  /* Hvem skal inn? Lista er alle på turen, med rommet de har i dag
     ved siden av — ellers må man huske det selv mens man fordeler. */
  function sheetVelgPerson(romId) {
    const { rom, alle } = S.rom;
    const r = rom.find(x => x.id === romId);
    const navnPaa = id => (rom.find(x => x.id === id) || {}).navn || "";
    openSheet(`<h3>Hvem skal på ${esc(r ? r.navn : "rommet")}?</h3>
      <p class="lede">${r ? `${r.folk.length} av ${r.plasser} senger er tatt.` : ""}</p>
      <div class="memberlist">${alle.map(p => `<div class="person">
        <span>${esc(p.navn)}${p.leder ? ' <em>reiseleder</em>' : ""}${
          p.rom ? ` <em>${esc(navnPaa(p.rom))}</em>` : ""}</span>
        ${p.rom === romId
          ? `<span class="tag">her</span>`
          : `<button class="linkbtn" data-romvalg="${esc(p.id)}" data-rom="${esc(romId)}">velg</button>`}
      </div>`).join("")}</div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* Og motsatt vei: personen er valgt, nå skal rommet velges. */
  function sheetVelgRom(personId) {
    const { rom, alle } = S.rom;
    const p = alle.find(x => x.id === personId);
    openSheet(`<h3>Rom til ${esc(p ? p.navn : "deltakeren")}</h3>
      <div class="gruppe"><div class="list">
        ${rom.map(r => `<button class="listrow" data-romvalg="${esc(personId)}" data-rom="${esc(r.id)}"
          ${r.folk.length >= r.plasser && p && p.rom !== r.id ? "disabled" : ""}>
          <div class="grow"><div class="nm">${esc(r.navn)}</div>
            <div class="sub">${r.folk.length} av ${r.plasser} senger</div></div>
          ${p && p.rom === r.id ? '<span class="verdi">her nå</span>' : ""}
          <span class="chev">${ICON.chev}</span></button>`).join("")}
      </div></div>
      ${p && p.rom ? `<button class="btn danger" style="width:100%;margin-top:10px"
        data-romvalg="${esc(personId)}">Ta ut av rommet</button>` : ""}
      <button class="btn close" data-close>Avbryt</button>`);
  }

  /* Hotellene turen bor på, slik de står i programmet. Det er de eneste
     stedene et rom kan høre til — et rom på et museum finnes ikke. */
  function hotellene() {
    const ider = Array.from(new Set(S.trip.days.map(d => d.hotel).filter(Boolean)));
    return ider.map(id => ({ id, navn: (S.trip.places[id] || {}).name || "Hotell" }));
  }

  function sheetRom(id) {
    const r = id && S.rom.rom.find(x => x.id === id);
    const hotell = hotellene();
    openSheet(`<h3>${r ? "Endre rom" : "Nye rom"}</h3>
      ${r ? "" : `<p class="lede">Slutter navnet på et tall, teller appen videre:
        «Rom 201» og fire rom blir 201, 202, 203 og 204.</p>`}
      <form id="romForm">
        <div class="field"><label for="rmNavn">Navn</label>
          <input id="rmNavn" type="text" maxlength="40" placeholder="Rom 201"
            value="${r ? esc(r.navn) : ""}" autocomplete="off"></div>
        <div class="field"><label for="rmAnt">Antall senger</label>
          <input id="rmAnt" type="number" min="1" max="40" inputmode="numeric" value="${r ? r.plasser : 4}"></div>
        ${r ? "" : `<div class="field"><label for="rmHvorMange">Hvor mange slike rom?</label>
          <input id="rmHvorMange" type="number" min="1" max="60" inputmode="numeric" value="1"></div>`}
        ${hotell.length > 1 ? `<div class="field"><label for="rmSted">Hotell</label>
          <select id="rmSted" class="select">
            <option value="">Ikke valgt</option>
            ${hotell.map(h => `<option value="${esc(h.id)}"${r && r.sted === h.id ? " selected" : ""}>${esc(h.navn)}</option>`).join("")}
          </select></div>` : ""}
        <p class="err" id="rmErr" hidden></p>
        <button class="btn primary big" type="submit" id="rmLagre">Lagre</button>
      </form>
      ${r ? `<button class="btn danger" style="width:100%;margin-top:10px"
        data-slettrom="${esc(r.id)}">Slett rommet</button>` : ""}
      <button class="btn close" data-close>Avbryt</button>`);

    $("romForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("rmErr"), btn = $("rmLagre");
      const navn = $("rmNavn").value.trim();
      const plasser = parseInt($("rmAnt").value, 10);
      const antall = $("rmHvorMange") ? parseInt($("rmHvorMange").value, 10) : 1;
      const sted = $("rmSted") ? $("rmSted").value : undefined;
      if (!navn) { err.textContent = "Gi rommet et navn."; err.hidden = false; return; }
      if (!plasser || plasser < 1 || plasser > 40) {
        err.textContent = "Antall senger må være mellom 1 og 40."; err.hidden = false; return;
      }
      if (!r && (!antall || antall < 1 || antall > 60)) {
        err.textContent = "Antall rom må være mellom 1 og 60."; err.hidden = false; return;
      }
      btn.disabled = true; btn.textContent = "Lagrer…";
      try {
        if (r) await Api.endreRom(r.id, navn, plasser, sted);
        else await Api.nyttRom(S.trip.id, navn, plasser, sted, antall);
        closeSheet();
        await aapneRom(true);
        hentMegTall(true);
      } catch (e2) {
        btn.disabled = false; btn.textContent = "Lagre";
        err.textContent = e2.message; err.hidden = false;
      }
    });
  }

  /* Reiselederen setter en person på en plass. «Ingen» tømmer den. */
  function sheetSete(kjoretoyId, nr) {
    const k = S.setekart.kjoretoy.find(x => x.id === kjoretoyId);
    if (!k) return;
    const plass = plassnavn(k, nr);
    const paa = k.seter.find(s2 => s2.nr === nr);
    const hvor = new Map(k.seter.map(s2 => [s2.id, plassnavn(k, s2.nr)]));
    // Sitter personen i et kjøretøy som kjører samtidig, står det også,
    // så du ser at hen blir flyttet hit.
    const n = Api.samtidigNokkel(k);
    for (const x of S.setekart.kjoretoy) {
      if (x.id === k.id || Api.samtidigNokkel(x) !== n) continue;
      for (const s2 of x.seter) if (!hvor.has(s2.id)) hvor.set(s2.id, `${plassnavn(x, s2.nr)} i ${x.navn}`);
    }
    openSheet(`<h3>${plass} i ${esc(k.navn)}</h3>
      <p class="lede">${paa ? `${esc(paa.hvem)} sitter her nå.` : "Plassen er ledig."}</p>
      <div class="memberlist">${S.setekart.alle.map(p => `<div class="person">
        <span>${esc(p.navn)}${hvor.has(p.id) ? ` <em>${esc(hvor.get(p.id))}</em>` : ""}</span>
        ${paa && paa.id === p.id
          ? `<span class="tag">her</span>`
          : `<button class="linkbtn" data-setevalg="${esc(p.id)}"
              data-kj="${esc(kjoretoyId)}" data-nr="${nr}">velg</button>`}
      </div>`).join("")}</div>
      ${paa ? `<button class="btn danger" style="width:100%;margin-top:10px"
        data-setevalg="" data-kj="${esc(kjoretoyId)}" data-nr="${nr}">Gjør plassen ledig</button>` : ""}
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* ───────── ny turkode ─────────
     Koden er en delt hemmelighet. Kommer den ut til flere enn den
     skulle, var eneste vei før dette å lage turen på nytt. Den gamle
     slutter å virke i samme øyeblikk; de som alt er med, merker
     ingenting. */
  function sheetByttKode() {
    openSheet(`<h3>Ny turkode</h3>
      <p class="lede">Koden er nå <b class="mono">${esc(S.trip.code)}</b>.
        Lager du en ny, slutter den gamle å virke med en gang.
        De som alt er med på turen, merker ingenting — men alle som
        fortsatt skal bli med, må få den nye koden.</p>
      <p class="err" id="bkErr" hidden></p>
      <button class="btn primary big" id="bkLag">Lag en ny kode</button>
      <button class="btn close" data-close>Avbryt</button>`);

    $("bkLag").addEventListener("click", async () => {
      const btn = $("bkLag"), err = $("bkErr");
      btn.disabled = true; btn.textContent = "Lager…";
      try {
        const ny = await Api.byttTurkode(S.trip.id);
        S.trip.code = ny;
        S.trips = (S.trips || []).map(x => x.id === S.trip.id ? Object.assign({}, x, { code: ny }) : x);
        closeSheet();
        render();
        toast("Ny turkode: " + ny);
      } catch (e) {
        btn.disabled = false; btn.textContent = "Lag en ny kode";
        err.textContent = e.message; err.hidden = false;
      }
    });
  }

  /* ───────── slette kontoen ─────────
     Lå som den fjerde raden i en stabel med faregrep, rett under «Logg
     ut». Det som ikke kan angres, skal ikke ligge der fingeren er på vei
     et annet sted. Selve slettingen gjør #slettKontoBtn, som før. */
  function sheetSlettKonto() {
    const gjest = Api.erAnonym();
    openSheet(`<h3>Slette kontoen?</h3>
      <p class="lede">${gjest
        ? `Du er gjest, så kontoen finnes bare ${erNativ() ? "på denne telefonen" : "i denne nettleseren"}. Alt du har her forsvinner, og du må bruke turkoden på nytt for å komme inn igjen.`
        : "Du mistes fra alle turene dine, og e-posten din kan ikke logge inn igjen. Eier du en tur, må den slettes eller gis bort først."}</p>
      <p class="muted" style="margin:0 0 16px">Dette kan ikke angres. Vil du bare bort fra
        denne telefonen, er «Logg ut på denne enheten» det du leter etter.</p>
      <button class="btn danger big" id="slettKontoBtn">Slett kontoen min</button>
      <button class="btn close" data-close>Avbryt</button>`);
  }

  /* ───────── melde seg av, og slette turen ─────────
     Eieren kan ikke bare gå: da sto turen uten noen som kunne slette den.
     Den siste lederen heller ikke. Basen stopper begge (Utvidelse 29), og
     arkene her viser veien videre i stedet for en feilmelding. */
  async function meldAv(tripId) {
    await Api.leaveTrip(tripId);
    S.trips = await Api.myTrips().catch(() => []);
    if (S.trips.length) { S.tab = "program"; await openTrip(S.trips[0].id); }
    else { Api.setLastTrip(null); showJoin(); }
  }

  function sheetMeldAv() {
    const trip = S.trip;
    if (!trip.erEier) {
      openSheet(`<h3>Melde deg av ${esc(trip.name)}?</h3>
        <p class="lede">Du mister programmet og chattene. Du kommer inn igjen med turkoden,
          så sant reiselederen ikke har laget en ny kode eller krever godkjenning.</p>
        <p class="err" id="maErr" hidden></p>
        <button class="btn danger big" id="maJa">Meld meg av</button>
        <button class="btn close" data-close>Avbryt</button>`);
      $("maJa").addEventListener("click", async e => {
        e.currentTarget.disabled = true;
        try { closeSheet(); await meldAv(trip.id); }
        catch (err) { openSheet(`<h3>Det gikk ikke</h3><p class="lede">${esc(err.message)}</p>
          <button class="btn close" data-close>Lukk</button>`); }
      });
      return;
    }

    openSheet(`<h3>Du eier ${esc(trip.name)}</h3>${venter("Henter reiselederne")}
      <button class="btn close" data-close>Avbryt</button>`);
    Api.tripMembers(trip.id).then(folk => {
      const ledere = folk.filter(p => p.role === "leader" && !p.me && !p.venter && !p.skjult);
      const andre = folk.filter(p => p.role !== "leader" && !p.me && !p.venter && !p.skjult);
      const rad = (p, tekst, data) => `<div class="person"><span>${esc(p.name)}</span>
        <button class="linkbtn" ${data}="${esc(p.id)}">${tekst}</button></div>`;
      openSheet(ledere.length
        ? `<h3>Hvem tar over ${esc(trip.name)}?</h3>
           <p class="lede">Du eier turen. Før du går, må en annen reiseleder bli eier. Hen kan da
             styre turen, gi lederrollen videre og slette den.</p>
           <div class="memberlist">${ledere.map(p => rad(p, "gi turen hit", "data-gibort")).join("")}</div>
           <p class="err" id="maErr" hidden></p>
           <button class="btn close" data-close>Avbryt</button>`
        : `<h3>Du er den eneste reiselederen</h3>
           <p class="lede">Turen må ha en reiseleder. Gjør en deltaker til reiseleder og gi turen
             til hen, eller slett hele turen.</p>
           ${andre.length ? `<div class="memberlist">${andre.map(p =>
             rad(p, "gjør til leder og gi turen", "data-gibortny")).join("")}</div>`
             : `<p class="muted">Ingen andre er med på turen ennå.</p>`}
           <p class="err" id="maErr" hidden></p>
           <button class="btn danger" style="width:100%;margin-top:12px" id="maSlett">Slett hele turen</button>
           <button class="btn close" data-close>Avbryt</button>`);

      const slett = $("maSlett");
      if (slett) slett.addEventListener("click", () => sheetSlettTur());
      for (const b of $("sheet").querySelectorAll("[data-gibort], [data-gibortny]")) {
        b.addEventListener("click", async () => {
          const id = b.dataset.gibort || b.dataset.gibortny;
          const p = folk.find(x => x.id === id);
          b.disabled = true; b.textContent = "Gir bort…";
          try {
            if (b.dataset.gibortny) await Api.setMemberRole(trip.id, id, "leader");
            await Api.giBortEierskap(trip.id, id);
            closeSheet();
            await meldAv(trip.id);
            toast(`${p ? p.name : "Den nye eieren"} eier turen nå. Du er meldt av.`);
          } catch (err) {
            b.disabled = false; b.textContent = "prøv igjen";
            const e2 = $("maErr"); if (e2) { e2.textContent = err.message; e2.hidden = false; }
          }
        });
      }
    }).catch(() => openSheet(`<h3>Klarte ikke hente deltakerne</h3>
      <p class="lede">Sjekk nettet og prøv igjen.</p><button class="btn close" data-close>Lukk</button>`));
  }

  /* Sletting av turen viser hva som forsvinner, og krever turens navn.
     Før var det et nettleservindu som ba om turkoden. */
  function sheetSlettTur() {
    const trip = S.trip;
    const rent = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
    openSheet(`<h3>Slette ${esc(trip.name)}?</h3>
      <p class="lede" id="stHva">Programmet med ${trip.days.length} ${trip.days.length === 1 ? "dag" : "dager"},
        ${trip.channels.length} ${trip.channels.length === 1 ? "chat" : "chatter"} med alle meldingene,
        rom, seter og pakkeliste forsvinner for alle. Det kan ikke angres.</p>
      <div class="field"><label for="stNavn">Skriv navnet på turen for å bekrefte</label>
        <input id="stNavn" autocomplete="off" placeholder="${esc(trip.name)}"></div>
      <p class="err" id="stErr" hidden></p>
      <button class="btn danger big" id="stJa" disabled>Slett turen for alle</button>
      <button class="btn close" data-close>Avbryt</button>`);

    Api.tripMembers(trip.id).then(folk => {
      const n = folk.filter(p => !p.me && !p.skjult).length;
      const hva = $("stHva");
      if (hva && n) hva.insertAdjacentHTML("afterbegin", `<b>${n} ${n === 1 ? "deltaker" : "deltakere"}</b> mister turen. `);
    }).catch(() => {});

    $("stNavn").addEventListener("input", e => { $("stJa").disabled = rent(e.target.value) !== rent(trip.name); });
    $("stJa").addEventListener("click", async e => {
      const b = e.currentTarget;
      b.disabled = true; b.innerHTML = prikker() + " Sletter";
      try {
        await Api.deleteTrip(trip.id);
        closeSheet();
        S.trips = await Api.myTrips().catch(() => []);
        if (S.trips.length) { S.tab = "program"; await openTrip(S.trips[0].id); }
        else { Api.setLastTrip(null); showJoin(); }
        toast("Turen er slettet.");
      } catch (err) {
        b.disabled = false; b.textContent = "Slett turen for alle";
        $("stErr").textContent = "Klarte ikke slette turen. " + (err.message || ""); $("stErr").hidden = false;
      }
    });
  }

  /* ───────── fase 6 ───────── */

  /* L6: hvilket kjøretøy oppropet gjelder. Har turen ingen kjøretøy,
     starter det rett for hele turen. */
  async function sheetNyttOpprop() {
    let kart = null;
    try { kart = await Api.setekart(S.trip.id); } catch { /* uten kjøretøy */ }
    const kj = (kart && kart.kjoretoy) || [];
    if (!kj.length) {
      try { await Api.nyttOpprop(S.trip.id, ""); await aapneOpprop(true); } catch (e) { toast(e.message); }
      return;
    }
    openSheet(`<h3>Hvem skal telles?</h3>
      <p class="lede">Velg et kjøretøy, så teller du bare dem som sitter der. De uten plass står for seg.</p>
      <div class="gruppe"><div class="list">
        <button class="listrow" data-startopprop=""><div class="grow"><div class="nm">Hele turen</div></div>
          <span class="chev">${ICON.chev}</span></button>
        ${kj.map(k => `<button class="listrow" data-startopprop="${esc(k.id)}">
          <div class="grow"><div class="nm">${esc(k.navn)}</div>
            <div class="sub">${k.seter.length} sitter her${k.dato ? " · " + esc(cap(Api.fmtDay(k.dato).label)) : ""}</div></div>
          <span class="chev">${ICON.chev}</span></button>`).join("")}
      </div></div>
      <button class="btn close" data-close>Avbryt</button>`);
  }

  /* L7: hvem sitter hvor, sortert på plass eller navn. For sjåføren eller
     billettkontrollen. */
  function sheetSeteliste(kjId, etter) {
    const k = ((S.setekart || {}).kjoretoy || []).find(x => x.id === kjId);
    if (!k) return;
    const rader = k.seter.map(s2 => ({ plass: plassnavn(k, s2.nr), nr: s2.nr, navn: s2.hvem || "" }))
      .sort((a, b) => etter === "navn" ? a.navn.localeCompare(b.navn, "nb") : a.nr - b.nr);
    // Sortering etter navn er for å finne én person i en full buss. I en
    // bil med tre stykker er den bare et valg til å forstå.
    const sortering = k.seter.length > 8 ? `<div class="segment" role="tablist" aria-label="Sorter">
        <button role="tab" aria-selected="${etter !== "navn"}" data-seteliste="${esc(k.id)}" data-etter="plass">Etter plass</button>
        <button role="tab" aria-selected="${etter === "navn"}" data-seteliste="${esc(k.id)}" data-etter="navn">Etter navn</button>
      </div>` : "";
    openSheet(`<h3>Hvem sitter hvor i ${esc(k.navn)}</h3>
      <p class="lede">${k.seter.length} av ${k.plasser} plasser er tatt.</p>
      ${sortering}
      <div class="memberlist">${rader.map(r => `<div class="person"><span><b class="mono">${esc(r.plass)}</b></span>
        <span>${esc(r.navn)}</span></div>`).join("") || '<p class="muted" style="padding:10px">Ingen har plass ennå.</p>'}</div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* L3: alt om turkoden på én side: koden selv, QR-koden og lenken.
     Lenken fyller inn koden når den åpnes. QR-koden lages på telefonen
     (vendor/qrcode.js, MIT). Før lå dette spredt på tre rader i Turen. */
  const DELE_URL = "https://tripmateub.github.io/tripmate/";
  const turlenke = () => `${DELE_URL}?kode=${encodeURIComponent(S.trip.code)}`;
  function aapneTurkode(fraHistorikk) {
    S.side = "turkode";
    if (!fraHistorikk) history.pushState({ side: "turkode" }, "");
    render();
  }
  function viewTurkode() {
    const leder = S.trip.role === "leader";
    let svg = "";
    try {
      const q = qrcode(0, "M"); q.addData(turlenke()); q.make();
      svg = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch { /* uten QR viser vi bare koden og lenken */ }
    return `
      <div class="kodeside">
        <button class="storkode mono" data-copy="${esc(S.trip.code)}" aria-label="Kopier turkoden ${esc(S.trip.code)}">${esc(S.trip.code)}</button>
        <p class="muted kodehint">Trykk på koden for å kopiere den.</p>
        ${svg ? `<div class="qrkode" aria-label="QR-kode for å bli med på turen">${svg}</div>
          <p class="muted kodehint">Skann med kameraet for å bli med.</p>` : ""}
      </div>
      <div class="gruppe"><div class="list">
        <button class="listrow" data-turkode="del">
          <span class="rikon">${ICON.nav}</span>
          <div class="grow"><div class="nm">Send lenken</div></div></button>
        <button class="listrow" data-turkode="lenke">
          <span class="rikon grunn">${ICON.kopi}</span>
          <div class="grow"><div class="nm">Kopier lenken</div></div></button>
      </div></div>
      ${leder ? `<div>
        <div class="gruppe"><div class="list">
          <button class="listrow" data-sheet="byttkode">
            <span class="rikon gul">${ICON.spark}</span>
            <div class="grow"><div class="nm">Lag ny turkode</div></div>
            <span class="chev">${ICON.chev}</span></button>
        </div></div>
        <p class="muted" style="font-size:13.5px;margin:8px 4px 0">Kom koden ut til flere enn den skulle? En ny kode stenger den gamle. De som er med, merker ingenting.</p>
      </div>` : ""}`;
  }
  async function delTurlenke() {
    const lenke = turlenke();
    const tekst = `Bli med på ${S.trip.name} i TripMate. Turkoden er ${S.trip.code}: ${lenke}`;
    const Share = nativPlugin("Share");
    try {
      if (erNativ() && Share) await Share.share({ text: tekst, url: lenke });
      else if (navigator.share) await navigator.share({ text: tekst, url: lenke });
      else { await navigator.clipboard.writeText(lenke); toast("Lenken er kopiert."); }
    } catch { /* avbrutt */ }
  }

  /* L8: dokumenter. Egen side, som pakkelista. */
  async function aapneDokumenter(fraHistorikk) {
    S.side = "dokumenter"; S.dok = null; S.dokFeil = false;
    if (!fraHistorikk) history.pushState({ side: "dokumenter" }, "");
    render();
    try { S.dok = await Api.dokumenter(S.trip.id); } catch { S.dok = []; S.dokFeil = true; }
    if (S.side === "dokumenter") render();
  }
  /* ───────── tilgangskoder (bare for TripMate) ─────────
     En kode gir én kunde rett til å lage turer: et antall turer (eller
     ubegrenset), et tak på personer per tur, og eventuelt en sluttdato. */
  async function aapneTilgang(fraHistorikk) {
    S.side = "tilgang"; S.tilgangListe = null; S.tilgangFeil = false;
    if (!fraHistorikk) history.pushState({ side: "tilgang" }, "");
    render();
    try { S.tilgangListe = await Api.tilgangListe(); } catch { S.tilgangListe = []; S.tilgangFeil = true; }
    if (S.side === "tilgang") render();
  }

  function viewTilgang() {
    if (S.tilgangFeil) return '<p class="muted">Klarte ikke hente kodene.</p>';
    if (!S.tilgangListe) return venter("Henter kodene");
    // Én rad per kode, som i Innstillinger. Trykk på raden for å kopiere
    // eller stenge; selve koden står under kundens navn.
    const rad = x => `<button class="listrow bar${!x.aktiv || tilgangUtlopt(x) ? " av" : ""}" data-tilgangvalg="${esc(x.id)}">
        <div class="grow"><div class="nm">${esc(x.kunde)}</div>
          <div class="sub"><span class="mono" style="letter-spacing:.04em">${esc(x.kode)}</span> · ${esc(tilgangOmfang(x))}</div></div>
        <span class="verdi">${esc(tilgangStatus(x))}</span>
        <span class="chev">${ICON.chev}</span></button>`;
    return `
      <button class="btn primary big" data-sheet="nytilgang">Ny tilgangskode</button>
      ${S.tilgangListe.length ? `<div class="gruppe"><div class="list">${S.tilgangListe.map(rad).join("")}</div></div>`
        : '<p class="muted" style="margin:0">Ingen koder ennå.</p>'}`;
  }
  const tilgangUtlopt = x => Boolean(x.gyldigTil && x.gyldigTil < today());
  const tilgangStatus = x => !x.aktiv ? "Stengt" : tilgangUtlopt(x) ? "Utløpt" : x.brukt ? (x.bruktNavn || "I bruk") : "Ikke brukt";
  function tilgangOmfang(x) {
    const turer = x.maksTurer === null ? `${x.turer} ${x.turer === 1 ? "tur" : "turer"}, ubegrenset`
      : `${x.turer} av ${x.maksTurer} ${x.maksTurer === 1 ? "tur" : "turer"}`;
    const folk = x.maksDeltakere === null ? "alle størrelser" : `opptil ${x.maksDeltakere} personer`;
    const dato = x.gyldigTil ? ` · til ${new Date(x.gyldigTil + "T12:00").toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}` : "";
    return `${turer} · ${folk}${dato}`;
  }
  function sheetTilgangvalg(id) {
    const x = (S.tilgangListe || []).find(k => k.id === id);
    if (!x) return;
    openSheet(`<h3>${esc(x.kunde)}</h3>
      <p class="lede"><b class="mono" style="letter-spacing:.06em">${esc(x.kode)}</b><br>${esc(tilgangOmfang(x))} · ${esc(tilgangStatus(x))}</p>
      <div class="gruppe"><div class="list">
        <button class="listrow bar" data-copy="${esc(x.kode)}"><div class="grow"><div class="nm">Kopier koden</div></div></button>
        <button class="listrow bar" data-tilgangaktiv="${esc(x.id)}" data-aapne="${x.aktiv ? "0" : "1"}"><div class="grow"><div class="nm"${x.aktiv ? ' style="color:var(--danger)"' : ""}>${x.aktiv ? "Steng koden" : "Åpne koden igjen"}</div></div></button>
      </div></div>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* Ny kode: to tall. 0 betyr ubegrenset, for begge. */
  function sheetNyTilgang() {
    openSheet(`<h3>Ny tilgangskode</h3>
      <form id="ntForm" novalidate>
        <div class="field"><label for="ntKunde">Kunde</label>
          <input id="ntKunde" maxlength="80" placeholder="Sandnes IL" autocomplete="off"></div>
        <div class="field"><label for="ntAntall">Antall turer</label>
          <input id="ntAntall" type="number" min="0" max="1000" value="1"></div>
        <div class="field"><label for="ntPers">Maks personer per tur</label>
          <input id="ntPers" type="number" min="0" max="2000" value="50"></div>
        <p class="muted" style="font-size:13.5px;margin:-4px 0 14px">Skriv 0 for ubegrenset.</p>
        <div class="field"><label for="ntTil">Gjelder til (valgfritt)</label>
          <input id="ntTil" type="date"></div>
        <p class="err" id="ntErr" hidden></p>
        <button class="btn primary big" type="submit" id="ntLag">Lag koden</button>
      </form>
      <button class="btn close" data-close>Avbryt</button>`);
    $("ntForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("ntErr"), btn = $("ntLag");
      const vis = t => { err.textContent = t; err.hidden = false; };
      const kunde = $("ntKunde").value.trim();
      const tall = id => { const v = $(id).value.trim(); return v === "" ? NaN : Number(v); };
      const turer = tall("ntAntall"), pers = tall("ntPers");
      if (!kunde) return vis("Skriv hvem koden er til.");
      if (!(Number.isInteger(turer) && turer >= 0 && turer <= 1000)) return vis("Antall turer må være et tall fra 0 til 1000.");
      if (!(Number.isInteger(pers) && (pers === 0 || (pers >= 2 && pers <= 2000)))) return vis("Personer per tur må være 0, eller fra 2 til 2000.");
      const maksTurer = turer === 0 ? null : turer;
      const maksDeltakere = pers === 0 ? null : pers;
      btn.disabled = true; btn.innerHTML = prikker() + " Lager koden";
      try {
        const rad = await Api.lagTilgang({ kunde, maksTurer, maksDeltakere, gyldigTil: $("ntTil").value || null });
        closeSheet();
        await aapneTilgang(true);
        sheetTilgangvalg(rad.id);
      } catch (e2) { btn.disabled = false; btn.textContent = "Lag koden"; vis(e2.message); }
    });
  }

  const storrelse = b => b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " kB";
  function viewDokumenter() {
    if (S.dokFeil) return '<p class="muted">Klarte ikke hente dokumentene. Sjekk nettet og prøv igjen.</p>';
    if (!S.dok) return venter("Henter dokumentene");
    const leder = S.trip.role === "leader";
    const felles = S.dok.filter(d => d.felles), mine = S.dok.filter(d => !d.felles);
    const rad = d => `<div class="person">
      <button class="linkbtn dokrad" data-aapnedok="${esc(d.sti)}"><b>${esc(d.navn)}</b><br>
        <small>${esc(storrelse(d.storrelse))} · ${esc(shortStamp(d.created_at))}</small></button>
      ${d.min || (d.felles && leder) ? `<button class="linkbtn fare" data-slettdok="${esc(d.id)}" data-sti="${esc(d.sti)}" data-navn="${esc(d.navn)}">slett</button>` : ""}
    </div>`;
    const opp = (felles2, tekst) => `<label class="btn filknapp" style="margin-top:10px">${tekst}
      <input type="file" class="skjultfil" accept="application/pdf,image/*" data-lastopp="${felles2 ? "felles" : "egen"}"></label>`;
    return `
      <div>
        <div class="eyebrow" style="margin-bottom:8px">Fra reiselederen</div>
        ${felles.length ? `<div class="memberlist">${felles.map(rad).join("")}</div>`
          : `<p class="muted" style="margin:0">${leder ? "Heftet, forsikringen eller annet alle trenger." : "Ingen dokumenter ennå."}</p>`}
        ${leder ? opp(true, "Last opp for alle") : ""}
      </div>
      <div>
        <div class="eyebrow" style="margin-bottom:8px">Mine dokumenter</div>
        <p class="muted" style="margin:0 0 8px">Bare du ser disse.</p>
        ${mine.length ? `<div class="memberlist">${mine.map(rad).join("")}</div>` : ""}
        ${opp(false, "Last opp mitt eget")}
      </div>
      <p class="muted" style="font-size:13.5px">PDF eller bilde, maks 10 MB.</p>`;
  }

  /* L9: programmet som kalenderfil. Hvert punkt med klokkeslett blir en
     hendelse med adresse, så iPhone selv kan varsle «Tid for å dra». */
  function lagKalender() {
    const t = S.trip;
    const rens = x => String(x || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
    // Maks 75 byte per linje, slik standarden vil. Æ, ø og å er to byte
    // hver, så det telles i byte og ikke i tegn.
    const kod = new TextEncoder();
    const brett = linje => {
      const ut = []; let del = "", byte = 0;
      for (const tegn of linje) {
        const b = kod.encode(tegn).length;
        if (byte + b > 73) { ut.push(del); del = " "; byte = 1; }
        del += tegn; byte += b;
      }
      ut.push(del); return ut.join("\r\n");
    };
    const tid = (dato, kl) => dato.replace(/-/g, "") + "T" + kl.replace(":", "") + "00";
    const pluss = (kl, min) => { const m = minutt(kl) + min; return String(Math.min(23, Math.floor(m / 60))).padStart(2, "0") + ":" + String(m >= 1440 ? 59 : m % 60).padStart(2, "0"); };
    const stempel = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const linjer = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripMate//NO", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${rens(t.name)}`];
    for (const d of t.days) for (const i of d.items) {
      if (!i.t) continue;
      const p = i.place ? t.places[i.place] : null;
      linjer.push("BEGIN:VEVENT", `UID:${i.id}@tripmate`, `DTSTAMP:${stempel}`,
        `DTSTART:${tid(d.date, i.t)}`, `DTEND:${tid(d.date, slutt(i) || pluss(i.t, 30))}`,
        `SUMMARY:${rens(i.title)}`);
      if (p) linjer.push(`LOCATION:${rens([p.name, p.addr].filter(Boolean).join(", "))}`);
      if (i.note) linjer.push(`DESCRIPTION:${rens(i.note)}`);
      linjer.push("END:VEVENT");
    }
    linjer.push("END:VCALENDAR");
    return linjer.map(brett).join("\r\n") + "\r\n";
  }
  /* I iOS-appen går programmet rett inn i Kalender, og Kalender åpnes på
     første dag. Trykker du igjen etter en endring, oppdateres de samme
     hendelsene i stedet for å legges inn på nytt (KalenderPlugin.swift). */
  async function leggIKalenderNativt() {
    const plugin = nativPlugin("Kalender");
    if (!plugin) return false;
    const t = S.trip;
    const hendelser = [];
    for (const d of t.days) for (const i of d.items) {
      if (!i.t) continue;
      const p = i.place ? t.places[i.place] : null;
      const s = slutt(i);
      hendelser.push({
        id: String(i.id), tittel: i.title,
        start: d.date + "T" + i.t,
        slutt: s && minutt(s) > minutt(i.t) ? d.date + "T" + s : null,
        sted: p ? [p.name, p.addr].filter(Boolean).join(", ") : null,
        notat: i.note || null
      });
    }
    if (!hendelser.length) { toast("Programmet har ingen punkter med klokkeslett ennå."); return true; }
    try {
      const r = await plugin.leggInn({ tur: String(t.id), hendelser });
      const deler = [];
      if (r.lagtTil) deler.push(r.lagtTil === 1 ? "1 punkt lagt inn" : r.lagtTil + " punkter lagt inn");
      if (r.endret) deler.push(r.endret + " oppdatert");
      if (r.fjernet) deler.push(r.fjernet + " fjernet");
      toast(deler.length ? deler.join(", ") + "." : "Kalenderen er allerede oppdatert.");
    } catch (e) {
      if (e && e.code === "NEKTET") {
        melding("TripMate har ikke lov til å bruke kalenderen.\n\nSlå det på i Innstillinger → Apper → TripMate → Kalendere.");
      } else {
        toast("Klarte ikke legge programmet i kalenderen.");
      }
    }
    return true;
  }

  async function delKalender() {
    if (erNativ() && await leggIKalenderNativt()) return;
    const ics = lagKalender();
    if (!/BEGIN:VEVENT/.test(ics)) return toast("Programmet har ingen punkter med klokkeslett ennå.");
    const navn = (S.trip.name.replace(/[^\p{L}\p{N} -]/gu, "").trim() || "tur") + ".ics";
    const fil = new File([ics], navn, { type: "text/calendar" });
    if (erNativ() && await delNativt(fil)) return;
    if (navigator.canShare && navigator.canShare({ files: [fil] })) {
      try { await navigator.share({ files: [fil] }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(fil); a.download = navn;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
    toast("Kalenderfila er lastet ned. Åpne den for å legge programmet i kalenderen.");
  }

  /* L12: søk i chattene. Treffet åpner chatten og blar til meldingen. */
  let sokTimer = null;
  async function sok(tekst) {
    const boks = $("sokTreff");
    if (!boks) return;
    if (String(tekst).trim().length < 2) { boks.innerHTML = ""; $("chatlistBoks").hidden = false; return; }
    $("chatlistBoks").hidden = true;
    boks.innerHTML = venter("Søker");
    try {
      const treff = await Api.sokMeldinger(S.trip.id, tekst);
      const navn = id => (S.trip.channels.find(c => c.id === id) || {}).name || "Chat";
      boks.innerHTML = treff.length ? `<div class="memberlist">${treff.map(m => `<button class="person sokrad" data-soktreff="${esc(m.id)}" data-kanal="${esc(m.channel_id)}">
          <span><b>${esc(m.author_name)}</b> <em>${esc(navn(m.channel_id))} · ${esc(shortStamp(m.created_at))}</em><br>
          <small>${esc(String(m.txt || "").slice(0, 140))}</small></span></button>`).join("")}</div>`
        : `<p class="muted" style="padding:10px 0">Ingen meldinger med «${esc(tekst.trim())}».</p>`;
    } catch { boks.innerHTML = `<p class="muted">Klarte ikke søke. Sjekk nettet.</p>`; }
  }
  async function hoppTilTreff(kanal, id) {
    S.tab = "chat";
    await openChat(kanal);
    for (let n = 0; n < 6 && !document.getElementById("msg-" + id); n++) {
      if (!Api.harEldre(kanal)) break;
      await Api.loadMoreMessages(kanal).catch(() => {});
      render();
    }
    hoppTil(id);
  }

  /* ───────── omvisning ─────────
     En tur settes opp én gang, av en som aldri har gjort det før, og
     ofte kvelden før avreise. Den første omvisningen var fire sider
     tekst som fortalte hvor ting lå — og da måtte man lete likevel,
     bare med en beskrivelse i hodet i stedet for uten.

     Denne går veien selv. Hvert steg bytter til riktig fane, ruller
     fram det den snakker om, legger en ring rundt det, og dimmer
     resten. Du ser hvor det er mens du får vite hva det er, og neste
     gang du skal dit, husker fingeren veien.

     Målet er en velger mot den ekte appen. Finner den ingenting — en
     tur uten program har ingen dagsvelger — hopper steget over seg
     selv i stedet for å peke på ingenting. */
  /* To slags steg. «vis» peker på noe og forklarer det, og du går videre
     med Neste. «trykk» ber deg trykke på det selv: en fane, en rad, eller
     fanen igjen for å komme tilbake. Da lærer fingeren veien, ikke bare
     øynene. Steget er ferdig når appen står der trykket skulle føre deg.

     Hvert «vis»-steg har en fane; står du et annet sted, bytter
     omvisningen dit selv (bare når du går bakover eller starter fra Meg).
     Et «trykk»-steg flytter deg aldri: det er du som trykker. */
  const FANE = id => `#tabbar [data-tab="${id}"]`;
  const PRAKTISK_RADER = ['[data-side="pakk"]', '[data-side="seter"]', '[data-side="kontakt"]',
                          '[data-side="rom"]', '[data-side="dokumenter"]', '[data-side="opprop"]'];
  const OMVISNING = {
    leader: [
      { vis: ".naakort", tab: "program",
        h: "Her står det som skjer nå",
        t: "Punktet som pågår eller er neste, med adresse og en knapp rett til kartet." },
      { vis: ".chips", tab: "program",
        h: "Bla mellom dagene her",
        t: "Trykk på en dag, så bytter programmet under." },
      { vis: '[data-sheet="additem"]', tab: "program",
        h: "Slik legger du inn et punkt",
        t: "Tid, tittel og sted. Har du heftet som PDF, leses hele programmet inn på en gang." },
      { trykk: FANE("chat"), ferdig: () => S.tab === "chat" && !S.openChat,
        h: "Trykk på Chat",
        t: "Fanene nederst tar deg mellom de fire delene av appen." },
      { vis: ".chatrow", tab: "chat",
        h: "Hver chat har sin rad",
        t: "Trykk på en for å skrive. Med Ny chat nederst lager du en chat for en del av gruppa." },
      { trykk: FANE("turen"), ferdig: () => S.tab === "turen" && !S.side,
        h: "Trykk på Turen",
        t: "Alt det praktiske for turen ligger her." },
      { vis: ".ordnes", tab: "turen",
        h: "Appen sier hva som mangler",
        t: "Et sted uten adresse, en dag uten hotell. Er det unødvendig, trykker du det bort." },
      { trykk: PRAKTISK_RADER, side: true,
        h: el => `Trykk på ${radnavn(el)}`,
        t: "Radene her åpner en egen side." },
      { trykk: FANE("turen"), tilbake: true, ferdig: () => S.tab === "turen" && !S.side,
        h: "Trykk på Turen for å gå tilbake",
        t: "Fanen tar deg alltid tilbake til starten. Du kan også dra fra venstre kant av skjermen." },
      { vis: '[data-side="turkode"]', tab: "turen",
        h: "Turkoden slipper folk inn",
        t: "Her kopierer du koden, viser QR-koden eller sender lenken til gruppa." },
      { trykk: FANE("meg"), ferdig: () => S.tab === "meg" && !S.side,
        h: "Trykk på Meg",
        t: "Navnet ditt, turene dine og innstillingene." },
      { vis: '[data-sheet="omvisning"]', tab: "meg",
        h: "Omvisningen ligger her",
        t: "Vil du se den igjen, starter du den herfra." }
    ],
    member: [
      { vis: ".naakort", tab: "program",
        h: "Her står det som skjer nå",
        t: "Punktet som pågår eller er neste, med adresse og en knapp rett til kartet." },
      { vis: ".chips", tab: "program",
        h: "Bla mellom dagene her",
        t: "Trykk på en dag for å se programmet for den." },
      { vis: ".tl .ev", tab: "program",
        h: "Trykk på et punkt for detaljene",
        t: "Adresse, kart og vær. Har punktet påmelding, melder du deg på derfra." },
      { trykk: FANE("chat"), ferdig: () => S.tab === "chat" && !S.openChat,
        h: "Trykk på Chat",
        t: "Fanene nederst tar deg mellom de fire delene av appen." },
      { vis: ".chatrow", tab: "chat",
        h: "Hver chat har sin rad",
        t: "Trykk på en for å lese og skrive." },
      { trykk: FANE("turen"), ferdig: () => S.tab === "turen" && !S.side,
        h: "Trykk på Turen",
        t: "Alt det praktiske for turen ligger her." },
      { trykk: PRAKTISK_RADER, side: true,
        h: el => `Trykk på ${radnavn(el)}`,
        t: "Radene her åpner en egen side." },
      { trykk: FANE("turen"), tilbake: true, ferdig: () => S.tab === "turen" && !S.side,
        h: "Trykk på Turen for å gå tilbake",
        t: "Fanen tar deg alltid tilbake til starten. Du kan også dra fra venstre kant av skjermen." },
      { trykk: FANE("meg"), ferdig: () => S.tab === "meg" && !S.side,
        h: "Trykk på Meg",
        t: "Navnet ditt, turene dine og innstillingene." },
      { vis: '[data-sheet="varsler"]', tab: "meg",
        h: "Slå på varsler her",
        t: "Uten varsler er telefonen stille når reiselederen skriver noe viktig." }
    ]
  };
  const radnavn = el => {
    const nm = el && el.querySelector(".nm");
    return nm ? nm.textContent.trim() : "raden";
  };

  const omvisningNokkel = rolle => "tk.omvisning." + rolle;

  function omvisningSett(rolle) {
    try { return Boolean(localStorage.getItem(omvisningNokkel(rolle))); }
    catch { return true; }          // uten lager viser vi den ikke om og om igjen
  }

  const omvisRolle = () => (S.trip && S.trip.role === "leader" ? "leader" : "member");
  const omvisSteg = () => (S.omvis ? S.omvis.steg[S.omvis.i] : null);

  /* Hvilke steg denne turen har. En tur uten program har ingen
     dagsvelger, og en tur uten Praktisk har ingen rad å trykke på. Det
     finner vi ut før vi begynner, ved å tegne fanene uten å vise dem —
     så telleren sier «1 av 9» og ikke hopper fra 2 til 4. */
  function omvisStegFor(rolle) {
    const tegnet = {};
    const finn = (tab, sel) => {
      if (!tegnet[tab]) {
        const d = document.createElement("div");
        try { d.innerHTML = visningFor(tab); } catch { /* tom fane */ }
        tegnet[tab] = d;
      }
      return (Array.isArray(sel) ? sel : [sel]).some(x => tegnet[tab].querySelector(x));
    };
    const ut = [];
    let forrigeSide = false;
    for (const st of OMVISNING[rolle]) {
      if (st.vis && !finn(st.tab, st.vis)) continue;
      if (st.side) { forrigeSide = finn("turen", st.trykk); if (!forrigeSide) continue; }
      if (st.tilbake && !forrigeSide) continue;
      ut.push(st);
    }
    return ut;
  }

  function startOmvisning() {
    const rolle = omvisRolle();
    try { localStorage.setItem(omvisningNokkel(rolle), "1"); } catch { /* uviktig */ }
    closeSheet();
    const steg = omvisStegFor(rolle);
    if (!steg.length) return;
    S.omvis = { rolle, i: 0, steg };
    gaaTilOmvisSteg(0, true);
  }

  function avsluttOmvisning() {
    S.omvis = null;
    $("omvis").hidden = true;
    $("omvis").classList.remove("slipp");
    render();
  }

  /* Et «vis»-steg bytter til sin fane når du går bakover eller starter
     et annet sted. Går du framover, står du alt der: forrige steg ba
     deg trykke deg dit. */
  function gaaTilOmvisSteg(i, flytt) {
    const liste = S.omvis.steg;
    if (i < 0 || i >= liste.length) return avsluttOmvisning();
    S.omvis.i = i;
    const steg = liste[i];
    if (steg.vis && (flytt || S.tab !== steg.tab) && (S.tab !== steg.tab || S.side || S.openChat)) {
      S.side = null;
      S.openChat = null;
      S.tab = steg.tab;
    }
    render();
  }

  // Elementet steget peker på. Et «trykk»-steg kan ha flere kandidater
  // (den første raden under Praktisk som finnes).
  function omvisMaal(steg) {
    const sel = steg.vis || steg.trykk;
    for (const x of (Array.isArray(sel) ? sel : [sel])) {
      const el = $("screen").querySelector(x) || document.querySelector(x);
      if (el) return el;
    }
    return null;
  }

  /* Tegner ringen og kortet etter at skjermen er ferdig. Måler den ekte
     knappen, så markeringen sitter der knappen faktisk er. */
  function tegnOmvisning() {
    const lag = $("omvis");
    const steg = omvisSteg();
    if (!steg) { lag.hidden = true; lag.classList.remove("slipp"); return; }

    // Har du alt gjort det steget ber om, går vi videre av oss selv.
    if (steg.trykk && (steg.side ? (S.side && S.side !== "turkode") : steg.ferdig())) {
      return setTimeout(() => { if (omvisSteg() === steg) gaaTilOmvisSteg(S.omvis.i + 1); }, steg.side ? 450 : 250);
    }
    const maal = omvisMaal(steg);
    // Finnes ikke målet likevel (noe endret seg underveis), hopper vi over.
    if (!maal) return gaaTilOmvisSteg(S.omvis.i + 1);

    const liste = S.omvis.steg;
    const siste = S.omvis.i === liste.length - 1;
    const forrige = liste[S.omvis.i - 1];
    // Tilbake gir bare mening mellom to «vis»-steg på samme fane.
    const kanTilbake = steg.vis && forrige && forrige.vis && forrige.tab === steg.tab;
    lag.hidden = false;
    lag.classList.toggle("slipp", Boolean(steg.trykk));

    const h = typeof steg.h === "function" ? steg.h(maal) : steg.h;
    $("omvisKort").innerHTML = `
      <p class="omvis-teller">Omvisning · ${S.omvis.i + 1} av ${liste.length}</p>
      <h3>${esc(h)}</h3>
      <p>${esc(steg.t)}</p>
      ${steg.trykk ? "" : `<div class="omvis-knapper">
        ${kanTilbake ? `<button class="btn" data-omvis="forrige">Tilbake</button>` : ""}
        <button class="btn primary" data-omvis="neste">${siste ? "Ferdig" : "Neste"}</button>
      </div>`}
      ${siste ? "" : `<button class="linkbtn omvis-hopp" data-omvis="slutt">Avslutt omvisningen</button>`}`;

    plasserOmvisning(maal);
  }

  /* Under et «trykk»-steg slipper laget trykk gjennom, men bare til det
     ringen peker på og til kortet. Alt annet stoppes her, før appen ser
     det — ellers kunne et bomtrykk sende deg et helt annet sted. */
  for (const type of ["pointerdown", "touchstart", "click"]) {
    document.addEventListener(type, e => {
      const steg = omvisSteg();
      if (!steg || !steg.trykk) return;
      const maal = omvisMaal(steg);
      if (e.target.closest && (e.target.closest("#omvisKort") || (maal && maal.contains(e.target)))) return;
      e.stopPropagation();
      if (type === "click") e.preventDefault();
    }, { capture: true, passive: type !== "click" });
  }

  /* Ringen legges rundt målet, og kortet på den siden det er plass.
     Er målet utenfor skjermen, rulles det fram først — og da må vi måle
     en gang til, for det har nettopp flyttet seg. */
  function plasserOmvisning(maal, andreForsok) {
    const ring = $("omvisRing"), kort = $("omvisKort"), app = $("appScreen");
    ring.classList.remove("tom");
    kort.classList.remove("midt");

    /* Ligger målet i skjermen, men utenfor det synlige feltet, rulles det
       fram først. Fanelinja flyter over bunnen av skjermen, så det som
       ligger bak den, regnes som utenfor. Bare ett forsøk: ruller vi i
       ring, står omvisningen fast. */
    const sk = $("screen");
    if (!andreForsok && sk.contains(maal)) {
      const s = sk.getBoundingClientRect();
      const bar = $("tabbar");
      const bunn = bar && !bar.hidden ? Math.min(s.bottom, bar.getBoundingClientRect().top) : s.bottom;
      const f = maal.getBoundingClientRect();
      if (f.top < s.top + 8 || f.bottom > bunn - 12) {
        const midt = (bunn - s.top) / 2;
        // «instant»: skjermen kan ha myk rulling, og da ville målingen
        // under skjedd før rullingen var ferdig.
        sk.scrollTo({ top: sk.scrollTop + (f.top + f.height / 2) - (s.top + midt), behavior: "instant" });
        return plasserOmvisning(maal, true);
      }
    }

    const r = maal.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    const luft = 6;
    ring.style.left = (r.left - a.left - luft) + "px";
    ring.style.top = (r.top - a.top - luft) + "px";
    ring.style.width = (r.width + luft * 2) + "px";
    ring.style.height = (r.height + luft * 2) + "px";

    /* Kortet legger seg på den siden av ringen der det får plass. Får
       det plass på begge, velger vi under. Får det plass på ingen av dem,
       legger det seg der det er mest rom. */
    const h = kort.getBoundingClientRect().height || 240;
    const marg = 14, kant = 10;
    const over = (r.top - a.top) - marg - kant;
    const under = (a.bottom - r.bottom) - marg - kant;

    if (under >= h || under >= over) {
      kort.style.top = Math.min(r.bottom - a.top + marg, a.height - h - kant) + "px";
      kort.style.bottom = "auto";
    } else {
      kort.style.bottom = Math.min(a.bottom - r.top + marg, a.height - h - kant) + "px";
      kort.style.top = "auto";
    }
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
    const k = id && ((S.setekart || {}).kjoretoy || []).find(x => x.id === id);
    // En type vi ikke kjenner lenger — fly eller båt fra før de ble tatt
    // ut — står som «Annet» i velgeren, og blir det hvis man lagrer.
    const typ = k ? (TYPER[k.typ] ? k.typ : "annet") : "buss";
    const typer = Object.entries(TYPER);
    const dager = S.trip.days;
    // Vanlig antall plasser for hver type. Fylles inn når du bytter type,
    // så lenge du ikke har skrevet et tall selv.
    const VANLIG = { buss: 56, minibuss: 16, bil: 5, tog: 64, annet: 20 };
    openSheet(`<h3>${k ? "Endre kjøretøy" : "Nytt kjøretøy"}</h3>
      <form id="kjForm">
        <div class="segment valg" role="radiogroup" aria-label="Type">
          ${typer.map(([v, o]) => `<label><input type="radio" name="kjTyp" value="${v}"${v === typ ? " checked" : ""}>${esc(o.navn.replace(" (vogn)", ""))}</label>`).join("")}
        </div>
        <div class="field"><label for="kjNavn">Navn</label>
          <input id="kjNavn" type="text" maxlength="40" placeholder="${esc(TYPER[typ].navn.replace(" (vogn)", ""))} 1"
            value="${k ? esc(k.navn) : ""}" autocomplete="off"></div>
        <div class="feltpar">
          <div class="field"><label for="kjAnt">Plasser</label>
            <input id="kjAnt" type="number" min="1" max="400" value="${k ? k.plasser : VANLIG[typ]}"></div>
          ${k ? "" : `<div class="field"><label for="kjHvorMange">Hvor mange</label>
            <input id="kjHvorMange" type="number" min="1" max="60" value="1"></div>`}
        </div>
        ${k ? "" : `<p class="muted" style="margin:-6px 0 14px;font-size:13px">Skriver du «Bil» og 7, får du Bil 1 til Bil 7.</p>`}
        ${dager.length ? `<div class="field"><label for="kjDato">Hvilken dag</label>
          <select id="kjDato" class="select">
            <option value="">Hele turen</option>
            ${dager.map(d => `<option value="${esc(d.date)}"${k && k.dato === d.date ? " selected" : ""}>${esc(cap(d.label))}</option>`).join("")}
          </select></div>` : ""}
        <div class="field"${typ === "bil" || typ === "tog" ? " hidden" : ""}><label for="kjBak">Bakerste rad</label>
          <select id="kjBak" class="select">
            ${[0, 1, 2, 3].map(n => `<option value="${n}"${(k ? k.bakerst : 0) === n ? " selected" : ""}>${
              n === 0 ? "Like mange som de andre" : `${n} plass${n === 1 ? "" : "er"} mer`}</option>`).join("")}
          </select></div>
        ${k ? `<div class="gruppe" style="margin-bottom:14px"><div class="list">
          <label class="listrow" style="cursor:pointer">
            <div class="grow"><div class="nm">Deltakerne velger selv</div>
              <div class="sub" id="kjFrittTekst"></div></div>
            <input type="checkbox" class="bryter" id="kjFritt" ${k.fritt ? "checked" : ""}></label>
          <label class="listrow" style="cursor:pointer">
            <div class="grow"><div class="nm">Jeg godkjenner bytter</div>
              <div class="sub" id="kjGodkjennTekst"></div></div>
            <input type="checkbox" class="bryter" id="kjGodkjenn" ${k.godkjenn ? "checked" : ""}></label>
        </div></div>` : ""}
        <p class="err" id="kjErr" hidden></p>
        <button class="btn primary big" type="submit" id="kjLagre">Lagre</button>
      </form>
      ${k ? `<button class="btn danger" style="width:100%;margin-top:10px"
        data-slettkj="${esc(k.id)}">Slett kjøretøyet</button>` : ""}
      <button class="btn close" data-close>Avbryt</button>`);

    // Teksten under bryteren sier hva som gjelder nå, ikke hva «av» betyr.
    // «Av: du setter hvem som sitter hvor» under en bryter som sto på,
    // var umulig å lese.
    const forklar = () => {
      if (!$("kjFritt")) return;
      $("kjFrittTekst").textContent = $("kjFritt").checked
        ? "Hver deltaker trykker på en ledig plass." : "Du setter hvem som sitter hvor.";
      $("kjGodkjennTekst").textContent = $("kjGodkjenn").checked
        ? "Et bytte gjelder først når du har sagt ja." : "Det holder at begge som bytter sier ja.";
    };
    forklar();
    if ($("kjFritt")) { $("kjFritt").addEventListener("change", forklar); $("kjGodkjenn").addEventListener("change", forklar); }
    let egetTall = Boolean(k);
    $("kjAnt").addEventListener("input", () => { egetTall = true; });
    document.querySelectorAll('input[name="kjTyp"]').forEach(r => r.addEventListener("change", () => {
      const v = document.querySelector('input[name="kjTyp"]:checked').value;
      if (!egetTall) $("kjAnt").value = VANLIG[v];
      $("kjNavn").placeholder = TYPER[v].navn.replace(" (vogn)", "") + " 1";
      // Ekstra plasser bakerst finnes bare der det er en bakerste benk.
      const bak = $("kjBak").closest(".field");
      if (bak) bak.hidden = v === "bil" || v === "tog";
    }));

    $("kjForm").addEventListener("submit", async e => {
      e.preventDefault();
      const err = $("kjErr"), btn = $("kjLagre");
      const navn = $("kjNavn").value.trim();
      const plasser = parseInt($("kjAnt").value, 10);
      const antall = $("kjHvorMange") ? parseInt($("kjHvorMange").value, 10) : 1;
      if (!navn) { err.textContent = "Gi kjøretøyet et navn."; err.hidden = false; return; }
      if (!plasser || plasser < 1 || plasser > 400) {
        err.textContent = "Antall plasser må være mellom 1 og 400."; err.hidden = false; return;
      }
      if (!k && (!antall || antall < 1 || antall > 60)) {
        err.textContent = "Antall kjøretøy må være mellom 1 og 60."; err.hidden = false; return;
      }
      const felter = {
        navn, typ: document.querySelector('input[name="kjTyp"]:checked').value, plasser,
        bakerst: parseInt($("kjBak").value, 10) || 0,
        dato: $("kjDato") ? ($("kjDato").value || null) : null
      };
      btn.disabled = true; btn.textContent = "Lagrer…";
      try {
        if (k) {
          await Api.endreKjoretoy(k.id, felter);
          const fritt = $("kjFritt").checked, godkjenn = $("kjGodkjenn").checked;
          if (fritt !== k.fritt || godkjenn !== k.godkjenn) await Api.settKjoretoyvalg(k.id, { fritt, godkjenn });
        } else await Api.nyttKjoretoy(S.trip.id, Object.assign({ antall }, felter));
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

    const antallMed = (folk || []).filter(p => !p.skjult).length;
    const topp = `
      ${leder && S.trip.maksDeltakere && folk ? `<p class="muted" style="margin:0">${antallMed} av ${S.trip.maksDeltakere} plasser er tatt.</p>` : ""}
      ${leder ? `<label class="bryterrad" style="margin-top:4px">
        <span class="grow"><b>Krev godkjenning</b>
          <small>Nye deltakere må slippes inn av en reiseleder.</small></span>
        <input type="checkbox" id="krevGodkjenning" ${S.trip.krevGodkjenning ? "checked" : ""}>
        <span class="bryter" aria-hidden="true"></span>
      </label>` : ""}`;

    if (S.folkFeil) return `<div>${topp}</div><p class="muted">Klarte ikke hente deltakerlista.</p>`;
    if (!folk) return `<div>${topp}</div>${venter("Henter deltakere")}`;

    const ventende = folk.filter(p => p.venter);
    const med = folk.filter(p => !p.venter);
    const visPaar = leder && har("paaroerende") && S.paar;

    // Én linje under navnet: rollen, og for reiselederen om pårørende
    // mangler. Valgene for personen ligger bak ⋯, som i Kontakter.
    const underlinje = p => {
      const biter = [];
      if (p.me) biter.push("Deg");
      if (p.role === "leader") biter.push("Reiseleder");
      if (visPaar) {
        const pr = S.paar.get(p.id);
        biter.push(pr ? `Pårørende: ${esc(pr.navn)}` : `<span style="color:var(--amber)">Mangler pårørende</span>`);
      }
      return biter.join(" · ");
    };

    return `
      <div>${topp}</div>

      ${ventende.length ? `<div>
        <div class="eyebrow" style="margin-bottom:8px;color:var(--amber)">Venter på å bli sluppet inn · ${ventende.length}</div>
        <div class="gruppe"><div class="list">${ventende.map(p => `
          <div class="listrow deltrad">
            <span class="megava liten">${esc(initialer(p.name))}</span>
            <div class="grow"><div class="nm">${esc(p.name)}</div></div>
            <button class="pilleknapp" data-avvis="${esc(p.id)}">Avvis</button>
            <button class="pilleknapp fylt" data-godkjenn="${esc(p.id)}">Slipp inn</button>
          </div>`).join("")}</div></div>
      </div>` : ""}

      <div>
        <div class="eyebrow" style="margin-bottom:8px">Med på turen · ${med.length}</div>
        <div class="gruppe"><div class="list">${med.map(p => {
          const valg = leder && !p.me && !p.skjult;
          const sub = underlinje(p);
          return `<div class="listrow deltrad">
            <span class="megava liten">${esc(initialer(p.name))}</span>
            <div class="grow"><div class="nm">${esc(p.name)}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>
            ${visPaar && !p.me && S.paar.get(p.id) ? `<a class="rundknapp" href="tel:${esc(telnummer(S.paar.get(p.id).telefon))}" aria-label="Ring pårørende til ${esc(p.name)}">${ICON.telefon}</a>` : ""}
            ${valg ? `<button class="rundknapp" data-personvalg="${esc(p.id)}" aria-label="Valg for ${esc(p.name)}">${ICON.mer}</button>` : ""}
          </div>`;
        }).join("")}</div></div>
      </div>`;
  }

  /* Valgene for én deltaker, som et handlingsark i iOS: det vanlige
     øverst, det som ikke kan angres nederst og i rødt. */
  function sheetPersonvalg(id) {
    const p = (S.folk || []).find(x => x.id === id);
    if (!p) return;
    const ledere = (S.folk || []).filter(x => !x.venter && x.role === "leader");
    openSheet(`<h3>${esc(p.name)}</h3>
      <div class="gruppe"><div class="list">
        ${p.role === "leader"
          ? (ledere.length > 1 ? `<button class="listrow bar" data-rolle="${esc(p.id)}" data-til="member"><div class="grow"><div class="nm">Fjern som reiseleder</div></div></button>` : "")
          : `<button class="listrow bar" data-rolle="${esc(p.id)}" data-til="leader"><div class="grow"><div class="nm">Gjør til reiseleder</div></div></button>`}
        <button class="listrow bar" data-rettnavn="${esc(p.id)}" data-navn="${esc(p.name)}"><div class="grow"><div class="nm">Rett navn</div></div></button>
        <button class="listrow bar" data-fjern="${esc(p.id)}" data-navn="${esc(p.name)}"><div class="grow"><div class="nm" style="color:var(--danger)">Fjern fra turen</div></div></button>
      </div></div>
      <button class="btn close" data-close>Avbryt</button>`);
  }
  const initialer = navn => String(navn || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "–";

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
        ? "Program, beskjeder og veibeskrivelse for gruppa som reiser."
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
      <p class="soppelpost"><b>Finner du ikke koden?</b> Se i søppelpost.</p>

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
    return bekreft(
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
    ["viktig", "Det viktige", "Reiseledere, svar til deg, og møtetider"],
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
    // Fra ett kjøretøy går tilbake til lista over kjøretøy, ikke ut.
    if (S.side === "seter" && S.seteKj) {
      S.seteKj = null;
      render();
      if (!fraHistorikk && history.state && history.state.kj) gaaTilbake();
      return true;
    }
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
          <small>${ch.ledere
            ? "Lederchat — alle reiseledere er med, og ingen andre. Den som får lederrollen, legges til av seg selv."
            : ch.private
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
              ${ch.private && !ch.ledere && !p.me ? `<button class="linkbtn" data-cmdel="${esc(p.id)}">fjern</button>` : ""}
            </div>`).join("")}</div>`}
      </div>

      ${folk && folk.andre.length && !ch.ledere ? `<div>
        <div class="eyebrow" style="margin-bottom:8px">Andre på turen</div>
        <div class="memberlist">${folk.andre.map(p => `<div class="person">
          <span>${esc(p.name)}${p.role === "leader" ? ' <em>reiseleder</em>' : ""}</span>
          <button class="linkbtn" data-cmadd="${esc(p.id)}">legg til</button>
        </div>`).join("")}</div>
      </div>` : ""}

      <div class="stack">
        ${ch.private && !ch.ledere ? `<button class="btn danger" data-cmleave="${esc(ch.id)}">Gå ut av chatten</button>` : ""}
        ${ch.ledere ? "" : ch.min || (!ch.private && S.trip.role === "leader")
          ? `<button class="btn danger" data-slettchat="${esc(ch.id)}">Slett chatten</button>` : ""}
      </div>`;
  }

  function viewVarsler() {
    const st = S.varselStatus;
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const paaHjem = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const turNiva = Api.varselNiva(null);
    const valg = Api.varselvalg();
    // I iOS-appen virker ikke nettleservarsler, og telefonens egne varsler
    // (APNs) er ikke bygget ennå. Da skal siden si det rett ut, ikke be om
    // hjemskjerm og Safari-innstillinger som ikke finnes i en app.
    const nativ = erNativ();

    const topp = nativ
      ? `<div class="card pad" style="padding-block:14px">
           <b style="font-family:"DM Sans",sans-serif;font-size:14px">Varsler kommer i en oppdatering</b>
           <p style="margin:7px 0 0;font-size:13.5px;color:var(--ink-2)">
             Appen kan ikke sende varsler ennå. Valgene under er lagret på kontoen din,
             og gjelder så snart varslene er på plass.</p>
         </div>`
      : st === null
      ? venter("Sjekker")
      : iOS && !paaHjem
      ? `<div class="card pad" style="padding-block:14px;border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
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
      ? `<div class="card pad" style="padding-block:14px;border-color:color-mix(in srgb, var(--amber) 45%, var(--line))">
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

      </div>

      ${nativ || !altVirker ? "" : `<div style="margin-top:18px">
        <button class="linkbtn" id="testServer" style="font-size:13px">Send et testvarsel hit</button>
        ${S.varselTest ? `<div class="card pad" style="padding-block:12px;margin-top:8px;
             border-left:3px solid var(--${S.varselTest.ok ? "moss" : "amber"})">
           <p style="margin:0;font-size:13.5px;color:var(--ink-2)">${esc(S.varselTest.tekst)}</p></div>` : ""}
      </div>`}

      ${nativ || altVirker ? "" : `<details class="feilsok">
        <summary>Virker ikke varslene?</summary>
        <div class="eyebrow" style="margin:14px 0 8px">Hvert ledd i kjeden</div>
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
      </details>`}`;
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
      <p class="muted" style="margin:6px 0 14px">Navn, gruppe og når turen starter.
        Turkoden endrer seg ikke.</p>
      <form id="turForm">
        <div class="field"><label for="tuNavn">Navn på turen</label>
          <input id="tuNavn" value="${esc(t.name)}" maxlength="80"></div>
        <div class="field"><label for="tuOrg">Gruppe</label>
          <input id="tuOrg" value="${esc(t.org || "")}" maxlength="80" placeholder="Sandnes IL G16, salgsavdelingen eller 10B"></div>
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
        S.tab = "turen"; render();
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
              med hele gruppa blir det mange.</small></span>
        </div>
        <div class="person" style="align-items:flex-start">
          <span class="chattekst"><b>Det viktige</b>
            <small>Tre ting: meldinger fra reiseledere, svar på dine egne meldinger, og
              meldinger som avtaler et møtested med klokkeslett — som «møt på hotellet kl 18:30».
              «Møt ved Notre-Dame» uten tid gir veibeskrivelse i chatten, men ikke varsel.
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

  /* Om appen og personvern (E19). Den gamle teksten sa at alle fikk en
     anonym identitet (e-post finnes nå) og at man måtte lage en ny tur
     når koden kom på avveie (Ny turkode finnes). */
  const PERSONVERN_URL = "https://tripmateub.github.io/tripmate/personvern.html";
  const VILKAAR_URL = "https://tripmateub.github.io/tripmate/vilkaar.html";
  function sheetAbout() {
    openSheet(`<h3>Om appen og personvern</h3>
      <p style="margin:10px 0;font-size:14.5px;color:var(--ink-2)">
        TripMate samler program, beskjeder og veibeskrivelser for en gruppe som reiser sammen. Når noen
        avtaler et møtested i chatten, kobler appen det mot programmet og finner riktig adresse.</p>
      <div class="card pad" style="padding-block:12px;margin-top:6px">
        <dl class="kv">
          <dt>Lagring</dt><dd>I en database hos Supabase i EU (Irland). Du ser bare turer du er med på.</dd>
          <dt>Innlogging</dt><dd>Med e-post, eller som gjest. En gjestekonto finnes bare på denne telefonen.</dd>
          <dt>Sletting</dt><dd>En tur slettes 60 dager etter siste programdag. Bilder slettes etter 30 dager.
            Du kan slette kontoen din under Meg.</dd>
          <dt>Kart</dt><dd>Adressen åpnes i Google Maps eller Apple Kart når du trykker på veibeskrivelse.</dd>
          <dt>Vær</dt><dd>Værmelding og værsymboler fra Yr og MET Norway. Symbolene er © 2015–2017 Yr, MIT-lisens.</dd>
        </dl>
      </div>
      <p class="muted" style="margin-top:12px">Turkoden slipper folk inn på turen. Del den bare med dem som skal være med.
        Kommer den på avveie, kan reiselederen lage en ny under Turen.</p>
      <a class="btn" style="width:100%;margin-top:6px" href="${PERSONVERN_URL}" target="_blank" rel="noopener">Les personvernerklæringen</a>
      <a class="btn" style="width:100%;margin-top:6px" href="${VILKAAR_URL}" target="_blank" rel="noopener">Les vilkårene</a>
      <button class="btn close" data-close>Lukk</button>`);
  }

  /* ───────────────── hendelser ───────────────── */
  document.addEventListener("change", async e => {
    if (e.target.dataset && e.target.dataset.lastopp) {
      const fil = e.target.files && e.target.files[0];
      const felles = e.target.dataset.lastopp === "felles";
      e.target.value = "";
      if (!fil) return;
      toast("Laster opp " + fil.name + "…");
      try { await Api.lastOppDokument(S.trip.id, fil, felles); await aapneDokumenter(true); toast("Lagt inn."); }
      catch (err) { toast(err.message || "Klarte ikke laste opp."); }
      return;
    }
  });
  document.addEventListener("input", e => {
    if (e.target.id !== "sokFelt") return;
    clearTimeout(sokTimer);
    sokTimer = setTimeout(() => sok(e.target.value), 300);
  });

  document.addEventListener("change", async e => {
    const bryter = e.target.closest("[data-chatskriv],[data-kjfritt],[data-kjgodkjenn],[data-romfritt],[data-romgodkjenn]");
    if (!bryter) return;
    const paa = bryter.checked;
    try {
      if (bryter.dataset.chatskriv) {
        await Api.settChatSkriving(bryter.dataset.chatskriv, paa);
        render();
      } else if (bryter.dataset.kjfritt) {
        await Api.settKjoretoyvalg(bryter.dataset.kjfritt, { fritt: paa });
        await aapneSeter(true);
      } else if (bryter.dataset.kjgodkjenn) {
        await Api.settKjoretoyvalg(bryter.dataset.kjgodkjenn, { godkjenn: paa });
        await aapneSeter(true);
      } else {
        // Rombryterne ligger på turen, så turen må hentes på nytt — det
        // er den som bærer verdien videre til resten av skjermene.
        const felt = bryter.dataset.romfritt ? { fritt: paa } : { godkjenn: paa };
        await Api.settRomvalg(S.trip.id, felt);
        await openTrip(S.trip.id);
        await aapneRom(true);
      }
    } catch {
      bryter.checked = !paa;
      toast("Klarte ikke lagre. Prøv igjen om litt.");
    }
  });

  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-tab],[data-side],[data-kjside],[data-pakk],[data-slettpakk],[data-sete],[data-setevalg],[data-nykj],[data-endrekj],[data-slettkj],[data-vaerigjen],[data-svarbytte],[data-avgjorbytte],[data-trekkbytte],[data-nyttrom],[data-endrerom],[data-slettrom],[data-fyllrom],[data-fyllalle],[data-settrom],[data-romvalg],[data-utavrom],[data-bytterom],[data-svarrombytte],[data-avgjorrombytte],[data-trekkrombytte],[data-nykontakt],[data-endrekontakt],[data-slettkontakt],[data-nyttopprop],[data-hake],[data-lukkopprop],[data-omvis],[data-day],[data-channel],[data-sheet],[data-opentrip],[data-close],[data-copy],[data-turkode],[data-edit],[data-iprog],[data-taned],[data-romliste],[data-angrerom],[data-fjernres],[data-rettnavn],[data-personvalg],[data-utsett],[data-startopprop],[data-seteliste],[data-fyllseter],[data-kalender],[data-aapnedok],[data-slettdok],[data-soktreff],[data-delitem],[data-delday],[data-delmsg],[data-rapporter],[data-blokker],[data-opphevblokk],[data-rappslett],[data-rappfjern],[data-rappferdig],[data-tilgangaktiv],[data-tilgangvalg],[data-leave],[data-deltrip],[data-members],[data-openchat],[data-item],[data-kopi],[data-skjul],[data-vis],[data-kartapne],[data-kartlukk],[data-nye],[data-eldre],[data-msgmeny],[data-chat],[data-paa],[data-slettchat],[data-bilde],[data-slettbilde],[data-bvlukk],[data-bvmeny],[data-lagrebilde],[data-kopimeld],[data-deltekst],[data-chatside],[data-cmadd],[data-cmdel],[data-cmleave],[data-rolle],[data-godkjenn],[data-avvis],[data-fjern],#authTilbake,#joinTilbake,[data-emoji],[data-hopp],[data-svar],#tripBtn,#meBtn,#resetBtn,#backBtn,#skjulInstall,#installKnapp");
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
      // En gjest som eier en tur, kan ikke logge ut: kontoen slettes da,
      // og turen ville stått igjen uten noen som kan styre den.
      if (gjest) {
        const eier = await Api.antallEgneTurer().catch(() => 0);
        if (eier) {
          if (await bekreft(`Du er gjest og eier ${eier === 1 ? "en tur" : eier + " turer"}. Logger du ut, mister du turen for godt.\n\nKoble kontoen til e-posten din først, så kan du logge inn igjen senere.`,
            { ja: "Koble til e-post", nei: "Avbryt", fare: false })) { closeSheet(); visAuth("koble"); }
          return;
        }
      }
      const sporsmaal = gjest
        ? "Logge ut? Du er gjest, så kontoen finnes bare her — den slettes, og du kommer inn igjen med turkoden."
        : "Logge ut på denne enheten? Turene ligger igjen i basen, og du logger inn igjen med e-posten din.";
      if (await bekreft(sporsmaal)) {
        // Vent: utloggingen rydder gjestekontoen, og det må rekke å skje
        // før siden lastes på nytt.
        await Api.signOutLocal();
        location.reload();
      }
      return;
    }

    /* Sletting av konto spør to ganger. Første spørsmål sier hva som
       skjer, andre er en siste stopp — dette kan ikke angres, og raden
       ligger rett under «Logg ut», som folk trykker på i farta. */
    if (t.id === "slettKontoBtn") {
      const hva = Api.erAnonym()
        ? "Slette kontoen? Du er gjest, så alt du har her forsvinner, og turkoden må brukes på nytt."
        : "Slette kontoen? Du mistes fra alle turene dine, og e-posten din kan ikke logge inn igjen.";
      if (!await bekreft(hva)) return;
      if (!await bekreft("Helt sikker? Dette kan ikke angres.")) return;

      const svar = await Api.slettKonto();

      if (svar.slettet) { location.reload(); return; }

      // Eier du turer, står kontoen. Vi sier hvilke, ellers er beskjeden
      // umulig å gjøre noe med.
      if (svar.grunn === "eier_tur") {
        const navn = (svar.turer || []).map(t2 => t2.name).join(", ");
        await melding("Kontoen ble ikke slettet. Du eier " +
          ((svar.turer || []).length === 1 ? "turen " : "turene ") + navn +
          ". Slett dem, eller gjør noen andre til eier, og prøv igjen.");
        return;
      }
      toast(svar.grunn === "nettverk"
        ? "Fikk ikke kontakt. Prøv igjen."
        : "Kontoen ble ikke slettet.");
      return;
    }

    if (t.dataset.copy) {
      const hva = S.side === "tilgang" ? "Tilgangskoden" : "Turkoden";
      try { await kopier(t.dataset.copy); toast(hva + " er kopiert."); haptikk(); }
      catch { toast("Fikk ikke kopiert. Hold fingeren på koden og velg Kopier."); }
      return;
    }
    if (t.dataset.turkode === "del") return delTurlenke();
    if (t.dataset.turkode === "lenke") {
      try { await kopier(turlenke()); toast("Lenken er kopiert."); haptikk(); }
      catch { toast("Fikk ikke kopiert lenken."); }
      return;
    }

    if (t.dataset.opentrip) { closeSheet(); S.tab = "program"; return openTrip(t.dataset.opentrip).catch(() => toast("Klarte ikke åpne turen.")); }
    if (t.dataset.tab) return byttFane(t.dataset.tab);

    if (t.dataset.kjside) return aapneKjoretoy(t.dataset.kjside);
    if (t.dataset.side) {
      closeSheet();
      if (t.dataset.side === "pakk") return aapnePakk();
      if (t.dataset.side === "rom") return aapneRom();
      if (t.dataset.side === "kontakt") return aapneKontakt();
      if (t.dataset.side === "opprop") return aapneOpprop();
      if (t.dataset.side === "dokumenter") return aapneDokumenter();
      if (t.dataset.side === "tilgang") return aapneTilgang();
      if (t.dataset.side === "turkode") return aapneTurkode();
      return aapneSeter();
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
      const egen = t.dataset.egen === "1", id = t.dataset.slettpakk;
      const rad = t.closest(".pkrad");
      medAngre("Punktet er slettet.", async () => { await Api.slettPakkPunkt(id, egen); await aapnePakk(true); },
        skjult => { if (rad) rad.hidden = skjult; });
      return;
    }

    if (t.dataset.sete && t.dataset.kj) {
      const nr = parseInt(t.dataset.sete, 10);
      const k = ((S.setekart || {}).kjoretoy || []).find(x => x.id === t.dataset.kj);
      if (!k) return;
      const leder = S.trip.role === "leader";
      const mitt = k.seter.find(x => x.meg);
      const paa = k.seter.find(x => x.nr === nr);
      const navn = plassOmtale(nr, k);

      // Reiselederen fordeler: da er et trykk et valg om hvem, ikke om deg.
      if (leder && !k.fritt) return sheetSete(k.id, nr);

      try {
        if (mitt && mitt.nr === nr) {
          if (!k.fritt) return;                // du satte den ikke selv
          if (!await bekreft(`Slippe ${navn} i ${k.navn}?`)) return;
          await Api.slippSete(k.id);
        } else if (k.fritt && !paa) {
          // Sitter du i et kjøretøy som kjører samtidig, flytter du deg.
          // Basen slipper den gamle plassen i samme operasjon.
          const n = Api.samtidigNokkel(k);
          const annen = S.setekart.kjoretoy.find(x => x.id !== k.id && Api.samtidigNokkel(x) === n && x.seter.some(y => y.meg));
          if (annen) {
            const gammel = annen.seter.find(y => y.meg);
            if (!await bekreft(`Du sitter på ${plassOmtale(gammel.nr, annen)} i ${annen.navn}. Flytte deg til ${navn} i ${k.navn}?`,
              { ja: "Flytt meg", fare: false })) return;
          }
          await Api.taSete(k.id, nr);
        } else {
          // Noen sitter der, eller reiselederen fordeler: da spør man.
          const hvem = paa ? paa.hvem : null;
          if (!await bekreft(hvem
            ? `Be ${hvem} om å bytte til ${navn} i ${k.navn}?`
            : `Be om ${navn} i ${k.navn}?`)) return;
          await Api.beOmBytte(k.id, nr);
          toast(hvem ? "Spurt. Du får beskjed når de svarer." : "Spurt. Reiselederen avgjør.");
        }
        await aapneSeter(true);
        hentMegTall(true);
      } catch (err) { toast(err.message); await aapneSeter(true); }
      return;
    }

    if (t.dataset.setevalg !== undefined && t.dataset.kj) {
      try {
        await Api.settSete(t.dataset.kj, parseInt(t.dataset.nr, 10), t.dataset.setevalg || null);
        closeSheet();
        await aapneSeter(true);
        hentMegTall(true);
      } catch (err) { toast(err.message); }
      return;
    }

    if (t.dataset.svarbytte) {
      try { await Api.svarBytte(t.dataset.svarbytte, t.dataset.ja === "1"); await aapneSeter(true); hentMegTall(true); }
      catch (err) { toast(err.message); await aapneSeter(true); }
      return;
    }
    if (t.dataset.avgjorbytte) {
      try { await Api.avgjorBytte(t.dataset.avgjorbytte, t.dataset.ja === "1"); await aapneSeter(true); hentMegTall(true); }
      catch (err) { toast(err.message); await aapneSeter(true); }
      return;
    }
    if (t.dataset.trekkbytte) {
      try { await Api.trekkBytte(t.dataset.trekkbytte); await aapneSeter(true); }
      catch (err) { toast(err.message); await aapneSeter(true); }
      return;
    }

    // ───── rom ─────
    if (t.hasAttribute("data-nyttrom")) return sheetRom(null);
    if (t.dataset.endrerom) return sheetRom(t.dataset.endrerom);
    if (t.dataset.fyllrom) return sheetVelgPerson(t.dataset.fyllrom);
    if (t.dataset.settrom) return sheetVelgRom(t.dataset.settrom);

    if (t.dataset.slettrom) {
      const r = S.rom.rom.find(x => x.id === t.dataset.slettrom);
      if (!await bekreft(`Slette ${r ? r.navn : "rommet"}? De som bor der blir stående uten seng.`)) return;
      try { await Api.slettRom(t.dataset.slettrom); closeSheet(); await aapneRom(true); }
      catch { toast("Klarte ikke slette rommet."); }
      return;
    }

    if (t.dataset.romvalg) {
      try {
        await Api.settRom(S.trip.id, t.dataset.romvalg, t.dataset.rom || null);
        closeSheet();
        await aapneRom(true);
      } catch (err) { toast(err.message); }
      return;
    }
    if (t.dataset.utavrom) {
      try { await Api.settRom(S.trip.id, t.dataset.utavrom, null); await aapneRom(true); hentMegTall(true); }
      catch (err) { toast(err.message); }
      return;
    }

    if (t.hasAttribute("data-fyllalle")) {
      const uten = (S.rom.alle || []).filter(p => !p.rom).length;
      if (!await bekreft(`Legge de ${uten} uten seng i de ledige sengene? Ingen som alt har rom blir flyttet.`)) return;
      try {
        const n = await Api.fyllRom(S.trip.id);
        await aapneRom(true);
        hentMegTall(true);
        toast(n ? `${n} fikk seng.` : "Ingen ledige senger.");
      } catch (err) { toast(err.message); }
      return;
    }

    /* Deltakeren ber om et rom. Står det en seng ledig, er det ingen å
       spørre, og forespørselen går rett til reiselederen — eller rett
       gjennom, hvis hen ikke vil se hvert bytte. Er rommet fullt, er det
       en person man spør: ellers hadde noen blitt stående uten seng. */
    if (t.dataset.bytterom) {
      const r = (S.rom.rom || []).find(x => x.id === t.dataset.bytterom);
      const person = t.dataset.person || null;
      const hvem = person && r ? (r.folk.find(p => p.id === person) || {}).navn : null;
      if (!await bekreft(hvem
        ? `Be ${hvem} om å bytte rom med deg?`
        : `Be om en ledig seng på ${r ? r.navn : "rommet"}?`)) return;
      try {
        await Api.beOmRombytte(t.dataset.bytterom, person);
        await aapneRom(true);
        hentMegTall(true);
        toast(hvem ? "Spurt. Du får beskjed når de svarer." : "Spurt. Reiselederen avgjør.");
      } catch (err) { toast(err.message); await aapneRom(true); }
      return;
    }

    if (t.dataset.svarrombytte) {
      try { await Api.svarRombytte(t.dataset.svarrombytte, t.dataset.ja === "1"); await aapneRom(true); hentMegTall(true); }
      catch (err) { toast(err.message); await aapneRom(true); }
      return;
    }
    if (t.dataset.avgjorrombytte) {
      try { await Api.avgjorRombytte(t.dataset.avgjorrombytte, t.dataset.ja === "1"); await aapneRom(true); hentMegTall(true); }
      catch (err) { toast(err.message); await aapneRom(true); }
      return;
    }
    if (t.dataset.trekkrombytte) {
      try { await Api.trekkRombytte(t.dataset.trekkrombytte); await aapneRom(true); hentMegTall(true); }
      catch (err) { toast(err.message); await aapneRom(true); }
      return;
    }

    // ───── omvisning ─────
    if (t.dataset.omvis) {
      const v = t.dataset.omvis;
      if (v === "slutt") return avsluttOmvisning();
      if (!S.omvis) return;
      return gaaTilOmvisSteg(S.omvis.i + (v === "forrige" ? -1 : 1), v === "forrige");
    }

    // ───── nødnummer ─────
    if (t.hasAttribute("data-nykontakt")) return sheetKontakt(null);
    if (t.dataset.endrekontakt) return sheetKontakt(t.dataset.endrekontakt);

    if (t.dataset.slettkontakt) {
      const c = ((S.kontakt || {}).liste || []).find(x => x.id === t.dataset.slettkontakt);
      if (!await bekreft(`Slette ${c ? c.navn : "nummeret"}?`)) return;
      try { await Api.slettKontakt(t.dataset.slettkontakt); await aapneKontakt(true); }
      catch (err) { toast(err.message); }
      return;
    }

    // ───── opprop ─────
    if (t.hasAttribute("data-nyttopprop")) return sheetNyttOpprop();
    if (t.dataset.startopprop !== undefined) {
      closeSheet();
      try { await Api.nyttOpprop(S.trip.id, "", t.dataset.startopprop || null); await aapneOpprop(true); }
      catch (err) { toast(err.message); }
      return;
    }

    /* Haken settes med en gang på skjermen: et opprop gjøres i farta, og
       et navn som venter på serveren før det flytter seg, blir haket av
       to ganger. Går det galt, settes den tilbake. */
    if (t.dataset.hake) {
      const runde = (S.opprop || {}).runde;
      if (!runde) return;
      const p = (S.opprop.folk || []).find(x => x.id === t.dataset.hake);
      if (!p) return;
      const foer = p.her;
      p.her = !foer; render();
      try { await Api.settHake(S.trip.id, runde.id, p.id, p.her); }
      catch (err) { p.her = foer; render(); toast(err.message); }
      return;
    }

    if (t.dataset.lukkopprop) {
      const mangler = (S.opprop.folk || []).filter(p => !p.her).length;
      if (mangler && !await bekreft(`${mangler} står fortsatt uten hake. Avslutte oppropet likevel?`)) return;
      try { await Api.lukkOpprop(t.dataset.lukkopprop); await aapneOpprop(true); }
      catch (err) { toast(err.message); }
      return;
    }

    if (t.hasAttribute("data-nykj")) return sheetKjoretoy(null);
    if (t.dataset.endrekj) return sheetKjoretoy(t.dataset.endrekj);

    if (t.dataset.slettkj) {
      const k = ((S.setekart || {}).kjoretoy || []).find(x => x.id === t.dataset.slettkj);
      if (!await bekreft(`Slette ${k ? k.navn : "kjøretøyet"}? Plassene alle har valgt forsvinner.`)) return;
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
      // Oppslaget tar over tjue sekunder: kartet tåler ett spørsmål i
      // sekundet, og vi spør om flere steder. Et varsel som forsvinner
      // etter tre sekunder er da verre enn ingenting — derfor blir
      // knappen stående og si at den holder på.
      if (S.vaerJobber) return;
      S.vaerJobber = true; render();
      const svar = await Api.lastVaer(S.trip.id, true);
      S.vaerJobber = false;
      try { await openTrip(S.trip.id); } catch {}
      S.tab = "turen"; render();
      if (svar && svar.ok === false) return toast(svar.grunn);
      const igjen = oppgaver().filter(o => /Fant ikke posisjonen/.test(o.hva)).length;
      toast(igjen ? `${igjen} står fortsatt uten posisjon.` : "Alle stedene har posisjon nå.");
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

    if (t.dataset.romliste) return sheetRomliste();
    if (t.dataset.kalender) return delKalender();
    if (t.dataset.seteliste) return sheetSeteliste(t.dataset.seteliste, t.dataset.etter || "plass");
    if (t.dataset.fyllseter) {
      try {
        const n = await Api.fyllSeter(t.dataset.fyllseter);
        await aapneSeter(true); hentMegTall(true);
        toast(n ? `${n} ${n === 1 ? "person" : "personer"} fikk plass.` : "Alle har alt plass, eller det er fullt.");
      } catch (err) { toast(err.message || "Klarte ikke fylle plassene."); }
      return;
    }
    if (t.dataset.aapnedok) {
      // Vinduet åpnes i samme trykk; ellers stopper Safari det som en popup.
      const vindu = erNativ() ? null : window.open("about:blank", "_blank");
      try {
        const url = await Api.dokumentAdresse(t.dataset.aapnedok);
        if (vindu) vindu.location = url; else window.open(url, "_blank");
      } catch (err) { if (vindu) vindu.close(); toast(err.message); }
      return;
    }
    if (t.dataset.slettdok) {
      if (!await bekreft(`Slette «${t.dataset.navn}»?`)) return;
      try { await Api.slettDokument(t.dataset.slettdok, t.dataset.sti); await aapneDokumenter(true); }
      catch (err) { toast(err.message || "Klarte ikke slette."); }
      return;
    }
    if (t.dataset.soktreff) return hoppTilTreff(t.dataset.kanal, t.dataset.soktreff);
    if (t.dataset.utsett) {
      try {
        const ny = await Api.utsettSletting(S.trip.id);
        S.trip.slettes = ny;
        closeSheet(); render();
        toast("Turen slettes nå " + sletteTekst(ny).toLowerCase() + ".");
      } catch (err) { toast(err.message || "Klarte ikke utsette."); }
      return;
    }
    if (t.dataset.rettnavn) return sheetRettNavn(t.dataset.rettnavn, t.dataset.navn);
    if (t.dataset.personvalg) return sheetPersonvalg(t.dataset.personvalg);
    if (t.dataset.angrerom) {
      try { await Api.angreRomplass(t.dataset.angrerom); await aapneRom(true); toast("Sengen er ledig igjen."); }
      catch (err) { toast(err.message || "Klarte ikke angre."); }
      return;
    }
    if (t.dataset.fjernres) {
      try { await Api.fjernReservasjon(t.dataset.fjernres); await aapneRom(true); }
      catch (err) { toast(err.message || "Klarte ikke fjerne navnet."); }
      return;
    }
    if (t.dataset.iprog) {
      const m = Api.messages(S.openChat).find(x => x.id === t.dataset.iprog);
      const a2 = m && m.action;
      const dag = a2 && S.trip.days.find(d => d.date === a2.date);
      if (!dag) return toast("Den dagen finnes ikke i programmet.");
      // Tittelen er meldingen, uten klokkeslettet som alt står i feltet over.
      const tittel = String(m.txt || "").replace(/\b(kl\.?|klokka|klokken)?\s*\d{1,2}[.:]\d{2}\b/gi, "")
        .replace(/\s{2,}/g, " ").trim().slice(0, 60);
      return sheetAddItem(dag.id, { t: a2.time || "", title: tittel, placeId: a2.place, fraMelding: m.id });
    }
    if (t.dataset.taned) {
      try { await Api.skjulForslag(t.dataset.taned); render(); }
      catch { toast("Klarte ikke ta ned forslaget."); }
      return;
    }
    if (t.dataset.delitem) {
      const id = t.dataset.delitem;
      closeSheet();
      const rad = $("screen").querySelector(`.ev[data-item="${CSS.escape(id)}"]`);
      medAngre("Punktet er slettet.", async () => { await Api.deleteItem(id); await openTrip(S.trip.id); },
        skjult => { if (rad) rad.hidden = skjult; });
      return;
    }
    if (t.dataset.delday) {
      if (!await bekreft("Slette hele dagen med alle punktene?")) return;
      try { await Api.deleteDay(t.dataset.delday); S.day = null; await openTrip(S.trip.id); }
      catch { toast("Klarte ikke slette."); }
      return;
    }
    if (t.dataset.delmsg) {
      const m = Api.messages(S.openChat).find(x => x.id === t.dataset.delmsg);
      const harBilde = m && m.bilde, id = t.dataset.delmsg, kanal = S.openChat;
      closeSheet();
      lukkBilde();
      const boks = $("screen").querySelector(`#msg-${CSS.escape(id)}`);
      medAngre(harBilde && !(m.txt) ? "Bildet er slettet." : "Meldingen er slettet.", async () => {
        // Bildefila ligger for seg selv i lageret, og blir ikke med i
        // dragsuget når meldingen forsvinner. Den må ryddes først.
        if (harBilde) await Api.slettBilde(m.bilde).catch(() => {});
        await Api.deleteMessage(id, kanal);
        render();
      }, skjult => { if (boks) boks.hidden = skjult; });
      return;
    }
    if (t.dataset.deltrip) return sheetSlettTur();
    if (t.dataset.leave) return sheetMeldAv();

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
          if (!await bekreft("Gå ut av chatten? Du mister tilgangen til meldingene.")) return;
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
      if (t.dataset.rolle) closeSheet();
      // Å fjerne noen er ikke til å angre på, så vi spør først. Meldingene
      // deres blir stående, men tilgangen forsvinner med én gang.
      if (t.dataset.fjern &&
          !await bekreft(`Fjerne ${t.dataset.navn} fra turen? Da mister de tilgangen til program og chatter, og trenger turkoden på nytt for å komme inn igjen.`)) return;
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
      if (!await bekreft("Slette teksten for alle? Bildet blir stående.")) return;
      try { await Api.slettTekst(t.dataset.deltekst, S.openChat); closeSheet(); render(); }
      catch { toast("Klarte ikke slette teksten. Prøv igjen om litt."); }
      return;
    }
    if (t.dataset.kopimeld) {
      closeSheet();
      try { await kopier(t.dataset.kopimeld); toast("Teksten er kopiert."); }
      catch { toast("Fikk ikke kopiert teksten."); }
      return;
    }

    if (t.dataset.slettbilde) {
      if (!await bekreft("Slette bildet for alle? Det kan ikke angres.")) return;
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
      if (!await bekreft(`Slette «${c ? c.name : "chatten"}» for alle? Meldingene forsvinner for godt.`)) return;
      try {
        await Api.deleteChannel(t.dataset.slettchat);
        S.side = null; S.openChat = null;
        await openTrip(S.trip.id);
        S.tab = "chat"; render();
        toast("Chatten er slettet.");
      } catch (e) { toast(e.message || "Klarte ikke slette chatten."); }
      return;
    }

    if (t.dataset.paa && !t.dataset.tilgangaktiv) {
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
    if (t.dataset.rapporter) return sheetRapporter(t.dataset.rapporter);
    if (t.dataset.reaksjoner) return sheetReaksjoner(t.dataset.reaksjoner);
    if (t.dataset.tilgangvalg) return sheetTilgangvalg(t.dataset.tilgangvalg);
    if (t.dataset.tilgangaktiv) {
      const paa = t.dataset.aapne === "1";
      if (!paa && !await bekreft("Stenge koden? Kunden kan ikke lage flere turer med den. Turer som finnes, virker som før.", { ja: "Steng", fare: true })) return;
      closeSheet();
      try { await Api.settTilgangAktiv(t.dataset.tilgangaktiv, paa); await aapneTilgang(true); toast(paa ? "Koden virker igjen." : "Koden er stengt."); }
      catch (err) { toast(err.message || "Klarte ikke."); }
      return;
    }
    if (t.dataset.blokker) return blokkerPerson(t.dataset.blokker, t.dataset.navn || "personen");
    if (t.dataset.opphevblokk) {
      try { await Api.opphevBlokk(t.dataset.opphevblokk); sheetBlokkerte(); render(); }
      catch { toast("Klarte ikke oppheve. Sjekk nettet og prøv igjen."); }
      return;
    }
    if (t.dataset.rappslett || t.dataset.rappfjern || t.dataset.rappferdig) {
      const id = t.dataset.rappslett || t.dataset.rappfjern || t.dataset.rappferdig;
      const r = (S.rapporter || []).find(x => x.id === id);
      if (!r) return;
      try {
        if (t.dataset.rappslett) {
          if (!await bekreft("Slette meldingen for alle?", { ja: "Slett" })) return sheetRapportliste();
          await Api.slettMeldingMedId(r.messageId);
        } else if (t.dataset.rappfjern) {
          if (!await bekreft(`Ta ${r.navn || "personen"} ut av turen? Hen mister tilgangen med en gang.`, { ja: "Ta ut", fare: true })) return sheetRapportliste();
          await Api.fjernDeltaker(S.trip.id, r.gjelder);
        }
        await Api.behandleRapport(r.id);
        S.rapporter = (S.rapporter || []).filter(x => x.id !== r.id);
        toast("Rapporten er behandlet.");
        if (S.rapporter.length) sheetRapportliste(); else closeSheet();
        render();
      } catch (err) { toast(err && err.kjent ? err.message : "Klarte ikke. Sjekk nettet og prøv igjen."); }
      return;
    }
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
    if (t.dataset.sheet === "endrenavn") return sheetEndreNavn();
    if (t.dataset.sheet === "paaroerende") return sheetPaaroerende();
    if (t.dataset.sheet === "sletting") return sheetSletting();
    if (t.dataset.sheet === "delkode") return aapneTurkode();
    if (t.dataset.sheet === "newtrip") return sheetNewTrip();
    if (t.dataset.sheet === "newchannel") return sheetNewChannel();
    if (t.dataset.sheet === "addday") return sheetAddDay();
    if (t.dataset.sheet === "additem") return sheetAddItem(t.dataset.day);
    if (t.dataset.sheet === "hotel") return sheetHotel(t.dataset.day);
    if (t.dataset.sheet === "deltakere") { closeSheet(); return aapneDeltakere(); }
    if (t.dataset.sheet === "varsler") { closeSheet(); return aapneVarsler(); }
    if (t.dataset.sheet === "varselinfo") return sheetVarselInfo();
    if (t.dataset.sheet === "byttkode") return sheetByttKode();
    if (t.dataset.sheet === "omvisning") return startOmvisning();
    if (t.dataset.sheet === "slettkonto") return sheetSlettKonto();
    if (t.dataset.sheet === "kartvalg") return sheetKartvalg();
    if (t.dataset.sheet === "endretur") return sheetEndreTur();
    if (t.dataset.sheet === "doppchat") return sheetDoppChat(t.dataset.chat);
    if (t.dataset.sheet === "logginn") return visAuth("logginn");
    if (t.dataset.sheet === "koblepost") { closeSheet(); return visAuth("koble"); }
    if (t.dataset.sheet === "nyttpakk") return sheetNyttPakk(t.dataset.egen === "1");
    if (t.dataset.sheet === "skjulte") return sheetSkjulte();
    if (t.dataset.sheet === "funksjoner") return sheetFunksjoner();
    if (t.dataset.sheet === "nytilgang") return sheetNyTilgang();
    if (t.dataset.sheet === "rapporter") return sheetRapportliste();
    if (t.dataset.sheet === "blokkerte") return sheetBlokkerte();
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
        toast("Klarte ikke lagre. Prøv igjen om litt.");
      }
      return;
    }

    if (m.id === "paaroerendePaa") {
      if (!m.checked && !await bekreft("Skru av? Alle pårørende-opplysningene som er samlet inn på turen, slettes.")) {
        m.checked = true; return;
      }
      try {
        await Api.settPaaroerende(S.trip.id, m.checked);
        S.trip.paaroerende = m.checked;
        await aapneDeltakere(true);
        toast(m.checked ? "Deltakerne blir bedt om nærmeste pårørende." : "Skrudd av. Opplysningene er slettet.");
      } catch (e) { m.checked = !m.checked; toast(e.message || "Klarte ikke lagre."); }
      return;
    }

    if (m.id === "krevGodkjenning") {
      try {
        await Api.setKrevGodkjenning(S.trip.id, m.checked);
        S.trip.krevGodkjenning = m.checked;
        toast(m.checked ? "Nye må nå godkjennes." : "Alle med koden slipper inn.");
      } catch {
        m.checked = !m.checked;
        toast("Klarte ikke lagre. Prøv igjen om litt.");
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

  $("sheetBg").addEventListener("click", e => { if (e.target.id === "sheetBg") forsokLukkArk(); });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".handlingsark-bg")) return;
    if (!$("sheetBg").hidden) return forsokLukkArk();
    if (lukkBilde()) return;
    if (S.side) return lukkSide();
    closeChat();
  });

  $("joinForm").addEventListener("submit", async e => {
    e.preventDefault();
    const first = storForbokstav($("fFirst").value), last = storForbokstav($("fLast").value);
    const err = $("joinErr"), btn = $("joinSubmit");
    const feil = navnFeil(first, last);
    if (feil) { err.textContent = feil; err.hidden = false; return; }
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
    return fane === "program" ? viewProgram()
         : fane === "chat" ? viewChat()
         : fane === "turen" ? viewTuren()
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

  /* ───────────────── toppen krymper når du blar ─────────────────
     Slik store titler i iOS gjør: øverst står turen med gruppa under.
     Blar du ned, blir tittelen mindre, gruppa glir bort, og streken
     under toppen kommer først når noe faktisk ligger under den. To
     terskler, så den ikke blafrer når du står og vipper rundt én. */
  var toppLiten = false;   // var: render() kan kalle sjekkTopp før denne linja har kjørt
  function sjekkTopp() {
    const y = $("screen").scrollTop;
    const ny = toppLiten ? y > 4 : y > 28;
    if (ny === toppLiten) return;
    toppLiten = ny;
    $("apphead").classList.toggle("liten", ny);
  }
  $("screen").addEventListener("scroll", sjekkTopp, { passive: true });

  /* Snur telefonen seg, eller kommer tastaturet opp, flytter øya seg —
     og da stemmer ikke plassen under lista lenger. */
  addEventListener("resize", () => { if (S.trip) maalOey(); });

  return { boot };
})();

UI.boot();
