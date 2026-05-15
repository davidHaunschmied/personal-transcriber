# CLAUDE.md

Guidance for Claude (and other AI assistants) working in this repo. Keep edits to this file durable — short, non-obvious, won't rot.

## What this is

A SaaS for: **upload audio → transcribe (Groq Whisper) → run user-defined LLM transformations (Anthropic)** against the transcript. Two target users — a German-speaking politician dictating speeches, and the author recording personal notes — collapse to the same pipeline.

## Architecture in one paragraph

Next.js frontend → FastAPI backend → Supabase (Postgres + Auth + Storage). The browser uploads audio **directly to Supabase Storage** via a signed URL (no streaming through FastAPI). FastAPI verifies the Supabase JWT on every request, uses the **service-role** key for DB writes, and scopes every query by the JWT-derived `user_id`. RLS is also enabled on every table as defense in depth. Transcription and transformation run as in-process `BackgroundTasks` — fine until concurrency hurts.

## Stack defaults (don't change casually)

- Backend: Python 3.11+, FastAPI, `uv`, `supabase-py` service-role client.
- Frontend: Next.js 15 App Router, TS, Tailwind, `@supabase/ssr`.
- Transcription model: `whisper-large-v3` via Groq.
- Transformation model: `claude-sonnet-4-6` (Opus 4.7 selectable per template). Prompt caching is enabled on the system block — keep the style guide + reference speeches there so the cache hits.

## Conventions

- All FastAPI routes depend on `get_current_user` and scope queries with `.eq("user_id", user.id)`. Don't trust path/body input for ownership.
- Storage paths are `{user_id}/{recording_id}.{ext}`. The storage RLS policies key off the first path segment — don't change the convention without updating the policies.
- Background tasks must update the row's `status` and `error` fields on failure (see `pipeline.py`). The frontend polls every 3s; don't add Realtime/WebSockets until polling actually hurts.
- One recording → many transformations. Each transformation snapshots its `prompt_used` and `model` so template edits don't retroactively change history.

## What NOT to do in v1

This project has a **stated KISS bias**. Don't introduce these without explicit user buy-in:

- **RAG / vector store.** Style guide + all reference speeches go into the Anthropic `system` block. Add RAG only when context-window limits actually bite.
- **Job queues** (Celery/RQ). FastAPI `BackgroundTasks` is the chosen path until concurrency hurts.
- **Diff/review UI.** Users copy-paste-edit transformations for now.
- **Watched-folder ingestion / Telegram bot.** Manual upload only.
- **Hardcoded output types.** The user prompt + templates define the output shape; don't add a "summary" or "bullets" preset endpoint.

## Running locally

Three terminals: `supabase start` (idempotent), `uv run uvicorn app.main:app --reload --port 8000` from `backend/`, `pnpm dev` from `frontend/`. Magic-link emails land in Inbucket at `http://127.0.0.1:54324`. Full run book in `README.md`.

## Common gotchas

- The Supabase **JWT secret** in `backend/.env` must match the one printed by `supabase start`. Mismatch → 401 on every call.
- `supabase-py`'s `create_signed_upload_url` return-shape has shifted across versions. `services/storage.py` reads multiple key spellings defensively — preserve that if you touch it.
- Groq's audio endpoint rejects files > 25 MB. The backend pre-checks and surfaces a friendly error.
- The `on_auth_user_created` trigger inserts a `profiles` row on signup. If you reset auth users without resetting profiles, you'll get orphan rows.
