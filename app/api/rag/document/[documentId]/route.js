import { NextResponse } from "next/server";
import { db } from "@/configs/db";
import { PDF_DOCUMENTS_TABLE } from "@/configs/schema";
import { eq } from "drizzle-orm";

export async function GET(req, { params }) {
  try {
    const documentId = parseInt(params.documentId);

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    const [document] = await db
      .select()
      .from(PDF_DOCUMENTS_TABLE)
      .where(eq(PDF_DOCUMENTS_TABLE.id, documentId));

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document", details: error.message },
      { status: 500 }
    );
  }
}

