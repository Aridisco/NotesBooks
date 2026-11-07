# Sketchbooks

App di taccuini: disegno a mano libera, testo, tabelle, LaTeX, circuiti, PDF e note vocali su una tela infinita.
Salva in locale (localStorage / IndexedDB) e, dopo il login con Google, su Firestore.

## Indice

1. [Cos'è l'app](#cosè-lapp)
2. [Funzionalità](#funzionalità)
3. [Come si usa](#come-si-usa)
4. [Sviluppo](#sviluppo)
5. [Deploy](#deploy-firebase-hosting)
6. [Architettura](#architettura)
7. [Sicurezza](#sicurezza)
8. [Decisioni di progetto](#decisioni-di-progetto)
9. [Bug report](#bug-report)

## Cos'è l'app

Un taccuino infinito nel browser, pensato per essere usato soprattutto con il dito o con la penna (touch-first).
Ogni taccuino è composto da pagine; ogni pagina è una lista di oggetti (tratti, forme, testo, tabelle, formule, grafici, immagini, PDF, blocchi di codice, circuiti, note vocali) disegnati sulla tela.

Organizzazione: **libreria → taccuino → pagina**, un solo percorso di navigazione.

## Funzionalità

- **Disegno**: penna, evidenziatore (tratti traslucidi sotto l'inchiostro), forme, poligoni da 3 a 12 lati modificabili dopo il disegno, gomma, pan.
- **Testo e tabelle**: tabelle con dimensioni per riga/colonna, inserimento ed eliminazione ovunque, unione di celle, riga d'intestazione, colore e allineamento, celle multi-riga, trascinamento delle linee di griglia.
- **Codice**: blocchi di codice in una finestra 560x320 ridimensionabile, con a capo, Tab / Shift+Tab per indentare, Invio che mantiene l'indentazione. Colorazione sintattica per C#, XAML, JS/TS, Python, HTML, CSS, C/C++, Java/Kotlin, SQL, JSON.
- **Matematica**: pannello formule con editor visuale (MathLive), risolutore (nerdamer), calcoli su numeri complessi, MCD/mcm, statistica, grafici di funzioni modificabili dal vivo. Il risultato può essere inserito nella pagina come formula renderizzata.
- **Circuiti**: componenti elettronici disegnabili sulla pagina.
- **PDF**: si importano PDF come sfondo/oggetti; si esportano pagine o taccuini in PDF (le pagine sono immagini).
- **Note vocali**: registrazione con trascrizione live (riconoscimento vocale del browser) e audio salvato sul dispositivo.
- **Pagine A4**: vista di un foglio singolo o di due fogli A4 affiancati; toccando uno dei due si disegna su quello.
- **Temi**: "Warm paper" e "Minimal", ciascuno in versione chiara e scura; la scelta è salvata e applicata prima del primo paint.
- **Cronologia pagina**: snapshot locali (massimo uno ogni 5 minuti, fino a 20 per pagina) per ripristinare versioni precedenti.
- **Palette comandi**: Ctrl/Cmd+K.
- **Renderer GPU**: la tela viene disegnata da tile in cache composite con WebGL; "Renderer" nel menu More passa al renderer classico 2D.
- **Cloud**: login Google, salvataggio e sincronizzazione su Firestore, con dialogo di conflitto e protezione contro pagine danneggiate.
- **Backup**: esportazione e importazione del contenuto in JSON.

## Come si usa

- **Barra inferiore**: selezione, penna, forme, testo, blocco di codice e un menu con altri strumenti. Alcuni strumenti si possono fissare sulla barra, altri spostare nei menu (personalizzazione).
- **Barra contestuale**: compare vicino all'oggetto selezionato con colori rapidi, duplica, blocca ed elimina. Il pulsante con i cursori apre il pannello proprietà (W/H esatti, spessore del tratto, dimensione testo in px, preset H1/H2/H3/Body, colori personalizzati). Il pannello ha larghezza fissa.
- **Con la penna**: le dita servono solo a spostare e zoomare; un palmo appoggiato non interrompe il tratto.
- **Selezione a riquadro**: seleziona tutti gli oggetti toccati dal riquadro; linee e tratti sono controllati lungo il loro percorso.
- **Menu > Sheet > Two A4 pages**: pagine affiancate.
- **Tastiera**: Page Up / Page Down cambiano pagina; Ctrl/Cmd+K apre la palette comandi.
- **Esporta**: menu Export nella barra in alto.
- **Cronologia**: "Page history" ripristina una versione precedente della pagina (salvata solo su questo dispositivo).

## Sviluppo

```bash
npm install
cp .env.example .env   # inserisci la configurazione web di Firebase
npm run dev            # http://localhost:5173
npm test               # test unitari (Vitest)
npm run build          # build di produzione in dist/
```

Il file `.env` non va committato (è in `.gitignore`).
Il server di sviluppo è configurato in `.claude/launch.json` (porta 5173).

## Deploy (Firebase Hosting)

```bash
npm run build
npx firebase-tools deploy --only hosting
```

Le regole sono in `firestore.rules`, collegate in `firebase.json`. Per pubblicare anche quelle:

```bash
npx firebase-tools deploy --only firestore:rules,hosting
```

Il nuovo formato cloud usa versioni per pagina. Prima del primo salvataggio con la nuova app, aggiornare/ricaricare l'app su tutti i dispositivi e chiudere le schede con la versione precedente: i vecchi client non supportano il nuovo formato. La nuova app legge i dati precedenti e li converte al primo salvataggio, senza eliminarli.

Aggiungi il dominio di hosting in Firebase Authentication > Authorized domains, altrimenti il login Google fallisce con `auth/unauthorized-domain`.

Il progetto Firebase è `nonte-c00a8` (`.firebaserc`).

Il 7 novembre 2026 sono stati pubblicati hosting e regole su https://nonte-c00a8.web.app. HTML, JavaScript e CSS online corrispondono byte per byte alla build locale; le regole attive corrispondono al file versionato e hanno superato 17 verifiche con il motore di Firebase. Una lettura senza autenticazione sul database pubblicato è stata respinta con HTTP 403. La prova di sincronizzazione è riuscita con due sessioni Chrome isolate sullo stesso Mac e lo stesso account Google: salvataggio dalla prima, lettura e modifica dalla seconda, rilettura nella prima dopo ricaricamento completo. Il taccuino temporaneo è stato rimosso dalla libreria cloud; i contenuti dei taccuini preesistenti sono rimasti invariati, verificati tramite confronto SHA-256. La rimozione è stata ricevuta anche dalla seconda sessione.

## Architettura

Progetto Vite con moduli ES, senza framework. Stack: Vite 8, Vitest 5, Firebase compat SDK 10.12.2 (da gstatic), MathLive 0.111.1 (npm).
Caricati da CDN a runtime: MathJax 3.2.2 e nerdamer 1.1.13 (cdnjs/jsDelivr), pdf.js 3.11.174 (cdnjs), font Google (Caveat, Figtree, Lora, JetBrains Mono, Permanent Marker).

Moduli principali:

- `src/state.js`: stato condiviso mutabile (`ST`); i moduli leggono e scrivono `ST.<nome>`. Carica anche i taccuini salvati.
- `src/main.js`: punto d'ingresso; importa i moduli, imposta lo strumento iniziale, avvia il cloud.
- `src/cloud.js`: login, salvataggio e caricamento; le funzioni pure stanno in `src/syncLogic.js` (divisione in pezzi da 300 000 caratteri, batch sotto i limiti Firestore, lettura delle versioni e decisione di sincronizzazione).
- `src/render.js`, `src/scene.js`: disegno della tela. `scene.js` gestisce le tile WebGL e il renderer classico.
- `src/input.js`, `src/edit.js`: puntatore, dita/penna, selezione e modifica degli oggetti.
- `src/toolbar.js`: barra inferiore, barra contestuale, pannello proprietà, personalizzazione.
- `src/objects.js`, `src/tableOps.js`, `src/stats.js`, `src/geom.js`: oggetti, tabelle, statistica, geometria.
- `src/math.js`, `src/graph.js`: pannello matematica e grafici.
- `src/circuit.js`: componenti dei circuiti.
- `src/code.js`, `src/highlight.js`: blocchi di codice e colorazione sintattica.
- `src/pdf.js`: scrittura PDF. `src/books.js`: caricamento PDF (pdf.js) e sfondi.
- `src/voice.js`: note vocali e trascrizione.
- `src/versions.js`: cronologia pagina (IndexedDB).
- `src/notebooks.js`: libreria, cestino, taccuini.
- `src/palette.js`: palette comandi (Ctrl/Cmd+K).
- `src/dialog.js`: finestre di scelta modali.
- `src/report.js`: raccolta errori (console + toast).
- `src/platform.js`: accesso a IndexedDB e funzioni di piattaforma.
- `src/env.js`: costanti (font, colori, temi), caricamento script esterni, rilevamento touch.
- `src/a11y.js`: etichette accessibili e supporto tastiera.
- `src/styles/main.css`: stili e temi.
- `src/scriptIntegrity.js`: hash SHA-384 delle risorse CDN caricate dinamicamente; gli script Firebase hanno gli hash in `index.html`.
- `test/`: test per backup, geometria, evidenziatura, PDF, sincronizzazione, operazioni tabella, cronologia, aggancio dell’input, voce, API di piattaforma e caricamento sicuro degli script.

## Sicurezza

La configurazione web di Firebase è pubblica una volta compilata: non è un segreto. La protezione dei dati sta nelle **regole di Firestore**, che devono limitare ogni utente ai propri dati:

```
match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }
```

Le regole sono versionate in `firestore.rules`. Il 7 novembre 2026 sono state confrontate con quelle attive nel progetto `nonte-c00a8`: la condizione di accesso coincide. Il motore di Firebase ha superato 17 casi di verifica delle regole locali: lettura/scrittura consentite al proprietario, negate senza autenticazione o con un altro UID, accesso negato fuori da `users/{uid}`, accesso consentito alle sottocollezioni del proprietario. Questa verifica non ha pubblicato regole né scritto dati dell'app.

Gli script CDN espliciti di Firebase, MathJax, Nerdamer e pdf.js hanno hash SHA-384 e `crossorigin="anonymous"`. Il worker PDF viene scaricato con `fetch(..., { integrity })` e avviato da un URL locale solo dopo la verifica. Il caricatore dinamico rifiuta URL privi di hash. Gli hash vanno aggiornati insieme alle versioni delle librerie; il controllo del browser segue [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity).

Le correzioni dei punti 3–6 e 8 del piano sono state pubblicate su Firebase il 7 novembre 2026. I quattro file serviti dal sito coincidono byte per byte con la build locale; sul sito online sono stati verificati Firebase con SRI, toast per URL non valido, importazione PDF con worker verificato, blocco di uno script alterato e successivo caricamento corretto di MathJax e Nerdamer. Queste prove sono state effettuate in una sessione Chrome isolata senza accesso Google e senza scritture cloud. La suite passa con 12 file e 110 test; `npm audit --package-lock-only` non segnala vulnerabilità note. In Chrome sono stati verificati il toast per un URL non valido, il blocco di uno script alterato, il successivo caricamento valido di MathJax/Nerdamer, Firebase e l’importazione di un PDF con worker verificato. Microfono e dettatura reali non sono stati provati.

L’avviso del chunk MathLive (800,76 kB, 220,02 kB gzip) è accettato dall’utente: il modulo è già caricato su richiesta e la soglia Vite resta invariata. Cambiare [`build.chunkSizeWarningLimit`](https://vite.dev/config/build-options#build-chunksizewarninglimit) cambia l’avviso, non la dimensione del file.

## Decisioni di progetto

Le decisioni sono ricavate dai commit e dal codice; vanno verificate e completate.

1. **Local-first**: l'app funziona senza account. I dati stanno sul dispositivo (localStorage, IndexedDB) e il cloud è opzionale, attivato dal login Google.
2. **Cloud su Firestore con login Google**, dati sotto `users/{uid}`.
3. **Sincronizzazione prudente**: i pezzi delle pagine modificate hanno una nuova versione, separata da quelle già pubblicate. `meta` pubblica per ultimo i riferimenti alle versioni e il numero dei pezzi. Un'interruzione tra batch lascia leggibile la copia precedente; il caricamento rifiuta una pagina pubblicata con pezzi mancanti o contenuto danneggiato. In caso di modifiche su entrambi i lati si chiede all'utente (dialogo di conflitto) invece di unire in silenzio. Le versioni precedenti e quelle abbandonate non vengono ancora eliminate, quindi spazio e letture cloud crescono con i salvataggi.
4. **Guardia contro pagine danneggiate**: una pagina corrotta non sovrascrive quella buona nel cloud.
5. **Vite e moduli ES senza framework**: stato condiviso in un unico oggetto `ST`, nessun framework UI.
6. **Firebase Hosting** per la pubblicazione.
7. **Touch-first**: barra inferiore con contesto, penna separata dalle dita (le dita non disegnano quando è in uso la penna).
8. **Renderer a tile con WebGL** per la fluidità (misurato: 2.500 oggetti da 9,0 a 1,1 ms per frame), con fallback 2D e possibilità di scegliere il renderer dal menu.
9. **Tabella e statistica come moduli puri testati**, separati dal DOM.
10. **PDF esportati come immagini** delle pagine (semplicità a scapito della dimensione e della selezionabilità del testo).
11. **Cronologia pagina solo locale**, con snapshot al massimo ogni 5 minuti e 20 versioni per pagina.
12. **Note vocali salvate sul dispositivo**, con trascrizione live del browser.
13. **Strumenti spostabili**: l'utente sceglie quali strumenti stanno sulla barra; le preferenze sono versionate, così i nuovi default si applicano una volta sola.
14. **Due temi** (Warm paper, Minimal), ciascuno chiaro e scuro, applicati prima del primo paint per evitare il flash.
15. **Librerie pesanti caricate a parte**: MathJax, nerdamer e pdf.js arrivano da CDN solo quando servono; MathLive è un chunk npm caricato in modo lazy.

## Bug report

Lo stato dei problemi è in [`bug report/`](bug%20report/):

- [`bug report/risolti.md`](bug%20report/risolti.md): problemi già risolti, con il commit che li risolve.
- [`bug report/da_fixare.md`](bug%20report/da_fixare.md): problemi aperti, in ordine di priorità.
