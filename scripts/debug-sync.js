const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env vars
const NEXT_PUBLIC_SUPABASE_URL = "https://your-project.supabase.co"; // Update these if necessary
const SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key";

async function debugSync() {
    try {
        const TEMPLATES_DIR = path.join(process.cwd(), 'public/templates');
        if (!fs.existsSync(TEMPLATES_DIR)) {
            console.error("Templates directory not found");
            return;
        }

        const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
        console.log(`Found ${files.length} template files:`, files);

        for (const file of files) {
            const filePath = path.join(TEMPLATES_DIR, file);
            const templateId = file.replace('.json', '');
            console.log(`\nProcessing ${file}...`);

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const { w, h, nm, assets, layers: topLayers } = data;

            // 1. 장면(사진 컴포지션) 분석
            const photoComps = (assets || []).filter((a) =>
                a.layers && (a.nm?.includes('사진') || a.nm?.toLowerCase().includes('image'))
            );

            console.log(`Found ${photoComps.length} photo compositions.`);

            // 정렬
            photoComps.sort((a, b) => (a.nm || "").localeCompare(b.nm || "", undefined, { numeric: true, sensitivity: 'base' }));

            let scenesBase = photoComps;
            if (scenesBase.length === 0) {
                scenesBase = (assets || []).filter((a) => a.id && a.id.startsWith('image_'));
                console.log(`Fall back to image_X assets: ${scenesBase.length} found.`);
            }

            const sceneCount = scenesBase.length || 1;
            console.log(`Final scene count: ${sceneCount}`);

            // 2. 텍스트 레이어 스캔
            const textRangeMap = {};
            const scanLayers = (ls) => {
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
                                const idx = parseInt(singleMatch[singleMatch.length - 1]);
                                textRangeMap[idx] = { isFirst: true, range: l.nm };
                            }
                        }
                    }
                    if (l.layers) scanLayers(l.layers);
                });
            };

            scanLayers(topLayers || []);
            (assets || []).forEach((a) => { if (a.layers) scanLayers(a.layers); });

            // 3. 장면 데이터 생성
            const scenes = scenesBase.map((item, idx) => {
                const numMatch = item.nm?.match(/\d+/);
                const sceneNum = numMatch ? parseInt(numMatch[0]) : idx + 1;
                const textInfo = textRangeMap[sceneNum];

                return {
                    id: item.id || `scene_${idx}`,
                    name: item.nm || `장면 ${idx + 1}`,
                    width: item.w || w,
                    height: item.h || h,
                    aeLayerName: textInfo?.range || `text_${sceneNum}`,
                    defaultContent: textInfo?.isFirst ? `${sceneNum}번 문구 입력` : "",
                    allowUserUpload: true,
                    allowUserText: textInfo ? textInfo.isFirst : false,
                };
            });

            console.log(`Generated ${scenes.length} scenes.`);
            if (scenes.length > 0) {
                console.log(`First scene:`, JSON.stringify(scenes[0], null, 2));
            }
        }
    } catch (e) {
        console.error("Debug sync failed:", e);
    }
}

debugSync();
