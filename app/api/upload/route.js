import { inngest } from "@/inngest/client";
import { headers } from "next/headers";
import { db } from "@/configs/db";
import { PDF_DOCUMENTS_TABLE } from "@/configs/schema";
import { supabase } from "@/lib/supabase";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const headersList = await headers();
    const userId = headersList.get("x-user-id");

    if (!userId) {
      return Response.json(
        { error: "User ID is required" },
        { status: 401 }
      );
    }

    // Create document record first
    const [document] = await db
      .insert(PDF_DOCUMENTS_TABLE)
      .values({
        userId: userId,
        fileName: file.name,
        content: null, // Will be populated by Inngest
        summary: null,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: PDF_DOCUMENTS_TABLE.id });

    // Upload file to Supabase storage to avoid large Inngest payloads
    const filePath = `pdf-uploads/${document.id}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pdf-uploads")
      .upload(filePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return Response.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    // Trigger Inngest processing with document ID
    await inngest.send({
      name: "pdf/ingest",
      data: {
        fileName: file.name,
        userId,
        storagePath: filePath,
        documentId: document.id,
      },
    });

    return Response.json({
      success: true,
      documentId: document.id,
      message: "Upload received — processing started!",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { error: "Failed to upload file", details: error.message },
      { status: 500 }
    );
  }
}
