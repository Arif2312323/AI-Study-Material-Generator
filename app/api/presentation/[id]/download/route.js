import { NextResponse } from "next/server";

const PPT_API_URL = process.env.PPT_API_URL || "http://localhost:8085";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${PPT_API_URL}/api/v1/presentations/${id}/download`,
      { method: "GET" }
    );

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: errText || "Failed to download presentation" },
        { status: res.status }
      );
    }

    const blob = await res.blob();
    const contentDisposition = res.headers.get("content-disposition");
    const filename =
      contentDisposition?.match(/filename="?([^";\n]+)"?/)?.[1] ||
      `presentation_${id}.pptx`;

    return new NextResponse(blob, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[presentation/download]", error);
    return NextResponse.json(
      { error: "Could not reach PPT API. Ensure it is running at " + PPT_API_URL },
      { status: 502 }
    );
  }
}
