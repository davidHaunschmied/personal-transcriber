"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { PromptTemplate } from "@/lib/types";

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PromptTemplate[]>("/api/templates")
      .then(setTemplates)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"));
  }, []);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const t = await api.post<PromptTemplate>("/api/templates", {
        name,
        prompt,
        model: model || null,
        is_default: isDefault,
      });
      setTemplates([t, ...templates.map((x) => (isDefault ? { ...x, is_default: false } : x))]);
      setName("");
      setPrompt("");
      setModel("");
      setIsDefault(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  async function deleteTemplate(id: string) {
    setError(null);
    try {
      await api.del(`/api/templates/${id}`);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Prompt templates</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Reusable transformation prompts. Pick one when running a transformation.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={createTemplate} className="mt-6 space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Polish speech)"
          required
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="The prompt to send to the model"
          required
          className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model (default claude-sonnet-4-6)"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default
          </label>
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white"
        >
          Save template
        </button>
      </form>

      <ul className="mt-8 space-y-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="flex items-start justify-between rounded-md border border-neutral-200 bg-white p-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {t.name}
                {t.is_default && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    default
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{t.model}</p>
              <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-700">{t.prompt}</p>
            </div>
            <button
              onClick={() => deleteTemplate(t.id)}
              type="button"
              className="ml-3 text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
