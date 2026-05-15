-- Personal Transcriber initial schema
-- Tables: profiles, style_guides, reference_speeches, prompt_templates, recordings, transformations
-- All user-owned tables enforce RLS: user_id = auth.uid()

set search_path = public;

create extension if not exists "pgcrypto";

-- Enums
create type recording_status as enum ('uploaded', 'transcribing', 'transcribed', 'failed');
create type transformation_status as enum ('pending', 'running', 'done', 'failed');

-- Profiles: 1:1 with auth.users, populated by trigger on signup
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text,
    created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user is inserted
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- Style guide: one per user
create table style_guides (
    user_id uuid primary key references auth.users(id) on delete cascade,
    content text not null default '',
    updated_at timestamptz not null default now()
);

-- Reference speeches: many per user, stuffed into LLM context
create table reference_speeches (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    content text not null,
    created_at timestamptz not null default now()
);

create index reference_speeches_user_id_idx on reference_speeches(user_id);

-- Prompt templates: saved transformation prompts
create table prompt_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    prompt text not null,
    model text not null default 'llama-3.3-70b-versatile',
    is_default boolean not null default false,
    created_at timestamptz not null default now()
);

create index prompt_templates_user_id_idx on prompt_templates(user_id);

-- Recordings: uploaded audio + transcript
create table recordings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    original_filename text not null,
    storage_path text not null,
    duration_seconds numeric,
    status recording_status not null default 'uploaded',
    transcript text,
    error text,
    created_at timestamptz not null default now()
);

create index recordings_user_id_created_at_idx on recordings(user_id, created_at desc);

-- Transformations: LLM outputs from a transcript
create table transformations (
    id uuid primary key default gen_random_uuid(),
    recording_id uuid not null references recordings(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    template_id uuid references prompt_templates(id) on delete set null,
    prompt_used text not null,
    model text not null,
    output text,
    status transformation_status not null default 'pending',
    error text,
    created_at timestamptz not null default now()
);

create index transformations_recording_id_idx on transformations(recording_id);
create index transformations_user_id_idx on transformations(user_id);

-- Row Level Security
alter table profiles enable row level security;
alter table style_guides enable row level security;
alter table reference_speeches enable row level security;
alter table prompt_templates enable row level security;
alter table recordings enable row level security;
alter table transformations enable row level security;

-- profiles: self only
create policy "profiles self read" on profiles for select using (auth.uid() = id);
create policy "profiles self update" on profiles for update using (auth.uid() = id);

-- style_guides
create policy "style_guides self all" on style_guides
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- reference_speeches
create policy "reference_speeches self all" on reference_speeches
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- prompt_templates
create policy "prompt_templates self all" on prompt_templates
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recordings
create policy "recordings self all" on recordings
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- transformations
create policy "transformations self all" on transformations
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket for audio files
insert into storage.buckets (id, name, public)
    values ('recordings', 'recordings', false)
    on conflict (id) do nothing;

-- Storage RLS: users may only read/write their own folder ({user_id}/...)
create policy "recordings bucket self read" on storage.objects
    for select using (
        bucket_id = 'recordings'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "recordings bucket self insert" on storage.objects
    for insert with check (
        bucket_id = 'recordings'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "recordings bucket self delete" on storage.objects
    for delete using (
        bucket_id = 'recordings'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
