import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    const sql = fs.readFileSync(
        "supabase/migrations/20260211000000_fix_duplicate_version_hierarchy.sql",
        "utf8"
    );

    console.log("Applying RPC migration directly...");

    // Execute the SQL directly
    const { error } = await supabase.rpc("exec", { sql });

    if (error) {
        console.error("Error applying migration:", error);
        console.log("\nPlease apply this migration manually through Supabase Dashboard:");
        console.log("1. Go to SQL Editor in Supabase Dashboard");
        console.log("2. Paste the contents of:");
        console.log("   supabase/migrations/20260211000000_fix_duplicate_version_hierarchy.sql");
        console.log("3. Run the query");
    } else {
        console.log("✅ Migration applied successfully!");
    }
}

applyMigration();
