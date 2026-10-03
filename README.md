# Study Hub

An installable, offline-first learning hub for your IT certification study guides.
Import `.docx` study guides and it automatically generates flashcards (with
spaced repetition) and multiple-choice quizzes from term/definition style
content — all parsed and stored **on your device**, nothing is uploaded.

## Features

- **Import `.docx` guides** directly in the browser (no server, no upload)
- **Flashcards with SM-2 spaced repetition** (the Anki algorithm) — cards you
  know well show up less often, cards you struggle with come back sooner
- **Auto-generated quizzes** (multiple choice) built from your guide content
- **Full-text search** across every guide you've imported
- **Dashboard** with due-today count, streak tracking, and per-guide mastery %
- **Installable PWA** — add it to your phone's home screen and use it offline
- **Dark mode UI**, mobile-first design

## Getting started

```powershell
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL. On your phone, visit the same
URL (once deployed, see below) and use "Add to Home Screen" (iOS Safari) or
the install prompt (Android Chrome) to install it like a native app.

## Building for production

```powershell
npm run build
npm run preview   # serve the production build locally to sanity-check
```

The `dist/` folder is a fully static site — deploy it to GitHub Pages,
Netlify, Vercel, or any static host. No backend is required; all data lives
in your browser's IndexedDB.

## Importing your OneDrive study guides

1. Download the `.docx` files from your OneDrive "TECH FOLDER" to your device
   (or sync via the OneDrive app so they're available locally).
2. In the app, go to **Import**, pick a certification label (e.g. "Security+"),
   and select one or more `.docx` files.
3. The app splits each guide into topics by heading, then scans each topic
   for "term: definition" style lines (also matches `-`, `–`, `—`, `=`) to
   auto-build flashcards and quiz questions.
4. Review any auto-generated cards on the guide page — you can always open
   the guide's **Topics** section to re-check the source text.

## Project structure

```
src/
  db/            Dexie (IndexedDB) schema + SM-2 spaced-repetition logic
  lib/           docx parsing, flashcard/quiz generation, search, stats
  pages/         Dashboard, Import, Library, GuideDetail, Study, Quiz, Search
  components/    Shared UI (bottom nav)
```

## Tech stack

Vite + React + TypeScript, Tailwind CSS v4, Dexie.js (IndexedDB), mammoth.js
(docx → HTML parsing), Fuse.js (fuzzy search), vite-plugin-pwa (installable,
offline support).
