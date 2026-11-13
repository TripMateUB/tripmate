/* Trykker gjennom pakkelista, setekartene, slutt-tiden og oppslagstavla
   i ekte WebKit, som en bruker ville gjort.

   Krever at design/server.mjs kjører.  node design/sjekk-pakk.mjs */
import { webkit, devices } from "playwright";

const nb = await webkit.launch();
const side = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
const feil = [];
side.on("pageerror", e => feil.push("pageerror: " + e));
side.on("dialog", d => d.accept());
side.on("console", m => { if (m.type() === "error") feil.push("konsoll: " + m.text()); });
const ok = [], nei = [];
const sjekk = async (hva, f) => {
  try { (await f()) ? ok.push(hva) : nei.push(hva); }
  catch (e) { nei.push(hva + " — kastet: " + e.message); }
};

await side.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html`, { waitUntil: "networkidle" });
await side.waitForSelector("#tabbar button");

/* Trykk via evaluate: åpningsbildet ligger over og tar ekte klikk. */
const trykk = async v => { await side.evaluate(s => document.querySelector(s).click(), v); await side.waitForTimeout(420); };
const trykkSiste = async v => {
  await side.evaluate(s => { const n = document.querySelectorAll(s); n[n.length - 1].click(); }, v);
  await side.waitForTimeout(420);
};
const antall = v => side.$$eval(v, e => e.length).catch(() => 0);

/* ───── fire faner, og hver av dem svarer på sitt ─────
   «I dag» og «Program» var to skjermer om det samme. Nå er det én:
   nå-kortet øverst, dagsvelgeren under, hele dagen i full lengde.
   Plassen som ble ledig gikk til Turen, der det praktiske ligger. */
await sjekk("fire faner", async () => await antall("#tabbar button") === 4);
await sjekk("fanene heter det de skal", async () =>
  (await side.$$eval("#tabbar button", e => e.map(x => x.dataset.tab).join(",")))
    === "program,chat,turen,meg");
await sjekk("Program åpner på dagens dato", async () =>
  /Dag \d+ av \d+/.test(await side.$eval(".dagunder", e => e.textContent)));
await sjekk("nå-kortet står på Program", async () => await side.$(".naakort") !== null);
await sjekk("dagsvelgeren står på samme skjerm", async () => await side.$(".chips") !== null);
await sjekk("det som venter på deg står der", async () =>
  /VENTER PÅ DEG/i.test(await side.$eval("#screen", e => e.textContent)));
await sjekk("ingen dagstripe lenger", async () => await side.$(".stripe") === null);
await sjekk("Program har ikke Praktisk-gruppa", async () =>
  !/PRAKTISK/i.test(await side.$eval("#screen", e => e.textContent)));

/* På en annen dag enn i dag er «nå» ikke lenger noe svar. */
await side.evaluate(() => [...document.querySelectorAll(".chip")].slice(-2)[0].click());
await side.waitForTimeout(400);
await sjekk("nå-kortet forsvinner på en annen dag", async () => await side.$(".naakort") === null);
await sjekk("hilsenen følger dagen du ser på", async () =>
  /Dag \d+ av \d+/.test(await side.$eval(".dagunder", e => e.textContent)));

await trykk('#tabbar button[data-tab="turen"]');
await sjekk("Turen har rad for pakkeliste", async () => await side.$('[data-side="pakk"]') !== null);
await sjekk("Turen har rad for sitteplasser", async () => await side.$('[data-side="seter"]') !== null);
await sjekk("Turen har rad for nødnummer", async () => await side.$('[data-side="kontakt"]') !== null);
await sjekk("reiselederen har opprop", async () => await side.$('[data-side="opprop"]') !== null);
await sjekk("Turen har turkoden", async () =>
  /Turkode/.test(await side.$eval("#screen", e => e.textContent)));
await trykk('#tabbar button[data-tab="meg"]');
await sjekk("Meg har ikke det praktiske lenger", async () => await side.$('[data-side="pakk"]') === null);
await trykk('#tabbar button[data-tab="turen"]');

/* ───── pakkeliste ───── */
await trykk('[data-side="pakk"]');
await sjekk("pakkesida viser begge delene", async () => await antall(".pkliste") === 2);
await sjekk("pakkesida viser punkter", async () => await antall(".pkrad") > 0);
const for1 = await antall(".pkrad");
const forFelles = await antall('.pkliste[data-egen="0"] .pkrad');

await trykk('[data-sheet="nyttpakk"]:not([data-egen])');
await sjekk("arket for nytt punkt åpnet", async () => await side.$("#pkTxt") !== null);
await side.fill("#pkTxt", "Regnjakke til Paris");
await trykk("#pakkForm button[type=submit]");
await sjekk("punktet kom i lista", async () => await antall(".pkrad") === for1 + 1);
await sjekk("punktet har riktig tekst", async () =>
  (await side.$$eval(".pknavn", e => e.map(x => x.textContent))).includes("Regnjakke til Paris"));
await sjekk("arket lukket seg", async () => await side.$eval("#sheetBg", e => e.hidden));

const krysset = () => antall(".pkhake.av");
const f1 = await krysset();
await trykk(".pkliste[data-egen=\"0\"] .pkrad:last-child .pkhake");
await sjekk("kryss slår på", async () => await krysset() === f1 + 1);
await trykk(".pkrad:last-child .pkhake");
await sjekk("kryss slår av igjen", async () => await krysset() === f1);

await sjekk("teller i toppen stemmer", async () => {
  const t = await side.$eval("#screen p.muted", e => e.textContent);
  const m = t.match(/(\d+) av (\d+) klart/);
  return m && Number(m[1]) === f1 && Number(m[2]) === for1 + 1;
});

await trykk(".pkliste[data-egen=\"0\"] .pkrad:last-child [data-slettpakk]");
await sjekk("sletting virker", async () => await antall(".pkrad") === for1);


/* Min egen del: punktene mine, og ingen andres. */
await trykk('[data-sheet="nyttpakk"][data-egen="1"]');
await side.fill("#pkTxt", "Solkrem");
await trykk("#pakkForm button[type=submit]");
await sjekk("eget punkt havner i min egen del", async () =>
  await side.$$eval('.pkliste[data-egen="1"] .pknavn', e => e.map(x => x.textContent)).then(l => l.includes("Solkrem")));
await sjekk("og ikke i reiselederens del", async () =>
  await side.$$eval('.pkliste[data-egen="0"] .pknavn', e => e.map(x => x.textContent)).then(l => !l.includes("Solkrem")));
await sjekk("hvert punkt har et drahåndtak", async () =>
  await antall(".pkrad [data-drag]") === await antall(".pkrad"));
await trykk('.pkliste[data-egen="1"] .pkrad:last-child [data-slettpakk]');
await sjekk("eget punkt lar seg slette", async () =>
  await side.$$eval('.pkliste[data-egen="1"] .pknavn', e => e.map(x => x.textContent)).then(l => !l.includes("Solkrem")));
/* ───── sitteplasser: flere kjøretøy ───── */
await side.goBack();
await side.waitForTimeout(350);
await trykk('[data-side="seter"]');
await sjekk("ett kort per kjøretøy", async () => await antall(".kjkort") === 3);
await sjekk("bussen har 57 seter", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet:not(.tom)").length) === 57);
await sjekk("toget har 32 plasser", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet:not(.tom)").length) === 32);
await sjekk("bilen har 5 seter", async () =>
  await side.$$eval(".kjkort", e => e[2].querySelectorAll(".setet:not(.tom)").length) === 5);

await sjekk("bussen er fire i bredden med midtgang etter to", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[0].querySelector(".seterad").children].map(x => x.className.split(" ")[0]).join(",")
  ) === "setet,setet,gang,setet,setet");
await sjekk("toget er fire i bredden med midtgang etter to", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[1].querySelector(".seterad").children].map(x => x.className.split(" ")[0]).join(",")
  ) === "setet,setet,gang,setet,setet");
/* Et tog nummererer gjennom vogna: 41, 42, 43. «11A» finnes ikke paa
   billetten, og da skal det ikke finnes i kartet heller. */
await sjekk("togplassene er tall, ikke rad og bokstav", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[1].querySelectorAll(".seterad")[0].querySelectorAll(".setet")].map(x => x.querySelector("b").textContent).join(",")
  ) === "1,2,3,4");
/* En buss har fem bak der resten har fire. Uten dette stemte ikke
   setenumrene med bussen folk satt i. */
await sjekk("bussens bakerste rad har fem, og heter 14A til 14E", async () =>
  await side.$$eval(".kjkort", e => {
    const rader = e[0].querySelectorAll(".seterad");
    const siste = rader[rader.length - 1];
    return rader.length === 14 &&
      siste.classList.contains("bakerst") &&
      siste.querySelectorAll(".gang").length === 0 &&
      [...siste.querySelectorAll(".setet")].map(x => x.querySelector("b").textContent).join(",")
        === "14A,14B,14C,14D,14E";
  }));
/* Plassene i en bil er steder og ikke tall: fører, foran, bak. */
await sjekk("bilplassene heter det de heter", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[2].querySelectorAll(".setet:not(.tom)")].map(x => x.querySelector("b").textContent).join(",")
  ) === "Fører,Foran,Bak v.,Bak midt,Bak h.");
await sjekk("siste rad fylles med tomrom, ikke med seter som ikke finnes", async () =>
  await side.$$eval(".kjkort", e => {
    const rader = e[2].querySelectorAll(".seterad");          // bilen: 5 plasser, 2 i bredden
    return rader.length === 3 && rader[2].querySelectorAll(".setet.tom").length === 1;
  }));

await sjekk("min plass i bussen er markert", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.min").length) === 1);
await sjekk("ingen plass i toget ennå", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet.min").length) === 0);
// Et tatt sete er ikke lenger avslaatt: det er veien inn til aa spoerre
// om aa bytte. Et sete som ikke kan trykkes sier ikke hvorfor.
await sjekk("tatte seter kan trykkes", async () =>
  (await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.tatt[disabled]").length)) === 0 &&
  (await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.tatt").length)) === 5);
await sjekk("reiselederen har to brytere per kjoeretoy", async () =>
  (await side.$$eval(".kjkort", e => e[0].querySelectorAll(".bryter").length)) === 2);
await sjekk("kortet sier hvordan plassene fordeles", async () => {
  const t = await side.$$eval(".kjtopp small", e => e.map(x => x.textContent));
  return /alle velger selv/.test(t[0]) && /reiselederen fordeler/.test(t[2]);
});
await sjekk("i et laast kjoeretoy setter reiselederen hvem som sitter der", async () => {
  await side.evaluate(() => document.querySelectorAll(".kjkort")[2]
    .querySelector(".setet:not(.tom)").click());
  await side.waitForTimeout(450);
  const h = await side.$eval("#sheet h3", e => e.textContent).catch(() => "");
  const valg = await side.$$eval("[data-setevalg]", e => e.length);
  await side.evaluate(() => document.querySelector("[data-close]").click());
  await side.waitForTimeout(300);
  return /Fører i Bil/.test(h) && valg > 0;
});

await sjekk("et opptatt sete viser hvem som sitter der", async () =>
  await side.$$eval(".kjkort", e => {
    const t = [...e[0].querySelectorAll(".setet.tatt")].map(x => x.querySelector("small"));
    return t.length > 0 && t.every(Boolean) && t.some(x => x.textContent === "Emma");
  }));
await sjekk("min egen plass er merket Deg", async () =>
  await side.$$eval(".kjkort", e => {
    const m = e[0].querySelector(".setet.min small");
    return m && m.textContent === "Deg";
  }));
await sjekk("et ledig sete har ingen navn", async () =>
  await side.$$eval(".kjkort", e => {
    const l = e[0].querySelector(".setet:not(.tatt):not(.min):not(.tom)");
    return l && !l.querySelector("small");
  }));
/* Ta en plass i toget: bussplassen skal ikke røres. */
const bussetet = () => side.$$eval(".kjkort", e => {
  const m = e[0].querySelector(".setet.min"); return m ? m.querySelector("b").textContent : null;
});
const forBuss = await bussetet();
await side.evaluate(() => document.querySelectorAll(".kjkort")[1]
  .querySelector(".setet:not(.tatt):not(.min):not(.tom)").click());
await side.waitForTimeout(420);
await sjekk("fikk plass i toget", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet.min").length) === 1);
await sjekk("bussplassen står urørt", async () => await bussetet() === forBuss);

/* Bytt plass i bussen: den gamle skal bli ledig. */
await side.evaluate(() => document.querySelectorAll(".kjkort")[0]
  .querySelector(".setet:not(.tatt):not(.min):not(.tom)").click());
await side.waitForTimeout(420);
await sjekk("byttet plass i bussen", async () => await bussetet() !== forBuss);
await sjekk("bare én plass er min i bussen", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.min").length) === 1);
await sjekk("den gamle plassen er ledig igjen", async () =>
  await side.$$eval(".kjkort", (e, f) => {
    const g = [...e[0].querySelectorAll(".setet")].find(x => x.querySelector("b") && x.querySelector("b").textContent === f);
    return g && !g.classList.contains("tatt") && !g.classList.contains("min") && !g.disabled;
  }, forBuss));

/* Nytt kjøretøy, og bort igjen. */
await trykk('[data-nykj="1"]');
await sjekk("arket for nytt kjøretøy åpnet", async () => await side.$("#kjNavn") !== null);
await side.fill("#kjNavn", "Buss 2");
await side.selectOption("#kjTyp", "buss");
await side.fill("#kjAnt", "49");
await trykk("#kjLagre");
await sjekk("kjøretøyet kom med", async () => await antall(".kjkort") === 4);
await sjekk("49 plasser, siste rad delvis fylt", async () =>
  await side.$$eval(".kjkort", e =>
    e[3].querySelectorAll(".setet:not(.tom)").length === 49 &&
    e[3].querySelectorAll(".setet.tom").length === 3));
await trykkSiste("[data-endrekj]");
await sjekk("arket for endring er forhåndsfylt", async () =>
  await side.$eval("#kjNavn", e => e.value) === "Buss 2");
await trykk("[data-slettkj]");
await sjekk("kjøretøyet ble slettet", async () => await antall(".kjkort") === 3);

/* ───── oppslagstavle: bare reiseledere skriver ───── */
await side.goBack();
await side.waitForTimeout(350);
await trykk('#tabbar button[data-tab="chat"]');
await trykk("[data-openchat]");
await sjekk("reiselederen har skrivefelt", async () => await side.$("#msgInput") !== null);
/* Navnet i toppen er veien inn til chat-siden, og det virker bare mens
   samtalen står åpen. */
await trykk("#convhead .t");
const bryter = await side.$("[data-chatskriv]");
await sjekk("chat-siden har bryter for oppslagstavle", async () => bryter !== null);
if (bryter) {
  await side.evaluate(() => {
    const b = document.querySelector("[data-chatskriv]");
    b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await side.waitForTimeout(450);
  await sjekk("bryteren ble stående på", async () =>
    await side.$eval("[data-chatskriv]", e => e.checked));
}


/* En deltaker skal ikke ha skrivefelt i en oppslagstavle. Rollen kan ikke
   byttes fra utsiden, så demoen får den som et flagg i adressen. */
const side2 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
side2.on("pageerror", e => feil.push("pageerror (deltaker): " + e));
await side2.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html?rolle=deltaker&tavle=1`, { waitUntil: "networkidle" });
await side2.waitForSelector("#tabbar button");
await side2.evaluate(() => document.querySelector('#tabbar button[data-tab="chat"]').click());
await side2.waitForTimeout(420);
await side2.evaluate(() => document.querySelector("[data-openchat]").click());
await side2.waitForTimeout(500);
await sjekk("deltakeren får ikke skrivefelt i en oppslagstavle", async () => await side2.$("#msgInput") === null);
await sjekk("deltakeren får vite hvorfor", async () =>
  /Bare reiseledere/.test(await side2.$eval(".bareledere", e => e.textContent)));
await sjekk("deltakeren ser ingen bryter for oppslagstavle", async () => {
  await side2.evaluate(() => document.querySelector("#convhead .t").click());
  await side2.waitForTimeout(450);
  return await side2.$("[data-chatskriv]") === null;
});
/* ───── slutt-tid i stedet for nedtrekksmeny ───── */
await trykk('#tabbar button[data-tab="program"]');
const addKnapp = await side.$('[data-sheet^="addItem"], [data-sheet="additem"]');
await sjekk("fant knappen for nytt programpunkt", async () => addKnapp !== null);
if (addKnapp) {
  await side.evaluate(() => document.querySelector('[data-sheet^="addItem"], [data-sheet="additem"]').click());
  await side.waitForTimeout(420);
  await sjekk("nytt programpunkt har felt for slutt-tid", async () => await side.$("#iSlutt") !== null);
  await sjekk("ingen nedtrekksmeny for varighet igjen", async () => await side.$("#iVarer") === null);
  await side.fill("#iTime", "10:00");
  await side.fill("#iSlutt", "09:00");
  await side.fill("#iTitle", "Baklengs");
  await trykk("#iSubmit");
  await sjekk("slutt før start gir en feilmelding", async () =>
    await side.$eval("#iErr", e => !e.hidden && /før start/i.test(e.textContent)));
}


/* Dra et punkt opp i lista, med ekte pekerhendelser. */
await side.evaluate(() => { const b = document.querySelector("[data-close]"); if (b) b.click(); });
await side.waitForTimeout(300);
await trykk('#tabbar button[data-tab="turen"]');
await trykk('[data-side="pakk"]');
const rekke = () => side.$$eval('.pkliste[data-egen="0"] .pknavn', e => e.map(x => x.textContent));
const foerDra = await rekke();
const bokser = await side.$$eval('.pkliste[data-egen="0"] .pkrad [data-drag]', e => e.map(x => {
  const r = x.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}));
await side.mouse.move(bokser[3].x, bokser[3].y);
await side.mouse.down();
for (let n = 1; n <= 8; n++) {
  await side.mouse.move(bokser[3].x, bokser[3].y - (bokser[3].y - bokser[1].y) * n / 8);
  await side.waitForTimeout(25);
}
await side.mouse.up();
await side.waitForTimeout(700);
const etterDra = await rekke();
// Draingen bytter plass med én nabo om gangen, slik programpunktene gjør:
// drar du lenger, bytter den igjen.
await sjekk("draing flytter punktet oppover", async () =>
  etterDra[2] === foerDra[3] && etterDra[3] === foerDra[2] && etterDra.length === foerDra.length);
await sjekk("ingen punkter kom bort under draingen", async () =>
  foerDra.every(t => etterDra.includes(t)));

/* Knappen som slår opp adressene på nytt. Oppslaget tar over tjue
   sekunder på ekte, så den må si at den holder på — og den må si fra
   når serveren svarer nei, i stedet for å bli stille. */
for (const [flagg, venta] of [["", /står fortsatt uten posisjon/], ["&vaerfeil=1", /Fikk ikke lest stedene/]]) {
  const s3 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s3.on("pageerror", e => feil.push("pageerror (vær): " + e));
  await s3.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html?utenpos=1${flagg}`, { waitUntil: "networkidle" });
  await s3.waitForSelector("#tabbar button");
  await s3.evaluate(() => document.querySelector('#tabbar button[data-tab="turen"]').click());
  await s3.waitForTimeout(500);
  const merke = flagg ? "når serveren sier nei" : "når alt gikk bra";
  await sjekk(`knappen «Slå opp adressene på nytt» finnes ${merke}`,
    async () => await s3.$("[data-vaerigjen]") !== null);
  await s3.evaluate(() => document.querySelector("[data-vaerigjen]").click());
  await s3.waitForTimeout(250);
  await sjekk(`den sier at den holder på ${merke}`, async () =>
    /Slår opp adressene/.test(await s3.$$eval("#screen p.muted", e => e.map(x => x.textContent).join(" "))));
  await sjekk(`knappen kan ikke trykkes to ganger ${merke}`,
    async () => await s3.$("[data-vaerigjen]") === null);
  await s3.waitForTimeout(1500);
  await sjekk(`svaret kommer fram ${merke}`, async () =>
    venta.test(await s3.$eval("#toast, .toast", e => e.textContent)));
  await sjekk(`knappen er tilbake etterpå ${merke}`,
    async () => await s3.$("[data-vaerigjen]") !== null);
  await s3.close();
}

/* To ting paa samme tid: naa-kortet viste bare den ene. */
{
  const s4 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s4.on("pageerror", e => feil.push("pageerror (samtidig): " + e));
  await s4.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html?samtidig=1`, { waitUntil: "networkidle" });
  await s4.waitForSelector("#tabbar button");
  await s4.waitForTimeout(600);
  await sjekk("kortet staar paa Naa", async () =>
    /^Nå/.test((await s4.$eval(".naakort .merk", e => e.textContent)).trim()));
  await sjekk("naa-kortet viser det andre punktet som skjer samtidig", async () =>
    (await s4.$$eval(".ogsaarad", e => e.length)) === 1);
  await sjekk("et punkt som overlapper, men ikke har startet, staar ikke under Samtidig", async () =>
    !/har ikke startet/.test(await s4.$eval(".naakort", e => e.textContent)));
  await sjekk("det punktet staar i dagens liste i stedet", async () =>
    (await s4.$$eval(".tl .ev", e => e.map(x => x.textContent))).some(t => /har ikke startet/.test(t)));
  await sjekk("den samtidige raden har bade tid, tittel og sted", async () => {
    const t = await s4.$eval(".ogsaarad", e => e.textContent.replace(/\s+/g, " "));
    return /\d\d:\d\d/.test(t) && /Gruppe B/.test(t) && /Orsay/.test(t);
  });
  await sjekk("raden er stor nok til aa treffes", async () =>
    (await s4.$eval(".ogsaarad", e => Math.round(e.getBoundingClientRect().height))) >= 44);
  await sjekk("naa-kortet viser vaer", async () =>
    (await s4.$$eval(".naakort .hva .vaer", e => e.length)) === 1);
  await sjekk("den samtidige raden viser vaer", async () =>
    (await s4.$$eval(".ogsaarad .vaer", e => e.length)) === 1);
  await sjekk("hvert punkt i dagens liste viser vaer", async () => {
    const rader = await s4.$$eval(".tl .ev", e => e.length);
    const vaer = await s4.$$eval(".tl .ev .vaer", e => e.length);
    return rader > 0 && vaer === rader;
  });
  await sjekk("vaeret klippes ikke bort i den samtidige raden", async () =>
    await s4.$eval(".ogsaarad .vaer", e => {
      const v = e.getBoundingClientRect(), rad = e.closest(".ogsaarad").getBoundingClientRect();
      return v.width > 0 && v.right <= rad.right + 1 && v.left >= rad.left - 1;
    }));
  await sjekk("den samtidige raden apner sitt eget punkt", async () => {
    await s4.evaluate(() => document.querySelector(".ogsaarad").click());
    await s4.waitForTimeout(500);
    return /Gruppe B/.test(await s4.$eval("#sheet", e => e.textContent));
  });
  await s4.close();
}

/* Naar ingenting paagaar, er «samtidig» det som begynner i samme
   oeyeblikk som det neste. */
{
  const s5 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s5.on("pageerror", e => feil.push("pageerror (samtidig 2): " + e));
  await s5.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html?samtidig=2`, { waitUntil: "networkidle" });
  await s5.waitForSelector("#tabbar button");
  await s5.waitForTimeout(600);
  await sjekk("kortet staar paa Naa snart", async () =>
    /Nå snart/.test(await s5.$eval(".naakort .merk", e => e.textContent)));
  await sjekk("det som begynner samtidig med det neste vises", async () =>
    (await s5.$$eval(".ogsaarad", e => e.length)) === 1 &&
    /Gruppe B/.test(await s5.$eval(".ogsaarad", e => e.textContent)));
  await sjekk("et punkt som begynner senere vises ikke", async () =>
    !/har ikke startet/.test(await s5.$eval(".naakort", e => e.textContent)));
  await s5.close();
}

/* Et punkt uten sluttid varer fem minutter. «Avreise 08:00» skal ikke
   slutte aa vaere naa i samme sekund som klokka slaar. */
for (const [siden, venta, hva] of [
  ["3", /^Nå · startet for 3 minutter siden$/, "tre minutter etter start"],
  ["1", /^Nå · startet for 1 minutt siden$/, "ett minutt etter start"],
  ["7", /^Neste · /, "sju minutter etter start"]
]) {
  const s6 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s6.on("pageerror", e => feil.push("pageerror (uten sluttid): " + e));
  await s6.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html?samtidig=3&siden=${siden}`, { waitUntil: "networkidle" });
  await s6.waitForSelector("#tabbar button");
  await s6.waitForTimeout(600);
  await sjekk(`punkt uten sluttid, ${hva}`, async () =>
    venta.test((await s6.$eval(".naakort .merk", e => e.textContent)).trim()));
  if (siden !== "7") {
    await sjekk(`klokkeslettet staar alene, ${hva}`, async () =>
      /^\d\d:\d\d$/.test((await s6.$eval(".naakort .kl", e => e.textContent)).trim()));
  }
  await s6.close();
}

/* Rom: reiselederen fordeler, og ingen havner i to rom. */
{
  const s7 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s7.on("pageerror", e => feil.push("pageerror (rom): " + e));
  s7.on("dialog", d => d.accept());
  await s7.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html`, { waitUntil: "networkidle" });
  await s7.waitForSelector("#tabbar button");
  // Listene ligger under Meg nå, ikke på I dag.
  await s7.evaluate(() => document.querySelector('#tabbar [data-tab="turen"]').click());
  await s7.waitForTimeout(400);
  await s7.evaluate(() => document.querySelector('[data-side="rom"]').click());
  await s7.waitForTimeout(700);
  const senger = () => s7.$$eval(".kjtopp small", e => e.map(x => x.textContent));
  await sjekk("romsida viser rommene", async () => (await senger()).length === 3);
  await sjekk("den som bor et sted ser hvor", async () =>
    /Du bor på/.test(await s7.$eval("#screen p.muted", e => e.textContent)));
  await sjekk("uten seng staar oeverst", async () =>
    /Uten seng/.test(await s7.$eval("#screen", e => e.textContent)));

  const foer = await senger();
  await s7.evaluate(() => document.querySelector("[data-fyllrom]").click());
  await s7.waitForTimeout(500);
  await sjekk("arket spoer hvem som skal inn", async () =>
    /Hvem skal på/.test(await s7.$eval("#sheet h3", e => e.textContent)));
  await s7.evaluate(() => document.querySelector("[data-romvalg]").click());
  await s7.waitForTimeout(700);
  const etter = await senger();
  await sjekk("personen flyttes, og blir ikke staaende to steder", async () =>
    etter[0] !== foer[0] && etter.join("|") !== foer.join("|") &&
    (await s7.$$eval(".kjkort .person", e => e.map(x => x.textContent.trim())))
      .filter(t => /Emma/.test(t)).length === 1);
  await s7.close();
}
/* Omvisningen peker paa ekte ting, og det er det eneste som gjoer den
   bedre enn fire sider tekst. For hvert steg: finner den maalet, ligger
   ringen inne paa skjermen, og staar kortet klar av den? Et steg som
   peker paa ingenting, eller et kort som dekker det det snakker om, er
   verre enn ingen omvisning. */
for (const rolle of ["leder", "deltaker"]) {
  const s8 = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
  s8.on("pageerror", e => feil.push(`pageerror (omvisning ${rolle}): ` + e));
  const url = `http://localhost:${process.env.PORT || 4321}/design/demo.html?omvisning=1`
    + (rolle === "deltaker" ? "&rolle=deltaker" : "");
  await s8.goto(url, { waitUntil: "networkidle" });
  await s8.waitForSelector("#omvisKort h3", { timeout: 8000 });
  await s8.waitForTimeout(600);

  const antallSteg = await s8.$eval("#omvisKort .omvis-teller", e =>
    Number(e.textContent.match(/av (\d+)/)[1]));
  await sjekk(`omvisningen starter av seg selv, ${rolle}`, async () => antallSteg > 3);

  const daarlige = [];
  for (let i = 0; i < antallSteg; i++) {
    await s8.waitForTimeout(450);
    const m = await s8.evaluate(() => {
      const k = document.getElementById("omvisKort");
      const r = document.getElementById("omvisRing");
      const rb = r.getBoundingClientRect(), kb = k.getBoundingClientRect();
      const a = document.getElementById("appScreen").getBoundingClientRect();
      return {
        nr: k.querySelector(".omvis-teller").textContent,
        tom: r.classList.contains("tom"),
        ringInne: rb.height > 0 && rb.top >= a.top - 1 && rb.bottom <= a.bottom + 1,
        kortInne: kb.top >= a.top - 1 && kb.bottom <= a.bottom + 1,
        kolliderer: !r.classList.contains("tom") && rb.bottom > kb.top && rb.top < kb.bottom
      };
    });
    if (m.tom) daarlige.push(`${m.nr}: fant ikke maalet`);
    else if (!m.ringInne) daarlige.push(`${m.nr}: ringen er utenfor skjermen`);
    if (!m.kortInne) daarlige.push(`${m.nr}: kortet er utenfor skjermen`);
    if (m.kolliderer) daarlige.push(`${m.nr}: kortet dekker det ringen peker paa`);
    await s8.evaluate(() => document.querySelector('[data-omvis="neste"]').click());
  }
  await sjekk(`hvert steg peker paa noe synlig, ${rolle}`, async () => {
    if (!daarlige.length) return true;
    nei.push(...daarlige.map(d => "   " + d));
    return false;
  });
  await s8.waitForTimeout(400);
  await sjekk(`omvisningen lukker seg etter siste steg, ${rolle}`,
    async () => await s8.$eval("#omvis", e => e.hidden));

  // Og den skal kunne startes om igjen, og hoppes over naar som helst.
  await s8.evaluate(() => document.querySelector('#tabbar [data-tab="meg"]').click());
  await s8.waitForTimeout(400);
  await s8.evaluate(() => document.querySelector('[data-sheet="omvisning"]').click());
  await s8.waitForTimeout(700);
  await sjekk(`omvisningen kan startes om igjen, ${rolle}`,
    async () => await s8.$eval("#omvis", e => !e.hidden));
  await s8.evaluate(() => document.querySelector('[data-omvis="slutt"]').click());
  await s8.waitForTimeout(400);
  await sjekk(`hopp over lukker den, ${rolle}`,
    async () => await s8.$eval("#omvis", e => e.hidden));
  await s8.close();
}

console.log("OK:\n  " + ok.join("\n  "));
console.log(nei.length ? "\nFEIL:\n  " + nei.join("\n  ") : "\nFEIL: ingen");
console.log(feil.length ? "KONSOLL:\n  " + feil.join("\n  ") : "KONSOLL: rent");
await nb.close();
process.exit(nei.length || feil.length ? 1 : 0);
