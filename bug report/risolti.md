# Bug risolti

Elenco dei problemi già risolti. Il commit indica dove è stata applicata la correzione.
Le voci derivano dai messaggi di commit e dal codice; la verifica di ciascuna va fatta sul dispositivo.

| # | Problema | Soluzione | Commit |
|---|----------|-----------|--------|
| 1 | Sincronizzazione cloud non sicura: scritture non a batch, rischio di versioni incoerenti tra dispositivi | Scritture a batch sotto i limiti Firestore; `meta` scritto per ultimo | `19d2192` |
| 2 | Modifiche concorrenti su due dispositivi sovrascrivevano in silenzio | Dialogo di conflitto (`syncAction` in `src/syncLogic.js`) | `19d2192` |
| 3 | Una pagina danneggiata poteva sovrascrivere quella buona nel cloud | Guardia contro pagine danneggiate | `19d2192` |
| 4 | Errori invisibili all'utente | Raccolta errori con console e toast (`src/report.js`) | `19d2192` |
| 5 | Stroke della penna interrotti dal palmo appoggiato | Con la penna le dita fanno solo pan e zoom | `ebab8f2` |
| 6 | Menu che uscivano dallo schermo | I menu restano sempre visibili | `0fe8443` |
| 7 | Lentezza con molti oggetti: 2.500 oggetti a 9,0 ms per frame, 10.000 a 28,8 ms | Pagine in tile da 512 px composite con WebGL: 1,1 ms per frame in entrambi i casi | `d71861c` |
| 8 | Aggiornamenti di tile mancanti dopo caricamenti asincroni (immagini, PDF, font, solver grafici) | Invalidazione delle tile dopo ogni caricamento | `d71861c` |
| 9 | Zoom sfocato dopo lo zoom rapido | Dopo 160 ms la vista si ridisegna alla scala esatta | `d71861c` |
| 10 | Il riquadro di selezione non prendeva linee e tratti | Test lungo il percorso (`segInRect`, con test unitario) | `42be6dc` |
| 11 | Tratti selezionati subito dopo la fine del disegno | Penna ed evidenziatore non si selezionano al termine; si selezionano con lo strumento Select | `42be6dc` |
| 12 | Pannello proprietà che cambiava larghezza tra le schermate | Larghezza fissa su tutte le schermate | `42be6dc` |
| 13 | Logica di tabelle e statistica mescolata al DOM, non verificabile | Moduli puri `tableOps.js` e `stats.js` con test (`tableOps.test.js`) | `0fe8443` |
| 14 | README vecchio con riferimenti a `src/sidebar.js`, file rimosso nel redesign | README riscritto con l'architettura attuale | questo lavoro (non committato) |

Verifica attuale (5 novembre 2026): `npm test` passa con 6 file e 53 test; `npm run build` completa senza errori.

## Correzioni back-end pubblicate il 7 novembre 2026

### 1. Regole Firestore non presenti nel repository
- **Dove**: `firebase.json` (nessuna sezione `firestore`), nessun file `firestore.rules`; il README descrive la regola ma non è versionata.
- **Verifica**: 2026-11-06; area back-end/sicurezza; confermato da configurazione e file presenti nel repository; **priorità alta**.
- **Rischio**: se le regole nel progetto Firebase non sono quelle giuste, qualsiasi utente autenticato può leggere o scrivere dati altrui. Il deploy non le aggiorna.
- **Fix**: aggiungere `firestore.rules` con la regola `users/{uid}/**`, collegarla in `firebase.json` e distribuirla con `firebase deploy --only firestore:rules`. Verificare anche le regole attive in console.
- **Intervento**: aggiunti `firestore.rules` e il collegamento in `firebase.json`. Le regole attive nel progetto `nonte-c00a8` hanno già la stessa condizione di accesso. Il motore di Firebase ha superato tutti i 17 casi di verifica sulle regole locali (proprietario, altro UID, anonimo, percorsi esclusi e sottocollezioni).
- **Deploy e verifica**: regole pubblicate nel progetto `nonte-c00a8` il 7 novembre 2026. Il contenuto attivo coincide con `firestore.rules`; 17 verifiche del motore di Firebase superate sul sorgente pubblicato. Lettura reale senza autenticazione respinta con HTTP 403.
- **Stato**: risolto e pubblicato (modifiche locali non committate).

### 2. Scritture cloud non atomiche oltre un batch
- **Dove**: `src/cloud.js` (`flush`, `pull`) e `src/syncLogic.js` (`planBatches`, `decodePages`); il limite precedente era segnalato come `shortcut:`.
- **Verifica**: 2026-11-06; area back-end/sincronizzazione; limiti per batch di 400 operazioni o 8 MB e scritture per gruppi; **priorità alta**.
- **Rischio**: un salvataggio più grande di un batch (400 operazioni o 8 MB) non è atomico tra batch. Se si interrompe a metà, un altro dispositivo può leggere uno stato misto. Il `meta` è scritto per ultimo, ma questo protegge solo in parte.
- **Fix**: usare una transazione o un numero di versione per pagina, oppure ridurre le scritture per salvataggio.
- **Intervento**: scelta dall'utente la versione per pagina. I nuovi pezzi hanno identificativi separati, `meta` pubblica i riferimenti solo nell'ultimo batch e il caricamento legge soltanto le versioni referenziate. I salvataggi ripetuti sono serializzati e le modifiche locali fatte durante il salvataggio restano da salvare. Il formato precedente viene letto e convertito al primo salvataggio.
- **Verifiche**: test con oltre 400 operazioni, oltre 8 MB stimati, interruzione tra batch e riprova, vecchio snapshot ancora leggibile, migrazione, pagine ridotte/eliminate, modifiche durante il salvataggio e caricamenti danneggiati. Build completata; resta il warning MathLive già segnalato al punto 7.
- **Limiti**: tutti i dispositivi devono usare l'app aggiornata prima di salvare nel nuovo formato. Le versioni precedenti e abbandonate sono conservate: nessuna pulizia automatica, con crescita dello spazio e delle letture cloud. Prova eseguita con due sessioni Chrome isolate sullo stesso Mac; non verificati due dispositivi fisici separati.
- **Deploy e verifica**: app pubblicata il 7 novembre 2026 su `https://nonte-c00a8.web.app`; HTML, JavaScript e CSS online coincidono byte per byte con la build locale. Prova cloud completata con due sessioni Chrome isolate e lo stesso account Google: salvataggio A → lettura/modifica B → ricaricamento A, letture dirette dal server e versioni per pagina confermate. Taccuino temporaneo rimosso dalla libreria cloud, rimozione ricevuta anche da B. Contenuti preesistenti invariati rispetto al confronto SHA-256 iniziale.
- **Stato**: risolto, pubblicato e verificato tra due sessioni browser (modifiche locali non committate).

Verifiche automatiche dell’intervento: 7 file e 86 test passati, build riuscita con il warning MathLive già noto, 17 verifiche delle regole pubblicate passate e lettura anonima reale respinta con HTTP 403. I casi di interruzione tra batch sono stati simulati nei test automatici; non sono state provocate interruzioni sul database di produzione. Le vecchie versioni dei pezzi restano conservate, come previsto dall’implementazione.

## Seconda parte del piano — pubblicata il 7 novembre 2026

Le modifiche seguenti sono state pubblicate su Firebase Hosting. Nessun nuovo pacchetto aggiunto e nessuna modifica ai dati cloud durante queste verifiche. Le regole Firestore, già pubblicate nella prima parte, non sono state modificate da questo rilascio.

### 3. Errori silenziosi
- Aggiunto `report(..., { quiet: true })` ai `catch` segnalati in voce, toolbar, renderer, preferenze e matematica.
- Gestiti anche i rifiuti asincroni delle API fullscreen e batteria, gli eventi di errore della registrazione e del riconoscimento vocale, e il fallimento del salvataggio/eliminazione dell’audio.
- I messaggi già presenti per microfono negato e salvataggio audio fallito sono mantenuti. I test verificano che gli errori siano registrati senza toast aggiuntivi.
- **Stato**: risolto, pubblicato e verificato sul sito online.

### 4. Script CDN senza Subresource Integrity
- Scelta dell’utente: SRI e CORS anonimo sulle risorse attuali, senza migrazione a npm.
- Tre script Firebase protetti in `index.html`; sei script dinamici e il worker PDF hanno hash in `src/scriptIntegrity.js`. URL dinamici sconosciuti rifiutati dal caricatore.
- Il worker PDF usa la verifica `fetch` prima di essere avviato da URL blob, perché non dispone dell’attributo `integrity` di uno script HTML.
- Verificati SHA-384 e CORS di tutte e 10 le risorse. In Chrome uno script MathJax alterato è stato bloccato e non eseguito; ripristinato il CDN, MathJax ha prodotto SVG e Nerdamer ha calcolato 2+2=4. Firebase e importazione PDF con worker locale verificato funzionano.
- **Stato**: risolto, pubblicato e verificato sul sito online. Gli hash richiedono aggiornamento insieme alle librerie.

### 5. Cache Firebase non ignorata
- Aggiunta `.firebase/` a `.gitignore`; `git check-ignore` conferma l’esclusione della cache già presente.
- Nessuna cache eliminata.
- **Stato**: risolto in locale; modifica di configurazione Git, senza effetti sul sito.

### 6. Alert per URL non valido
- Il ramo URL non valido di `src/notebooks.js` usa il toast esistente con `role="status"` e `aria-live="polite"`.
- Verificato nel browser con un indirizzo `mailto:` rifiutato: appare il messaggio senza finestra nativa bloccante.
- **Stato**: risolto, pubblicato e verificato sul sito online.

### 7. Avviso MathLive in build
- Scelta dell’utente: accettare e documentare l’avviso, mantenendo la soglia Vite.
- MathLive resta lazy e separato dal bundle principale; la build riesce con il chunk di 800,76 kB (220,02 kB gzip).
- **Stato**: avviso accettato; nessuna configurazione o funzionalità modificata per nasconderlo.

### 8. Test mancanti
- Aggiunti test per `versions.js`: serializzazione indipendente, intervallo di 5 minuti, snapshot forzati, massimo 20 versioni per pagina, isolamento fra pagine, lettura/ordinamento, errori e debounce durante il cambio pagina.
- Aggiunti test dell’export `snp` di `input.js`: griglia, guide, tolleranza rispetto allo zoom, esclusione di oggetti e selezioni. Nessuna modifica all’algoritmo di input.
- Aggiunti anche test per errori voce/piattaforma e sicurezza del caricatore script. Totale: 12 file, 110 test passati.
- **Stato**: copertura mirata prevista dal piano completata. Restano fuori una copertura completa di rendering/WebGL e prove con microfono o penna reali.

Verifiche finali: 110 test passati, build riuscita con il solo avviso MathLive già accettato, audit npm senza vulnerabilità note e `git diff --check` pulito. Prove browser effettuate su build locale in una sessione Chrome isolata, senza accesso Google e senza scritture cloud. La seconda parte è stata successivamente pubblicata e verificata sul sito online, come riportato di seguito.


### Verifica del deploy della seconda parte

Deploy Firebase Hosting completato il 7 novembre 2026 su `https://nonte-c00a8.web.app`. Confronto SHA-256 dei quattro file online e locali riuscito: `index.html`, `index-hsY-0yXe.js`, `index-CdVaPVAr.css` e `mathlive.min-DQ9Gqdmh.js`.

Prove sul sito pubblicato, in una sessione Chrome isolata senza accesso Google:

- Firebase inizializzato e relativi script con SRI/CORS anonimo caricati.
- URL `mailto:` rifiutato con il toast previsto.
- PDF temporaneo importato; worker verificato e avviato da URL blob.
- Risposta MathJax alterata soltanto nella sessione di prova: il browser ne ha bloccato l’esecuzione per hash errato. Nessun file remoto modificato.
- Ripristinato il CDN nella sessione, MathJax ha prodotto SVG e Nerdamer ha restituito `4` per `2+2`. Nessuno script CDN caricato dalla pagina risultava privo di hash.

Restano da verificare microfono/dettatura reali e due dispositivi fisici separati. Nessuna scrittura sui taccuini cloud durante questa verifica. L’avviso MathLive rimane accettato, come richiesto dall’utente.
