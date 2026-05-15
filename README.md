# personal-transcriber

Audio dictation → transcript → user-defined transformations. Two target users: a German-speaking politician dictating speeches, and the author recording personal notes.

**Pipeline:** upload audio → transcribe with Groq Whisper → run user-defined LLM transformations against the transcript, with a per-user style guide and reference speeches stuffed into context.

## Stack

- **Backend** — FastAPI (Python 3.11+), Supabase service client, Groq + Anthropic SDKs.
- **Frontend** — Next.js 15 (App Router) + TypeScript + Tailwind, `@supabase/ssr` for auth.
- **Data** — Supabase: Postgres (RLS on every table), Auth, private Storage bucket `recordings`.
- **Transcription** — Groq `whisper-large-v3`.
- **Transformation LLM** — Anthropic Claude Sonnet 4.6 by default; per-template override (e.g. Opus 4.7 for higher-stakes speeches).

## Prerequisites

- Docker (for `supabase start`).
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).
- Python 3.11+ and [`uv`](https://docs.astral.sh/uv/) (or pip).
- Node 20+ and pnpm/npm.
- API keys: [Groq](https://console.groq.com) and [Anthropic](https://console.anthropic.com).

## First-time setup

```bash
# 1. Start the local Supabase stack (Postgres + Auth + Storage + Studio).
supabase start
# Note the printed values: API URL, anon key, service_role key, JWT secret.

# 2. Backend env.
cd backend
cp .env.example .env
# Fill in SUPABASE_*, GROQ_API_KEY, ANTHROPIC_API_KEY.
uv sync           # or: pip install -e .

# 3. Frontend env.
cd ../frontend
cp .env.local.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL + ANON_KEY.
pnpm install      # or: npm install
```

The migration in `supabase/migrations/0001_init.sql` applies automatically on `supabase start` (or `supabase db reset` to reapply).

## Running locally

Three terminals:

```bash
# Terminal 1 — Supabase
supabase start    # idempotent; leave running

# Terminal 2 — Backend
cd backend
uv run uvicorn app.main:app --reload --port 8000

# Terminal 3 — Frontend
cd frontend
pnpm dev          # http://localhost:3000
```

In dev, magic-link emails land in **Inbucket** at `http://127.0.0.1:54324`.

## Smoke test

1. Open `http://localhost:3000` → redirected to `/login`. Enter your email; grab the magic link from Inbucket.
2. Land on the dashboard.
3. Go to **Style** → paste a short style guide → **Save**. Add one reference speech.
4. Go to **Templates** → save a template like *"Polish this dictation into a finished speech in my voice. Match the tone of the reference speech."*
5. Go to **New** → upload a short audio file (≤ 25 MB). Wait for status to flip to `transcribed` (polls every 3s).
6. Open the recording → pick your template → **Run**. Transformation appears within seconds.

## Project layout

```
backend/             # FastAPI service
  app/
    main.py          # app entrypoint
    auth.py          # Supabase JWT verification (HS256)
    deps.py          # service-role Supabase client
    config.py        # pydantic settings
    models.py        # pydantic request/response shapes
    pipeline.py      # background tasks (transcribe, transform)
    services/        # groq, llm (anthropic), storage helpers
    routers/         # style, templates, recordings, transformations
frontend/            # Next.js app
  app/
    login/           # magic-link sign-in
    auth/callback/   # PKCE callback
    dashboard/       # recordings list
    recordings/      # new / [id]
    settings/        # style / templates
  lib/               # supabase clients + typed API client
  middleware.ts      # auth gate
supabase/
  config.toml
  migrations/0001_init.sql
```

## Design notes

- **Direct-to-storage upload.** The browser uploads audio straight to Supabase Storage via a signed URL (no streaming through FastAPI). The backend only downloads the audio when it transcribes.
- **Background tasks via FastAPI.** Transcription and transformation run in-process. Fine until concurrency hurts — swap in Celery/RQ then.
- **No RAG yet.** Style guide + all reference speeches are stuffed into Anthropic's `system` block with prompt caching enabled. Add RAG when context-window limits actually bite.
- **RLS everywhere.** Every user-owned table enforces `user_id = auth.uid()`. The backend uses the service role key but every router scopes queries by the JWT-derived `user_id`.

## Roadmap (deferred from v1)

- RAG / vector store for reference speeches
- Side-by-side diff/review UI between transcript and transformations
- Speaker diarization
- Job queue (Celery/RQ)
- Cloud deployment (Fly.io / Railway / Vercel)
- Watched-folder ingestion / Telegram bot
