import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const TEMPLATES_DIR = path.join(process.cwd(), 'public/templates');

        if (!fs.existsSync(TEMPLATES_DIR)) {
            return NextResponse.json({ error: "Templates directory not found" }, { status: 404 });
        }

        const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
        const results = [];

        for (const file of files) {
            const filePath = path.join(TEMPLATES_DIR, file);
            const templateId = file.replace('.json', '');

            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const { w, h, nm } = data;

                // Check if template exists
                const { data: existing } = await supabase
                    .from('templates')
                    .select('id')
                    .eq('id', templateId)
                    .single();

                const templateData: any = {
                    id: templateId,
                    name: nm || templateId,
                    scene_count: 1,
                };

                // Only set default scenes if it's a new template
                if (!existing) {
                    templateData.scenes = [
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
                    ];
                }

                const { error: upsertError } = await supabase
                    .from('templates')
                    .upsert(templateData);

                if (upsertError) {
                    results.push({ file, status: 'error', message: upsertError.message });
                } else {
                    results.push({ file, status: 'success' });
                }

            } catch (e: any) {
                results.push({ file, status: 'error', message: e.message });
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
