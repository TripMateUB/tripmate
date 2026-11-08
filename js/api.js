/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* api.js — all kontakt med databasen.
   Ingen andre filer snakker med Supabase. Skjermene kaller bare herfra.

   Lokalt på enheten lagres tre ting: navnet ditt, hvilken tur du så sist,
   og en kopi av siste turdata så appen kan vises uten nett. Alt annet
   ligger i basen, og hva du får se der bestemmes av reglene i
   supabase/schema.sql — ikke av denne filen. */

const Api = (() => {

  let sb = null;                 // Supabase-klienten
  let userId = null;
  let liveSub = null;            // abonnement på nye meldinger
  let liveTrip = null;           // hvilken tur abonnementet gjelder
  let reaSub = null;             // abonnement på reaksjoner i én chat
  let reaKanal = null;
  const cache = { trip: null, messages: {}, recent: {}, reactions: {}, vaer: {}, mer: {}, varsel: null, paa: {} };
  const SIDE = 300;              // meldinger per bunke
  const listeners = new Set();

  const LS = {
    profile: "tk.profile",
    lastTrip: "tk.lastTrip",
    lastChannel: id => `tk.lastChannel.${id}`,
    snapshot: id => `tk.snapshot.${id}`,
    vaer: id => `tk.vaer.${id}`,
    lest: id => `tk.lest.${id}`,
    kart: "tk.kart"
  };

  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  /* ───────── datoformat ───────── */
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function fmtDay(date) {
    const d = new Date(date + "T12:00:00");
    return {
      chip: cap(d.toLocaleDateString("nb-NO", { weekday: "short" }).replace(".", "")),
      num: d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }).replace(".", ""),
      label: d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" })
    };
  }


  /* Perioden regnes ut av dagene i programmet, ikke av en tekst noen skrev
     en gang. Da kan den ikke bli stående og lyve når programmet endres. */
  function datoSpenn(fra, til) {
    if (!fra) return "";
    const d1 = new Date(fra + "T12:00:00"), d2 = new Date((til || fra) + "T12:00:00");
    const dag = d => d.toLocaleDateString("nb-NO", { day: "numeric" });
    const full = d => d.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
    if (fra === til) return full(d1);
    if (d1.getMonth() === d2.getMonth()) return `${dag(d1)}.–${full(d2)}`;
    return `${full(d1)} – ${full(d2)}`;
  }
  /* ───────── oppstart ───────── */
  async function init() {
    if (!CONFIG.ready) return { ok: false, reason: "mangler_config" };
    if (!window.supabase) return { ok: false, reason: "mangler_bibliotek" };

    sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    try {
      let { data } = await sb.auth.getSession();
      if (!data.session) {
        const res = await sb.auth.signInAnonymously();
        if (res.error) return { ok: false, reason: "innlogging_feilet", error: res.error.message };
        data = { session: res.data.session };
      }
      userId = data.session.user.id;
      // Brukeren ligger alt i økta. Før spurte vi serveren om den på
      // nytt her, og det kallet lå først i køen — alt annet i oppstarten
      // ventet på et svar vi allerede hadde.
      await lesInnlogging(data.session.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: "nettverk", error: String(e.message || e) };
    }
  }

  const online = () => Boolean(sb && userId);

  /* ───────── profil og sist brukte tur ───────── */
  function getProfile() { return lsGet(LS.profile, null); }
  function setProfile(first, last) {
    const p = {
      first: first.trim(), last: last.trim(),
      name: `${first.trim()} ${last.trim()}`.trim(),
      initials: ((first.trim()[0] || "") + (last.trim()[0] || "")).toUpperCase()
    };
    lsSet(LS.profile, p);
    return p;
  }
  const getLastTrip = () => lsGet(LS.lastTrip, null);
  const setLastTrip = id => lsSet(LS.lastTrip, id);
  const getLastChannel = tripId => lsGet(LS.lastChannel(tripId), null);
  const setLastChannel = (tripId, ch) => lsSet(LS.lastChannel(tripId), ch);

  /* ───────── turer ───────── */
  async function myTrips() {
    if (!online()) return [];
    const { data, error } = await sb
      .from("members")
      .select("role, trips ( id, code, name, org )")
      .eq("user_id", userId);
    if (error) throw error;

    const rader = (data || []).filter(r => r.trips);
    const ids = rader.map(r => r.trips.id);

    // Perioden hentes fra dagene, ikke fra et tekstfelt.
    const spenn = {};
    if (ids.length) {
      const { data: dager } = await sb.from("days").select("trip_id, date").in("trip_id", ids);
      for (const d of (dager || [])) {
        const s = spenn[d.trip_id] || (spenn[d.trip_id] = { fra: d.date, til: d.date });
        if (d.date < s.fra) s.fra = d.date;
        if (d.date > s.til) s.til = d.date;
      }
    }

    return rader.map(r => ({
      id: r.trips.id, code: r.trips.code, name: r.trips.name, org: r.trips.org,
      dates: spenn[r.trips.id] ? datoSpenn(spenn[r.trips.id].fra, spenn[r.trips.id].til) : "",
      role: r.role === "admin" ? "leader" : r.role
    }));
  }

  async function joinByCode(code, name) {
    const { data, error } = await sb.rpc("join_trip", { p_code: code, p_name: name });
    if (error) throw friendly(error);
    const t = Array.isArray(data) ? data[0] : data;
    return { id: t.id, code: t.code, name: t.name, org: t.org, dates: "" };
  }

  async function createTrip({ name, org, dates, leaderName }) {
    const { data, error } = await sb.rpc("create_trip", {
      p_name: name, p_org: org || "", p_dates: dates || "", p_leader_name: leaderName
    });
    if (error) throw friendly(error);
    const t = Array.isArray(data) ? data[0] : data;
    return { id: t.id, code: t.code, name: t.name, org: t.org, dates: "", role: "leader" };
  }

  function friendly(error) {
    const m = String(error.message || "");
    // «kjent» betyr at teksten er skrevet for å leses av folk, ikke av oss.
    const k = t => Object.assign(new Error(t), { kjent: true });
    if (m.includes("ukjent_kode")) return k("Fant ingen tur med den koden.");
    if (m.includes("mangler_navn")) return k("Navn mangler.");
    if (m.includes("for_mange_turer")) return k("Du har laget for mange turer.");
    if (m.includes("ikke_medlem")) return k("Du er ikke med på denne turen.");
    if (m.includes("ingen_tilgang")) return k("Du har ikke tilgang til denne chatten.");
    if (m.includes("ikke_paa_turen")) return k("Personen er ikke med på turen.");
    if (m.includes("ukjent_chat")) return k("Fant ikke chatten.");
    if (m.includes("ikke_leder")) return k("Bare reiseledere kan endre roller.");
    if (m.includes("eier_beholder_rollen")) return k("Den som laget turen beholder lederrollen.");
    if (m.includes("siste_leder")) return k("Turen må ha minst én reiseleder.");
    if (m.includes("ikke_deg_selv")) return k("Bruk «Meld deg av» for å gå ut selv.");
    if (m.includes("eier_kan_ikke_fjernes")) return k("Den som laget turen kan ikke fjernes.");
    if (m.includes("kan_ikke_endres")) return k("Denne deltakeren kan ikke endres herfra.");
    if (m.includes("fullt")) return k("Det er fullt — alle plassene er tatt.");
    if (m.includes("sete_tatt")) return k("Den plassen ble tatt av noen andre.");
    if (m.includes("ugyldig_sete")) return k("Det setet finnes ikke.");
    if (m.includes("ikke_paamelding")) return k("Dette punktet har ikke påmelding.");
    if (m.includes("ukjent_punkt")) return k("Fant ikke programpunktet.");
    if (m.includes("for_mange_meldinger")) return k("Du skriver fort. Vent et lite øyeblikk.");
    if (m.includes("for_mange_chatter")) return k("Du har laget mange chatter på denne turen. Rydd i dem først.");
    if (m.includes("ikke_innlogget")) return k("Appen fikk ikke kontakt med serveren. Prøv igjen.");
    return new Error(m || "Noe gikk galt.");
  }

  /* ───────── last hele turen ───────── */
  async function loadTrip(tripId) {
    if (!online()) return loadSnapshot(tripId);
    try {
      const [trip, member, places, days, items, channels] = await Promise.all([
        sb.from("trips").select("*").eq("id", tripId).single(),
        sb.from("members").select("role, name, status").eq("trip_id", tripId).eq("user_id", userId).single()
          .then(r => (r.error && /status/.test(r.error.message || ""))
            ? sb.from("members").select("role, name").eq("trip_id", tripId).eq("user_id", userId).single()
            : r),
        sb.from("places").select("*").eq("trip_id", tripId),
        sb.from("days").select("*").eq("trip_id", tripId).order("date"),
        sb.from("items").select("*").eq("trip_id", tripId),
        sb.from("channels").select("*").eq("trip_id", tripId).order("created_at")
      ]);
      // Ingen medlemsrad betyr at du ikke er med på turen lenger — enten
      // fjernet av en reiseleder, eller så meldte du deg av et annet sted.
      // Det er noe helt annet enn dårlig nett, og skal ikke ende med at
      // appen viser en gammel kopi som om alt var som før.
      if (member.error && member.error.code === "PGRST116") {
        glemTur(tripId);
        throw Object.assign(new Error("Du er ikke med på denne turen lenger."),
                            { kjent: true, utmeldt: true });
      }
      for (const r of [trip, member, places, days, items, channels]) if (r.error) throw r.error;

      const built = build(trip.data, member.data, places.data, days.data, items.data, channels.data);
      cache.trip = built;
      lsSet(LS.snapshot(tripId), built);
      return built;
    } catch (e) {
      if (e && e.utmeldt) throw e;
      const snap = loadSnapshot(tripId);
      if (snap) { snap.stale = true; return snap; }
      throw e;
    }
  }

  /* Slett det appen har liggende om en tur på denne enheten. Brukes når
     du ikke er med lenger — da skal ikke en kopi bli stående igjen. */
  function glemTur(tripId) {
    try {
      localStorage.removeItem(LS.snapshot(tripId));
      localStorage.removeItem(LS.lastChannel(tripId));
      localStorage.removeItem(LS.vaer(tripId));
      localStorage.removeItem(LS.lest(tripId));
      if (lsGet(LS.lastTrip, null) === tripId) localStorage.removeItem(LS.lastTrip);
    } catch { /* uviktig */ }
    if (cache.trip && cache.trip.id === tripId) cache.trip = null;
    if (liveTrip === tripId) kobleFra();
  }

  function loadSnapshot(tripId) {
    const snap = lsGet(LS.snapshot(tripId), null);
    if (snap) cache.trip = snap;
    return snap;
  }


  /* Rekkefølgen i heftet bærer mening når klokkeslettet mangler, så «sort»
     bestemmer. Faller den bort (gammel base), sorteres det på tid i stedet. */
  function rekkefolge(a, b) {
    const sa = a.sort, sb2 = b.sort;
    if (sa != null && sb2 != null && sa !== sb2) return sa - sb2;
    return (a.t || "99:99").localeCompare(b.t || "99:99");
  }
  function build(trip, member, places, days, items, channels) {
    const placeMap = {};
    for (const p of places) {
      const words = p.name.toLowerCase().split(/[\s,()]+/).filter(w => w.length > 3);
      placeMap[p.id] = {
        id: p.id, name: p.name, addr: p.addr, kind: p.kind, url: p.url || "",
        lat: p.lat == null ? null : p.lat, lon: p.lon == null ? null : p.lon,
        ignorer: p.ignore_position === true,
        alias: Array.from(new Set([p.name.toLowerCase(), ...words, ...(p.aliases || [])]))
      };
    }
    const byDay = {};
    for (const it of items) (byDay[it.day_id] = byDay[it.day_id] || []).push(it);

    return {
      id: trip.id, code: trip.code, name: trip.name, org: trip.org,
      krevGodkjenning: trip.require_approval === true,
      seter: trip.seter == null ? null : trip.seter,
      bilder: trip.bilder !== false,
      venter: member ? member.status === "pending" : false,
      dates: days.length ? datoSpenn(days[0].date, days[days.length - 1].date) : "",
      // "admin" er skjult: den gir samme rettigheter som reiseleder, men
      // staar ingen steder i grensesnittet.
      role: member && (member.role === "leader" || member.role === "admin") ? "leader" : "member",
      erAdmin: !!(member && member.role === "admin"),
      erEier: trip.created_by === userId,
      places: placeMap,
      days: days.map(d => Object.assign({
        id: d.id, date: d.date, hotel: d.hotel_place_id, ignorerHotell: d.ignore_hotel === true,
        items: (byDay[d.id] || []).sort(rekkefolge).map(i => ({
          id: i.id, t: i.t || "", title: i.title, place: i.place_id, note: i.note, src: i.src,
          paamelding: i.paamelding === true, plasser: i.plasser == null ? null : i.plasser,
          minutter: i.minutter == null ? null : i.minutter,
          paaChat: i.paa_chat || null,
          sort: (i.sort === undefined || i.sort === null) ? null : i.sort
        }))
      }, fmtDay(d.date))),
      channels: channels.map(c => ({
        id: c.id, name: c.name, sub: c.sub, private: c.private === true,
        min: c.created_by === userId          // du laget den, og kan slette den
      }))
    };
  }

  const currentTrip = () => cache.trip;
  const isLeader = () => Boolean(cache.trip && cache.trip.role === "leader");

  /* ───────── meldinger ───────── */
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function fire(hendelse) { listeners.forEach(f => { try { f(hendelse); } catch {} }); }

  function messages(channelId) { return cache.messages[channelId] || []; }

  /* Siste melding i hver chat — det chatlista viser under navnet. */
  function lastByChannel() { return cache.recent || {}; }

  /* ───────── uleste ─────────
     Hva du har sett, er det bare denne telefonen som vet — og det holder.
     Vi lagrer tidspunktet for den siste meldingen du hadde framme i hver
     chat, og sammenlikner med den nyeste som finnes. Ingenting av dette
     trenger å ligge i basen, og da slipper vi også at «lest» blir noe
     andre kan se. */
  const lest = {};

  function lestKart(tripId) {
    if (!lest[tripId]) lest[tripId] = lsGet(LS.lest(tripId), {});
    return lest[tripId];
  }

  function settLest(tripId, channelId, ts) {
    if (!tripId || !channelId || !ts) return;
    const k = lestKart(tripId);
    if (k[channelId] && k[channelId] >= ts) return;
    k[channelId] = ts;
    lsSet(LS.lest(tripId), k);
  }

  /* Egne meldinger teller aldri som uleste — du var jo der da du skrev. */
  function erUlest(tripId, channelId) {
    const siste = (cache.recent || {})[channelId];
    if (!siste || siste.mine) return false;
    const k = lestKart(tripId);
    return !k[channelId] || siste.ts > k[channelId];
  }

  function antallUleste(tripId) {
    if (!cache.trip || cache.trip.id !== tripId) return 0;
    return cache.trip.channels.filter(c => erUlest(tripId, c.id)).length;
  }

  async function loadRecent(tripId) {
    if (!online()) return lastByChannel();

    // Én rad per chat, rett fra basen. Den gamle måten — hent de 300
    // siste meldingene i turen og plukk ut den nyeste per chat — mistet
    // alle de rolige chattene så snart hovedchatten ble travel.
    const rpc = await sb.rpc("siste_meldinger", { p_trip: tripId });
    let data = rpc.data, error = rpc.error;

    if (error) {
      // Funksjonen er ikke lagt inn i basen enda: gjør det på gamlemåten.
      const gml = await sb
        .from("messages").select("channel_id, txt, author_name, created_at, author_id")
        .eq("trip_id", tripId).order("created_at", { ascending: false }).limit(300);
      data = gml.data; error = gml.error;
    }
    if (error) throw error;
    const map = {};
    for (const m of (data || [])) {
      if (!map[m.channel_id]) {
        map[m.channel_id] = { txt: m.txt, who: m.author_name, ts: m.created_at, mine: m.author_id === userId };
      }
    }
    cache.recent = map;
    return map;
  }

  async function loadMessages(tripId, channelId) {
    if (!online()) return messages(channelId);
    // De 300 SISTE meldingene, ikke de 300 første. Med «order(created_at)»
    // og en grense hentet appen de eldste, så en chat med mye trafikk
    // stoppet å vise nye meldinger etter at den passerte grensa.
    const [m, r] = await Promise.all([
      sb.from("messages").select("*").eq("channel_id", channelId)
        .order("created_at", { ascending: false }).limit(SIDE),
      sb.from("reactions").select("*").eq("channel_id", channelId)
    ]);
    if (m.error) throw m.error;
    cache.messages[channelId] = (m.data || []).reverse().map(shape);
    cache.reactions[channelId] = r.error ? [] : (r.data || []);
    // Kom det en full bunke, ligger det sannsynligvis mer bakenfor.
    cache.mer[channelId] = (m.data || []).length >= SIDE;
    return cache.messages[channelId];
  }

  const harEldre = channelId => Boolean(cache.mer[channelId]);

  /* Hent bunken før den eldste vi har. Chatten holder bare de nyeste 300
     i minnet; skal du lenger bak i turen, hentes de på forespørsel. */
  async function loadMoreMessages(channelId) {
    const liste = cache.messages[channelId] || [];
    if (!online() || !liste.length) return false;

    const { data, error } = await sb.from("messages").select("*")
      .eq("channel_id", channelId).lt("created_at", liste[0].ts)
      .order("created_at", { ascending: false }).limit(SIDE);
    if (error) throw error;

    const eldre = (data || []).reverse().map(shape);
    cache.messages[channelId] = eldre.concat(liste);
    cache.mer[channelId] = eldre.length >= SIDE;
    return eldre.length;
  }

  const shape = m => ({
    id: m.id, who: m.author_name, role: m.role, txt: m.txt,
    ts: m.created_at, action: m.action || null, mine: m.author_id === userId,
    replyTo: m.reply_to || null, bilde: m.bilde || null
  });

  /* ───────── reaksjoner ───────── */
  /* Samlet per melding: hvilken emoji, hvor mange, hvem — og om du selv
     har gitt den, så trykket kan slå den av igjen. */
  function reactions(channelId, messageId) {
    const alle = (cache.reactions[channelId] || []).filter(r => r.message_id === messageId);
    const grupper = {};
    for (const r of alle) {
      const g = grupper[r.emoji] || (grupper[r.emoji] = { emoji: r.emoji, navn: [], min: false });
      g.navn.push(r.name);
      if (r.user_id === userId) g.min = true;
    }
    return Object.values(grupper);
  }

  /* Én reaksjon per person: velger du en ny, erstatter den den forrige.
     Trykker du på den du alt har, fjernes den. */
  async function toggleReaction(channelId, messageId, emoji) {
    const p = getProfile();
    const liste = cache.reactions[channelId] || (cache.reactions[channelId] = []);
    const min = liste.find(r => r.message_id === messageId && r.user_id === userId);

    if (min && min.emoji === emoji) {
      liste.splice(liste.indexOf(min), 1);
      const { error } = await sb.from("reactions").delete()
        .eq("message_id", messageId).eq("user_id", userId);
      if (error) throw error;
      return;
    }

    const rad = {
      message_id: messageId, channel_id: channelId,
      name: p ? p.name : "Ukjent", emoji
    };
    if (min) min.emoji = emoji; else liste.push({ ...rad, user_id: userId });

    const { error } = await sb.from("reactions")
      .upsert(rad, { onConflict: "message_id,user_id" });
    if (error) {
      await lastReaksjoner(channelId);
      throw error;
    }
  }

  async function lastReaksjoner(channelId) {
    const { data, error } = await sb.from("reactions").select("*").eq("channel_id", channelId);
    if (!error) cache.reactions[channelId] = data || [];
  }

  /* Ett abonnement for hele turen, ikke ett per chat: da oppdateres både
     chatlista og den samtalen som står åpen. Radsikkerheten sørger for at
     vi bare får hendelser fra chatter vi har lov til å lese. */
  function subscribeTrip(tripId) {
    // openTrip() kjøres på nytt etter hver endring. Bygde vi abonnementet
    // opp igjen hver gang, ville meldinger som kom i det lille glippet
    // aldri dukket opp hos den som redigerer.
    if (liveSub && liveTrip === tripId) return;
    if (liveSub) { sb.removeChannel(liveSub); liveSub = null; }
    liveTrip = tripId;
    liveSub = sb.channel("tur-" + tripId)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `trip_id=eq.${tripId}` },
          payload => {
            const m = payload.new;
            const list = cache.messages[m.channel_id];
            if (list && !list.some(x => x.id === m.id)) {
              list.push(shape(m));
              list.sort((a, b) => a.ts.localeCompare(b.ts));
            }
            cache.recent = cache.recent || {};
            cache.recent[m.channel_id] = {
              txt: m.txt, who: m.author_name, ts: m.created_at, mine: m.author_id === userId
            };
            // Appen er framme, så telefonen får ikke noe varsel. Da må
            // appen selv si fra — herfra, ikke fra push.
            fire(m.author_id === userId ? null : {
              nyMelding: { tur: m.trip_id, kanal: m.channel_id, hvem: m.author_name, txt: m.txt }
            });
          })
      .on("postgres_changes",
          { event: "DELETE", schema: "public", table: "messages", filter: `trip_id=eq.${tripId}` },
          payload => {
            // En slettehendelse inneholder bare nøkkelen — ikke hvilken chat
            // meldingen lå i. Derfor leter vi i alle chattene vi har lastet.
            const id = payload.old && payload.old.id;
            if (!id) return;
            let endret = false;
            for (const list of Object.values(cache.messages)) {
              const i = list.findIndex(m => m.id === id);
              if (i > -1) { list.splice(i, 1); endret = true; }
            }
            if (endret) fire();
          })
      // Programmet kan endres mens folk har appen åpen. Da skal skjermen
      // følge med, ikke vise gårsdagens klokkeslett til noen lukker appen.
      .on("postgres_changes",
          { event: "*", schema: "public", table: "items", filter: `trip_id=eq.${tripId}` },
          programEndret)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "days", filter: `trip_id=eq.${tripId}` },
          programEndret)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "places", filter: `trip_id=eq.${tripId}` },
          programEndret)
      .subscribe();
  }

  /* Én endring i programmet kommer sjelden alene — drar du om på fem
     punkter, kommer det fem hendelser. Vi venter til det har roet seg,
     og henter turen én gang. */
  let programTimer = null;
  function programEndret() {
    clearTimeout(programTimer);
    programTimer = setTimeout(async () => {
      if (!liveTrip) return;
      try { await loadTrip(liveTrip); fire(); } catch { /* prøver igjen neste gang */ }
    }, 600);
  }

  /* Reaksjoner abonneres det på bare mens du har en samtale framme, og
     bare for den samtalen. Ellers ville hver eneste emoji i hele turen
     blitt sendt ut til alle hundre — og gratisnivået i Supabase tåler
     hundre meldinger i sekundet til sammen. */
  function subscribeChannel(channelId) {
    if (reaSub && reaKanal === channelId) return;
    unsubscribeChannel();
    reaKanal = channelId;
    reaSub = sb.channel("chat-" + channelId)
      .on("postgres_changes",
          { event: "*", schema: "public", table: "reactions", filter: `channel_id=eq.${channelId}` },
          nyttOmReaksjon)
      .subscribe();
  }

  function unsubscribeChannel() {
    if (reaSub) sb.removeChannel(reaSub);
    reaSub = null; reaKanal = null;
  }

  /* Ligger appen i lomma, trenger den ingen strøm av meldinger. En
     frakoblet telefon teller heller ikke som mottaker, så både
     tilkoblingene og meldingstallet går ned for hele turen. */
  function kobleFra() {
    clearTimeout(programTimer);
    unsubscribeChannel();
    if (liveSub) sb.removeChannel(liveSub);
    liveSub = null; liveTrip = null;
  }

  /* Reaksjoner endres i mellomlageret direkte, ikke ved å hente hele
     chatten på nytt. Med hundre påloggede ville hvert eneste trykk ellers
     ha utløst hundre nye spørringer mot basen — for én emoji.

     En slettehendelse inneholder bare nøkkelen (melding + person), og det
     er nok: raden fjernes der den ligger, uansett hvilken chat det er. */
  function nyttOmReaksjon(payload) {
    const ny = payload.new && payload.new.message_id ? payload.new : null;
    const gml = payload.old && payload.old.message_id ? payload.old : null;
    const noekkel = ny || gml;
    if (!noekkel) return;

    let endret = false;
    for (const [kanal, liste] of Object.entries(cache.reactions)) {
      const i = liste.findIndex(r =>
        r.message_id === noekkel.message_id && r.user_id === noekkel.user_id);
      if (i > -1) { liste.splice(i, 1); endret = true; }
      if (ny && ny.channel_id === kanal) { liste.push(ny); endret = true; }
    }
    // Reaksjon på en melding i en chat vi ikke har lastet: la den ligge.
    if (endret) fire();
  }

  async function sendMessage(tripId, channelId, txt, action, replyTo, bilde) {
    const p = getProfile();
    const row = {
      trip_id: tripId, channel_id: channelId, bilde: bilde || null,
      author_name: p ? p.name : "Ukjent",
      // En admin skriver som en vanlig deltaker. Sto det «Reiseleder» her,
      // ville den skjulte rollen røpe seg i første melding.
      role: isLeader() && !(cache.trip && cache.trip.erAdmin) ? "Reiseleder" : "",
      txt, action: action || null, reply_to: replyTo || null
    };
    let svar = await sb.from("messages").insert(row).select().single();
    // Er ikke svar-kolonnen lagt til enda, send meldingen som en vanlig en.
    if (svar.error && /reply_to/.test(svar.error.message || "")) {
      const { reply_to, ...utenSvar } = row;
      svar = await sb.from("messages").insert(utenSvar).select().single();
    }
    // Er ikke bildekolonnen lagt til enda, send teksten uten den.
    if (svar.error && /bilde/.test(svar.error.message || "")) {
      const { bilde: _, ...utenBilde } = row;
      svar = await sb.from("messages").insert(utenBilde).select().single();
    }
    if (svar.error) throw friendly(svar.error);
    const data = svar.data;
    const list = cache.messages[channelId] || (cache.messages[channelId] = []);
    if (!list.some(m => m.id === data.id)) { list.push(shape(data)); }
    cache.recent[channelId] = { txt: data.txt, who: data.author_name, ts: data.created_at, mine: true };
    varsleOmMelding(data.id);
    return data.id;
  }

  /* ───────── varsler ─────────
     Selve sendingen skjer på serveren: den hemmelige nøkkelen kan ikke
     ligge i en nettside, og én deltaker skal ikke kunne se hvem andre som
     varsles. Herfra sier vi bare fra at det kom en melding. */
  async function varsleOmMelding(messageId) {
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      await fetch(CONFIG.supabaseUrl + "/functions/v1/varsle", {
        method: "POST",
        keepalive: true,             // rekker fram selv om du lukker appen
        headers: {
          "Authorization": "Bearer " + data.session.access_token,
          "apikey": CONFIG.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messageId })
      });
    } catch { /* uten varsel er meldingen like fullt sendt */ }
  }

  /* Serverfunksjoner sover mellom hver gang de brukes, og å våkne tar
     sekunder. Åpner du en chat, vekker vi den med en tom forespørsel —
     da er den i gang lenge før du er ferdig med å skrive. */
  let sistVekket = 0;
  function varmVarsler() {
    if (!CONFIG.ready) return;
    const naa = Date.now();
    if (naa - sistVekket < 60000) return;      // én gang i minuttet holder
    sistVekket = naa;
    fetch(CONFIG.supabaseUrl + "/functions/v1/varsle", {
      method: "OPTIONS", headers: { "apikey": CONFIG.supabaseAnonKey }
    }).catch(() => {});
  }

  /* Serveren må vite om du sitter med appen framme, ellers kan den ikke
     la være å sende varselet — og iPhone viser et varsel uansett hva
     appen sier når det først har kommet fram. Raden er din egen; ingen
     andre kan lese den. */
  let herTimer = null;
  let herNaa = { trip: null, chat: null };

  function erHer(tripId, channelId) {
    herNaa = { trip: tripId || null, chat: channelId || null };
    if (!online() || !tripId) return;
    sb.rpc("jeg_er_her", { p_trip: tripId, p_channel: channelId || null }).then(() => {}, () => {});

    clearTimeout(herTimer);
    // Serveren regner deg som borte etter halvannet minutt, så vi sier
    // fra litt oftere enn det så lenge appen er framme.
    herTimer = setTimeout(() => {
      if (document.visibilityState === "visible" && herNaa.trip) erHer(herNaa.trip, herNaa.chat);
    }, 45000);
  }

  function ikkeHer() {
    clearTimeout(herTimer);
    herTimer = null;
    if (!online() || !herNaa.trip) return;
    // Sett tidsstempelet tilbake, så serveren ser at du har gått.
    sb.from("tilstede").delete().eq("user_id", userId).then(() => {}, () => {});
  }

  /* Endrer reiselederen programmet for i dag, skal folk få vite det.
     Serveren avgjør om datoen er i dag — den har riktig klokke. */
  let programVarselTimer = null;
  function varsleOmProgram(tripId, dato) {
    if (!dato) return;
    clearTimeout(programVarselTimer);
    // Drar man om på fem punkter, er det én endring, ikke fem varsler.
    programVarselTimer = setTimeout(async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!data.session) return;
        await fetch(CONFIG.supabaseUrl + "/functions/v1/varsle", {
          method: "POST", keepalive: true,
          headers: {
            "Authorization": "Bearer " + data.session.access_token,
            "apikey": CONFIG.supabaseAnonKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ program: { tripId, dato } })
        });
      } catch { /* programmet er endret uansett */ }
    }, 12000);
  }

  const kanVarsle = () =>
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  /* «umulig» — nettleseren kan det ikke (iPhone i Safari uten å ha lagt
     appen på hjemskjermen), «avslaatt» — du har sagt nei én gang og må
     snu det i innstillingene, ellers av eller på. */
  async function varselStatus() {
    if (!kanVarsle()) return "umulig";
    if (Notification.permission === "denied") return "avslaatt";
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      return sub ? "paa" : "av";
    } catch { return "umulig"; }
  }

  function tilBytes(b64) {
    const pad = "=".repeat((4 - b64.length % 4) % 4);
    const raa = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raa, c => c.charCodeAt(0));
  }

  async function slaaPaaVarsler() {
    if (!kanVarsle()) throw new Error("Denne nettleseren kan ikke vise varsler.");
    if (!CONFIG.vapidPublicKey) throw new Error("Varsler er ikke satt opp ennå.");

    const lov = await Notification.requestPermission();
    if (lov !== "granted") throw new Error("Du må si ja til varsler for at de skal virke.");

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: tilBytes(CONFIG.vapidPublicKey)
      });
    }
    const j = sub.toJSON();
    const { error } = await sb.rpc("lagre_push", {
      p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth
    });
    if (error) throw friendly(error);
  }

  async function slaaAvVarsler() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const { endpoint } = sub.toJSON();
    await sub.unsubscribe().catch(() => {});
    await sb.from("push_subs").delete().eq("endpoint", endpoint);
  }

  /* Hvilke enheter denne kontoen har påmeldt. Radsikkerheten gjør at du
     bare ser dine egne — nyttig for å se om påmeldingen faktisk kom fram. */
  async function varselEnheter() {
    const { data, error } = await sb.from("push_subs").select("endpoint").eq("user_id", userId);
    if (error) throw error;
    return (data || []).map(r => r.endpoint);
  }

  /* Testvarsel til dine egne enheter, hele veien om serveren. Svaret
     sier hvor det eventuelt stopper. */
  async function testVarsel() {
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error("Du er ikke innlogget.");
    const start = Date.now();
    const res = await fetch(CONFIG.supabaseUrl + "/functions/v1/varsle", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + data.session.access_token,
        "apikey": CONFIG.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ test: true })
    });
    let svar = null;
    try { svar = await res.json(); } catch { /* tomt svar */ }
    if (!res.ok) {
      throw Object.assign(
        new Error((svar && svar.feil) || `Serveren svarte ${res.status}. Er «varsle» deployet?`),
        { kjent: true }
      );
    }
    // Hele kallet sett fra telefonen. Sammenliknet med tiden funksjonen
    // selv målte, viser det hvor mye som går med til oppstart.
    return Object.assign(svar || {}, { totalt: Date.now() - start });
  }

  /* Nivåene ligger i basen, ikke på telefonen: bytter du telefon, skal
     du slippe å sette alt på nytt. Ingen rad betyr «viktig». */
  async function lastVarselvalg(tripId) {
    const { data, error } = await sb.from("varselvalg")
      .select("channel_id, niva").eq("trip_id", tripId);
    if (error) return (cache.varsel = {});
    const m = { tur: "viktig", chat: {} };
    for (const r of (data || [])) {
      if (r.channel_id) m.chat[r.channel_id] = r.niva; else m.tur = r.niva;
    }
    cache.varsel = m;
    return m;
  }

  const varselvalg = () => cache.varsel || { tur: "viktig", chat: {} };

  const varselNiva = channelId => {
    const v = varselvalg();
    return (channelId && v.chat[channelId]) || v.tur;
  };

  async function settVarselNiva(tripId, channelId, niva) {
    const { error } = await sb.rpc("sett_varselniva", {
      p_trip: tripId, p_channel: channelId || null, p_niva: niva
    });
    if (error) throw friendly(error);
    const v = varselvalg();
    if (channelId) {
      if (niva === "folg") delete v.chat[channelId]; else v.chat[channelId] = niva;
    } else v.tur = niva === "folg" ? "viktig" : niva;
    cache.varsel = v;
  }

  /* ───────── bilder ─────────
     Et mobilbilde er tre–fem megabyte. Sendt rått ville hundre elever
     fylt lagringen på en tur, og bildene ville tatt evigheter å laste på
     utenlandsk mobilnett. Vi krymper til noe som ser likt ut i en chat. */
  const MAKS_KANT = 1280;

  function krymp(fil) {
    return new Promise((ok, feil) => {
      const url = URL.createObjectURL(fil);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const skala = Math.min(1, MAKS_KANT / Math.max(img.width, img.height));
        const b = Math.round(img.width * skala), h = Math.round(img.height * skala);

        const lerret = document.createElement("canvas");
        lerret.width = b; lerret.height = h;
        lerret.getContext("2d").drawImage(img, 0, 0, b, h);
        lerret.toBlob(
          blob => blob ? ok(blob) : feil(new Error("Klarte ikke lese bildet.")),
          "image/jpeg", 0.72
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); feil(new Error("Klarte ikke lese bildet.")); };
      img.src = url;
    });
  }

  /* Stien forteller hvor bildet hører hjemme, og det er den reglene i
     basen leser: <tur>/<chat>/<fil>. */
  async function lastOppBilde(tripId, channelId, fil) {
    if (!/^image\//.test(fil.type)) throw Object.assign(new Error("Velg et bilde."), { kjent: true });
    const blob = await krymp(fil);
    const navn = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const sti = `${tripId}/${channelId}/${navn}`;

    const { error } = await sb.storage.from("bilder")
      .upload(sti, blob, { contentType: "image/jpeg", upsert: false });
    if (error) {
      if (/row-level security|violates/i.test(error.message || "")) {
        throw Object.assign(new Error("Bilder er slått av for denne turen."), { kjent: true });
      }
      throw friendly(error);
    }
    return sti;
  }

  /* Lageret er lukket, så hvert bilde trenger en signert adresse. De
     varer en time og hentes for mange om gangen — ett kall per bilde i en
     lang samtale ville blitt hundre kall. */
  const bildeUrler = new Map();

  async function bildeUrl(stier) {
    const mangler = stier.filter(s => s && !bildeUrler.has(s));
    if (mangler.length) {
      const { data } = await sb.storage.from("bilder").createSignedUrls(mangler, 3600);
      for (const r of (data || [])) {
        if (r.signedUrl) bildeUrler.set(r.path, r.signedUrl);
      }
      if (data) fire();
    }
    return bildeUrler;
  }

  const bildeAdresse = sti => bildeUrler.get(sti) || null;

  /* Filen slettes fra lageret, og meldingen slutter å peke på den. Var det
     et bilde uten tekst, forsvinner hele meldingen — en tom boble er ingen
     å ha. Begge deler gjøres på serveren, slik at det skjer for alle. */
  async function slettBilde(sti) {
    const { error } = await sb.storage.from("bilder").remove([sti]);
    if (error) throw friendly(error);
    bildeUrler.delete(sti);
    await sb.rpc("fjern_bilde", { p_sti: sti });
    for (const liste of Object.values(cache.messages)) {
      for (let i = liste.length - 1; i >= 0; i--) {
        if (liste[i].bilde !== sti) continue;
        if (liste[i].txt) liste[i].bilde = null;
        else liste.splice(i, 1);
      }
    }
  }

  /* Bilder fra en klassetur er personopplysninger om mindreårige, og skal
     ikke bli liggende i årevis fordi ingen husket å rydde. Serveren
     sletter dem tretti dager etter siste programdag; appen minner den på
     det én gang i døgnet. */
  async function ryddGamleBilder() {
    const sist = lsGet("tk.ryddet", 0);
    if (Date.now() - sist < 86400000) return;
    lsSet("tk.ryddet", Date.now());
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      await fetch(CONFIG.supabaseUrl + "/functions/v1/rydd", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + data.session.access_token,
          "apikey": CONFIG.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: "{}"
      });
    } catch { /* ryddes neste gang */ }
  }

  /* Teksten under et bilde er sin egen ting, og kan fjernes for seg. Er
     det ikke noe bilde, er teksten hele meldingen — da forsvinner den. */
  async function slettTekst(id, channelId) {
    const { error } = await sb.rpc("fjern_tekst", { p_id: id });
    if (error) throw friendly(error);
    const liste = cache.messages[channelId];
    if (!liste) return;
    const i = liste.findIndex(m => m.id === id);
    if (i < 0) return;
    if (liste[i].bilde) liste[i].txt = "";
    else liste.splice(i, 1);
  }

  async function setBilderPaa(tripId, paa) {
    const { error } = await sb.from("trips").update({ bilder: !!paa }).eq("id", tripId);
    if (error) throw friendly(error);
    if (cache.trip && cache.trip.id === tripId) cache.trip.bilder = !!paa;
  }

  async function deleteMessage(id, channelId) {
    const { error } = await sb.from("messages").delete().eq("id", id);
    if (error) throw error;
    const list = cache.messages[channelId];
    if (list) {
      const i = list.findIndex(m => m.id === id);
      if (i > -1) list.splice(i, 1);
    }
  }

  /* Navn og klasse på turen. Turkoden og eierskapet er det en regel i
     basen som passer på — de skal ikke gå an å endre herfra. */
  async function updateTrip(tripId, { name, org }) {
    const rad = {};
    if (name !== undefined) rad.name = String(name).trim();
    if (org !== undefined) rad.org = String(org).trim();
    if (!Object.keys(rad).length) return;

    const { error } = await sb.from("trips").update(rad).eq("id", tripId);
    if (error) throw friendly(error);
    if (cache.trip && cache.trip.id === tripId) Object.assign(cache.trip, rad);
  }

  /* Flytt hele turen til en ny startdato. Dagene beholder avstanden seg
     imellom, og punktene følger dagen sin. */
  async function flyttTur(tripId, nyStart) {
    const { error } = await sb.rpc("flytt_tur", { p_trip: tripId, p_ny_start: nyStart });
    if (error) throw friendly(error);
  }

  /* Hvor mange venter på å bli sluppet inn? Et tall, ikke en liste —
     det er alt Meg-fanen trenger for å sette en prikk. */
  async function antallVentende(tripId) {
    const { data, error } = await sb.from("members")
      .select("user_id").eq("trip_id", tripId).eq("status", "pending");
    if (error) return 0;
    return (data || []).length;
  }

  /* Hvilken kartapp du vil bruke. Et valg som hører til enheten, ikke
     kontoen: du har ikke nødvendigvis samme kart på PC-en og telefonen. */
  const ANDROID = /android/i.test(navigator.userAgent);
  const APPLE = /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);

  function kartValg() {
    const v = lsGet(LS.kart, null);
    if (v === "google" || v === "apple") return v;
    return APPLE && !ANDROID ? "apple" : "google";   // det telefonen har fra før
  }
  const settKartValg = v => lsSet(LS.kart, v);

  /* Hvordan dere kommer dere dit. På en klassetur går dere stort sett de
     siste hundre meterne fra bussen, så det er til fots som er svaret
     oftest — ikke tog, og ikke bil ingen av dere har. */
  function reisemaate() {
    const v = lsGet("tk.reise", null);
    return v === "kollektiv" || v === "bil" ? v : "fots";
  }
  const settReisemaate = v => lsSet("tk.reise", v);

  /* Hvem som får døpe om en chat, avgjøres i basen: en åpen chat hører
     til reiselederen eller den som laget den, en privat til dem som er
     med i den. */
  async function doppChat(channelId, navn) {
    const { error } = await sb.rpc("dopp_chat", { p_channel: channelId, p_navn: navn });
    if (error) throw friendly(error);
    const c = cache.trip && cache.trip.channels.find(x => x.id === channelId);
    if (c) c.name = String(navn).trim().slice(0, 60);
  }

  /* ───────── chatter ───────── */
  async function addChannel(tripId, name, sub, isPrivate, memberIds) {
    const { data, error } = await sb.rpc("create_channel", {
      p_trip: tripId, p_name: name, p_sub: sub || "",
      p_private: Boolean(isPrivate), p_members: memberIds || []
    });
    if (error) throw friendly(error);
    const c = Array.isArray(data) ? data[0] : data;
    if (cache.trip) cache.trip.channels.push({ id: c.id, name: c.name, sub: c.sub, private: c.private });
    return c.id;
  }

  /* Slett en chat med alt som står i den. Basen avgjør hvem som får:
     den som laget chatten, eller en reiseleder når chatten er åpen. */
  async function deleteChannel(channelId) {
    const { error } = await sb.from("channels").delete().eq("id", channelId);
    if (error) throw friendly(error);

    const { data } = await sb.from("channels").select("id").eq("id", channelId).maybeSingle();
    if (data) throw Object.assign(new Error("Du kan ikke slette denne chatten."), { kjent: true });

    if (cache.trip) cache.trip.channels = cache.trip.channels.filter(c => c.id !== channelId);
    delete cache.messages[channelId];
    delete cache.recent[channelId];
  }

  /* Hvem er med på turen — grunnlaget for å plukke deltakere til en chat. */
  async function tripMembers(tripId) {
    const { data, error } = await sb.from("members")
      .select("user_id, name, role, status").eq("trip_id", tripId).order("name");
    if (error && /status/.test(error.message || "")) {
      // Godkjenning er ikke lagt til i basen enda.
      const p = await sb.from("members").select("user_id, name, role").eq("trip_id", tripId).order("name");
      if (p.error) throw p.error;
      return (p.data || []).map(m => ({
        id: m.user_id, name: m.name,
        role: m.role === "admin" ? "member" : m.role,
        skjult: m.role === "admin",
        venter: false, me: m.user_id === userId
      }));
    }
    if (error) throw error;
    return (data || []).map(m => ({
      id: m.user_id, name: m.name,
      role: m.role === "admin" ? "member" : m.role,   // admin vises ikke
      skjult: m.role === "admin",
      venter: m.status === "pending", me: m.user_id === userId
    }));
  }

  async function channelMembers(channelId) {
    const { data, error } = await sb.from("channel_members")
      .select("user_id").eq("channel_id", channelId);
    if (error) throw error;
    return (data || []).map(r => r.user_id);
  }

  async function addChannelMember(channelId, personId) {
    const { error } = await sb.rpc("add_channel_member", { p_channel: channelId, p_user: personId });
    if (error) throw friendly(error);
  }

  /* Uten personId går du ut selv. */
  async function removeChannelMember(channelId, personId) {
    const { error } = await sb.from("channel_members").delete()
      .eq("channel_id", channelId).eq("user_id", personId || userId);
    if (error) throw error;
  }

  /* ───────── program (kun reiseleder) ───────── */

  /* ───────── godkjenning for å bli med ───────── */
  async function setKrevGodkjenning(tripId, paa) {
    const { error } = await sb.from("trips").update({ require_approval: !!paa }).eq("id", tripId);
    if (error) throw error;
    if (cache.trip) cache.trip.krevGodkjenning = !!paa;
  }

  async function godkjennDeltaker(tripId, personId) {
    const { error } = await sb.rpc("set_member_status", {
      p_trip: tripId, p_user: personId, p_status: "approved"
    });
    if (error) throw friendly(error);
  }

  async function avvisDeltaker(tripId, personId) {
    const { error } = await sb.rpc("avvis_deltaker", { p_trip: tripId, p_user: personId });
    if (error) throw friendly(error);
  }

  async function fjernDeltaker(tripId, personId) {
    const { error } = await sb.rpc("fjern_deltaker", { p_trip: tripId, p_user: personId });
    if (error) throw friendly(error);
  }
  async function addPlace(tripId, { name, addr, kind, url, lat, lon }) {
    const { data, error } = await sb.from("places")
      .insert({ trip_id: tripId, name, addr: addr || "", kind: kind || "Sted", url: url || "",
               lat: lat == null ? null : lat, lon: lon == null ? null : lon }).select().single();
    if (error) throw error;
    cache.vaerUtdatert = true;      // nytt sted trenger et oppslag
    return data.id;
  }


  /* Kryss av for at noe ikke trengs — for eksempel adressen til et sted
     gruppen kjøres til med buss. Skjuler bare oppgaven, sletter ingenting. */
  async function setIgnorer(hva, id, verdi) {
    const tabell = hva === "place" ? "places" : "days";
    const felt = hva === "place" ? "ignore_position" : "ignore_hotel";
    const { error } = await sb.from(tabell).update({ [felt]: verdi }).eq("id", id);
    if (error) throw error;
  }
  /* Hvilken dag hører denne endringen til? Trengs for å vite om den
     angår i dag — det er bare da folk skal vekkes av den. */
  const datoForDag = dayId => {
    const d = cache.trip && cache.trip.days.find(x => x.id === dayId);
    return d ? d.date : null;
  };
  const datoForPunkt = itemId => {
    const d = cache.trip && cache.trip.days.find(x => x.items.some(i => i.id === itemId));
    return d ? d.date : null;
  };

  async function addDay(tripId, date) {
    const { data, error } = await sb.from("days")
      .insert({ trip_id: tripId, date }).select().single();
    if (error) throw error;
    varsleOmProgram(tripId, date);
    return data.id;
  }

  async function setHotel(dayId, placeId) {
    const { error } = await sb.from("days").update({ hotel_place_id: placeId }).eq("id", dayId);
    if (error) throw error;
  }

  async function addItem(tripId, dayId, { t, title, placeId, note, sort, minutter }) {
    const rad = {
      trip_id: tripId, day_id: dayId, t: t || null, title,
      place_id: placeId || null, note: note || ""
    };
    if (minutter) rad.minutter = minutter;
    let svar = await sb.from("items").insert({ ...rad, sort: sort || 0 }).select().single();
    // Mangler varighetskolonnen enda, legges punktet inn uten den.
    if (svar.error && /minutter/.test(svar.error.message || "")) {
      delete rad.minutter;
      svar = await sb.from("items").insert({ ...rad, sort: sort || 0 }).select().single();
    }
    // Er ikke rekkefolge-kolonnen lagt til enda, legg inn punktet uten den.
    if (svar.error && /sort/.test(svar.error.message || "")) {
      svar = await sb.from("items").insert(rad).select().single();
    }
    if (svar.error) throw svar.error;
    varsleOmProgram(tripId, datoForDag(dayId));
    return svar.data.id;
  }

  /* ───────── pakkeliste og sitteplasser ─────────
     Begge hentes når siden åpnes, ikke ved oppstart. De hører til et
     sted man går inn i, og skal ikke koste noe for dem som aldri gjør
     det. Tallene til «Meg» er tre tellinger, ikke tre lister. */
  async function pakkeliste(tripId) {
    const [punkter, kryss] = await Promise.all([
      sb.from("pakk").select("id, txt, sort").eq("trip_id", tripId).order("sort"),
      sb.from("pakk_kryss").select("pakk_id")
    ]);
    if (punkter.error) throw friendly(punkter.error);
    // Radsikkerheten gjør at kryssene du får er dine egne, ingen andres.
    const mine = new Set((kryss.data || []).map(r => r.pakk_id));
    return (punkter.data || []).map(p => ({ id: p.id, txt: p.txt, sort: p.sort, kryss: mine.has(p.id) }));
  }

  async function kryssPakk(pakkId, paa) {
    const { error } = paa
      ? await sb.from("pakk_kryss").insert({ pakk_id: pakkId, user_id: userId })
      : await sb.from("pakk_kryss").delete().eq("pakk_id", pakkId).eq("user_id", userId);
    if (error) throw friendly(error);
  }

  async function nyttPakkPunkt(tripId, txt, sort) {
    const { error } = await sb.from("pakk").insert({ trip_id: tripId, txt, sort });
    if (error) throw friendly(error);
  }

  async function slettPakkPunkt(id) {
    const { error } = await sb.from("pakk").delete().eq("id", id);
    if (error) throw friendly(error);
  }

  /* Hvem som sitter hvor. Navn henter vi ikke: kartet skal vise ledig,
     tatt og din egen plass, og det er det det brukes til. */
  async function seter(tripId) {
    const { data, error } = await sb.from("seter").select("nr, user_id").eq("trip_id", tripId);
    if (error) throw friendly(error);
    return (data || []).map(r => ({ nr: r.nr, meg: r.user_id === userId }));
  }

  /* Gjennom basen, ikke gjennom appen: to som trykker på samme sete
     innenfor samme sekund skal ikke begge få det. */
  async function taSete(tripId, nr) {
    const { error } = await sb.rpc("ta_sete", { p_trip: tripId, p_nr: nr });
    if (error) throw friendly(error);
  }

  async function slippSete(tripId) {
    const { error } = await sb.from("seter").delete().eq("trip_id", tripId).eq("user_id", userId);
    if (error) throw friendly(error);
  }

  async function settSeteantall(tripId, antall) {
    const { error } = await sb.from("trips").update({ seter: antall }).eq("id", tripId);
    if (error) throw friendly(error);
  }

  /* Tallene «Meg» viser. Feiler de — for eksempel fordi tabellene ikke
     finnes ennå — skal fana vise seg likevel, bare uten tall. */
  async function megTall(tripId) {
    if (!online()) return null;
    const [p, k, s2] = await Promise.all([
      sb.from("pakk").select("id", { count: "exact", head: true }).eq("trip_id", tripId),
      sb.from("pakk_kryss").select("pakk_id, pakk!inner(trip_id)", { count: "exact", head: true })
        .eq("pakk.trip_id", tripId),
      sb.from("seter").select("nr").eq("trip_id", tripId).eq("user_id", userId).maybeSingle()
    ]);
    return {
      pakkTotalt: p.count || 0,
      pakkKrysset: k.count || 0,
      mittSete: s2.data ? s2.data.nr : null
    };
  }

  /* ───────── påmelding ─────────
     Hvem som har meldt seg på hva. Hentes for hele turen på én gang —
     programlista skal kunne vise «6 av 20» uten å spørre per punkt. */
  async function lastPaameldinger(tripId) {
    if (!online()) return;
    const { data, error } = await sb.from("paameldinger")
      .select("item_id, user_id, name, items!inner(trip_id)")
      .eq("items.trip_id", tripId);
    if (error) { cache.paa = {}; return; }

    const kart = {};
    for (const r of (data || [])) {
      (kart[r.item_id] = kart[r.item_id] || []).push({
        id: r.user_id, navn: r.name, meg: r.user_id === userId
      });
    }
    cache.paa = kart;
    fire();
  }

  const paameldte = itemId => (cache.paa || {})[itemId] || [];

  async function meldPaa(itemId) {
    const p = getProfile();
    const { error } = await sb.rpc("meld_paa", {
      p_item: itemId, p_navn: p ? p.name : "Deltaker"
    });
    if (error) throw friendly(error);
  }

  async function meldAv(itemId) {
    const { error } = await sb.rpc("meld_av", { p_item: itemId });
    if (error) throw friendly(error);
  }

  /* Endre et punkt som allerede ligger inne: tid, tittel, sted eller notat. */
  async function updateItem(id, felter) {
    const rad = {};
    if ("t" in felter) rad.t = felter.t || null;
    if ("title" in felter) rad.title = felter.title;
    if ("placeId" in felter) rad.place_id = felter.placeId || null;
    if ("note" in felter) rad.note = felter.note || "";
    if ("sort" in felter) rad.sort = felter.sort;
    if ("minutter" in felter) rad.minutter = felter.minutter || null;
    if ("paamelding" in felter) rad.paamelding = !!felter.paamelding;
    if ("plasser" in felter) rad.plasser = felter.plasser === "" || felter.plasser == null ? null : Number(felter.plasser);
    if ("paaChat" in felter) rad.paa_chat = felter.paaChat || null;
    const dato = datoForPunkt(id);
    const { error } = await sb.from("items").update(rad).eq("id", id);
    if (error) throw error;
    if (cache.trip) varsleOmProgram(cache.trip.id, dato);
  }

  /* Gi eller ta lederrollen. Reglene ligger i basen, ikke her. */
  async function setMemberRole(tripId, personId, rolle) {
    const { error } = await sb.rpc("set_member_role", {
      p_trip: tripId, p_user: personId, p_role: rolle
    });
    if (error) throw friendly(error);
  }

  /* Endre et sted — for eksempel legge inn adressen som manglet i heftet. */
  async function updatePlace(id, felter) {
    const rad = {};
    if ("name" in felter) rad.name = felter.name;
    if ("addr" in felter) rad.addr = felter.addr;
    if ("kind" in felter) rad.kind = felter.kind;
    const { error } = await sb.from("places").update(rad).eq("id", id);
    if (error) throw error;
    if ("addr" in felter) cache.vaerUtdatert = true;   // ny adresse, nytt oppslag
  }

  async function deleteItem(id) {
    const dato = datoForPunkt(id);
    const { error } = await sb.from("items").delete().eq("id", id);
    if (error) throw error;
    if (cache.trip) varsleOmProgram(cache.trip.id, dato);
  }

  async function deleteDay(id) {
    const { error } = await sb.from("days").delete().eq("id", id);
    if (error) throw error;
  }

  async function deleteTrip(tripId) {
    const { error } = await sb.from("trips").delete().eq("id", tripId);
    if (error) throw error;
    // Uten sletteregelen i basen svarer API-et med suksess uten aa slette noe.
    // Sjekk derfor at raden faktisk er borte for vi melder at det gikk bra.
    const { data } = await sb.from("trips").select("id").eq("id", tripId).maybeSingle();
    if (data) throw new Error("Databasen tillot ikke sletting. Kjor supabase/schema.sql i Supabase paa nytt.");
    try { localStorage.removeItem(LS.snapshot(tripId)); } catch {}
  }

  async function leaveTrip(tripId) {
    const { error } = await sb.from("members").delete().eq("trip_id", tripId).eq("user_id", userId);
    if (error) throw error;
    try { localStorage.removeItem(LS.snapshot(tripId)); } catch {}
  }

  /* ───────── fyll en tur fra en mal ───────── */
  async function applyTemplate(tripId, tpl, dates) {
    const ids = {};
    for (const [key, p] of Object.entries(tpl.places)) {
      ids[key] = await addPlace(tripId, { name: p.name, addr: p.addr, kind: p.kind, lat: p.lat, lon: p.lon });
    }
    for (let n = 0; n < tpl.days.length; n++) {
      const d = tpl.days[n];
      const dayId = await addDay(tripId, dates[n]);
      if (d.hotel && ids[d.hotel]) await setHotel(dayId, ids[d.hotel]);
      for (const it of d.items) {
        await addItem(tripId, dayId, {
          t: it.t, title: it.title,
          placeId: it.place ? ids[it.place] : null,
          note: it.note || "", minutter: it.minutter || null
        });
      }
    }
    for (const c of (tpl.channels || [])) {
      await addChannel(tripId, c.name, c.sub, false, []);
    }
  }

  /* ───────── les program fra PDF ───────── */
  /* Selve modellkallet skjer på serveren; her sender vi bare filene dit
     og får et forslag tilbake. Ingenting lagres før brukeren godkjenner. */
  async function lesProgramFraPdf(tripId, filer) {
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error("Du er ikke innlogget.");

    const res = await fetch(CONFIG.supabaseUrl + "/functions/v1/les-program", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + data.session.access_token,
        "apikey": CONFIG.supabaseAnonKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tripId, filer })
    });

    let svar = null;
    try { svar = await res.json(); } catch { /* tomt svar */ }
    if (!res.ok) throw new Error((svar && svar.feil) || "Klarte ikke lese filen.");
    return svar;
  }


  /* ───────── vær ───────── */
  /* Serveren henter fra Yr og mellomlagrer. Feiler det, viser appen
     ingenting — heller ingen værmelding enn feil værmelding. */
  function vaerFor(placeId) { return cache.vaer[placeId] || null; }

  /* Værmeldingen hentes ikke på nytt hver gang appen tegner en tur.
     openTrip() kjøres etter hver eneste endring, og med hundre deltakere
     på samme tur ville det blitt hundrevis av kall til Yr i timen — både
     unødvendig og i strid med det Yr og Nominatim ber om. Svaret ligger
     derfor en halvtime, og hentes før det bare når et sted er endret. */
  const VAER_FERSK_MIN = 30;

  async function lastVaer(tripId, tving) {
    if (!online()) return;

    const lagret = lsGet(LS.vaer(tripId), null);
    if (lagret && lagret.vaer && !Object.keys(cache.vaer).length) {
      cache.vaer = lagret.vaer;                     // vis noe med én gang
      fire();
    }
    const alder = lagret && lagret.ts ? (Date.now() - lagret.ts) / 60000 : Infinity;
    if (!tving && !cache.vaerUtdatert && alder < VAER_FERSK_MIN &&
        lagret && lagret.vaer && Object.keys(lagret.vaer).length) return;

    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      const res = await fetch(CONFIG.supabaseUrl + "/functions/v1/vaer", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + data.session.access_token,
          "apikey": CONFIG.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tripId })
      });
      if (!res.ok) return;
      const svar = await res.json();
      cache.vaer = svar.vaer || {};
      cache.vaerUtdatert = false;
      lsSet(LS.vaer(tripId), { ts: Date.now(), vaer: cache.vaer });
      fire();
    } catch { /* uten vær går appen like fint */ }
  }

  /* Nærmeste times varsel for et sted på et gitt tidspunkt. */
  function vaerPunkt(placeId, dato, tid) {
    const v = cache.vaer[placeId];
    if (!v || !v.timer || !v.timer.length) return null;
    const maal = new Date(`${dato}T${tid || "12:00"}:00`).getTime();
    if (isNaN(maal)) return null;

    let best = null, avstand = Infinity;
    for (const t of v.timer) {
      const d = Math.abs(new Date(t.t).getTime() - maal);
      if (d < avstand) { avstand = d; best = t; }
    }
    // Yr rekker omtrent ni dager fram. Er punktet lenger unna, si heller ingenting.
    if (!best || avstand > 3 * 3600 * 1000) return null;
    return best;
  }

  /* ───────── e-post som identitet ─────────
     Anonym pålogging er fortsatt inngangen — den krever ingenting og
     virker med én gang. Men identiteten bor da i nettleseren, og
     forsvinner med den. Kobler du på en e-post, beholder du samme bruker
     og dermed turene og lederrollene dine, men kan logge inn hvor som
     helst. */

  const minEpost = () => cache.epost || null;

  async function lesInnlogging(kjent) {
    if (!sb) return null;
    let u = kjent;
    if (!u) {
      const { data } = await sb.auth.getUser();
      u = data && data.user;
    }
    // Logger man inn med e-post, blir man en annen bruker enn gjesten man
    // var. Uten dette spør appen fortsatt etter den gamle IDen, finner
    // ingen turer, og sender deg tilbake til skjemaet.
    if (u && u.id && u.id !== userId) {
      userId = u.id;
      cache.messages = {}; cache.reactions = {}; cache.recent = {}; cache.vaer = {}; cache.trip = null;
      // Abonnementet hører til den forrige brukeren og må settes opp på nytt.
      kobleFra();
    }
    cache.epost = u && u.email ? u.email : null;
    cache.anonym = !!(u && u.is_anonymous);
    return { epost: cache.epost, anonym: cache.anonym };
  }

  const erAnonym = () => cache.anonym !== false;

  /* Ny eller eksisterende bruker: send kode til e-posten. */
  async function sendKode(epost) {
    const { error } = await sb.auth.signInWithOtp({
      email: epost.trim(),
      options: { shouldCreateUser: true }
    });
    if (error) throw epostFeil(error);
  }

  /* Gjestekontoen er billetten vi sitter med akkurat nå. Tar vi vare på
     den før vi logger inn som noen andre, kan vi be serveren rydde den
     bort etterpå — og bare den, for det er billetten som er beviset. */
  async function gjestebillett() {
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    return s && s.user && s.user.is_anonymous
      ? { token: s.access_token, id: s.user.id } : null;
  }

  async function ryddGjest(gjest) {
    if (!gjest) return null;
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch(CONFIG.supabaseUrl + "/functions/v1/ryddgjest", {
        method: "POST",
        keepalive: true,
        headers: {
          "Authorization": "Bearer " + (data.session ? data.session.access_token : CONFIG.supabaseAnonKey),
          "apikey": CONFIG.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ gjestToken: gjest.token })
      });
      const svar = await res.json().catch(() => null);
      if (svar && !svar.slettet) console.warn("Gjestekontoen ble ikke slettet:", svar.grunn);
      return svar;
    } catch { return null; }
  }

  async function bekreftKode(epost, kode) {
    // Hentes før innloggingen: etterpå er vi en annen bruker.
    const gjest = await gjestebillett();

    const { error } = await sb.auth.verifyOtp({
      email: epost.trim(), token: kode.trim(), type: "email"
    });
    if (error) throw epostFeil(error);
    await lesInnlogging();

    // Logget du inn som deg selv på en telefon der du har vært gjest, er
    // gjestekontoen ikke til å nå igjen for noen. Da skal den bort.
    if (gjest && gjest.id !== userId) ryddGjest(gjest);
  }

  /* Koble e-post til kontoen du alt har, så du beholder turene dine. */
  async function koblePaaEpost(epost) {
    const { error } = await sb.auth.updateUser({ email: epost.trim() });
    if (error) throw epostFeil(error);
  }

  async function bekreftKobling(epost, kode) {
    const { error } = await sb.auth.verifyOtp({
      email: epost.trim(), token: kode.trim(), type: "email_change"
    });
    if (error) throw epostFeil(error);
    await lesInnlogging();
  }

  function epostFeil(error) {
    const m = String(error.message || "").toLowerCase();
    console.warn("E-postfeil fra Supabase:", error.message);

    // Rekkefølgen betyr noe: «Error sending confirmation email» inneholder
    // ordet email, men handler om sending, ikke om adressen.
    if (m.includes("sending") || m.includes("smtp") || m.includes("mailer")) {
      return new Error("Appen fikk ikke sendt e-posten. Er SMTP satt opp i Supabase?");
    }
    if (m.includes("rate") || m.includes("too many") || m.includes("limit")) {
      return new Error("For mange forsøk. Vent noen minutter og prøv igjen.");
    }
    if (m.includes("disabled") || m.includes("not allowed") || m.includes("not enabled")) {
      return new Error("E-postinnlogging er slått av i Supabase.");
    }
    if (m.includes("expired")) return k("Koden er utløpt. Be om en ny.");
    if (m.includes("token") || m.includes("otp")) {
      return new Error("Koden stemte ikke. Sjekk at du skrev alle sifrene.");
    }
    if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists")) {
      return new Error("Den e-posten er alt i bruk. Logg inn med den i stedet.");
    }
    if (m.includes("invalid") && m.includes("email")) {
      return new Error("Sjekk at e-postadressen er riktig skrevet.");
    }
    // Ukjent: vis det serveren faktisk sa, så feilsøking er mulig.
    return new Error(error.message || "Noe gikk galt.");
  }

  /* Navnet ditt ligger lokalt. Logger du inn på en ny telefon, henter vi
     det fra turene du er medlem av i stedet for å spørre på nytt. */
  async function hentNavnFraTurer() {
    const { data } = await sb.from("members").select("name").eq("user_id", userId).limit(1);
    return data && data.length ? data[0].name : null;
  }

  /* Logger en gjest ut, er kontoen borte for alltid — den bodde bare i
     denne nettleseren. Da rydder vi den bort i stedet for å la den ligge
     igjen som en konto uten eier. */
  async function loggUt() {
    await ryddGjest(await gjestebillett());
    try { await sb.auth.signOut(); } catch {}
    Object.keys(localStorage).filter(k => k.startsWith("tk.")).forEach(k => localStorage.removeItem(k));
  }
  async function signOutLocal() {
    await ryddGjest(await gjestebillett());
    Object.keys(localStorage).filter(k => k.startsWith("tk.")).forEach(k => localStorage.removeItem(k));
    if (sb) sb.auth.signOut().catch(() => {});
  }

  return {
    init, online, fmtDay,
    getProfile, setProfile, getLastTrip, setLastTrip, getLastChannel, setLastChannel,
    myTrips, joinByCode, createTrip, updateTrip, doppChat, flyttTur, antallVentende, glemTur,
    kartValg, settKartValg, reisemaate, settReisemaate, loadTrip, lagretTur: loadSnapshot, currentTrip, isLeader, leaveTrip, deleteTrip,
    messages, loadMessages, loadMoreMessages, harEldre, loadRecent, lastByChannel,
    settLest, erUlest, antallUleste,
    subscribeTrip, subscribeChannel, unsubscribeChannel, kobleFra,
    sendMessage, deleteMessage, onChange,
    reactions, toggleReaction, lastReaksjoner, vaerFor, vaerPunkt, lastVaer,
    lastOppBilde, bildeUrl, bildeAdresse, slettBilde, slettTekst, ryddGamleBilder, setBilderPaa,
    addChannel, deleteChannel, tripMembers, channelMembers, addChannelMember, removeChannelMember, setMemberRole,
    setKrevGodkjenning, godkjennDeltaker, avvisDeltaker, fjernDeltaker,
    addPlace, updatePlace, setIgnorer, addDay, setHotel, addItem, updateItem, deleteItem, deleteDay,
    lastPaameldinger, paameldte, meldPaa, meldAv,
    pakkeliste, kryssPakk, nyttPakkPunkt, slettPakkPunkt,
    seter, taSete, slippSete, settSeteantall, megTall,
    applyTemplate, lesProgramFraPdf, signOutLocal,
    varselStatus, slaaPaaVarsler, slaaAvVarsler, varselEnheter, testVarsel, varmVarsler,
    erHer, ikkeHer,
    lastVarselvalg, varselvalg, varselNiva, settVarselNiva,
    lesInnlogging, erAnonym, minEpost, sendKode, bekreftKode, koblePaaEpost, bekreftKobling,
    hentNavnFraTurer, loggUt
  };
})();
