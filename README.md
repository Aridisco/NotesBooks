# Sketchbooks

Notebook app: freehand drawing, text, tables, LaTeX, circuits, PDFs and voice notes on an infinite canvas.
Saves locally (localStorage / IndexedDB) and, after Google sign-in, to Firestore.

## Develop

```bash
npm install
cp .env.example .env   # fill in the Firebase web config
npm run dev            # http://localhost:5173
npm test               # unit tests (Vitest)
npm run build          # production build in dist/
```

## Deploy (Firebase Hosting)

```bash
npm run build
npx firebase-tools deploy --only hosting
```

Add the hosting domain to Firebase Authentication > Authorized domains, or Google sign-in fails with `auth/unauthorized-domain`.

## Layout

- `src/state.js` shared mutable state (`ST`); modules read and write `ST.<name>`.
- `src/cloud.js` sign-in, save and load; pure helpers in `src/syncLogic.js`.
- `src/render.js`, `input.js`, `edit.js`, `toolbar.js`, `sidebar.js`, `notebooks.js` canvas, tools and UI.
- `src/report.js` error sink (console + toast), `src/dialog.js` modal choices.

## Security

The Firebase web config is public once built. Protect data with Firestore rules, e.g. only `users/{uid}/**` for the signed-in user:

```
match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }
```
