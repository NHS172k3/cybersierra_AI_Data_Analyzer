# Cyber Sierra - AI Data Explorer

AI-powered data exploration app for CSV/Excel files. Upload data, preview rows, ask natural-language questions, and render interactive Plotly visualizations.

## Architecture

```
┌───────────────────┐   /api/* (Vite proxy)   ┌──────────────────────────────┐
│ Frontend (React)  │ -----------------------> │ Backend (FastAPI, Python)    │
│ Vite + TypeScript │                          │ PandasAI + LIDA + OpenAI     │
└───────────────────┘ <----------------------- └──────────────────────────────┘
      localhost:5173         JSON + Plotly spec          localhost:8000
```

    ## Continuous Integration

    GitHub Actions workflow file: `.github/workflows/ci.yml`

    On every push to `main` and every pull request, CI runs:

    - Frontend: `npm ci`, `npm run typecheck`, `npm run build`
    - Backend: `pip install -r requirements.txt`, syntax compile check, FastAPI app import smoke check

    This gives reviewers a quick pass/fail signal that the submitted codebase installs and builds cleanly.

## Current Feature Set

- Multi-file upload for `.csv`, `.xls`, `.xlsx`.
- Server-side upload validation (extension whitelist + 50 MB max per file).
- File list and file deletion.
- Sheet-aware preview endpoint with row count control (`1-1000`).
- AI query pipeline with intent classification (`text`, `viz`, `both`).
- Direct in-process routing:
  - PandasAI for text analysis.
  - LIDA for visualization generation.
- Interactive Plotly chart rendering in the frontend (`plotly_json`).
- Final LLM answer synthesis based on prompt + dataset context + tool outputs.
- Chart-status language scrubber in response text (to avoid contradictory chart messaging).
- Prompt history in browser `localStorage` (search, grouping, replay).
- Feedback persistence to backend SQLite via thumbs up/down.
- Frontend `ErrorBoundary` with reload recovery.

## AI Request Workflow

When `POST /api/query` is called:

1. Backend loads the requested file/sheet into a DataFrame.
2. Intent classifier (OpenAI `gpt-4o-mini`) labels the prompt as `text`, `viz`, or `both`.
3. Routing:
   - `text`/`both` -> PandasAI executes directly on the DataFrame.
   - `viz`/`both` -> LIDA attempts to generate a chart and extract Plotly JSON.
4. Final response text is synthesized by OpenAI from:
   - user prompt,
   - compact dataset context,
   - tool outputs (text result + whether chart payload exists).
5. Text is post-processed to remove chart-generation status phrasing.
6. Prompt result is stored in SQLite (`prompt_id`, text, chart JSON, metadata).
7. API returns `{ prompt_id, type, text, chart, feedback }`.

## Prerequisites

- Python 3.11+ (project has been run on Python 3.13).
- Node.js 18+.
- OpenAI API key with access to `gpt-4o`/`gpt-4o-mini`.

## Setup

### 1. Clone and configure environment

```bash
cd cybersierra
```

Create `.env` from `.env.example` and set your API key.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

### 2. Backend

```bash
cd backend
python -m venv .venv
```

Activate venv:

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

For PandasAI on Python 3.13, if compatibility issues appear, use:

```bash
pip install pandasai==1.5.3 --no-deps
pip install astor "faker>=19.0,<20.0" ipython
```

Run backend:

```bash
python -m uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`  
Backend docs: `http://localhost:8000/docs`

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Health check -> `{ "status": "ok" }` |
| POST | `/api/upload` | Upload one or more files (multipart key: `files`) |
| GET | `/api/files` | List uploaded files in current server session |
| DELETE | `/api/files/{file_id}` | Delete uploaded file from disk and registry |
| GET | `/api/preview` | Query: `file_id`, `sheet`, `n` (1-1000) |
| POST | `/api/query` | Body: `{ file_id, sheet, prompt }` |
| PATCH | `/api/prompts/{prompt_id}` | Body: `{ feedback: "thumbs_up" | "thumbs_down" }` |

### Query Request

```json
{
  "file_id": "uuid",
  "sheet": "Sheet1",
  "prompt": "Show survival rate by passenger class"
}
```

### Query Response

```json
{
  "prompt_id": "uuid",
  "type": "viz",
  "text": "Key insights from the dataset...",
  "chart": {
    "plotly_json": {
      "data": [],
      "layout": {}
    }
  },
  "feedback": null
}
```

### Preview Response

```json
{
  "columns": ["PassengerId", "Survived", "Pclass"],
  "rows": [
    { "PassengerId": 1, "Survived": 0, "Pclass": 3 }
  ]
}
```

## Frontend Behavior

- All HTTP calls are centralized in `frontend/src/api.ts`.
- Vite dev server proxies `/api` to backend (`frontend/vite.config.ts`).
- Query input supports `Ctrl+Enter` submit and aborts in-flight requests before new ones.
- Data preview fetches are debounced (`300ms`) and cancelable via `AbortController`.
- Prompt history is stored locally in browser storage key `prompt_history` (max 100 entries).
- Feedback updates both backend (`PATCH /api/prompts/{prompt_id}`) and local history state.

## Storage Model

- Uploaded file binaries: filesystem (`UPLOAD_DIR`, default OS temp + `cybersierra_uploads`).
- File registry metadata: in-memory dict (`backend/services/file_service.py`), reset on backend restart.
- Prompt records + feedback: SQLite database (`backend/cybersierra.db` by default).
- Frontend history timeline: browser `localStorage`.

## Environment Variables

| Variable | Required | Default | Used by |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | none | AI service |
| `UPLOAD_DIR` | No | `<temp>/cybersierra_uploads` | File storage |
| `CORS_ORIGINS` | No | `http://localhost:5173` | FastAPI CORS |
| `CYBERSIERRA_DB_PATH` | No | `<backend cwd>/cybersierra.db` | Prompt/feedback DB |

Note: `.env.example` includes `MAX_UPLOAD_SIZE_MB`, but current backend code enforces a fixed 50 MB cap internally and does not read that env var.

## Project Structure

```
cybersierra/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── files.py
│   │   ├── preview.py
│   │   └── query.py
│   ├── services/
│   │   ├── ai_service.py
│   │   ├── file_service.py
│   │   └── prompt_store.py
│   ├── models/
│   │   └── schemas.py
│   └── cybersierra.db
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── api.ts
│       ├── App.tsx
│       ├── main.tsx
│       ├── components/
│       └── hooks/
├── .env.example
└── README.md
```

## Known Limitations

- No auth/multi-tenant isolation (demo-style local app).
- File registry is process-memory only; uploaded files on disk are not automatically re-indexed after restart.
- AI toolchain depends on PandasAI/LIDA behavior and OpenAI API availability.
- `exec()` is used on LIDA-generated chart code path when needed to recover Plotly output.
- History is split across frontend `localStorage` and backend SQLite records (not fully unified as one source of truth).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, react-plotly.js |
| Backend | FastAPI, Pydantic v2, Uvicorn |
| Data | Pandas, OpenPyXL, xlrd |
| AI | OpenAI SDK, PandasAI 1.5.3, Microsoft LIDA |
| Storage | Local filesystem + SQLite |
