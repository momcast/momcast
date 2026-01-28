const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration - Using values from supabaseClient.ts
const SUPABASE_URL = 'https://mrnjoopluhzjoalqvpov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmpvb3BsdWh6am9hbHF2cG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjcwNDcsImV4cCI6MjA4Mzc0MzA0N30.GqrbytubIw87FPIQZllmTbXT2lssrk36PuWhiQc_vyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEMPLATES_DIR = path.join(__dirname, '../../public/templates');

async function syncTemplates() {
    console.log("🔍 Scanning templates directory:", TEMPLATES_DIR);

    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.error("❌ Templates directory does not exist!");
        return;
    }

    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
        const filePath = path.join(TEMPLATES_DIR, file);
        const templateId = file.replace('.json', '');

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const { w, h, nm } = data;

            console.log(`📦 Processing ${file}: ${w}x${h} (${nm})`);

            // Check if template exists
            const { data: existing, error: fetchError } = await supabase
                .from('templates')
                .select('id')
                .eq('id', templateId)
                .single();

            const templateData = {
                id: templateId,
                name: nm || templateId,
                scene_count: 1, // Default
                // Default scenes structure if new
                scenes: existing ? undefined : [
                    {
                        id: 'scene_1',
                        rotation: 0,
                        zoom: 1,
                        position: { x: 50, y: 50 },
                        backgroundMode: 'transparent',
                        backgroundColor: '#ffffff',
                        cropRect: { top: 0, left: 0, right: 0, bottom: 0 },
                        stickers: [],
                        drawings: [],
                        defaultContent: "새로운 장면"
                    }
                ]
            };

            const { error: upsertError } = await supabase
                .from('templates')
                .upsert(templateData);

            if (upsertError) {
                console.error(`❌ Failed to upsert ${templateId}:`, upsertError.message);
            } else {
                console.log(`✅ ${templateId} synchronized.`);
            }

        } catch (e) {
            console.error(`❌ Error processing ${file}:`, e.message);
        }
    }
}

syncTemplates();
