import { db } from "@/configs/db";
import { supabase } from "@/lib/supabase";
import { SmartPDFParser } from "pdf-parse-new";
import { inngest } from "./client";
import {
  CHAPTER_NOTES_TABLE,
  STUDY_MATERIAL_TABLE,
  STUDY_TYPE_CONTENT_TABLE,
  USER_TABLE,
  PDF_DOCUMENTS_TABLE,
  PDF_CHUNKS_TABLE,
} from "@/configs/schema";
import { eq } from "drizzle-orm";
import {
  generateNotesAiModel,
  GenerateQnAAiModel,
  GenerateQuizAiModel,
  GenerateStudyTypeContentAiModel,
} from "@/configs/AiModel";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { event, body: "Hello World!" };
  }
);

export const CreateNewUser = inngest.createFunction(
  { id: "create-user" },
  { event: "user.create" },
  async ({ event, step }) => {
    const { user } = event.data;
    const result = await step.run(
      "CheckUser And create new if not in DB",
      async () => {
        try {
          // Check if the user already exists
          const email = user.email;
          const userName = user.userName;
          console.log(email, userName);
          const existingUser = await db
            .select()
            .from(USER_TABLE)
            .where(eq(USER_TABLE.email, email));

          if (existingUser?.length === 0) {
            // If not, then add to db with proper field names
            const userResp = await db
              .insert(USER_TABLE)
              .values({
                userName: userName || "", // Match the schema column name
                email: user.email || "",
                isMember: false,
                customerId: null,
              })
              .returning({ id: USER_TABLE.id });

            console.log("New user created:", userResp);
            return userResp;
          }
          return existingUser;
        } catch (error) {
          console.error("Error in CreateNewUser:", error);
          throw error; // Re-throw to let Inngest handle the error
        }
      }
    );

    return { status: "Success", userId: result[0]?.id };
  }
);

export const GenerateNotes = inngest.createFunction(
  { id: "generate-course" },
  { event: "notes.generate" },
  async ({ event, step }) => {
    const { course } = event.data;
    console.log("hello from notes inngest");

    try {
      console.log(
        `📚 [INNGEST] Starting notes generation for courseId: ${course?.courseId}`
      );
      console.log(
        `📖 [INNGEST] Chapters to generate:`,
        course?.courseLayout?.chapters
      );

      // Generate notes for each chapter with ai
      const notesResult = await step.run("Generate Chapter Notes", async () => {
        const chapters = course?.courseLayout?.chapters;

        if (!chapters || !Array.isArray(chapters)) {
          throw new Error("No chapters found in course layout");
        }

        console.log(
          `🔄 [INNGEST] Generating notes for ${chapters.length} chapters...`
        );

        // Use Promise.all to wait for all chapter notes to be generated
        await Promise.all(
          chapters.map(async (chapter, index) => {
            console.log(
              `📝 [INNGEST] Generating notes for chapter ${index + 1}: ${
                chapter.chapterTitle
              }`
            );

            const PROMPT =
              "Generate exam material detail content for each chapter. Make sure to include all topic point in the content, make sure to give content in HTML format (DO not add HTML, Head, Body, title tag), The Chapters:" +
              JSON.stringify(chapter);

            const result = await generateNotesAiModel.sendMessage(PROMPT);
            const aiResp = await result.response.text();

            console.log(
              `✅ [INNGEST] Generated content for chapter ${
                index + 1
              } (Length: ${aiResp.length} chars)`
            );

            // Insert notes into CHAPTER_NOTES_TABLE
            await db.insert(CHAPTER_NOTES_TABLE).values({
              chapterId: index + 1, // Using 1-based indexing for chapters
              courseId: course?.courseId,
              notes: aiResp,
            });

            console.log(
              `💾 [INNGEST] Saved notes to database for chapter ${index + 1}`
            );
          })
        );

        console.log(
          `🎉 [INNGEST] All notes generated successfully for courseId: ${course?.courseId}`
        );
        return "Completed";
      });

      // Update Status to ready in STUDY_MATERIAL_TABLE
      const updateCourseStatusResult = await step.run(
        "Update Course Status to Ready",
        async () => {
          await db
            .update(STUDY_MATERIAL_TABLE)
            .set({
              status: "Ready",
            })
            .where(eq(STUDY_MATERIAL_TABLE.courseId, course?.courseId));
          console.log(
            `✅ [INNGEST] Course status updated to Ready for courseId: ${course?.courseId}`
          );
          return "Success";
        }
      );

      return {
        status: "success",
        notesResult,
        updateCourseStatusResult,
      };
    } catch (error) {
      console.error(
        `❌ [INNGEST] Error in GenerateNotes for courseId ${course?.courseId}:`,
        error
      );

      // Update status to error in case of failure
      await db
        .update(STUDY_MATERIAL_TABLE)
        .set({
          status: "Error",
        })
        .where(eq(STUDY_MATERIAL_TABLE.courseId, course?.courseId));

      throw error; // Re-throw to let Inngest handle the error
    }
  }
);

//Used to generate flash cards, quiz and qna
export const GenerateStudyTypeContent = inngest.createFunction(
  { id: "Generate Study Type Content" },
  { event: "studyType.content" },

  async ({ event, step }) => {
    const { studyType, prompt, courseId, recordId } = event.data;

    try {
      console.log(
        `🚀 [INNGEST] Starting ${studyType} generation for courseId: ${courseId}`
      );
      console.log(`📌 [INNGEST] Record ID: ${recordId}`);
      console.log(`📝 [INNGEST] Prompt: ${prompt.substring(0, 100)}...`);

      const AiResult = await step.run(
        `Generating ${studyType} using AI`,
        async () => {
          console.log(`⏳ [INNGEST] Calling AI model for ${studyType}...`);

          let result;
          if (studyType === "Flashcard") {
            result = await GenerateStudyTypeContentAiModel.sendMessage(prompt);
            console.log(`📇 [INNGEST] Flashcard content received from AI`);
          } else if (studyType === "Quiz") {
            result = await GenerateQuizAiModel.sendMessage(prompt);
            console.log(`❓ [INNGEST] Quiz content received from AI`);
          } else if (studyType === "QA") {
            result = await GenerateQnAAiModel.sendMessage(prompt);
            console.log(`❔ [INNGEST] Q&A content received from AI`);
          } else {
            throw new Error(`Unsupported studyType: ${studyType}`);
          }

          const AIResult = JSON.parse(result.response.text());
          console.log(
            `✅ [INNGEST] ${studyType} content parsed successfully. Items count:`,
            Array.isArray(AIResult)
              ? AIResult.length
              : Object.keys(AIResult).length
          );
          return AIResult;
        }
      );

      //Save the result
      const DbResult = await step.run("Save Result to DB", async () => {
        console.log(
          `💾 [INNGEST] Saving ${studyType} to database for recordId: ${recordId}`
        );

        const result = await db
          .update(STUDY_TYPE_CONTENT_TABLE)
          .set({
            content: AiResult,
            status: "Ready",
          })
          .where(eq(STUDY_TYPE_CONTENT_TABLE.id, recordId));

        console.log(
          `✅ [INNGEST] ${studyType} saved to database successfully for courseId: ${courseId}`
        );
        return "Data Inserted";
      });

      console.log(
        `🎉 [INNGEST] ${studyType} generation completed for courseId: ${courseId}`
      );
      return { status: "success", studyType, courseId };
    } catch (error) {
      console.error(
        `❌ [INNGEST] Error generating ${studyType} for courseId ${courseId}:`,
        error
      );
      console.error(`Error details:`, {
        message: error.message,
        studyType,
        recordId,
      });
      throw error;
    }
  }
);

import { GoogleGenAI } from "@google/genai";
import { GoogleGenerativeAI } from "@google/generative-ai";
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embedder = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Sanitize non-ASCII to avoid JCS issues with embeddings/payloads
function stripNonAscii(text) {
  return text.replace(/[^\x00-\x7F]+/g, " ");
}

// Helper function to chunk text intelligently
function chunkText(text, chunkSize = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.5) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

export const ingestPDF = inngest.createFunction(
  { id: "ingest-pdf" },
  { event: "pdf/ingest" },
  async ({ event, step }) => {
    const { fileName, userId, documentId, storagePath, buffer } = event.data;

    try {
      // 1. Read PDF (prefer storage download to avoid large event payloads)
      const parsedResult = await step.run("Parse PDF", async () => {
        let pdfBuffer;

        if (storagePath) {
          const { data, error } = await supabase.storage
            .from("pdf-uploads")
            .download(storagePath);

          if (error) {
            console.error("Supabase download error:", error);
            throw error;
          }
          pdfBuffer = Buffer.from(await data.arrayBuffer());
        } else if (buffer) {
          pdfBuffer = Buffer.from(buffer, "base64");
        } else {
          throw new Error("No PDF source provided");
        }

        const parser = new SmartPDFParser();
        const parsed = await parser.parse(pdfBuffer);
        return parsed.text;
      });

      const text = parsedResult;
      const cleanText = stripNonAscii(text);

      // 2. Generate summary
      const summary = await step.run("Generate Summary", async () => {
        // Limit text to avoid token limits
        const limitedText = cleanText.substring(0, 8000);
        const prompt = `
You are a helpful AI tutor. Read the following document and generate a concise study summary (2-3 paragraphs):
${limitedText}
`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        return response.text || "Summary generated successfully.";
      });

      // 3. Chunk the text (larger chunks with overlap)
      const chunks = await step.run("Chunk Text", async () => {
        return chunkText(cleanText, 1200, 200);
      });

      // 4. Embed chunks
      const embeddings = await step.run("Embed Chunks", async () => {
        const results = [];
        for (const chunk of chunks) {
          try {
            const res = await embedder.embedContent(chunk);
            results.push(res.embedding.values);
          } catch (err) {
            console.error("Embedding error for chunk:", err);
            results.push(null);
          }
        }
        return results;
      });

      // 5. Update document in database with content and summary
      await step.run("Update Document", async () => {
        await db
          .update(PDF_DOCUMENTS_TABLE)
          .set({
            content: text,
            summary: summary,
          })
          .where(eq(PDF_DOCUMENTS_TABLE.id, documentId));
      });

      // 6. Store chunks in database with embeddings
      await step.run("Store Chunks", async () => {
        const chunkRows = chunks.map((chunk, index) => ({
          documentId: documentId,
          chunkIndex: index,
          content: chunk,
          embedding: embeddings[index],
        }));

        await db.insert(PDF_CHUNKS_TABLE).values(chunkRows);
      });

      console.log(`✅ PDF processed: ${fileName}, ${chunks.length} chunks stored`);

      return {
        status: "processed",
        documentId: documentId,
        chunks: chunks.length,
        summary: summary,
      };
    } catch (error) {
      console.error("Error processing PDF:", error);
      throw error;
    }
  }
);
