"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { ReferenceSpeech, StyleGuide } from "@/lib/types";

export default function StyleSettingsPage() {
  const [guide, setGuide] = useState("");
  const [refs, setRefs] = useState<ReferenceSpeech[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<StyleGuide>("/api/style/guide"),
      api.get<ReferenceSpeech[]>("/api/style/references"),
    ])
      .then(([g, r]) => {
        setGuide(g.content);
        setRefs(r);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Laden fehlgeschlagen"));
  }, []);

  async function saveGuide(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await api.put("/api/style/guide", { content: guide });
      setStatus("Gespeichert.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addReference(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.post<ReferenceSpeech>("/api/style/references", { title, content });
      setRefs([r, ...refs]);
      setTitle("");
      setContent("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  async function deleteRef(id: string) {
    setError(null);
    try {
      await api.del(`/api/style/references/${id}`);
      setRefs(refs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Stil</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Stilguide und Referenzreden werden bei jedem Entwurf mitgesendet.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={saveGuide} className="mt-6">
        <label className="block text-sm font-medium text-neutral-700">Stilguide</label>
        <textarea
          value={guide}
          onChange={(e) => setGuide(e.target.value)}
          rows={10}
          placeholder="Ton, Satzbau, rhetorische Mittel, Wörter die vermieden werden sollen…"
          className="mt-2 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
          {status && <span className="text-sm text-emerald-700">{status}</span>}
        </div>
      </form>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-700">Referenzreden</h2>
        <form onSubmit={addReference} className="mt-3 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel"
            required
            className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Redetext hier einfügen…"
            required
            className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
          >
            Hinzufügen
          </button>
        </form>

        <ul className="mt-6 space-y-2">
          {refs.map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between rounded-md border border-neutral-200 bg-white p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="mt-1 truncate text-xs text-neutral-500">{r.content}</p>
              </div>
              <button
                onClick={() => deleteRef(r.id)}
                type="button"
                className="ml-3 text-xs text-red-600 hover:underline"
              >
                Löschen
              </button>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
