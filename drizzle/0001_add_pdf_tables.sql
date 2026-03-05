CREATE TABLE IF NOT EXISTS "pdfDocuments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" varchar NOT NULL,
	"fileName" varchar NOT NULL,
	"content" text,
	"summary" text,
	"createdAt" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pdfChunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"documentId" integer NOT NULL,
	"chunkIndex" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" json
);

