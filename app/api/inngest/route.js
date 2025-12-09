import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import {
  CreateNewUser,
  GenerateNotes,
  GenerateStudyTypeContent,
  helloWorld,
  ingestPDF,
} from "@/inngest/functions";
export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  streaming: "allow",
  functions: [
    helloWorld,
    CreateNewUser,
    GenerateNotes,
    GenerateStudyTypeContent,
    ingestPDF,
  ],
});
