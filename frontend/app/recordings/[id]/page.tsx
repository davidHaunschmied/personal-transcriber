"use client";

import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { saveAs } from "file-saver";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { PromptTemplate, Recording, Transformation } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Hochgeladen",
  transcribing: "Wird transkribiert…",
  transcribed: "Fertig",
  failed: "Fehler",
  pending: "Ausstehend",
  running: "Wird verarbeitet…",
  done: "Fertig",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-neutral-100 text-neutral-700",
  transcribing: "bg-amber-100 text-amber-800",
  transcribed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  pending: "bg-neutral-100 text-neutral-700",
  running: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
    if (m[1] !== undefined) runs.push(new TextRun({ text: m[1], bold: true }));
    else if (m[2] !== undefined) runs.push(new TextRun({ text: m[2], italics: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)));
  return runs.length > 0 ? runs : [new TextRun(text)];
}

function textToParagraphs(text: string): Paragraph[] {
  return text.split("\n").map((line) => {
    if (line.startsWith("### "))
      return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
    if (line.startsWith("## "))
      return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
    if (line.startsWith("# "))
      return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
    return new Paragraph({ children: parseInline(line || " ") });
  });
}

async function downloadDocx(text: string, basename: string) {
  const doc = new Document({
    sections: [{ properties: {}, children: textToParagraphs(text) }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${basename}.docx`);
}

function downloadPdf(text: string, title: string) {
  const toHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:Georgia,serif;max-width:680px;margin:40px auto;font-size:12pt;line-height:1.7;color:#222}
      h1,h2,h3{font-weight:bold;margin:1.4em 0 .4em}
      p{margin:0 0 .8em}
      @media print{@page{margin:2cm}body{margin:0;max-width:100%}}
    </style>
    </head><body><p>${toHtml(text)}</p>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  win.document.close();
}

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
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [savingTranscript, setSavingTranscript] = useState(false);

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
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Laden fehlgeschlagen");
      }
    }
    load();
    const t = setInterval(load, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [id]);

  useEffect(() => {
    api.get<PromptTemplate[]>("/api/templates").then(setTemplates).catch(() => {});
  }, []);

  function applyTemplate(tid: string) {
    setTemplateId(tid);
    const tpl = templates.find((t) => t.id === tid);
    if (tpl) setPrompt(tpl.prompt);
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
        model: null,
      });
      setPrompt("");
      setTemplateId("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function saveTranscript() {
    if (!recording) return;
    setSavingTranscript(true);
    try {
      const updated = await api.patch<Recording>(`/api/recordings/${id}`, {
        transcript: transcriptDraft,
      });
      setRecording(updated);
      setEditingTranscript(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    } finally {
      setSavingTranscript(false);
    }
  }

  function startEditing() {
    setTranscriptDraft(recording?.transcript ?? "");
    setEditingTranscript(true);
  }

  const basename = recording?.original_filename.replace(/\.[^.]+$/, "") ?? "transkript";

  return (
    <AppShell>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {recording === null ? (
        <p className="text-sm text-neutral-500">Wird geladen…</p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{recording.original_filename}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[recording.status] ?? ""}`}>
              {STATUS_LABEL[recording.status] ?? recording.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            {new Date(recording.created_at).toLocaleString("de-AT")}
          </p>

          {/* Transcript — collapsed by default */}
          <section className="mt-6">
            <button
              type="button"
              onClick={() => { setTranscriptOpen((o) => !o); setEditingTranscript(false); }}
              className="flex w-full items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium hover:bg-neutral-50"
            >
              <span>Transkript</span>
              <span className="text-neutral-400">{transcriptOpen ? "▲" : "▼"}</span>
            </button>

            {transcriptOpen && (
              <div className="mt-1 rounded-md border border-neutral-200 bg-white p-4">
                {editingTranscript ? (
                  <>
                    <textarea
                      value={transcriptDraft}
                      onChange={(e) => setTranscriptDraft(e.target.value)}
                      rows={12}
                      className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={saveTranscript}
                        disabled={savingTranscript}
                        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                      >
                        {savingTranscript ? "Speichern…" : "Speichern"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTranscript(false)}
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-sm">
                      {recording.transcript ? (
                        recording.transcript
                      ) : recording.status === "failed" ? (
                        <span className="text-red-600">{recording.error}</span>
                      ) : (
                        <span className="text-neutral-400">
                          {recording.status === "transcribing"
                            ? "Wird transkribiert…"
                            : "Warte auf Transkription."}
                        </span>
                      )}
                    </div>
                    {recording.transcript && (
                      <button
                        type="button"
                        onClick={startEditing}
                        className="mt-3 text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
                      >
                        Transkript bearbeiten
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {/* Run transformation */}
          {recording.status === "transcribed" && (
            <section className="mt-6">
              <h2 className="text-sm font-medium text-neutral-700">Entwurf erstellen</h2>
              <form onSubmit={runTransformation} className="mt-2 space-y-3">
                {templates.length > 0 && (
                  <select
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Vorlage auswählen (optional) —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.is_default ? " (Standard)" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Anweisungen für die KI…"
                  rows={4}
                  className="block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  required
                />
                <button
                  type="submit"
                  disabled={running}
                  className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  {running ? "Startet…" : "Starten"}
                </button>
              </form>
            </section>
          )}

          {/* Transformations */}
          {transformations.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-medium text-neutral-700">Entwürfe</h2>
              <ul className="mt-2 space-y-3">
                {transformations.map((t) => (
                  <li key={t.id} className="rounded-md border border-neutral-200 bg-white p-4">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="italic">{t.prompt_used}</span>
                      <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 ${STATUS_STYLES[t.status] ?? ""}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>

                    {t.output && (
                      <>
                        <div className="mt-3 text-sm [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:font-bold [&_em]:italic">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.output}</ReactMarkdown>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => downloadDocx(t.output!, basename)}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            Word (.docx)
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPdf(t.output!, basename)}
                            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                          >
                            PDF (Drucken)
                          </button>
                        </div>
                      </>
                    )}

                    {t.status === "failed" && (
                      <p className="mt-2 text-sm text-red-600">{t.error}</p>
                    )}
                    {(t.status === "pending" || t.status === "running") && (
                      <p className="mt-2 text-sm text-neutral-400">Wird verarbeitet…</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
