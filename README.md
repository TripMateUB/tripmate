# TripMate

Program, gruppechat og veibeskrivelse for klasseturer. Nettside som kan legges til på
hjemskjermen (PWA) og virker uten nett. Ingen byggesteg — rene statiske filer på GitHub
Pages, med Supabase som database.

© 2026 TripMate UB. Alle rettigheter forbeholdt — se [LICENSE](LICENSE). Koden ligger
åpent fordi en nettside må sende koden sin til alle som besøker den. Det er ikke det
samme som at den er fri å bruke.

## Hva appen gjør

- **Reiseledere lager turer.** Tomt program, eller start fra en ferdig mal. Du får en
  turkode på seks tegn å dele ut.
- **Deltakere blir med** med fornavn, etternavn og turkoden.
- **Flere turer.** Appen husker hvilken tur du så sist og åpner den neste gang.
- **Flere chatter per tur.** En chat er enten åpen for hele turen, eller privat for dem du
  legger til. Private chatter vises ikke i det hele tatt for andre — heller ikke for
  reiseledere. Alle medlemmer kan opprette en chat og legge til folk som er med på turen.
- **Møteavtaler blir til veibeskrivelse.** Skriver noen «møt på hotellet kl 18:30», kobles
  det mot programmet for den dagen, og kartet åpner riktig adresse. «Hotellet» slår opp
  hotellet dere faktisk bor på den datoen — turer bytter hotell underveis.
- **Program** med dagsvelger, neste hendelse, og kart på hvert punkt. Reiseleder legger inn
  dager, punkter, steder og hvilket hotell som gjelder hver dag.
- **Praktisk** samlet under Meg: pakkeliste, sitteplasser, rom og nødnummer. «I dag» viser
  bare det som venter på at du gjør noe.
- **Sitteplasser** per kjøretøy, med dag, type og navngiving som følger kjøretøyet: en buss
  heter 12A, et tog 41, en bil «Bak v.». Flere like kjøretøy lages i én omgang.
- **Rom** med de samme to bryterne som setene: deltakerne flytter seg selv, eller
  reiselederen fordeler — og om hvert bytte må godkjennes. «Fyll de ledige sengene»
  fordeler resten.
- **Nødnummer** som alle ser, også uten nett, og som ringes med ett trykk.
- **Opprop** for reiselederne: en runde der navnene hakes av. Bare reiseledere ser den.
- **Omvisning** første gang du åpner en tur — én for reiseledere, én for deltakere.
- **Lys visning.** Appen er lys uansett hva telefonen står på.
- **Offline** — appen caches, og siste turdata vises selv uten nett. Meldinger krever nett.

## Sett opp databasen

Appen trenger et Supabase-prosjekt. Gratisplanen holder godt for utprøving.

1. **Lag prosjekt** på [supabase.com](https://supabase.com) → *New project*.
   Velg en **region i EU** (f.eks. Frankfurt) — dette er elevdata.
2. **Kjør skjemaet.** Åpne *SQL Editor*, lim inn hele `schema.sql` fra det private repoet
   [TourFlowUB/tripmate-supabase](https://github.com/TourFlowUB/tripmate-supabase) og kjør. Den lager tabeller, regler for hvem som får lese og skrive, og funksjonene
   `join_trip` og `create_trip`.
3. **Slå på anonym pålogging.** *Authentication → Sign In / Providers → Anonymous sign-ins* → på.
   Hver enhet får da en identitet uten at noen må lage passord.
4. **Fyll inn nøklene** i [`js/config.js`](js/config.js). Begge finnes under
   *Project Settings → API*:
   - `supabaseUrl` — *Project URL*
   - `supabaseAnonKey` — nøkkelen merket **anon public**

Anon-nøkkelen er laget for å ligge åpent i en nettside. Det er reglene i databasen som
bestemmer hva noen får lese og skrive, ikke nøkkelen. **`service_role`-nøkkelen skal aldri
inn i dette repoet** — den går utenom alle regler.

## Kjør lokalt

Service workers krever `http://`, ikke `file://`:

```bash
python -m http.server 8080
```

## Legg ut på GitHub Pages

**Settings → Pages → Source: Deploy from a branch**, branch `main`, mappe `/ (root)`.
Alle stier er relative, så appen virker like godt i en undermappe som på eget domene.

## Filstruktur

| Fil | Ansvar |
|---|---|
| `index.html` | Skjelettet: oppstart, join-skjerm, app-skall, ark |
| `styles.css` | Alt av utseende, lys og mørk variant |
| `js/config.js` | Hvilket Supabase-prosjekt appen snakker med |
| `js/api.js` | **All kontakt med databasen.** Ingen andre filer snakker med Supabase |
| `js/parse.js` | Melding → møtested, dato, klokkeslett |
| `js/templates.js` | Ferdige turer for «lag eksempeltur» |
| `js/ui.js` | Skjermer, navigasjon, hendelser |
| `sw.js` | Offline-cache og varsler. Bump `BUILD` sammen med `?v=` i index.html |

Databaseoppsettet og serverfunksjonene ligger i et eget, privat repo:
[TourFlowUB/tripmate-supabase](https://github.com/TourFlowUB/tripmate-supabase). Denne
siden må ligge åpent for at GitHub Pages skal virke — det må ikke serverdelen.

## Sikkerhet — hva som er på plass

Reglene ligger i databasen, ikke i appen. En bruker som omgår appen og snakker direkte med
API-et møter de samme reglene.

- **Radsikkerhet på alle tabeller.** Du kan bare lese turer du er medlem av. Innmelding går
  gjennom `join_trip()`, som er den eneste veien inn.
- **Roller.** Bare reiseledere endrer program, steder, dager og hotell. Alle medlemmer kan
  skrive meldinger og lage gruppechatter.
- **Private chatter er private.** Tilgang følger chatten, ikke turen. En privat chat og
  meldingene i den er usynlige for alle som ikke er lagt til — reiseledere inkludert.
- **Meldinger** skrives i eget navn — `author_id` må være din egen bruker. Du kan slette
  dine egne; reiseleder kan slette alle.
- **Anonym pålogging** gir hver enhet en identitet. Ingen passord å miste.
- **Grenser** på lengde av meldinger og antall turer per bruker.

## Sikkerhet — hva som gjenstår

- **Navnet er selvvalgt.** Hvem som helst kan skrive «Kari Lund» og se ut som en lærer.
  Fikses med engangskode på e-post eller SMS, eller ved at reiseleder godkjenner deltakere.
- **Turkoden er en delt hemmelighet.** Lekker den, kommer hvem som helst inn. Reiselederen
  kan nå lage en ny kode, og da slutter den gamle å virke. Å stenge turen helt for nye
  deltakere er fortsatt ikke mulig — men reiseleder kan kreve å godkjenne hver som blir med.
- **Ingen automatisk sletting.** Meldinger og deltakerlister bør slettes en gitt tid etter
  turen, ikke ligge til evig tid.
- **Ingen moderering utover sletting.** Reiseleder bør kunne stenge en chat og fjerne
  deltakere som ikke skal være der.
- **Personvern.** Dette er personopplysninger om mindreårige i skolesammenheng. Skolen
  trenger databehandleravtale med Supabase, og en personvernkonsekvensvurdering (DPIA) er
  sannsynligvis påkrevd før ekte bruk.
- **Filopplasting** er ikke bygget. Program legges inn manuelt.

## Når du har endret noe

Appen ligger i offline-lageret på folks telefoner, og nettleseren har sitt eget mellomlager
i tillegg. Begge må brytes, ellers ser folk den gamle versjonen i timevis.

Bump derfor **to tall til samme verdi** for hver utrulling:

1. `?v=` på alle `<script>` og `<link>` i `index.html`
2. `const BUILD` øverst i `sw.js`

Nye filadresser går utenom begge lagrene. Service workeren henter dessuten siden ferskt ved
hver navigasjon, og `index.html` laster seg selv på nytt én gang når en ny versjon tar over.
