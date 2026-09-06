# Sprint 11, Agent 3 — KDP-Upload-Bundle: Abschlussbericht

## Ergebnis

KDP bietet keine Public API — die Produktoberflaeche ist ein perfektes
Manual-Upload-Paket: Manuskript + Cover + Manifest als ZIP, das der Autor
unveraendert im KDP-Webformular hochlaedt.

## Neue Dateien

- `src/services/bookwriter/kdpPackage.ts`
  - `buildKdpBundle(input)`: hasht Manuskript (+ Cover) mit SHA256 (WebCrypto),
    validiert per importiertem `validateUploadArtefact` (kdpUploadValidation),
    uebernimmt die Checkliste per importiertem `buildUploadPackage` (kdpUpload).
    Keine eigene Prueflogik, keine Kopien.
  - Manifest (`kdp-manifest.json`): Titel, Autor, Sprache, ISBN (optional/null),
    ISO-Zeitstempel, Datei-Hashes, Validierungsstand, Checkliste, Cover-Nachweis.
  - `canUpload`-Gate: `validation.isValid && coverPresent` (KDP lehnt Buecher
    ohne Cover im Review ab; die Datei-Validierung prueft Cover nicht, daher
    das zusaetzliche Gate — dokumentiert, nicht dupliziert).
  - `verifyBundleHashes`: recomputet SHA256 und vergleicht (Integritaet).
  - `bundleToZip` / `downloadBundleAsZip`: ZIP via **JSZip (bereits installiert,
    `^3.10.1`, gleiche Lib wie `releasePackage.ts`) — keine neuen Dependencies.**
- `src/components/KDP/KdpPackagePanel.tsx`
  - Bundle-Vorschau: Dateien, Groessen, Kurz-Hashes (Tooltip: voll), Checkliste,
    Issues, Validierungsstatus; Download-als-ZIP-Button (deaktiviert bis
    `canUpload`); Hinweis auf manuellen Upload unter kdp.amazon.com.
- `src/services/bookwriter/kdpPackage.test.ts` — **17 Tests** (Mindestsoll: 10).

## Checklisten-Wiederverwendung (Import statt Kopie)

- Service: `validateUploadArtefact` + `buildUploadPackage` aus den
  Sprint-7/9-Services importiert.
- Panel: zeigt die im Manifest eingebettete Checkliste an; die separate
  `buildPreUploadChecklist`-UI-Logik (Sprint 9, inkl. Cover-Pflichtpunkt) bleibt
  der Upload-Dialog-Gate — bewusst nicht in den Service importiert (keine
  Service→Komponenten-Abhaengigkeit, kein CSS/React im Service).

## Verifikation

- `vitest run src/services/bookwriter/kdpPackage.test.ts`: **17/17 gruen**.
- `eslint` (3 neue Dateien, `--max-warnings 0`): sauber.
- `tsc --noEmit`: einziger Fehler in `src/services/bookwriter/lektorat.ts`
  (TS6133, ungenutzte Variable) — pre-existing, nicht von diesem Agenten.
- Testabdeckung: Manifest-Korrektheit (Titel/Autor/Sprache/ISBN/Groessen),
  SHA256-Stabilitaet + bekannter Vektor (`abc`), Gate-Faelle (PDF-Format,
  Pflichtfeld, fehlendes Cover), Hash-Verifikation (intakt/manipuliert/fehlend),
  ZIP-Inhalt (mit/ohne Cover).

## Offene Punkte / Hinweise fuer Integration

- Panel ist noch nirgends eingebunden (kein Router-Eingriff in diesem Task);
  Vorschlag: neben `KdpPreUploadChecklist` im Publishing-/Export-Flow rendern,
  Manuskript-Blob aus `exportBook` uebergeben.
- `lektorat.ts`-Lintfehler (pre-existing) sollte ein anderer Agent beheben.
