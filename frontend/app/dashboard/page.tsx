"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api, ApiError } from "@/lib/api";
import type { Recording } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Hochgeladen",
  transcribing: "Wird transkribiert…",
  transcribed: "Fertig",
  failed: "Fehler",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-neutral-100 text-neutral-700",
  transcribing: "bg-amber-100 text-amber-800",
  transcribed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<Recording[]>("/api/recordings");
        if (!cancelled) setRecordings(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Laden fehlgeschlagen");
      }
    }
    load();
    const t = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aufnahmen</h1>
        <Link
          href="/recordings/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
        >
          Neue Aufnahme
        </Link>
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
      {recordings === null && <p className="mt-6 text-sm text-neutral-500">Wird geladen…</p>}
      {recordings?.length === 0 && (
        <p className="mt-6 text-sm text-neutral-500">
          Noch keine Aufnahmen. Lade eine hoch, um zu beginnen.
        </p>
      )}

      <ul className="mt-6 divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
        {recordings?.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <Link href={`/recordings/${r.id}`} className="flex-1 truncate hover:underline">
              {r.original_filename}
            </Link>
            <span className={`ml-3 rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[r.status] ?? ""}`}>
              {STATUS_LABEL[r.status] ?? r.status}
            </span>
            <span className="ml-3 text-xs text-neutral-400">
              {new Date(r.created_at).toLocaleString("de-AT")}
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
