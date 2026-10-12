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

The default local model is `gemma3:1b`. Keep `OLLAMA_MODEL=gemma3:1b` when that model is installed. The server verifies the configured name against `OLLAMA_BASE_URL/api/tags` before generating a mission.

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
- The browser calls the Node `/api/mission` proxy; it never calls Ollama directly.
- If the configured Ollama model is not installed, the server reports the available models and returns a labeled preset instead of silently selecting a different model.
- Ollama generation waits up to 120 seconds by default so local model cold starts and inference are not aborted prematurely. Override with `OLLAMA_TIMEOUT_MS` when needed.
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
