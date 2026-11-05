# Sketchbooks

Notebook app: freehand drawing, text, tables, LaTeX, circuits, PDFs and voice notes on an infinite canvas.
Saves locally (localStorage / IndexedDB) and, after Google sign-in, to Firestore.

## Using it

- Bottom bar: select, pen, shapes, text, code block, and a menu with more tools. A bar next to the selected object holds quick colors, duplicate, lock and delete; its sliders button opens the full panel (exact W/H, stroke width, text size in px, H1/H2/H3/Body presets, custom colors).
- With a pen, fingers only pan and zoom (a resting palm never interrupts a stroke).
- Code blocks: Tab / Shift+Tab indent, Enter keeps the indentation, syntax colors for C#, XAML, JS/TS, Python, HTML, CSS, C/C++, Java/Kotlin, SQL and JSON.
- Menu > Sheet > Two A4 pages shows a page next to the following one; press either sheet to draw on it.
- Ctrl/Cmd+K opens the command palette. Export a page or notebook as PDF (pages are images), and restore earlier versions of a page from Page history (kept on this device).

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
- `src/report.js` error sink (console + toast), `src/dialog.js` modal choices, `src/palette.js` command palette.
- `src/highlight.js` syntax highlighter, `src/code.js` code blocks, `src/pdf.js` PDF writer, `src/versions.js` page history.

## Security

The Firebase web config is public once built. Protect data with Firestore rules, e.g. only `users/{uid}/**` for the signed-in user:

```
match /users/{uid}/{document=**} { allow read, write: if request.auth != null && request.auth.uid == uid; }
```
