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

        const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.toLowerCase().endsWith('.json'));
        console.log(`[Sync] Found ${files.length} JSON files in ${TEMPLATES_DIR}:`, files);
        const results = [];

        for (const file of files) {
            const filePath = path.join(TEMPLATES_DIR, file);
            const templateId = file.replace('.json', '');

            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const { w, h, nm, assets, layers: topLayers } = data;

                // 1. 장면(사진 컴포지션) 분석 (사진01, 사진02 ... 또는 image_0...)
                let scenesBase = (assets || []).filter((a: any) =>
                    a.layers && (a.nm?.includes('사진') || a.nm?.toLowerCase().includes('image') || a.nm?.toLowerCase().includes('photo'))
                );

                // 만약 특정 키워드 compositions가 없다면, layers가 있는 모든 assets(compositions)를 후보로 검토
                if (scenesBase.length === 0) {
                    scenesBase = (assets || []).filter((a: any) => a.layers && (a.nm || a.id));
                    console.log(`[Sync] No photo/image comps found. Found ${scenesBase.length} total compositions.`);
                }

                // 만약 위에서도 안 나오면 기존 방식(image_X 에셋)으로 폴백
                if (scenesBase.length === 0) {
                    scenesBase = (assets || []).filter((a: any) => a.id && (a.id.startsWith('image_') || a.p?.includes('img_')));
                    console.log(`[Sync] Falling back to image assets: ${scenesBase.length} found.`);
                }

                // 이름 순으로 정렬
                scenesBase.sort((a: any, b: any) => (a.nm || a.id || "").localeCompare(b.nm || b.id || "", undefined, { numeric: true, sensitivity: 'base' }));

                const sceneCount = scenesBase.length || 1;

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
                                    const idx = parseInt(singleMatch[singleMatch.length - 1]); // 가장 마지막 숫자 사용 (텍스트last31 등 대응)
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
                const scenes = scenesBase.map((item: any, idx: number) => {
                    // 이름에서 번호 추출 (없으면 인덱스 + 1)
                    const numMatch = item.nm?.match(/\d+/);
                    const sceneNum = numMatch ? parseInt(numMatch[0]) : idx + 1;
                    const textInfo = textRangeMap[sceneNum];

                    return {
                        id: item.id || `scene_${idx}`,
                        name: item.nm || `장면 ${idx + 1}`,
                        width: item.w || w,
                        height: item.h || h,
                        rotation: 0,
                        zoom: 1,
                        position: { x: 50, y: 50 },
                        backgroundMode: 'transparent',
                        backgroundColor: '#ffffff',
                        cropRect: { top: 0, left: 0, right: 0, bottom: 0 },
                        stickers: [],
                        drawings: [],
                        aeLayerName: textInfo?.range || `text_${sceneNum}`,
                        defaultContent: textInfo?.isFirst ? `${sceneNum}번 문구 입력` : "",
                        allowUserUpload: true,
                        allowUserText: textInfo ? textInfo.isFirst : false,
                        allowUserDecorate: true
                    };
                });

                const templateData = {
                    id: templateId,
                    name: nm || templateId,
                    scene_count: sceneCount,
                    width: w,
                    height: h,
                    scenes: scenes,
                    updated_at: new Date().toISOString()
                };

                console.log(`[Sync] Upserting template: ${templateId}, scenes: ${scenes.length}`);

                const { error: upsertError } = await supabase
                    .from('templates')
                    .upsert(templateData);

                if (upsertError) {
                    console.error(`[Sync] Upsert failed for ${file}:`, upsertError);
                    results.push({ file, status: 'error', message: upsertError.message });
                } else {
                    console.log(`[Sync] Successfully synced ${file}`);
                    results.push({ file, status: 'success', sceneCount });
                }

            } catch (e: any) {
                results.push({ file, status: 'error', message: e.message });
            }
        }

        const anyError = results.some(r => r.status === 'error');
        return NextResponse.json({ success: !anyError, results }, { status: anyError ? 400 : 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
