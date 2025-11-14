import { db } from "@/configs/db";
import { inngest } from "./client";
import {
  CHAPTER_NOTES_TABLE,
  STUDY_MATERIAL_TABLE,
  STUDY_TYPE_CONTENT_TABLE,
  USER_TABLE,
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
    console.log("hello from notes inngest")

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
