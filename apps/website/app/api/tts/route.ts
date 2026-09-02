import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TtsRequestBody = { text?: string };

const MAX_TEXT = 4000;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 20;

// Per-user fixed-window counter. Single-instance only (same caveat as the
// in-memory game/meet state elsewhere in this codebase).
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "OpenAI API key is not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Authentication required" }, { status: 401 });
  }

  if (rateLimited(user.id)) {
    return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  }

  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const text = body.text?.replace(/\s+/g, " ").trim();
  if (!text) {
    return NextResponse.json({ message: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ message: `Text exceeds ${MAX_TEXT} characters` }, { status: 400 });
  }

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", input: text, response_format: "mp3" }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    return NextResponse.json({ message: "Failed to generate speech", details }, { status: upstream.status });
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(Buffer.from(audio), {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}