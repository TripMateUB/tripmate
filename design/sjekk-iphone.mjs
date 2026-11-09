/* Går gjennom alle fire fanene i demoen, i ekte WebKit — samme motor
   som iPhone bruker. Chromium sier ja til ting Safari sier nei til, og
   det er der feilene har gjemt seg.

   Krever at design/server.mjs kjører.

     node design/sjekk-iphone.mjs

   Måler det som pleier å svikte: treffflater, kontrast, øya, plassen
   under lista, og om noe ligger utenfor skjermen. */
import { webkit, devices } from "playwright";

const nb = await webkit.launch();
const side = await (await nb.newContext({ ...devices["iPhone 13"] })).newPage();
const feil = [];
side.on("pageerror", e => feil.push("pageerror: " + e));
side.on("console", m => { if (m.type() === "error") feil.push("konsoll: " + m.text()); });

await side.goto(`http://localhost:${process.env.PORT || 4321}/design/demo.html`, { waitUntil: "networkidle" });
await side.waitForSelector("#tabbar button", { timeout: 5000 });

const maal = async navn => side.evaluate(n => {
  const lum = c => {
    const m = c.match(/[\d.]+/g).map(Number);
    const k = m.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  /* Bakgrunnen er ikke nødvendigvis den første fargen vi finner. En
     halvgjennomsiktig flate over en mørk bakgrunn er noe helt annet enn
     den samme fargen alene — og det er den blandede fargen øyet ser.
     Uten dette meldte sjekken «Detaljer 4,00:1» om en knapp som i
     virkeligheten står på 10,22:1. */
  const bak = el => {
    const lag = [];
    for (let x = el; x; x = x.parentElement) {
      const b = getComputedStyle(x).backgroundColor;
      if (!b || /transparent/.test(b)) continue;
      const d = b.match(/[\d.]+/g);
      if (!d) continue;
      const a = d.length > 3 ? Number(d[3]) : 1;
      if (a === 0) continue;
      lag.push([d.slice(0, 3).map(Number), a]);
      if (a === 1) break;
    }
    // Nederste lag først, så legger vi de gjennomsiktige oppå.
    let ut = [255, 255, 255];
    for (const [farge, a] of lag.reverse()) ut = farge.map((v, i) => v * a + ut[i] * (1 - a));
    return `rgb(${ut.map(Math.round).join(",")})`;
  };
  const forhold = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  const app = document.getElementById("appScreen");
  const bar = document.getElementById("tabbar");
  const skjerm = document.getElementById("screen");

  const smaa = [...document.querySelectorAll("button, a, [role=tab]")]
    .filter(b => b.offsetParent !== null)
    .map(b => ({ t: (b.textContent || b.ariaLabel || "?").trim().slice(0, 22), r: b.getBoundingClientRect() }))
    .filter(x => x.r.width > 0 && (x.r.height < 44 || x.r.width < 44))
    .map(x => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`);

  const svak = [...skjerm.querySelectorAll("*")]
    .filter(el => el.children.length === 0 && el.textContent.trim() && el.offsetParent !== null)
    .map(el => {
      const cs = getComputedStyle(el);
      const st = parseFloat(cs.fontSize), fet = parseInt(cs.fontWeight, 10) >= 700;
      const krav = (st >= 24 || (st >= 18.66 && fet)) ? 3 : 4.5;
      return { t: el.textContent.trim().slice(0, 24), f: forhold(cs.color, bak(el)), krav };
    })
    .filter(x => x.f < x.krav)
    .map(x => `${x.t} ${x.f.toFixed(2)}:1 (krav ${x.krav})`);

  const utenfor = [...skjerm.querySelectorAll("*")]
    // Noe som ligger i en stripe man blar sidelengs i, skal stikke utenfor.
    // Det er poenget med stripa, ikke en feil.
    .filter(el => {
      const r = el.getBoundingClientRect();
      if (!(r.width > 0 && (r.right > innerWidth + 1 || r.left < -1))) return false;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 1) return false;
      }
      return true;
    })
    .map(el => el.className || el.tagName).slice(0, 5);

  return {
    fane: n,
    oey: { bunn: Math.round(app.getBoundingClientRect().bottom - bar.getBoundingClientRect().bottom), h: Math.round(bar.getBoundingClientRect().height) },
    plassUnder: getComputedStyle(skjerm).paddingBottom,
    kanBla: skjerm.scrollHeight > skjerm.clientHeight,
    smaa, svak, utenfor
  };
}, navn);

const skriv = m => {
  console.log("\n" + m.fane.toUpperCase().padEnd(10), `øya ${m.oey.h}px, ${m.oey.bunn}px over bunn · plass under ${m.plassUnder} · kan bla: ${m.kanBla}`);
  console.log("  for små:   ", m.smaa.length ? m.smaa.join(" | ") : "ingen");
  console.log("  svak tekst:", m.svak.length ? m.svak.join(" | ") : "ingen");
  console.log("  utenfor:   ", m.utenfor.length ? m.utenfor.join(" | ") : "ingen");
};

for (const fane of ["idag", "program", "chat", "meg"]) {
  await side.evaluate(f => document.querySelector(`#tabbar button[data-tab="${f}"]`).click(), fane);
  await side.waitForTimeout(220);
  skriv(await maal(fane));
}

/* Undersidene har sine egne knapper og sine egne lister, og det er der
   nye feil kommer inn. Måles med samme målebånd som fanene. */
for (const [navn, vei] of [
  ["pakk", '[data-side="pakk"]'], ["seter", '[data-side="seter"]'], ["rom", '[data-side="rom"]']
]) {
  await side.evaluate(() => document.querySelector('#tabbar button[data-tab="idag"]').click());
  await side.waitForTimeout(250);
  await side.evaluate(v => document.querySelector(v).click(), vei);
  await side.waitForTimeout(700);
  skriv(await maal(navn));
}

await side.evaluate(() => document.querySelector('#tabbar button[data-tab="chat"]').click());
await side.waitForTimeout(250);
await side.evaluate(() => document.querySelector("[data-openchat]").click());
await side.waitForTimeout(500);
skriv(await maal("samtale"));
await side.evaluate(() => document.querySelector("#convhead .t").click());
await side.waitForTimeout(600);
skriv(await maal("chatside"));
await side.evaluate(() => document.querySelector("#tabbar button[data-tab=\"meg\"]").click());
await side.waitForTimeout(250);
await side.evaluate(() => document.querySelector('[data-sheet="deltakere"]').click());
await side.waitForTimeout(700);
skriv(await maal("deltakere"));


console.log("\n" + (feil.length ? "FEIL:\n  " + feil.join("\n  ") : "ingen feil i konsollen"));
await nb.close();
