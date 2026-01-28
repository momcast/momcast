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

                // 헬퍼 함수: 이름에서 숫자 추출
                const extractNumber = (name: string): number | null => {
                    const match = name?.match(/\d+/);
                    return match ? parseInt(match[0]) : null;
                };

                // 0. 'scene' 폴더 찾기 (선택적)
                const sceneFolder = (assets || []).find((a: any) =>
                    a.nm && a.nm.toLowerCase() === 'scene'
                );

                let targetAssets = assets || [];

                if (sceneFolder) {
                    // 'scene' 폴더가 있으면 해당 폴더 내부의 컴포지션만 사용
                    const sceneFolderPath = sceneFolder.u;
                    targetAssets = (assets || []).filter((a: any) =>
                        a.u === sceneFolderPath && a.layers
                    );
                    console.log(`[Sync] Found 'scene' folder. Using ${targetAssets.length} compositions inside it.`);
                } else {
                    console.log(`[Sync] No 'scene' folder found. Scanning all compositions.`);
                }

                // 1. 사진 컴포지션 분석
                const photoComps = targetAssets.filter((a: any) =>
                    a.layers && a.nm && a.nm.includes('사진')
                );

                console.log(`[Sync] Found ${photoComps.length} photo compositions.`);

                // 2. 텍스트 컴포지션 분석
                const textComps = targetAssets.filter((a: any) =>
                    a.layers && a.nm && a.nm.includes('텍스트')
                );

                console.log(`[Sync] Found ${textComps.length} text compositions.`);

                // 3. 사진과 텍스트의 모든 번호 추출
                const photoNumbers = photoComps.map((c: any) => extractNumber(c.nm)).filter((n: any) => n !== null) as number[];
                const textNumbers = textComps.map((c: any) => extractNumber(c.nm)).filter((n: any) => n !== null) as number[];

                // 4. 번호 합집합 구하기 (중복 제거 및 정렬)
                const allNumbers = Array.from(new Set([...photoNumbers, ...textNumbers])).sort((a, b) => a - b);

                console.log(`[Sync] Scene numbers detected:`, allNumbers);

                if (allNumbers.length === 0) {
                    console.log(`[Sync] No numbered scenes found. Skipping ${file}.`);
                    results.push({ file, status: 'skipped', message: 'No numbered photo or text compositions found' });
                    continue;
                }

                // 5. 각 번호에 대해 씬 생성
                const scenes = allNumbers.map((num, idx) => {
                    // 해당 번호의 사진/텍스트 컴포지션 찾기
                    const photoComp = photoComps.find((c: any) => extractNumber(c.nm) === num);
                    const textComp = textComps.find((c: any) => extractNumber(c.nm) === num);

                    // 사진이나 텍스트 중 하나라도 있으면 해당 정보 사용
                    const sceneWidth = photoComp?.w || textComp?.w || w || 1920;
                    const sceneHeight = photoComp?.h || textComp?.h || h || 1080;

                    return {
                        id: photoComp?.id || textComp?.id || `scene_${num}`,
                        name: `장면 ${num}`,
                        sceneNumber: num,
                        hasPhoto: !!photoComp,
                        hasText: !!textComp,
                        width: sceneWidth,
                        height: sceneHeight,
                        rotation: 0,
                        zoom: 1,
                        position: { x: 50, y: 50 },
                        backgroundMode: 'transparent',
                        backgroundColor: '#ffffff',
                        cropRect: { top: 0, left: 0, right: 0, bottom: 0 },
                        stickers: [],
                        drawings: [],
                        aeLayerName: textComp?.nm || null,
                        defaultContent: textComp ? `${num}번 문구 입력` : "",
                        allowUserUpload: true,
                        allowUserText: !!textComp,
                        allowUserDecorate: true
                    };
                });

                const templateData = {
                    id: templateId,
                    name: nm || templateId,
                    scene_count: scenes.length,
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
                    results.push({ file, status: 'success', sceneCount: scenes.length });
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
