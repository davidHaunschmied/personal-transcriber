"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const links = [
  { href: "/dashboard", label: "Recordings" },
  { href: "/recordings/new", label: "New" },
  { href: "/settings/style", label: "Style" },
  { href: "/settings/templates", label: "Templates" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold">
          Transcriber
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "text-neutral-900 font-medium" : "text-neutral-500 hover:text-neutral-900"}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={signOut}
            className="text-neutral-500 hover:text-neutral-900"
            type="button"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}
