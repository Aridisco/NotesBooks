# Audit UI/UX – Sketchbooks (7 novembre 2026)

Test manuale di tutte le schermate e animazioni sul dev server (`npm run dev`, http://localhost:5173), con browser a 1024×768 (desktop), 768×1024 (tablet) e 375×812 (telefono), temi Warm paper chiaro e scuro.
Gli screenshot (nomi che iniziano con il numero del passo) sono nella cartella locale `shots/`, che non è nel repository: è in `.gitignore`.
I numeri di riga si riferiscono al codice del 7/11 ore 11:30: Codex stava modificando i file in parallelo, quindi possono essere spostati di qualche riga.

**Verdetto**: lo stile grafico è curato e coerente (palette calda, tipografia Lora/Figtree, bersagli da 44 px, focus visibile, `prefers-reduced-motion` gestito). Però ci sono **4 problemi bloccanti** (due causano perdita di dati, due rendono l'app inutilizzabile su telefono) e una serie di imperfezioni che oggi la separano da un'app "rifinita".

Legenda priorità: **P0** = perdita di dati o funzione inutilizzabile · **P1** = UX importante · **P2** = rifinitura · **A11y** = accessibilità.

---

## Passi testati

| # | Passo | Stato | Screenshot |
|---|-------|-------|------------|
| 1 | Libreria (scuro e chiaro), menu ⋮, tema | 🟡 ok visivamente, scorciatoie attive in background | 01, 02, 03 |
| 2 | Vista taccuino (pagine, colori copertina) | 🟢 buona | 04 |
| 3 | Editor vuoto, toolbar | 🟢 buona | 05 |
| 4 | Penna, evidenziatore, forme | 🟡 stato attivo ambiguo nel picker forme | 06, 07 |
| 5 | Barra contestuale e pannello proprietà | 🟡 il pannello copre la selezione; colori recenti duplicati | 08, 09, 10 |
| 6 | Undo/redo e passaggio libreria ↔ pagina | 🔴 cancellazioni invisibili e non annullabili | 11 |
| 7 | Testo | 🟡 il primo tocco sulla toolbar viene ignorato | 12 |
| 8 | Blocco di codice | 🟡 copre la toolbar, stile fuori tema | 13, 14 |
| 9 | Formula e grafico | 🔴 Cmd+A nel campo formula seleziona la pagina | 15, 16, 17 |
| 10 | Tabella | 🟡 compare fuori schermo; caratteri persi dopo Tab | 18 |
| 11 | Menu Altro, Cronologia, Export, Carta | 🟡 Esc bloccato nella cronologia; voci tecniche esposte | 19–22 |
| 12 | Foglio A4 / due A4 | 🟡 nasconde oggetti e crea una pagina in silenzio | 23 |
| 13 | Palette comandi, tema scuro | 🟢 buona (evidenziatore scuro poco leggibile) | 24, 25 |
| 14 | Telefono 375 px | 🔴 toolbar e barra in alto rotte | 26–30 |
| 15 | Tablet 768 px | 🟢 buona | 31 |
| 16 | Ricerca, cestino | 🟡 ricerca incompleta; nessun feedback all'eliminazione | 32, 33 |

---

## P0 – Da sistemare per primi

> **Stato (7/11, 11:38)**: i quattro P0 sono **risolti** (non committati), insieme ad A-1. Modifiche: `src/toolbar.js` (guardia all'inizio del gestore tasti), `src/notebooks.js` (`render()` rende inerti `#tools #topr #ctx #panel` fuori dall'editor), `src/styles/main.css` (`justify-content: safe center` sulla toolbar; sotto 640 px nasconde pager e zoom nella barra in alto). Ricontrollati nel browser a 1024 e 375 px seguendo i passi qui sotto; `npm test`: 110/110.

### P0-1. Le scorciatoie da tastiera agiscono sulla pagina nascosta quando sei nella libreria
**Cosa succede**: il gestore globale dei tasti (`src/toolbar.js:729`) non controlla se l'editor è visibile. Dalla libreria o dalla vista taccuino, **Backspace/Canc cancella l'oggetto selezionato** della pagina aperta prima, **Cmd+Z / Cmd+Shift+Z** fanno undo/redo, Cmd+A/X/D, `[` `]` e le lettere (P, E, V…) cambiano strumento. Non si vede niente: l'anteprima della pagina non si aggiorna.
**Peggiora**: riaprendo la pagina la cronologia undo viene azzerata (`src/notebooks.js:90` e `:107`, `ST.hist = [...]`), quindi **l'oggetto cancellato non si recupera più** con Undo (resta solo "Page history", se c'è uno snapshot).
**Come riprodurre**:
1. Apri una pagina, disegna un rettangolo e selezionalo con lo strumento Selezione.
2. Premi "‹ My notebook" per tornare alla vista taccuino.
3. Clicca su un'area vuota e premi **Backspace**.
4. Riapri la pagina: il rettangolo è sparito (screenshot 11). Premi Cmd+Z: non torna.
5. Variante: dalla libreria premi `E`, poi apri una pagina → lo strumento è cambiato.

**Fix proposto**: all'inizio dell'handler, `if (!$('#home').hidden) return;` (o `ST.S.view !== 'page'`). Inoltre azzerare `ST.sel`/`ST.msel` quando si esce dalla pagina.
**Verifica**: ripeti i passi 1–4: il rettangolo deve restare.

### P0-2. Le scorciatoie globali scattano mentre scrivi nel campo formula
**Cosa succede**: `src/toolbar.js:730` ignora solo `INPUT|TEXTAREA|SELECT`, ma il campo formula è un `<math-field>` (MathLive). **Cmd+A seleziona tutti gli oggetti della pagina** invece del testo della formula; in combinazione con Cmd+X/Cmd+D o Canc il rischio è modificare la pagina mentre si scrive.
**Come riprodurre**:
1. Apri Formula (fx), clicca sulla pagina, scrivi `x^2-4=0`.
2. Premi **Cmd+A** e poi scrivi `sin(x)`.
3. Risultato: la formula diventa `x^2-4=0sin(x)` e dietro al dialogo compaiono la barra contestuale e i riquadri di selezione di tutta la pagina (screenshot 17). Chiudi con Esc: gli oggetti restano selezionati.

**Fix proposto**: sostituire il test con `if (e.target.closest('input,textarea,select,[contenteditable],math-field,dialog,#mbox')) return;`.
**Verifica**: Cmd+A nel campo formula deve selezionare solo il testo della formula.

### P0-3. Telefono: "Seleziona" e "Penna" sono irraggiungibili nella toolbar
**Cosa succede**: `src/styles/main.css:74` `#tools .trow{justify-content:center; overflow-x:auto}`. Quando i pulsanti non entrano, il contenuto centrato esce **a sinistra**, dove lo scroll non arriva (Select a −64 px, Pen a −18 px). A destra anche Image e Table sono tagliati.
**Come riprodurre**: DevTools → dispositivo 375×812 (iPhone), apri una pagina: il primo pulsante a sinistra è tagliato e non si può scorrere fino a lui (screenshot 26).
**Fix proposto**: `justify-content: safe center;` (oppure `margin-inline:auto` sul primo e sull'ultimo figlio) e un leggero sfumato ai bordi per far capire che la barra scorre.
**Verifica**: a 375 px scorri la barra: devono comparire tutti gli 11 strumenti.

### P0-4. Telefono: i pulsanti della barra in alto si sovrappongono
**Cosa succede**: a 375 px il gruppo pagina precedente / successiva / nuova pagina (x 84–216) è disegnato sopra Undo/Redo (91–179) e sopra lo zoom (179–235). Il titolo è ridotto a "P". Toccando "Undo" si può premere "Pagina precedente" (screenshot 26 e 27).
**Dove**: `src/styles/main.css:55-58` (`.nav .nr{min-width:max-content}` spinge il gruppo centrale a 0 px) e `:70` (sotto 640 px nasconde solo il contatore `.pgn`).
**Fix proposto**: sotto 640 px nascondere anche le frecce pagina e "Nuova pagina" (sono già nel menu e nella vista taccuino) e l'etichetta "59%", con `overflow:hidden` su `.nc`; il titolo con `text-overflow: ellipsis`.
**Verifica**: a 375 px nessun pulsante deve sovrapporsi (prova anche 320 px).

---

## P1 – UX importante

> **Stato (7/11)**: tutti e 10 i P1 sono **risolti** (non committati) e ricontrollati nel browser: P1-1 `renderTools` non ricostruisce la barra se l'HTML è identico; P1-2 la cella successiva si apre in modo sincrono (`objects.js`); P1-3 `inView()` in `input.js` per codice e tabella; P1-4 `placeCtx` nasconde la barra contestuale con il pannello aperto; P1-5 avviso con toast fuori foglio e rimozione della pagina vuota creata da "Two A4" (`auto: true`); P1-6 `askChoice(…, dismiss)` fa chiudere Esc la cronologia; P1-7 la ricerca legge celle e codice; P1-8 toast all'eliminazione di pagina/taccuino; P1-9 `hit()` testa i segmenti dei tratti e la gomma campiona il percorso; P1-10 `openHist()` in `render.js` mantiene la cronologia undo per pagina finché l'app è aperta. `npm test` 110/110, build ok.

| # | Problema | Come riprodurre | Dove / fix proposto |
|---|----------|-----------------|---------------------|
| P1-1 | **Primo tocco sulla toolbar ignorato** mentre si scrive un testo: il testo viene confermato ma lo strumento resta "Testo". Serve un secondo tocco. | Strumento Testo → clic sulla pagina → scrivi → clic su Seleziona: resta evidenziata la "A" (screenshot 12). | Probabilmente il `blur` del textarea (`src/input.js`, `t.addEventListener('blur', done)`) ridisegna la toolbar prima del click. Confermare il testo su `pointerdown` della toolbar senza consumare l'evento. |
| P1-2 | **Caratteri persi dopo Tab** tra le celle della tabella. | Crea una tabella, scrivi "Nome", premi Tab e subito una lettera: la lettera non compare. | La nuova cella riceve il focus in ritardo. Spostare il focus in modo sincrono nel gestore di Tab. |
| P1-3 | **Nuovi oggetti fuori dalla vista**: il blocco di codice (560×320) copre la toolbar; la tabella esce dal bordo destro. | Codice: clic a metà altezza in basso a sinistra (screenshot 13). Tabella: clic vicino al bordo destro (screenshot 18). | Al momento della creazione limitare x/y in modo che l'oggetto resti dentro l'area visibile, sopra la toolbar. |
| P1-4 | **Il pannello proprietà copre l'oggetto selezionato e metà della barra contestuale.** | Seleziona un rettangolo a destra → icona cursori (screenshot 9). | Nascondere `#ctx` mentre `#panel` è aperto, o spostare la vista perché la selezione resti libera. |
| P1-5 | **"Two A4" nasconde gli oggetti fuori dal foglio** senza avviso e **crea una pagina 2** che resta anche tornando a "Infinite". | Metti un oggetto a destra (oltre ~800 px) → Carta → Two A4: l'oggetto sparisce (screenshot 23); torna a Infinite: ricompare, ma il contatore resta "1 / 2". | Avvisare con un toast ("2 oggetti sono fuori dal foglio") e non creare la pagina finché non si disegna sul secondo foglio. |
| P1-6 | **Cronologia pagina: Esc e clic fuori non chiudono**; il dialogo stesso riceve l'anello di focus rosso. | Altro → Page history → Esc (screenshot 20). | `src/dialog.js:24` blocca sempre `cancel`. Bloccarlo solo per il dialogo di conflitto; per gli altri mappare Esc su "Cancel" e mettere il focus sul primo pulsante. |
| P1-7 | **La ricerca non trova il testo di tabelle e blocchi di codice.** | Scrivi "Nome" in una cella o `return` nel codice → libreria → cerca: "No pages match" (screenshot 32). "Seconda" in un testo viene trovato. | Indicizzare anche celle tabella e codice nella funzione di ricerca di `src/notebooks.js` (~riga 170). |
| P1-8 | **Eliminare una pagina non dà nessun feedback**: va nel cestino in silenzio, niente toast né Annulla. | Vista taccuino → cestino su Pagina 2 (screenshot 33). | `toast('Pagina spostata nel cestino', {action:'Annulla'})`. Lo stesso vale per il taccuino. |
| P1-9 | **Gomma: controlla solo i punti campionati**, non il segmento tra due punti. Con un gesto veloce può "saltare" un tratto sottile. | Penna sottile (1) → gomma → passa velocemente di traverso sul tratto. Da verificare a mano: nel test automatico (trascinamento di soli 2 punti) il tratto non veniva cancellato. | `src/input.js:549` usa `hit(x, y)`. Fare il test sul segmento precedente→attuale (c'è già `segInRect`/geom in `src/geom.js`). |
| P1-10 | **La cronologia undo si azzera** ogni volta che riapri la pagina. | Disegna → torna al taccuino → riapri → Undo non fa nulla. | `src/notebooks.js:90/107`. Valutare di mantenere una cronologia per pagina in memoria finché l'app resta aperta. |

---

## P2 – Rifinitura UI

> **Stato (7/11)**: fatti e provati nel browser: P2-1 (recenti senza preset, anche quelli già salvati), P2-2 (titoli "Rectangle", 9 colori su una riga, etichetta "Hand-drawn"), P2-3 (forme: la forma aperta è evidenziata, non l'evidenziatore), P2-5 (toggle blu di MathLive nascosti, separatore sopra il risultato), P2-6 (messaggio "Enter an expression in x without “=”"), P2-8 (⌘ su Mac, tasti nascosti su touch), P2-9 (Undo/Redo disattivati), P2-10 (icona e nome "Export: image or PDF"), P2-11 (Performance e Renderer sotto "Advanced"), P2-12 (evidenziatore più vivo in scuro), P2-13 (nessuna scrollbar), P2-14 (avviso salvataggio nei colori del tema), P2-15 (matita sul titolo pagina, bordo al passaggio sul titolo del taccuino), A-2/A-3/A-4, più il sistema di animazioni (entrata di pannello, barra contestuale, toast, dialoghi, palette; dissolvenza tra schermate; il dialogo formula non "scivola" più lateralmente).
> **Non fatti**: P2-4 (regola unica sullo strumento dopo la creazione: è una scelta di prodotto), P2-7 (colori del blocco di codice nel tema: il disegno sulla tela usa gli stessi colori fissi, va cambiato insieme), "Circuit tools" nel menu Carta, e la lettura di "Page background #…" (colori di sfondo senza nome).
> **Animazioni di uscita (fatte)**: tutto in CSS in fondo a `main.css`, con `transition` su `opacity`, `transform` e `display … allow-discrete` più `@starting-style` per l'entrata. Valgono per menu in alto, popover strumenti, pannello proprietà, dialogo formula, toast, avviso di salvataggio, libreria → pagina (dissolvenza incrociata) e per i `<dialog>` (cronologia, conflitto cloud, palette comandi, rimossi dal DOM 250 ms dopo la chiusura). `.hidden` resta immediato nel codice; riaprire un menu a metà dissolvenza inverte la transizione. Misurato nel browser: popover 0.19 a 40 ms dalla chiusura, pannello 0.17, toast 0.19, dialogo 0.14, inversione 0.11 → 0.74 → 1. Nei browser senza `allow-discrete` la riga `transition` viene scartata e tutto si mostra/nasconde subito, come prima. Nessuna modifica per la barra contestuale `#ctx`, che si nasconde a ogni trascinamento. P2-7 "Invio non indenta dopo `{`" **non era un bug**: l'indentazione esiste già, il mio test inseriva testo senza il tasto Invio.

| # | Problema | Come vederlo |
|---|----------|--------------|
| P2-1 | Scegliere un colore **predefinito** di riempimento lo aggiunge ai "colori recenti" sia nella riga Stroke sia in Fill: doppione, il pannello si allunga e compare lo scroll (Delete esce dalla vista). | Pannello proprietà → Fill rosa (screenshot 10). I preset non dovrebbero entrare nei recenti. |
| P2-2 | Pannello proprietà: titolo "Rect" (abbreviazione); 8 colori + arcobaleno vanno a capo con un solo colore sulla seconda riga; lo slider "✎" non ha un'etichetta visibile (è "Sketchiness"); "Delete" resta da solo su una seconda riga. | Screenshot 9. Usare "Rettangolo", 9 colori per riga, etichetta "Tratto a mano", Delete allineato in fondo. |
| P2-3 | Con il picker forme aperto risulta ancora attivo l'evidenziatore (sfondo arancio) e la riga colori è quella dell'evidenziatore. | Evidenziatore → Forme (screenshot 7). |
| P2-4 | Comportamento incoerente dopo la creazione: dopo un rettangolo si torna a Seleziona, dopo testo e codice no. | Disegna un rettangolo, poi un blocco di codice. Decidere una regola unica. |
| P2-5 | Dialogo formula: due icone tastiera (header + MathLive) e il menu ☰ di MathLive in **blu**, fuori tema; il risultato di "Solve" è attaccato ai pulsanti senza separatore; il dialogo cresce verso l'alto (salto). | Screenshot 15–16. Nascondere i pulsanti di MathLive (`math-virtual-keyboard-toggle`, `menu-toggle` via `::part`), riquadro "Risultato". |
| P2-6 | Passando da Formula a Grafico la formula viene copiata nel campo del grafico (`x^2-4=0`), che non è una funzione: il grafico resta vuoto e **non c'è nessun messaggio d'errore**. | Formula `x^2-4=0` → tab Graph. Mostrare "Scrivi y in funzione di x" in rosso. |
| P2-7 | Blocco di codice: select e checkbox native nell'intestazione, sfondo grigio-blu (chiaro) / blu notte (scuro) che stona con Warm paper; Invio non indenta dopo `{`; dimensione iniziale troppo grande per 3 righe. | Screenshot 13, 14, 25. |
| P2-8 | Su Mac le etichette mostrano "Ctrl+Z", "Ctrl K", "Ctrl+Enter"; su telefono il menu mostra "Ctrl K". | Tooltip di Undo, menu Altro (screenshot 19, 28). Usare ⌘ su Mac e nascondere le scorciatoie su dispositivi touch. |
| P2-9 | Undo/Redo non sono mai disattivati, anche quando non c'è niente da annullare. | Apri una pagina appena creata. |
| P2-10 | Il pulsante "Export and share" ha l'icona condividi ma contiene solo export. | Screenshot 21. |
| P2-11 | "Circuit tools" sta nel menu Carta; il menu Altro espone "Performance" e "Renderer GPU tiles/Classic" (termini tecnici). | Screenshot 19, 22. Spostare in una sezione "Avanzate". |
| P2-12 | In tema scuro l'evidenziatore giallo diventa verde oliva, poco leggibile. | Screenshot 25. |
| P2-13 | Telefono: la barra contestuale mostra la scrollbar nativa grigia e nasconde Duplica/Elimina/Proprietà fuori dallo schermo. | Screenshot 29. |
| P2-14 | `#svbar` ha il colore fisso `#b45309` (`src/styles/main.css:213`), non segue il tema. | Avviso "Unsaved changes". |
| P2-15 | Il titolo del taccuino è un campo di testo che sembra un titolo: niente indica che si può rinominare. | Screenshot 4. Mostrare una matita o un bordo al passaggio. |

### Animazioni (motion)
Presenti: comparsa dei menu (`pop` 160 ms), dialogo formula (`pop` 180 ms), riga toolbar (`rowin` 180 ms), sollevamento delle copertine al passaggio del mouse. `prefers-reduced-motion` è gestito bene (`main.css:231`).
Mancano rispetto a un'app professionale:
- **Nessuna transizione tra schermate** Libreria → Taccuino → Pagina: il cambio è secco.
- **Nessuna animazione d'uscita**: menu, pannello e dialoghi spariscono di colpo.
- **Pannello proprietà, barra contestuale, toast, dialoghi `<dialog>` e palette comandi compaiono senza animazione**, a differenza dei menu: l'insieme risulta incoerente.
- Proposta: un'unica coppia di token (es. 160 ms entrata / 120 ms uscita, `cubic-bezier(.2,.8,.2,1)`), fade + scale 0.98 per popover/dialoghi, slide 8 px per pannello e toast, cross-fade di 180 ms tra schermate. Tutto già spento dalla regola reduced-motion.

---

## Accessibilità

| # | Problema | Come verificarlo |
|---|----------|------------------|
| A-1 | Con la libreria aperta, i **primi 11 stop del tasto Tab sono strumenti invisibili** dell'editor (dietro la libreria). | Ricarica sulla libreria e premi Tab: il focus non si vede per 11 pressioni. Fix: `$('#main').inert = !$('#home').hidden`. Risolve anche parte di P0-1. |
| A-2 | Menu (⋮, Export, Carta, Altro): niente `aria-expanded`, niente `role="menu"`, il focus non entra nel menu e con Esc non torna al pulsante (finisce su `BODY`). | Tab fino a ⋮ → Invio → Tab → Esc. |
| A-3 | I colori sono letti come codici: "Stroke color #e03131", "Cover color #d9534f". | Lettore di schermo o `read_page`. Usare nomi: "Rosso", "Arancio"… |
| A-4 | "Lock / unlock" non indica lo stato (manca `aria-pressed`). | Barra contestuale. |

---

## Punti di forza (da non perdere)
- Palette e tipografia coerenti in entrambi i temi, il tema viene applicato prima del primo paint (nessun lampo).
- Bersagli touch da 44 px, `:focus-visible` definito, etichette `aria-label` quasi ovunque, descrizione della tela per screen reader (`#cvdesc`).
- Evidenziatore sotto l'inchiostro, tratti "auto" che si invertono nel tema scuro, palette comandi rapida, cronologia pagine, cestino con ripristino, conferma in due tocchi per eliminare il taccuino.
- Tablet 768 px: layout corretto.

## Ordine di lavoro consigliato
1. P0-1 + A-1 (una sola modifica: `inert` sul `#main` + return nell'handler tasti) e P0-2.
2. P0-3 e P0-4 (solo CSS).
3. P1-1, P1-2, P1-3, P1-4, P1-6.
4. P1-5, P1-7, P1-8, P1-9, P1-10.
5. Rifinitura P2 e un unico sistema di animazioni.

## Cosa non è stato verificato
- Note vocali (permesso microfono), inserimento immagini e import PDF (selettore file), download PNG/PDF, login Google e sincronizzazione cloud.
- Penna, palmo e pinch-zoom reali: i test sono stati fatti con il mouse. Safari/iPad reali e lettore di schermo reale non provati.
- La gomma (P1-9) è confermata dalla lettura del codice ma va verificata a mano con un gesto veloce.
