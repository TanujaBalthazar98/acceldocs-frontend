
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load .env from root
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLegacyContent() {
    console.log("Checking for legacy content...");

    // 1. Check for documents with content_html but no google_doc_id
    const { data: legacyDocs, error } = await supabase
        .from("documents")
        .select("id, title, google_doc_id, content_html")
        .is("google_doc_id", null)
        .not("content_html", "is", null);

    if (error) {
        console.error("Error fetching documents:", error);
        return;
    }

    console.log(`Found ${legacyDocs?.length || 0} documents with content_html but no google_doc_id.`);
    if (legacyDocs && legacyDocs.length > 0) {
        console.log("Sample docs:", legacyDocs.slice(0, 5).map(d => d.title));
    } else {
        console.log("No legacy content found requiring migration.");
    }
}

checkLegacyContent();
