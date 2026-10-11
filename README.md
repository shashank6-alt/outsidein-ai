# OutsideIn AI

OutsideIn AI generates short outdoor missions and keeps reflections local to your browser.

## Stack

- Frontend: Vite + JavaScript
- Backend: Node.js (`server.cjs`)
- Primary AI provider: Ollama (local, open-weight)
- Optional fallback: Hugging Face (explicit opt-in via `.env`)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Set `OLLAMA_MODEL` to a model installed in your local Ollama runtime. If `OLLAMA_MODEL` is blank, the server tries the first model returned by `OLLAMA_BASE_URL/api/tags`.

## Run

Terminal 1 (API server):

```bash
npm run server
```

Terminal 2 (frontend):

```bash
npm run dev
```

Open `http://localhost:5173`.

## Commands

- `npm run dev` - start Vite dev server
- `npm run server` - start Node API server
- `npm run build` - production frontend build
- `npm run lint` - syntax checks for changed JS/CJS files
- `npm test` - targeted tests for validation/parser behavior

## Behavior notes

- Mission generation uses Ollama first.
- If Ollama is unavailable, the app returns a clearly labeled **Preset mission**.
- Hugging Face fallback is disabled by default and only used when `ENABLE_HF_FALLBACK=true` with `HF_API_KEY` and `HF_MODEL` set.
- Reflections are stored in browser `localStorage` only and are never sent to external AI providers.

## Safety guidance in app

Each mission includes reminders to:

- stay aware of traffic/surroundings,
- bring water and pause if unwell,
- respect local rules and property.

## `npcCube` check

A repository-wide search found no `npcCube` references in the current branch state.

## Limitations

This repository environment may not have an Ollama daemon/model running. If unavailable, the server degrades gracefully to a preset mission and returns a note indicating the exact provider failure.
