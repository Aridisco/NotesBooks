# Bug da fixare

Aggiornamento del 7 novembre 2026: le correzioni del piano approvato sono implementate e pubblicate su Firebase; i dettagli e le verifiche sono in [risolti.md](risolti.md).

- **Punti 1 e 2**: già pubblicati su Firebase, verificati fra due sessioni Chrome e confermati funzionanti dall’utente.
- **Punti 3, 4 e 6**: pubblicati su Firebase Hosting e verificati sul sito online. I quattro file pubblicati coincidono con la build locale; prove SRI, formule/solver, PDF e toast riuscite.
- **Punto 5**: `.firebase/` ignorata da Git, senza eliminare la cache.
- **Punto 7**: avviso MathLive accettato dall’utente, soglia Vite invariata.
- **Punto 8**: aggiunti i test mirati richiesti; suite di 12 file e 110 test passati.

Non ancora verificati: microfono e dettatura reali, copertura completa di rendering/WebGL e due dispositivi fisici separati. Le versioni cloud precedenti restano conservate come già documentato.

Il Google Doc “BooksNote Bug Report” e Google Keep non sono stati modificati durante questo intervento.
