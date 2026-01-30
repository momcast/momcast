const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = 'https://mrnjoopluhzjoalqvpov.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ybmpvb3BsdWh6am9hbHF2cG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNjcwNDcsImV4cCI6MjA4Mzc0MzA0N30.GqrbytubIw87FPIQZllmTbXT2lssrk36PuWhiQc_vyY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEMPLATES_DIR = path.join(__dirname, '../../public/templates');

/**
 * Recursive function to find all photo and text slots within a composition
 */
function findSlotsRecursively(compId, lottieJson, visited = new Set()) {
    if (visited.has(compId)) return { photos: [], texts: [] };
    visited.add(compId);

    const comp = lottieJson.assets.find(a => a.id === compId);
    if (!comp || !comp.layers) return { photos: [], texts: [] };

    let results = { photos: [], texts: [] };

    comp.layers.forEach(layer => {
        // Pre-comp layer (ty === 0)
        if (layer.ty === 0 && layer.refId) {
            const refAsset = lottieJson.assets.find(a => a.id === layer.refId);
            if (!refAsset) return;

            // 1. Check if it's a photo composition (matches "사진**" pattern)
            if (refAsset.nm?.match(/^사진\d+$/)) {
                results.photos.push({ id: refAsset.id, name: refAsset.nm });
            }
            // 2. Check if it's a text composition (matches "텍스트**" pattern)
            else if (refAsset.nm?.match(/^텍스트\d+$/)) {
                results.texts.push({ id: refAsset.id, name: refAsset.nm });
            }
            // 3. Otherwise, dive deeper (recursive search)
            else {
                const subResults = findSlotsRecursively(layer.refId, lottieJson, visited);
                results.photos.push(...subResults.photos);
                results.texts.push(...subResults.texts);
            }
        }
    });

    return results;
}

/**
 * Extract scenes from Lottie JSON by finding the scene folder composition
 */
function extractScenesFromLottie(lottieJson) {
    console.log('\n📋 Analyzing Lottie structure with Recursive Slot Search & Edit Locking...');

    // Step 1: Find the scene container composition (scene_all)
    let sceneFolderComp = lottieJson.assets.find(a =>
        a.nm?.match(/^(scene_all|scesne|scene)s?$/i) && a.layers
    );

    if (!sceneFolderComp && lottieJson.layers) {
        const rootSceneLayer = lottieJson.layers.find(l =>
            l.nm?.match(/^(scene_all|scesne|scene)s?$/i) && l.refId
        );
        if (rootSceneLayer) {
            sceneFolderComp = lottieJson.assets.find(a => a.id === rootSceneLayer.refId);
        }
    }

    // Fallback: Large composition
    if (!sceneFolderComp) {
        sceneFolderComp = lottieJson.assets.find(a => a.layers && a.layers.length >= 30);
    }

    if (!sceneFolderComp) {
        console.warn('⚠️  Could not find any scene container');
        return { scenes: [], textGroups: [] };
    }

    console.log(`✅ Found scene container: "${sceneFolderComp.nm}" (ID: ${sceneFolderComp.id})`);

    const rawScenes = [];

    // Step 2: Extract each scene layer reference
    sceneFolderComp.layers.forEach((layer) => {
        if (layer.ty === 0 && layer.refId) {
            const sceneCompAsset = lottieJson.assets.find(a => a.id === layer.refId);
            if (!sceneCompAsset) return;

            // Match "scene01" or "scene 01"
            const match = sceneCompAsset.nm?.match(/^scene\s*(\d+)$/i);
            if (match) {
                rawScenes.push({
                    asset: sceneCompAsset,
                    num: parseInt(match[1]),
                    layerName: layer.nm
                });
            } else {
                console.warn(`  ⚠️  Skipping reference "${sceneCompAsset.nm}": name pattern mismatch`);
            }
        }
    });

    // Sort by scene number
    rawScenes.sort((a, b) => a.num - b.num);

    const scenes = [];
    const slotFirstAppearance = new Map(); // Track where each slot first appears

    // Step 3: Deep search for slots in each scene & apply edit locking
    rawScenes.forEach((sceneInfo, index) => {
        const rawSlots = findSlotsRecursively(sceneInfo.asset.id, lottieJson);

        // Process slots to add isEditable flag
        const processSlots = (items) => {
            // De-duplicate within the same scene first
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

        const sceneData = {
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
        };

        scenes.push(sceneData);

        const editablePhotos = sceneData.slots.photos.filter(p => p.isEditable).length;
        const lockedPhotos = sceneData.slots.photos.length - editablePhotos;
        const editableTexts = sceneData.slots.texts.filter(t => t.isEditable).length;
        const lockedTexts = sceneData.slots.texts.length - editableTexts;

        console.log(`  [씬${sceneInfo.num}] 사진: ${editablePhotos}개 편집가능${lockedPhotos > 0 ? ` (${lockedPhotos}개 잠금)` : ''}, 텍스트: ${editableTexts}개 편집가능${lockedTexts > 0 ? ` (${lockedTexts}개 잠금)` : ''}`);
    });

    // Step 4: Detect shared text components (Legacy but useful for UI)
    const textGroups = detectSharedText(scenes);

    return { scenes, textGroups };
}

function detectSharedText(scenes) {
    const textMap = {};
    scenes.forEach(scene => {
        scene.slots.texts.forEach(t => {
            if (!textMap[t.id]) {
                textMap[t.id] = { id: t.id, name: t.name, usedInScenes: [], firstAppearance: scene.id };
            }
            textMap[t.id].usedInScenes.push(scene.id);
        });
    });
    return Object.values(textMap);
}

/**
 * Main synchronization function
 */
async function syncTemplates() {
    console.log('🔍 Scanning templates directory:', TEMPLATES_DIR);

    if (!fs.existsSync(TEMPLATES_DIR)) {
        console.error('❌ Templates directory does not exist!');
        return;
    }

    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
        console.log('⚠️  No template JSON files found');
        return;
    }

    for (const file of files) {
        const filePath = path.join(TEMPLATES_DIR, file);
        const templateId = file.replace('.json', '');

        console.log('\n' + '='.repeat(60));
        console.log(`📦 Processing: ${file}`);
        console.log('='.repeat(60));

        try {
            const lottieJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const { scenes, textGroups } = extractScenesFromLottie(lottieJson);

            if (scenes.length === 0) {
                console.warn(`⚠️  No scenes extracted from ${file}, skipping...`);
                continue;
            }

            const templateData = {
                id: templateId,
                name: lottieJson.nm || templateId,
                scene_count: scenes.length,
                scenes: scenes,
                text_groups: textGroups,
                updated_at: new Date().toISOString()
            };

            const { error: upsertError } = await supabase
                .from('templates')
                .upsert(templateData);

            if (upsertError) {
                console.error(`❌ Failed to upsert ${templateId}:`, upsertError.message);
            } else {
                console.log(`\n✅ ${templateId} synchronized successfully!`);
                console.log(`   - ${scenes.length} scenes (Recursive Search & Edit Lock logic applied)`);
            }

        } catch (e) {
            console.error(`❌ Error processing ${file}:`, e.message);
        }
    }

    console.log('\n✅ DONE!');
}

syncTemplates().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
