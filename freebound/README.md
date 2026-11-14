# FREEBOUND

Singleplayer-3D-Open-World-Sandbox im Stil von Wobbly Life, ohne Waffen und Gewalt.
Läuft als einzelne `www/index.html` im Browser (PC und Smartphone) und als Android-App per Capacitor.

## Inhalt

- Stadt mit Straßen, Blöcken, Parks, Strand und Meer (Festland bis x=236, Wasser ab x=240)
- Tag-/Nachtzyklus, wechselndes Wetter (klar, bewölkt, Regen)
- Charaktersteuerung: laufen, sprinten, springen, schwimmen, an Gebäuden klettern
- Gegenstände greifen, tragen und werfen, mit einfacher Physik
- Fahrzeuge: Auto, Taxi, Transporter, Rennwagen, Motorrad, Roller, Fahrrad, Boot
- Jobs: Paketzusteller, Taxifahrer, Pizzalieferant; Rennen über 8 Tore
- Geld, Autohaus, Kleiderladen (6 Outfits), Haus mit begehbarem Innenraum
- Münzen und ein geheimer Dachcoin, der nur durch Klettern erreichbar ist
- Speichern und Fortsetzen im lokalen Speicher (localStorage)
- Steuerung: PC mit WASD, Maus, Leertaste, E; Smartphone mit Joystick und Touch-Tasten

## Entwicklung

```bash
npm install
npm run build          # erzeugt www/index.html aus src/
```

`src/game.js` enthält die Spiellogik, `src/index.template.html` Menüs und HUD.
`build.js` bettet Three.js (r160) und das Spiel in eine Datei ein.

## Android

Der Workflow `.github/workflows/freebound-apk.yml` (im Repo-Wurzelverzeichnis) baut bei jedem Push
auf den Branch `freebound` eine Debug-APK und veröffentlicht sie im Release `freebound-latest` als `Freebound.apk`.
Der Branch `main` mit UNBOUND bleibt davon unberührt. Die Debug-APK ist mit dem Debug-Schlüssel
signiert und eignet sich zum Testen, nicht für den Play Store.

## Bekannte Einschränkungen

- Die Spezifikation umfasst deutlich mehr Inhalt als diese Version. Nicht enthalten sind
  Hubschrauber, Flugzeuge, Busse, Lastwagen, Landwirt- und Mechaniker-Job, Feuerwehr-Job,
  Müllabfuhr sowie Kleidung und Geschäfte in allen Stadtteilen.
- Ragdoll ist eine vereinfachte Tumble-Animation des Charakters, keine Gelenkphysik.
- Fußgänger laufen auf festen Gehwegrunden und weichen dem Spieler nicht aus.
- Keine Level-of-Detail-Stufen; die Stadt ist für Smartphones klein gehalten.
- Multiplayer ist nicht enthalten. Die Spielzustände sind jedoch als Daten gekapselt (`collectSave`),
  so dass sich später eine Synchronisation ergänzen ließe.
