import { NextResponse } from "next/server";

const PPT_API_URL = process.env.PPT_API_URL || "http://localhost:8085";

export async function POST(request) {
  try {
    const body = await request.json();
    const { topic, num_slides = 5, custom_content } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json(
        { error: "topic is required and must be a string" },
        { status: 400 }
      );
    }

    const payload = {
      topic: topic.trim(),
      num_slides: Math.min(20, Math.max(1, Number(num_slides) || 5)),
      ...(custom_content && { custom_content }),
    };

    const res = await fetch(`${PPT_API_URL}/api/v1/presentations/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: errText || "Failed to create presentation" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[presentation/create]", error);
    return NextResponse.json(
      { error: "Could not reach PPT API. Ensure it is running at " + PPT_API_URL },
      { status: 502 }
    );
  }
}
