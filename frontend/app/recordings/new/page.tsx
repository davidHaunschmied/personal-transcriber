"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { RecordingRegistered } from "@/lib/types";

export default function NewRecordingPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setStage("Creating recording…");
      const reg = await api.post<RecordingRegistered>("/api/recordings", {
        original_filename: file.name,
      });

      setStage("Uploading audio…");
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage
        .from("recordings")
        .uploadToSignedUrl(reg.storage_path, reg.upload_token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (upErr) throw new Error(upErr.message);

      setStage("Starting transcription…");
      await api.post(`/api/recordings/${reg.recording.id}/transcribe`);

      router.push(`/recordings/${reg.recording.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">New recording</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Upload an audio file (max 25&nbsp;MB). Transcription starts automatically.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
          required
        />
        <button
          type="submit"
          disabled={!file || busy}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy ? stage || "Working…" : "Upload & transcribe"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </AppShell>
  );
}
