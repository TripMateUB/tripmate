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
const antall = v => side.$$eval(v, e => e.length).catch(() => 0);

/* ───── pakkelista ligger på I dag, ikke under Meg ───── */
await sjekk("I dag har rad for pakkeliste", async () => await side.$('[data-side="pakk"]') !== null);
await sjekk("I dag har rad for sitteplasser", async () => await side.$('[data-side="seter"]') !== null);
await trykk('#tabbar button[data-tab="meg"]');
await sjekk("Meg har dem ikke lenger", async () => await side.$('[data-side="pakk"]') === null);
await trykk('#tabbar button[data-tab="idag"]');

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
await sjekk("bussen har 56 seter", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet:not(.tom)").length) === 56);
await sjekk("flyet har 30 seter", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet:not(.tom)").length) === 30);
await sjekk("bilen har 5 seter", async () =>
  await side.$$eval(".kjkort", e => e[2].querySelectorAll(".setet:not(.tom)").length) === 5);

await sjekk("bussen er fire i bredden med midtgang etter to", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[0].querySelector(".seterad").children].map(x => x.className.split(" ")[0]).join(",")
  ) === "setet,setet,gang,setet,setet");
await sjekk("flyet er seks i bredden med midtgang etter tre", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[1].querySelector(".seterad").children].map(x => x.className.split(" ")[0]).join(",")
  ) === "setet,setet,setet,gang,setet,setet,setet");
await sjekk("flysetene heter A til F", async () =>
  await side.$$eval(".kjkort", e =>
    [...e[1].querySelectorAll(".seterad")[0].querySelectorAll(".setet")].map(x => x.querySelector("b").textContent).join("")
  ) === "1A1B1C1D1E1F");
await sjekk("siste rad fylles med tomrom, ikke med seter som ikke finnes", async () =>
  await side.$$eval(".kjkort", e => {
    const rader = e[2].querySelectorAll(".seterad");          // bilen: 5 plasser, 2 i bredden
    return rader.length === 3 && rader[2].querySelectorAll(".setet.tom").length === 1;
  }));

await sjekk("min plass i bussen er markert", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.min").length) === 1);
await sjekk("ingen plass i flyet ennå", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet.min").length) === 0);
await sjekk("tatte seter er avslått", async () =>
  await side.$$eval(".kjkort", e => e[0].querySelectorAll(".setet.tatt[disabled]").length) === 5);

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
/* Ta en plass i flyet: bussplassen skal ikke røres. */
const bussetet = () => side.$$eval(".kjkort", e => {
  const m = e[0].querySelector(".setet.min"); return m ? m.querySelector("b").textContent : null;
});
const forBuss = await bussetet();
await trykk(".kjkort:nth-of-type(2) .setet:not(.tatt):not(.min):not(.tom):not([disabled])");
await sjekk("fikk plass i flyet", async () =>
  await side.$$eval(".kjkort", e => e[1].querySelectorAll(".setet.min").length) === 1);
await sjekk("bussplassen står urørt", async () => await bussetet() === forBuss);

/* Bytt plass i bussen: den gamle skal bli ledig. */
await trykk(".kjkort:nth-of-type(1) .setet:not(.tatt):not(.min):not(.tom):not([disabled])");
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
await trykk(".kjkort:nth-of-type(4) [data-endrekj]");
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
await trykk('#tabbar button[data-tab="idag"]');
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
  await s3.evaluate(() => document.querySelector('#tabbar button[data-tab="meg"]').click());
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
  await sjekk("naa-kortet viser det andre punktet som skjer samtidig", async () =>
    (await s4.$$eval(".ogsaarad", e => e.length)) === 1);
  await sjekk("den samtidige raden har bade tid, tittel og sted", async () => {
    const t = await s4.$eval(".ogsaarad", e => e.textContent.replace(/\s+/g, " "));
    return /\d\d:\d\d/.test(t) && /Gruppe B/.test(t) && /Orsay/.test(t);
  });
  await sjekk("raden er stor nok til aa treffes", async () =>
    (await s4.$eval(".ogsaarad", e => Math.round(e.getBoundingClientRect().height))) >= 44);
  await sjekk("den samtidige raden apner sitt eget punkt", async () => {
    await s4.evaluate(() => document.querySelector(".ogsaarad").click());
    await s4.waitForTimeout(500);
    return /Gruppe B/.test(await s4.$eval("#sheet", e => e.textContent));
  });
  await s4.close();
}
console.log("OK:\n  " + ok.join("\n  "));
console.log(nei.length ? "\nFEIL:\n  " + nei.join("\n  ") : "\nFEIL: ingen");
console.log(feil.length ? "KONSOLL:\n  " + feil.join("\n  ") : "KONSOLL: rent");
await nb.close();
process.exit(nei.length || feil.length ? 1 : 0);
