/* © 2026 TripMate UB. Alle rettigheter forbeholdt / All rights reserved.
   Koden ligger åpent fordi en nettside må sende koden sin til alle som
   besøker den. Det gir ingen rett til å kopiere, endre eller ta den i
   bruk. Se LICENSE. */

/* templates.js — ferdige turer du kan opprette med ett trykk.
   Brukes bare når noen velger «Lag eksempeltur»; ekte turer bygges i appen.
   Datoene er relative, så en eksempeltur alltid ligger litt fram i tid. */

const TEMPLATES = [
  {
    key: "berlin",
    name: "Berlin",
    org: "Klassetur",
    startInDays: 14,
    lengthLabel: "5 dager",
    blurb: "To hoteller, bytte til Potsdam underveis — viser hvordan «hotellet» betyr ulike steder ulike dager.",

    places: {
      moabit: { name:"Hotel Moabit Plaza", addr:"Stromstraße 62, 10551 Berlin", kind:"Hotell", lat:52.5265, lon:13.339 },
      havel:  { name:"Pension Havelblick", addr:"Zeppelinstraße 136, 14471 Potsdam", kind:"Hotell", lat:52.393, lon:13.032 },
      brand:  { name:"Brandenburger Tor", addr:"Pariser Platz, 10117 Berlin", kind:"Attraksjon", lat:52.5163, lon:13.3777 },
      mauer:  { name:"Gedenkstätte Berliner Mauer", addr:"Bernauer Straße 111, 13355 Berlin", kind:"Museum", lat:52.539, lon:13.39 },
      tech:   { name:"Deutsches Technikmuseum", addr:"Trebbiner Straße 9, 10963 Berlin", kind:"Museum", lat:52.4985, lon:13.378 },
      hbf:    { name:"Berlin Hauptbahnhof", addr:"Europaplatz 1, 10557 Berlin", kind:"Stasjon", lat:52.525, lon:13.3694 },
      sans:   { name:"Schloss Sanssouci", addr:"Maulbeerallee, 14469 Potsdam", kind:"Slott", lat:52.4042, lon:13.0386 },
      osl:    { name:"Oslo lufthavn, terminal 2", addr:"Edvard Munchs veg, 2061 Gardermoen", kind:"Flyplass", lat:60.1939, lon:11.1004 }
    },

    days: [
      { offset:0, hotel:"moabit", items:[
        { t:"05:40", title:"Oppmøte innsjekk", place:"osl" },
        { t:"08:10", title:"Fly til Berlin", note:"Gate oppgis på Gardermoen" },
        { t:"12:30", title:"Innsjekk hotell og romfordeling", place:"moabit" },
        { t:"18:00", title:"Felles middag", place:"moabit" }
      ]},
      { offset:1, hotel:"moabit", items:[
        { t:"07:45", title:"Avreise fra lobbyen", place:"moabit" },
        { t:"09:30", title:"Omvisning Berlinmuren", place:"mauer" },
        { t:"12:15", title:"Lunsj på egen hånd", note:"Møtes igjen 13:45" },
        { t:"14:00", title:"Gruppeoppgave: fotodokumentasjon", place:"brand" },
        { t:"18:30", title:"Kveldsmat på hotellet", place:"moabit" }
      ]},
      { offset:2, hotel:"moabit", items:[
        { t:"09:00", title:"Deutsches Technikmuseum", place:"tech" },
        { t:"15:00", title:"Fritid i grupper", note:"Minst tre sammen" },
        { t:"20:00", title:"Innetid", place:"moabit" }
      ]},
      { offset:3, hotel:"havel", items:[
        { t:"08:30", title:"Utsjekk, bagasje på buss", place:"moabit" },
        { t:"10:45", title:"Tog til Potsdam", place:"hbf" },
        { t:"13:00", title:"Innsjekk Potsdam", place:"havel" },
        { t:"15:00", title:"Schloss Sanssouci", place:"sans" }
      ]},
      { offset:4, hotel:"havel", items:[
        { t:"09:15", title:"Utsjekk og avreise", place:"havel" },
        { t:"14:20", title:"Fly til Oslo" }
      ]}
    ],

    channels: [
      { name:"Gruppe muren", sub:"Fotooppgave" },
      { name:"Gruppe museum", sub:"Technikmuseum" },
      { name:"Reiseledere", sub:"Kun ledere" }
    ]
  },

  /* En tur som alt er i gang. Berlin-malen starter om to uker, og da
     viser «I dag» bare en nedtelling — dagstripa og nå-kortet får
     ingenting å vise. Denne startet i går, så i dag er dag 2 og hele
     skjermen er i full drift. Det er denne man prøver appen med. */
  {
    key: "paris",
    name: "Paris",
    org: "Klassetur",
    startInDays: -1,
    lengthLabel: "7 dager, dag 2 i dag",
    blurb: "Startet i går, så «I dag» har program, dagstripe og neste punkt med én gang. Sju dager, gruppedag, og to gruppechatter.",

    places: {
      lafayette: { name:"Hôtel Lafayette Nord", addr:"18 Rue de Dunkerque, 75010 Paris", kind:"Hotell", lat:48.88, lon:2.353 },
      louvre:    { name:"Musée du Louvre", addr:"Rue de Rivoli, 75001 Paris", kind:"Museum", lat:48.8606, lon:2.3376 },
      notre:     { name:"Notre-Dame", addr:"6 Parvis Notre-Dame, 75004 Paris", kind:"Kirke", lat:48.853, lon:2.3499 },
      versailles:{ name:"Slottet i Versailles", addr:"Place d'Armes, 78000 Versailles", kind:"Slott", lat:48.8049, lon:2.1204 },
      eiffel:    { name:"Eiffeltårnet", addr:"Champ de Mars, 5 Avenue Anatole France, 75007 Paris", kind:"Attraksjon", lat:48.8584, lon:2.2945 },
      sacre:     { name:"Sacré-Cœur", addr:"35 Rue du Chevalier de la Barre, 75018 Paris", kind:"Kirke", lat:48.8867, lon:2.3431 },
      orsay:     { name:"Musée d'Orsay", addr:"1 Rue de la Légion d'Honneur, 75007 Paris", kind:"Museum", lat:48.86, lon:2.3266 },
      arc:       { name:"Triumfbuen", addr:"Place Charles de Gaulle, 75008 Paris", kind:"Attraksjon", lat:48.8738, lon:2.295 },
      cdg:       { name:"Paris Charles de Gaulle, terminal 2E", addr:"95700 Roissy-en-France", kind:"Flyplass", lat:49.0045, lon:2.5712 },
      osl:       { name:"Oslo lufthavn, terminal 2", addr:"Edvard Munchs veg, 2061 Gardermoen", kind:"Flyplass", lat:60.1939, lon:11.1004 }
    },

    days: [
      { offset:0, hotel:"lafayette", items:[
        { t:"05:30", title:"Oppmøte innsjekk", place:"osl", note:"Ta med pass. Møt opp ved skranke C." },
        { t:"08:45", title:"Fly til Paris" },
        { t:"13:30", title:"Innsjekk hotell og romfordeling", place:"lafayette" },
        { t:"17:00", title:"Bli kjent-tur i nabolaget", place:"lafayette" },
        { t:"19:30", title:"Felles middag", place:"lafayette" }
      ]},
      { offset:1, hotel:"lafayette", items:[
        { t:"08:15", title:"Avreise fra lobbyen", place:"lafayette" },
        { t:"10:00", title:"Louvre — kunsthistorie", place:"louvre", minutter:180, note:"Vi går sammen inn, så fri vandring i to timer." },
        { t:"13:00", title:"Lunsj i Tuileries", note:"Ta med matpakke fra hotellet" },
        { t:"15:00", title:"Notre-Dame og Île de la Cité", place:"notre", minutter:90 },
        { t:"19:00", title:"Middag på hotellet", place:"lafayette" },
        { t:"22:00", title:"Innetid", place:"lafayette" }
      ]},
      { offset:2, hotel:"lafayette", items:[
        { t:"08:30", title:"Tog til Versailles", place:"lafayette" },
        { t:"10:00", title:"Slottet og hagene", place:"versailles", minutter:300 },
        { t:"16:00", title:"Tilbake til byen" },
        { t:"18:30", title:"Middag på hotellet", place:"lafayette" }
      ]},
      { offset:3, hotel:"lafayette", items:[
        { t:"09:30", title:"Gruppe Eiffeltårnet", place:"eiffel", minutter:240, note:"Se gruppechatten" },
        { t:"09:30", title:"Gruppe museum", place:"orsay", minutter:240, note:"Se gruppechatten" },
        { t:"16:30", title:"Felles samling", place:"sacre", minutter:60 },
        { t:"21:00", title:"Innetid", place:"lafayette" }
      ]},
      { offset:4, hotel:"lafayette", items:[
        { t:"10:00", title:"Musée d'Orsay", place:"orsay" },
        { t:"14:00", title:"Fritid i grupper", note:"Minst tre sammen" },
        { t:"19:00", title:"Middag ute", note:"Kvitteringen leveres til reiseleder" }
      ]},
      { offset:5, hotel:"lafayette", items:[
        { t:"10:00", title:"Triumfbuen og Champs-Élysées", place:"arc" },
        { t:"14:00", title:"Fritid og shopping" },
        { t:"20:00", title:"Avslutningsmiddag", place:"lafayette" }
      ]},
      { offset:6, hotel:"lafayette", items:[
        { t:"08:00", title:"Utsjekk", place:"lafayette", note:"Rommene tømmes, bagasjen settes i lobbyen" },
        { t:"09:30", title:"Buss til flyplassen", place:"lafayette" },
        { t:"12:40", title:"Fly til Oslo", place:"cdg" }
      ]}
    ],

    channels: [
      { name:"Gruppe Eiffeltårnet", sub:"Gruppedagen" },
      { name:"Gruppe museum", sub:"Gruppedagen" },
      { name:"Reiseledere", sub:"Kun ledere" }
    ]
  }
];

/* Gjør om «om 14 dager» til faktiske datoer og en lesbar periode. */
function templateDates(tpl) {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() + tpl.startInDays);
  const dates = tpl.days.map(d => {
    const x = new Date(start);
    x.setDate(start.getDate() + d.offset);
    return x.toISOString().slice(0, 10);
  });
  const f = s => new Date(s + "T12:00:00").toLocaleDateString("nb-NO", { day:"numeric", month:"long" });
  return { dates, label: `${f(dates[0])}–${f(dates[dates.length - 1])}` };
}
