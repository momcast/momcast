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
                const { w, h, nm, assets, layers: topLayers } = data;

                // 1. 이미지 에셋 분석 (image_0, image_1 ...)
                const imageAssets = (assets || []).filter((a: any) => a.id && a.id.startsWith('image_'));
                const imageIndices = imageAssets.map((a: any) => parseInt(a.id.split('_')[1])).filter((n: number) => !isNaN(n));
                const maxImageIdx = imageIndices.length > 0 ? Math.max(...imageIndices) : 0;
                const sceneCount = maxImageIdx + 1;

                // 2. 텍스트 레이어 및 범위 분석 (텍스트12~13 등)
                const textRangeMap: Record<number, { isFirst: boolean, range: string }> = {};

                const scanLayers = (ls: any[]) => {
                    ls.forEach(l => {
                        if (l.nm && (l.nm.includes('텍스트') || l.nm.includes('text'))) {
                            const rangeMatch = l.nm.match(/(\d+)[~-](\d+)/);
                            if (rangeMatch) {
                                const start = parseInt(rangeMatch[1]);
                                const end = parseInt(rangeMatch[2]);
                                for (let i = start; i <= end; i++) {
                                    textRangeMap[i] = { isFirst: i === start, range: l.nm };
                                }
                            } else {
                                const singleMatch = l.nm.match(/(\d+)/);
                                if (singleMatch) {
                                    const idx = parseInt(singleMatch[1]);
                                    textRangeMap[idx] = { isFirst: true, range: l.nm };
                                }
                            }
                        }
                        if (l.layers) scanLayers(l.layers);
                    });
                };

                scanLayers(topLayers || []);
                (assets || []).forEach((a: any) => { if (a.layers) scanLayers(a.layers); });

                // 3. 장면 데이터 생성
                const scenes = [];
                for (let i = 0; i <= maxImageIdx; i++) {
                    const textInfo = textRangeMap[i];
                    scenes.push({
                        id: `scene_${i}`,
                        rotation: 0,
                        zoom: 1,
                        position: { x: 50, y: 50 },
                        backgroundMode: 'transparent',
                        backgroundColor: '#ffffff',
                        cropRect: { top: 0, left: 0, right: 0, bottom: 0 },
                        stickers: [],
                        drawings: [],
                        aeLayerName: textInfo?.range || `text_${i}`,
                        defaultContent: textInfo?.isFirst ? `${i}번 문구 입력` : "",
                        allowUserUpload: true,
                        allowUserText: textInfo ? textInfo.isFirst : false, // 이어지는 번호의 첫 번째만 텍스트 허용
                        allowUserDecorate: true
                    });
                }

                const templateData = {
                    id: templateId,
                    name: nm || templateId,
                    scene_count: sceneCount,
                    width: w,
                    height: h,
                    scenes: scenes,
                    updated_at: new Date().toISOString()
                };

                const { error: upsertError } = await supabase
                    .from('templates')
                    .upsert(templateData);

                if (upsertError) {
                    results.push({ file, status: 'error', message: upsertError.message });
                } else {
                    results.push({ file, status: 'success', sceneCount });
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
