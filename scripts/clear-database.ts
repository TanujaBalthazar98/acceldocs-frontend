import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function clearDatabase() {
    console.log("⚠️  Clearing database content for testing...");

    // Delete in order of dependency (child -> parent) to avoid FK constraints if cascade isn't set
    // However, if CASCADE is set, deleting projects might be enough.
    // We'll try deleting leaf nodes first just in case.

    console.log("Deleting documents...");
    const { error: docError } = await supabase.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
    if (docError) console.error("Error deleting documents:", docError);

    console.log("Deleting topics...");
    const { error: topicError } = await supabase.from("topics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (topicError) console.error("Error deleting topics:", topicError);

    // Project versions often have FK to projects, but projects have FK to versions (default_version_id).
    // This circular dependency can be tricky.
    // Usually we update projects to nullify default_version_id first if strictly enforced.
    // Let's try deleting projects and see if it cascades.

    console.log("Deleting projects...");
    const { error: projectError } = await supabase.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    if (projectError) {
        console.error("Error deleting projects:", projectError);
        // Fallback: Try clearing versions if projects failed (though duplicate_version_id constraint might be issue)
    }

    // Attempt to clear orphans if any remained
    console.log("Cleaning up any remaining versions...");
    const { error: versionError } = await supabase.from("project_versions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (versionError) console.error("Error deleting versions:", versionError);

    console.log("✅ Database cleared.");
}

clearDatabase();
