import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = neon(process.env.NEXT_PUBLIC_DATABASE_CONNECTION_STRING);

async function runMigration() {
  try {
    console.log("Running migration...");
    
    // Read the migration file
    const migrationPath = join(__dirname, "../drizzle/0001_add_pdf_tables.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");
    
    // Split by statement breakpoints and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log("Executing:", statement.substring(0, 50) + "...");
        await sql(statement);
      }
    }
    
    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

