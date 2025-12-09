import { NextResponse } from "next/server";
import { db } from "@/configs/db";
import { PDF_DOCUMENTS_TABLE, PDF_CHUNKS_TABLE } from "@/configs/schema";
import { eq, asc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedder = genAI.getGenerativeModel({ model: "text-embedding-004" });

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function POST(req) {
  try {
    const { query, documentId } = await req.json();

    if (!query || !documentId) {
      return NextResponse.json(
        { error: "Query and documentId are required" },
        { status: 400 }
      );
    }

    // Get document
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

    // Get all chunks for the document
    const chunks = await db
      .select()
      .from(PDF_CHUNKS_TABLE)
      .where(eq(PDF_CHUNKS_TABLE.documentId, documentId))
      .orderBy(asc(PDF_CHUNKS_TABLE.chunkIndex));

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document is still being processed. Please wait." },
        { status: 202 }
      );
    }

    // Embed query
    const queryEmbeddingResp = await embedder.embedContent(query);
    const queryEmbedding = queryEmbeddingResp.embedding.values;

    // Score chunks by cosine similarity; filter out missing embeddings
    const scored = chunks
      .map((c) => ({
        ...c,
        score: c.embedding ? cosineSimilarity(queryEmbedding, c.embedding) : -1,
      }))
      .filter((c) => c.score > 0);

    // If no embeddings, fall back to first 10 chunks
    const topChunks =
      scored.length > 0
        ? scored.sort((a, b) => b.score - a.score).slice(0, 8)
        : chunks.slice(0, 10);

    const relevantChunks = topChunks.map((c) => c.content).join("\n\n");

    // Generate answer using Gemini
    const prompt = `
You are a thorough AI tutor. Using ONLY the provided document excerpts, answer the question with depth and coverage. If information is missing, say so.

Document Excerpts:
${relevantChunks}

Question: ${query}

Instructions:
- Provide a comprehensive answer that covers all relevant points from the excerpts.
- Be specific and detailed; do not be terse.
- If the answer is not found in the excerpts, clearly state that.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // Handle both property and function access patterns
    const answer = typeof response.text === 'function' 
      ? response.text() 
      : (response.text || "I couldn't generate an answer. Please try again.");

    return NextResponse.json({
      success: true,
      answer: answer,
      documentTitle: document.fileName,
    });
  } catch (error) {
    console.error("Query error:", error);
    return NextResponse.json(
      { error: "Failed to process query", details: error.message },
      { status: 500 }
    );
  }
}

