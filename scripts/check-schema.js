const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mrnjoopluhzjoalqvpov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmpvb3BsdWh6am9hbHF2cG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjcwNDcsImV4cCI6MjA4Mzc0MzA0N30.GqrbytubIw87FPIQZllmTbXT2lssrk36PuWhiQc_vyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('templates').select('*').limit(1);
    if (error) {
        console.error("❌ Error fetching schema:", error.message);
    } else {
        console.log("✅ Current template record:", JSON.stringify(data[0], null, 2));
    }
}

checkSchema();
