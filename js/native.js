/* Oppførsel som bare gjelder iOS-appen.

   Nettleseren og appen deler all kode, men tastaturet oppfører seg ulikt.
   I appen krymper iOS selve appvinduet når tastaturet kommer opp
   (Keyboard-pluginen med resize: "native"), så siden trenger ikke gjette
   hvor tastaturet er. Det som står igjen her, er det en vanlig iOS-app
   gjør av seg selv:

   - Ingen ^ v ✓-linje over tastaturet. Returtasten sier i stedet hva som
     skjer: «Neste» flytter til neste felt, «Ferdig» lukker tastaturet, og
     skjemaer med ett felt sendes med «Gå» eller «Send».
   - Feltet du skriver i, ligger alltid over tastaturet.
   - Drar du nedover utenfor feltet, går tastaturet ned.

   På nett gjør denne fila ingenting. */
(function () {
  const cap = window.Capacitor;
  const nativ = Boolean(cap && cap.isNativePlatform && cap.isNativePlatform());
  if (!nativ) return;

  const rot = document.documentElement;
  rot.classList.add("nativ");
  const Keyboard = cap.Plugins && cap.Plugins.Keyboard;

  /* ── Tastaturet oppe eller nede ── */
  const tastaturOppe = () => rot.classList.contains("tastatur");

  if (Keyboard) {
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    Keyboard.addListener("keyboardWillShow", () => rot.classList.add("tastatur"));
    Keyboard.addListener("keyboardWillHide", () => rot.classList.remove("tastatur"));
    // Når vinduet har fått sin nye høyde, skal feltet fram.
    Keyboard.addListener("keyboardDidShow", () => visFeltet(document.activeElement));
  }

  /* ── Feltet over tastaturet ──
     Vinduet er alt krympet, så det holder å skrolle feltet fram i sin
     egen liste. Vi gjør det bare når det trengs: står feltet synlig,
     skal ingenting hoppe. */
  function visFeltet(el) {
    if (!erSkrivefelt(el)) return;
    const r = el.getBoundingClientRect();
    const luft = 16;
    const bunn = window.innerHeight;
    // Ligger feltet i et ark, er det arket som er rammen.
    const ark = el.closest(".sheet");
    const topp = ark ? ark.getBoundingClientRect().top : 0;
    if (r.top >= topp + luft && r.bottom <= bunn - luft) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  document.addEventListener("focusin", e => {
    if (tastaturOppe()) setTimeout(() => visFeltet(e.target), 50);
  });

  /* ── Returtasten ── */
  const TEKSTTYPER = /^(text|email|search|tel|url|password|number|)$/;
  function erSkrivefelt(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === "TEXTAREA") return true;
    return el.tagName === "INPUT" && TEKSTTYPER.test((el.getAttribute("type") || "").toLowerCase());
  }
  function synlig(el) {
    return !el.disabled && !el.readOnly && el.offsetParent !== null;
  }
  // Feltene som hører sammen: samme skjema, ellers samme ark eller skjerm.
  function feltgruppe(el) {
    const ramme = el.form || el.closest(".sheet, .screen, .join, .auth, main, body");
    return Array.from(ramme.querySelectorAll("input, textarea"))
      .filter(f => f === el || (erSkrivefelt(f) && synlig(f)));
  }
  function nesteFelt(el) {
    const felt = feltgruppe(el);
    const i = felt.indexOf(el);
    return i >= 0 ? felt[i + 1] || null : null;
  }

  /* Vi bestemmer tasten når feltet får fokus, siden skjemaene tegnes på
     nytt hele tiden. Har feltet allerede sagt hva tasten skal hete
     (enterkeyhint i HTML-en), gjelder det. */
  document.addEventListener("focusin", e => {
    const el = e.target;
    if (!erSkrivefelt(el) || el.tagName === "TEXTAREA") return;
    // Talltastaturet (inputmode="numeric") har ingen returtast. Uten
    // linja over tastaturet kom man seg da verken videre eller ut. Et
    // tallfelt får i stedet tall-siden av det vanlige tastaturet, som har
    // returtasten. Kodefelt (tekst med talltastatur) beholder sitt.
    if (el.type === "number" && el.hasAttribute("inputmode")) el.removeAttribute("inputmode");
    if (el.hasAttribute("enterkeyhint") && !el.dataset.autoEnter) return;
    const felt = feltgruppe(el).filter(f => f.tagName === "INPUT");
    let tast;
    if (el.form && felt.length === 1) tast = "go";        // ett felt: Enter sender skjemaet
    else if (nesteFelt(el)) tast = "next";
    else tast = "done";
    el.setAttribute("enterkeyhint", tast);
    el.dataset.autoEnter = "1";
  }, true);

  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing) return;
    const el = e.target;
    if (!erSkrivefelt(el) || el.tagName === "TEXTAREA") return;
    const tast = el.getAttribute("enterkeyhint");
    if (tast === "next") {
      e.preventDefault();
      const neste = nesteFelt(el);
      if (neste) neste.focus(); else el.blur();
    } else if (tast === "done") {
      // Et skjema med flere felt skal ikke sendes halvferdig fordi man
      // trykket retur i et av dem. Da lukkes bare tastaturet.
      e.preventDefault();
      el.blur();
    }
    // «go», «send» og «search» sender skjemaet slik nettleseren gjør.
  }, true);

  /* ── Trykk utenfor feltet legger bort tastaturet ──
     Et trykk på tom flate eller tekst (ikke en knapp, et felt eller en
     lenke) lukker tastaturet, slik skjemaer i iOS gjør. */
  let trykkStart = null;
  document.addEventListener("touchstart", e => {
    trykkStart = tastaturOppe() && e.touches.length === 1
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true, capture: true });
  document.addEventListener("touchend", e => {
    if (!trykkStart) return;
    const t = e.changedTouches[0];
    const flyttet = Math.abs(t.clientX - trykkStart.x) + Math.abs(t.clientY - trykkStart.y);
    trykkStart = null;
    if (flyttet > 10) return;
    if (e.target.closest && e.target.closest("input, textarea, select, button, a, label, [contenteditable], [role=button]")) return;
    const a = document.activeElement;
    if (!a || !erSkrivefelt(a)) return;
    // Uten dette kom klikket etter at tastaturet hadde lagt seg og arket
    // hadde flyttet seg ned, og da traff det den mørke bakgrunnen bak
    // arket og lukket hele arket. Trykket skal bare legge bort tastaturet.
    if (e.cancelable) e.preventDefault();
    a.blur();
  }, { passive: false, capture: true });

  /* ── Dra ned for å legge bort tastaturet ──
     Slik Meldinger gjør: drar du nedover i lista eller arket mens du
     skriver, går tastaturet ned. Et trykk i selve feltet teller ikke. */
  let y0 = null, x0 = 0;
  document.addEventListener("touchstart", e => {
    if (!tastaturOppe() || e.touches.length !== 1) { y0 = null; return; }
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) { y0 = null; return; }
    y0 = e.touches[0].clientY; x0 = e.touches[0].clientX;
  }, { passive: true, capture: true });
  document.addEventListener("touchmove", e => {
    if (y0 === null) return;
    const dy = e.touches[0].clientY - y0, dx = Math.abs(e.touches[0].clientX - x0);
    if (dy > 24 && dy > dx * 1.5) {
      y0 = null;
      const a = document.activeElement;
      if (a && a.blur) a.blur();
    } else if (dy < -24) {
      y0 = null;   // dra oppover er vanlig blaing
    }
  }, { passive: true, capture: true });
})();
