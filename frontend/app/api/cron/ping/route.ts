import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Vercel signs cron requests with CRON_SECRET — reject anything else in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_API_URL not set" }, { status: 500 });
  }

  try {
    const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
