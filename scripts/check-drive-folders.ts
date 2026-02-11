import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDriveFolders() {
    console.log("=== CHECKING GOOGLE DRIVE FOLDERS ===\n");

    const projects = [
        { name: "ADOC (Root)", id: "76895eb8-374e-41ff-ad90-dbf4584df7ad", folderId: "1s3ne7EmQxHjqrtyEXRyIPxrywnJ3iQJa" },
        { name: "Documentation", id: "a2e34756-c1c7-412a-99ae-f8d2718ded0d", folderId: "1SwkmbBpqQBZ_y0jCc6ywZsSSjKeBiL6P" },
        { name: "Release Notes", id: "19896aaf-2b1f-4a54-8b51-1e69e13f6677", folderId: "13K0xmc-2oIEuyU4fgJkt9eR78NxHcJfr" },
    ];

    for (const project of projects) {
        console.log(`\n📁 ${project.name}`);
        console.log(`   Folder ID: ${project.folderId}`);
        console.log(`   Drive URL: https://drive.google.com/drive/folders/${project.folderId}`);

        // Check if there are any documents in the database with google_doc_id
        const { data: docs } = await supabase
            .from("documents")
            .select("id, title, google_doc_id, is_published")
            .eq("project_id", project.id);

        if (docs && docs.length > 0) {
            console.log(`   ✅ ${docs.length} document(s) in database:`);
            docs.forEach(doc => {
                console.log(`      - "${doc.title}" ${doc.google_doc_id ? `(Google Doc: ${doc.google_doc_id})` : '(no Google Doc)'} ${doc.is_published ? '[PUBLISHED]' : '[DRAFT]'}`);
            });
        } else {
            console.log(`   ⚠️  No documents in database`);
        }
    }

    console.log("\n\n=== NEXT STEPS ===");
    console.log("1. Open each Drive URL above in your browser");
    console.log("2. Check if there are Google Docs in those folders");
    console.log("3. If YES → Use Dashboard 'Sync from Drive' to import them");
    console.log("4. If NO → Create new content through the Dashboard");
}

checkDriveFolders();
