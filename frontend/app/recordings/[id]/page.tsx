"use client";

import { use, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { PromptTemplate, Recording, Transformation } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-neutral-100 text-neutral-700",
  transcribing: "bg-amber-100 text-amber-800",
  transcribed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-neutral-100 text-neutral-700",
  running: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

export default function RecordingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rec, txs] = await Promise.all([
          api.get<Recording>(`/api/recordings/${id}`),
          api.get<Transformation[]>(`/api/transformations?recording_id=${id}`),
        ]);
        if (cancelled) return;
        setRecording(rec);
        setTransformations(txs);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Failed to load");
      }
    }
    load();
    const t = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  useEffect(() => {
    api.get<PromptTemplate[]>("/api/templates").then(setTemplates).catch(() => {});
  }, []);

  function applyTemplate(tid: string) {
    setTemplateId(tid);
    const tpl = templates.find((t) => t.id === tid);
    if (tpl) {
      setPrompt(tpl.prompt);
      setModel(tpl.model);
    }
  }

  async function runTransformation(e: React.FormEvent) {
    e.preventDefault();
    if (!recording) return;
    setRunning(true);
    setError(null);
    try {
      await api.post<Transformation>("/api/transformations", {
        recording_id: recording.id,
        template_id: templateId || null,
        prompt: prompt || null,
        model: model || null,
      });
      setPrompt("");
      setTemplateId("");
      setModel("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <AppShell>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {recording === null ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{recording.original_filename}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[recording.status] ?? ""}`}
            >
              {recording.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {new Date(recording.created_at).toLocaleString()}
          </p>

          <section className="mt-6">
            <h2 className="text-sm font-medium text-neutral-700">Transcript</h2>
            <div className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-200 bg-white p-4 text-sm">
              {recording.transcript ? (
                recording.transcript
              ) : recording.status === "failed" ? (
                <span className="text-red-600">{recording.error}</span>
              ) : (
                <span className="text-neutral-400">
                  {recording.status === "transcribing"
                    ? "Transcribing…"
                    : "Waiting to transcribe."}
                </span>
              )}
            </div>
          </section>

          {recording.status === "transcribed" && (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-neutral-700">Run transformation</h2>
              <form onSubmit={runTransformation} className="mt-2 space-y-3">
                <div className="flex gap-2">
                  <select
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">— pick a template (optional) —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="model (default claude-sonnet-4-6)"
                    className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Your transformation prompt"
                  rows={4}
                  className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={running}
                  className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {running ? "Starting…" : "Run"}
                </button>
              </form>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-sm font-medium text-neutral-700">Transformations</h2>
            {transformations.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400">No transformations yet.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {transformations.map((t) => (
                  <li key={t.id} className="rounded-md border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{t.model}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[t.status] ?? ""}`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-500 italic">{t.prompt_used}</p>
                    <div className="mt-3 whitespace-pre-wrap text-sm">
                      {t.output ? (
                        t.output
                      ) : t.status === "failed" ? (
                        <span className="text-red-600">{t.error}</span>
                      ) : (
                        <span className="text-neutral-400">Working…</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
