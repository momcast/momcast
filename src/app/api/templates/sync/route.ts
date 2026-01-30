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
        const results = [];

        // 헬퍼 함수 1: 재귀적 슬롯 검색
        const findSlotsRecursively = (compId: string, lottieJson: any, visited = new Set()) => {
            if (visited.has(compId)) return { photos: [], texts: [] };
            visited.add(compId);

            const comp = lottieJson.assets.find((a: any) => a.id === compId);
            if (!comp || !comp.layers) return { photos: [], texts: [] };

            let results: { photos: any[], texts: any[] } = { photos: [], texts: [] };

            comp.layers.forEach((layer: any) => {
                if (layer.ty === 0 && layer.refId) {
                    const refAsset = lottieJson.assets.find((a: any) => a.id === layer.refId);
                    if (!refAsset) return;

                    if (refAsset.nm?.match(/^사진\d+$/)) {
                        results.photos.push({ id: refAsset.id, name: refAsset.nm });
                    }
                    else if (refAsset.nm?.match(/^텍스트\d+$/)) {
                        results.texts.push({ id: refAsset.id, name: refAsset.nm });
                    }
                    else {
                        const subResults = findSlotsRecursively(layer.refId, lottieJson, visited);
                        results.photos.push(...subResults.photos);
                        results.texts.push(...subResults.texts);
                    }
                }
            });
            return results;
        };

        // 헬퍼 함수 2: 중복 텍스트 감지 (Legacy 호환성)
        const detectSharedText = (scenes: any[]) => {
            const textMap: any = {};
            scenes.forEach(scene => {
                scene.slots.texts.forEach((t: any) => {
                    if (!textMap[t.id]) {
                        textMap[t.id] = { id: t.id, name: t.name, usedInScenes: [], firstAppearance: scene.id };
                    }
                    textMap[t.id].usedInScenes.push(scene.id);
                });
            });
            return Object.values(textMap);
        };

        for (const file of files) {
            const filePath = path.join(TEMPLATES_DIR, file);
            const templateId = file.replace('.json', '');

            try {
                const lottieJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                // 씬 컨테이너 찾기 (scene_all 등)
                let sceneFolderComp = lottieJson.assets.find((a: any) =>
                    a.nm?.match(/^(scene_all|scesne|scene)s?$/i) && a.layers
                );

                if (!sceneFolderComp && lottieJson.layers) {
                    const rootSceneLayer = lottieJson.layers.find((l: any) =>
                        l.nm?.match(/^(scene_all|scesne|scene)s?$/i) && l.refId
                    );
                    if (rootSceneLayer) {
                        sceneFolderComp = lottieJson.assets.find((a: any) => a.id === rootSceneLayer.refId);
                    }
                }

                if (!sceneFolderComp) {
                    // 차선책: 레이어 수가 많은 컴포지션을 씬 폴더로 추측
                    sceneFolderComp = lottieJson.assets.find((a: any) => a.layers && a.layers.length >= 30);
                }

                if (!sceneFolderComp) {
                    results.push({ file, status: 'skipped', message: 'Could not find any scene container composition' });
                    continue;
                }

                const rawScenes: any[] = [];
                sceneFolderComp.layers.forEach((layer: any) => {
                    if (layer.ty === 0 && layer.refId) {
                        const sceneCompAsset = lottieJson.assets.find((a: any) => a.id === layer.refId);
                        if (!sceneCompAsset) return;

                        const match = sceneCompAsset.nm?.match(/^scene\s*(\d+)$/i);
                        if (match) {
                            rawScenes.push({
                                asset: sceneCompAsset,
                                num: parseInt(match[1]),
                                layerName: layer.nm
                            });
                        }
                    }
                });

                rawScenes.sort((a, b) => a.num - b.num);

                const scenes: any[] = [];
                const slotFirstAppearance = new Map();

                rawScenes.forEach((sceneInfo, index) => {
                    const rawSlots = findSlotsRecursively(sceneInfo.asset.id, lottieJson);

                    const processSlots = (items: any[]) => {
                        const uniqueInScene = Array.from(new Map(items.map(s => [s.id, s])).values());
                        return uniqueInScene.map(slot => {
                            const isFirstTime = !slotFirstAppearance.has(slot.id);
                            if (isFirstTime) {
                                slotFirstAppearance.set(slot.id, sceneInfo.asset.id);
                            }
                            return {
                                id: slot.id,
                                name: slot.name,
                                isEditable: slotFirstAppearance.get(slot.id) === sceneInfo.asset.id
                            };
                        });
                    };

                    scenes.push({
                        id: sceneInfo.asset.id,
                        name: `씬 ${sceneInfo.num}`,
                        order: index + 1,
                        width: sceneInfo.asset.w,
                        height: sceneInfo.asset.h,
                        previewFrame: 0,
                        slots: {
                            photos: processSlots(rawSlots.photos),
                            texts: processSlots(rawSlots.texts)
                        }
                    });
                });

                const textGroups = detectSharedText(scenes);

                const templateData = {
                    id: templateId,
                    name: lottieJson.nm || templateId,
                    scene_count: scenes.length,
                    width: lottieJson.w,
                    height: lottieJson.h,
                    scenes: scenes,
                    text_groups: textGroups,
                    updated_at: new Date().toISOString()
                };

                const { error: upsertError } = await supabase
                    .from('templates')
                    .upsert(templateData);

                if (upsertError) {
                    results.push({ file, status: 'error', message: upsertError.message });
                } else {
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
