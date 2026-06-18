import { NextRequest, NextResponse } from "next/server";

type TtsRequestBody = {
  text?: string;
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "OpenAI API key is not configured" }, { status: 500 });
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

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const details = await upstream.text();
    return NextResponse.json(
      { message: "Failed to generate speech", details },
      { status: upstream.status },
    );
  }

  const audio = await upstream.arrayBuffer();
  return new NextResponse(Buffer.from(audio), {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}