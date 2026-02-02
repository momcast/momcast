'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import { SceneSlots } from '../app/types';

interface Props {
    fullTemplate: any;
    sceneId: string;
    slots?: SceneSlots;
    userImages?: Record<string, string>; // compId -> imageURL
    userTexts?: Record<string, string>;  // compId -> textContent
    width?: number;
    height?: number;
    previewFrame?: number;
    className?: string;
    isEditor?: boolean;
    backgroundMode?: 'transparent' | 'solid' | 'blur';
    backgroundColor?: string;
}

/**
 * Helper: Find image layer recursively inside a composition tree
 */
function findImageLayer(compId: string, assets: any[]): any | null {
    const comp = assets.find((a: any) => a.id === compId);
    if (!comp || !comp.layers) return null;
    const imgLayer = comp.layers.find((l: any) => l.ty === 2);
    if (imgLayer) return imgLayer;
    for (const layer of comp.layers) {
        if (layer.ty === 0 && layer.refId) {
            const found = findImageLayer(layer.refId, assets);
            if (found) return found;
        }
    }
    return null;
}

/**
 * SMART PRUNING: Keep only necessary layers and assets for a scene.
 * This dramatically improves performance.
 */
function prepareSceneLottiePruned(fullTemplate: any, sceneId: string) {
    if (!fullTemplate || !sceneId) return null;

    // 1. Find the scene reference layer in the main composition
    const sceneLayer = fullTemplate.layers?.find((l: any) =>
        l.refId === sceneId || (l.nm && l.nm.toLowerCase().includes(sceneId.toLowerCase()))
    );
    if (!sceneLayer) {
        // Fallback: If scene not in main comp, just find the comp asset directly
        const directComp = fullTemplate.assets?.find((a: any) => a.id === sceneId);
        if (!directComp) return null;
    }

    const sceneIp = sceneLayer ? sceneLayer.ip : 0;
    const sceneOp = sceneLayer ? sceneLayer.op : (fullTemplate.op || 300);

    // 2. Identify "Global Backgrounds" (Layers visible at this scene's IP)
    // We only take layers that aren't other scenes to save memory
    const isSceneLayer = (l: any) => l.nm && (l.nm.toLowerCase().includes('scene') || l.nm.toLowerCase().includes('씬'));
    const bgLayers = fullTemplate.layers?.filter((l: any) =>
        l !== sceneLayer && !isSceneLayer(l) && l.ip <= sceneIp && l.op >= sceneIp
    ) || [];

    // 3. Construct the pruned layer list
    const layersToInclude = [...bgLayers, sceneLayer || { ty: 0, refId: sceneId, ip: 0, op: 9999, st: 0, ks: { o: { k: 100 }, r: { k: 0 }, p: { k: [Number(fullTemplate.w) / 2, Number(fullTemplate.h) / 2] }, a: { k: [Number(fullTemplate.w) / 2, Number(fullTemplate.h) / 2] }, s: { k: [100, 100] } } }];

    // 4. Recursive asset collection to strictly prune the JSON
    const usedAssetIds = new Set<string>();
    const collectUsedAssets = (layers: any[]) => {
        layers.forEach(l => {
            if (l.refId) {
                usedAssetIds.add(l.refId);
                const asset = fullTemplate.assets?.find((a: any) => a.id === l.refId);
                if (asset && asset.layers) collectUsedAssets(asset.layers);
            }
        });
    };
    collectUsedAssets(layersToInclude);

    // 5. Build final pruned JSON
    const pruned = {
        v: fullTemplate.v, fr: fullTemplate.fr,
        w: fullTemplate.w, h: fullTemplate.h,
        nm: `Pruned_${sceneId}`, ddd: 0,
        assets: fullTemplate.assets?.filter((a: any) => usedAssetIds.has(a.id)) || [],
        layers: layersToInclude.map(l => ({
            ...JSON.parse(JSON.stringify(l)),
            st: l.st - sceneIp, // Normalize timing
        })),
        ip: 0,
        op: sceneOp - sceneIp
    };

    // 6. Fix 404 Paths mapping
    pruned.assets.forEach((asset: any) => {
        if (asset.p && !asset.p.startsWith('http') && !asset.p.startsWith('data:')) {
            asset.p = `/templates/images/${asset.p}`;
            asset.u = '';
        }
    });

    return { lottie: pruned, sceneIp: 0 };
}

/**
 * Injects user content into the Lottie JSON assets
 */
function injectContent(
    lottieJson: any,
    slots: SceneSlots | undefined,
    userImages: Record<string, string>,
    userTexts: Record<string, string>,
    backgroundMode?: 'transparent' | 'solid' | 'blur',
    backgroundColor?: string
) {
    if (!lottieJson) return null;
    const copy = lottieJson;
    if (!slots) return copy;

    const w = Number(copy.w) || 1920;
    const h = Number(copy.h) || 1080;

    slots.photos?.forEach(photoSlot => {
        const imageUrl = userImages[photoSlot.id];
        if (!imageUrl) return;
        const imgLayer = findImageLayer(photoSlot.id, copy.assets);
        if (imgLayer && imgLayer.refId) {
            const imgAsset = copy.assets.find((a: any) => a.id === imgLayer.refId);
            if (imgAsset) {
                imgAsset.u = '';
                imgAsset.p = imageUrl;
            }
        }
    });

    slots.texts?.forEach(textSlot => {
        const textContent = userTexts[textSlot.id];
        if (textContent === undefined) return;
        const textComp = copy.assets.find((a: any) => a.id === textSlot.id);
        if (!textComp || !textComp.layers) return;
        textComp.layers.forEach((l: any) => {
            if (l.ty === 5 && l.t?.d?.k) {
                l.t.d.k[0].s.t = textContent;
            }
        });
    });

    if (backgroundMode === 'solid' || backgroundMode === 'blur') {
        const bgLayer: any = {
            nm: '___MOMCAST_BG___', ty: 1, sw: w, sh: h, sc: backgroundColor || '#ffffff',
            ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [w / 2, h / 2] }, a: { a: 0, k: [w / 2, h / 2] }, s: { a: 0, k: [100, 100] } },
            ip: 0, op: 10000, st: -100, bm: 0
        };
        if (backgroundMode === 'blur') {
            const firstPhotoId = slots.photos?.[0]?.id;
            const firstImgUrl = firstPhotoId ? userImages[firstPhotoId] : null;
            if (firstImgUrl) {
                const blurAssetId = 'asset_blur_bg';
                if (!copy.assets.find((a: any) => a.id === blurAssetId)) {
                    copy.assets.push({ id: blurAssetId, w: w, h: h, u: '', p: firstImgUrl, e: 0 });
                }
                bgLayer.ty = 2; bgLayer.refId = blurAssetId;
                bgLayer.ef = [{ ty: 29, nm: 'Blur', mn: 'ADBE Gaussian Blur 2', en: 1, ef: [{ ty: 0, nm: 'Blur', mn: 'ADBE Gaussian Blur 2-0001', v: { a: 0, k: 60 } }] }];
            }
        }
        copy.layers.unshift(bgLayer);
    }
    return copy;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate, sceneId, slots,
    userImages = {}, userTexts = {},
    width, height, previewFrame = 0,
    className = "", backgroundMode = 'transparent', backgroundColor = '#ffffff'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    const { processedJson } = useMemo(() => {
        const preparedResult = prepareSceneLottiePruned(fullTemplate, sceneId);
        if (!preparedResult) return { processedJson: null };
        const injected = injectContent(preparedResult.lottie, slots, userImages, userTexts, backgroundMode, backgroundColor);
        return { processedJson: injected };
    }, [fullTemplate, sceneId, slots, userImages, userTexts, backgroundMode, backgroundColor]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;
        if (animRef.current) animRef.current.destroy();

        try {
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg', loop: false, autoplay: false,
                animationData: processedJson
            });
            animRef.current = anim;
            anim.addEventListener('DOMLoaded', () => {
                anim.goToAndStop(previewFrame, true);
                setTimeout(() => { if (animRef.current) animRef.current.goToAndStop(previewFrame, true); }, 100);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error("[LottiePreview] Load error:", e);
        }
        return () => animRef.current?.destroy();
    }, [processedJson, previewFrame]);

    const displayW = fullTemplate?.w || width || 1920;
    const displayH = fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden ${className}`}>
            {!processedJson ? (
                <div className="text-xs text-gray-400">Preview Unavailable</div>
            ) : (
                <div
                    ref={containerRef}
                    className="relative"
                    style={{
                        width: isVertical ? 'auto' : '100%',
                        height: isVertical ? '100%' : 'auto',
                        aspectRatio: `${displayW} / ${displayH}`,
                        maxWidth: '100%',
                        maxHeight: '100%'
                    }}
                />
            )}
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
