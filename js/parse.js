/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* parse.js — leser en melding og finner ut om den avtaler et møte et sted.
   Regelbasert i denne versjonen: alt kjører på telefonen, ingenting sendes ut.
   Når backend er på plass kalles en språkmodell serverside i stedet, og
   denne filen blir reserveløsningen når nettet er borte. */

const Parse = (() => {

  const WEEKDAYS = ["søndag","mandag","tirsdag","onsdag","torsdag","fredag","lørdag"];

  /* Hele ord, også med æ, ø og å. JavaScripts \b kjenner bare a–z, så
     «\bgå\b» traff inne i «går», og «møt» kunne treffe midt i ord.
     Ingen lookbehind: den finnes ikke i Safari 15, og iOS-appen støtter
     iOS 15. Derfor en gruppe foran i stedet. */
  const ord = liste => new RegExp("(?:^|[^\\p{L}\\p{N}])(?:" + liste.join("|") + ")(?=$|[^\\p{L}\\p{N}])", "u");

  const MOTEORD = ord(["møt", "møtes", "møter", "treffes", "samles", "samling", "oppmøte",
                       "vi ses", "sees", "ses", "avreise", "avgang", "drar", "går fra"]);
  const HOTELLORD = ord(["hotell", "hotellet", "lobby", "lobbyen", "resepsjonen", "rommet"]);
  const FORTID = ord(["i går", "igår", "i forgårs"]);

  /* Hvilken dag tar vi utgangspunkt i: dagens dato hvis turen pågår,
     ellers første dag i programmet. */
  function baseDate(trip) {
    if (!trip || !trip.days || !trip.days.length) return null;
    // Lokal dato, ikke UTC — se lokalDato() i ui.js.
    const n = new Date();
    const today = n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" +
      String(n.getDate()).padStart(2, "0");
    const hit = trip.days.find(d => d.date === today);
    if (hit) return hit.date;
    const future = trip.days.find(d => d.date > today);
    return future ? future.date : trip.days[trip.days.length - 1].date;
  }

  function dayOf(trip, date) {
    return trip.days.find(d => d.date === date) || null;
  }

  function shiftDay(trip, date, delta) {
    const i = trip.days.findIndex(d => d.date === date);
    if (i === -1) return date;
    const j = Math.min(Math.max(i + delta, 0), trip.days.length - 1);
    return trip.days[j].date;
  }

  function findTime(low) {
    // 14:00, 14.00, kl 14, klokka 9
    let m = low.match(/\b(\d{1,2})[.:](\d{2})\b/);
    if (m && Number(m[1]) < 24) return String(m[1]).padStart(2, "0") + ":" + m[2];
    m = low.match(/\bkl(?:okk[ae]n?|\.)?\s*(\d{1,2})\b(?!\s*[.:]\d)/);
    if (m && Number(m[1]) < 24) return String(m[1]).padStart(2, "0") + ":00";
    return null;
  }

  function findDate(trip, low, base) {
    if (/\bi\s?morgen\b/.test(low)) return shiftDay(trip, base, 1);
    if (/\bi\s?overmorgen\b/.test(low)) return shiftDay(trip, base, 2);
    if (/\bi\s?dag\b/.test(low)) return base;
    for (const d of trip.days) {
      const wd = WEEKDAYS[new Date(d.date + "T12:00:00").getDay()];
      if (low.includes(wd)) return d.date;
    }
    return base;
  }

  function findPlace(trip, low, date) {
    const day = dayOf(trip, date);

    // Navngitt sted vinner over «hotellet», bortsett fra når hotellet er navngitt.
    // Kallenavnene må stå som hele ord: «nord» skal ikke treffe «nordover».
    let best = null;
    for (const [id, p] of Object.entries(trip.places)) {
      const hitName = low.includes(p.name.toLowerCase());
      const hitAlias = (p.alias || []).some(a => a && ord([a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")]).test(low));
      if (!hitName && !hitAlias) continue;
      const isHotel = p.kind === "Hotell";
      if (!isHotel) { best = id; break; }
      if (!best) best = id;
    }
    if (best && trip.places[best].kind !== "Hotell") {
      return { place: best, why: `Stedsnavnet «${trip.places[best].name}»` };
    }
    if (best || HOTELLORD.test(low)) {
      if (day && day.hotel && trip.places[day.hotel]) {
        return { place: day.hotel, why: "«hotellet» tolket som hotellet dere bor på" };
      }
      if (best) return { place: best, why: `Stedsnavnet «${trip.places[best].name}»` };
    }
    return null;
  }

  /* Reserve: finnes det et programpunkt på samme klokkeslett den dagen? */
  function fromProgram(trip, date, time) {
    const day = dayOf(trip, date);
    if (!day || !time) return null;
    const item = day.items.find(i => i.t === time && i.place);
    return item ? { place: item.place, why: `Programpunktet «${item.title}» kl ${time}` } : null;
  }

  function analyse(trip, text) {
    const base = baseDate(trip);
    if (!base) return null;               // turen har ikke program ennå
    const low = " " + String(text).toLowerCase() + " ";

    /* En avtale har et ord som sier at folk skal møtes. Før holdt det med
       et klokkeslett, og da ble «blir på rommet kl 19» (syk) og «jeg
       kommer 15:00 da» til kartkort. Noe som skjedde i går er heller ingen
       avtale.

       Klokkeslettet er ikke et krav for kortet: «Møt ved Notre-Dame» skal
       gi veibeskrivelse. Men bare kort MED klokkeslett varsles til alle på
       «Det viktige» — det sjekker serverfunksjonen varsle. */
    if (FORTID.test(low) || !MOTEORD.test(low)) return null;
    const time = findTime(low) || "";
    const date = findDate(trip, low, base);

    const hit = findPlace(trip, low, date) || fromProgram(trip, date, time);
    if (!hit) return null;

    const day = dayOf(trip, date);
    return {
      place: hit.place,
      time,
      date,
      why: hit.why + (day ? ` · ${day.label}` : "")
    };
  }

  return { analyse, baseDate, dayOf };
})();
