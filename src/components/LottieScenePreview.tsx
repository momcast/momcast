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
 * DEEP SEARCH: Recursively find an image layer linked to a slot.
 * It follows the composition tree until it finds a type 2 (image) layer.
 */
function findImageLayerDeep(compId: string, assets: any[]): any | null {
    const comp = assets.find((a: any) => a.id === compId);
    if (!comp || !comp.layers) return null;

    // 1. Check for direct image layer
    const imgLayer = comp.layers.find((l: any) => l.ty === 2);
    if (imgLayer) return imgLayer;

    // 2. Search deeper into nested precomps
    for (const layer of comp.layers) {
        if (layer.ty === 0 && layer.refId) {
            const found = findImageLayerDeep(layer.refId, assets);
            if (found) return found;
        }
    }
    return null;
}

/**
 * RECONSTRUCT: Ensure all assets required by a specific composition are collected.
 */
function collectRequiredAssets(compId: string, allAssets: any[], collectedIds: Set<string>) {
    if (collectedIds.has(compId)) return;
    const asset = allAssets.find(a => a.id === compId);
    if (!asset) return;

    collectedIds.add(compId);

    if (asset.layers) {
        asset.layers.forEach((l: any) => {
            if (l.refId) {
                collectRequiredAssets(l.refId, allAssets, collectedIds);
            }
        });
    }
}

/**
 * SMART PRUNING V2: 
 * - Extracts only necessary layers.
 * - Freezes background at frame 0 for performance.
 * - Ensures correct asset paths without duplicates.
 */
function prepareSceneLottieFixed(fullTemplate: any, sceneId: string) {
    if (!fullTemplate || !sceneId) return null;

    // Deep clone to safely mutate for this instance
    const template = JSON.parse(JSON.stringify(fullTemplate));

    // 1. Locate the scene's entry point in the main composition
    const sceneLayer = template.layers?.find((l: any) =>
        l.refId === sceneId || (l.nm && (l.nm.toLowerCase().includes(sceneId.toLowerCase()) || l.nm.includes('씬')))
    );

    // 2. Identify and collect all global background layers visible at scene start
    const sceneIp = sceneLayer ? sceneLayer.ip : 0;
    const isSceneNode = (l: any) => l.nm && (l.nm.toLowerCase().includes('scene') || l.nm.toLowerCase().includes('씬'));

    const backgroundLayers = template.layers?.filter((l: any) =>
        l !== sceneLayer && !isSceneNode(l) && l.ip <= sceneIp && l.op >= sceneIp
    ) || [];

    const finalLayers = [...backgroundLayers, sceneLayer].filter(Boolean);

    // 3. Prune assets to only what's actually used (Memory optimization)
    const usedAssetIds = new Set<string>();
    finalLayers.forEach(l => {
        if (l.refId) collectRequiredAssets(l.refId, template.assets || [], usedAssetIds);
    });

    const prunedAssets = (template.assets || []).filter((a: any) => usedAssetIds.has(a.id));

    // 4. Fix Asset Paths (Idempotent: prevents double prepending)
    prunedAssets.forEach((asset: any) => {
        if (asset.p && typeof asset.p === 'string' && !asset.p.startsWith('http') && !asset.p.startsWith('data:') && !asset.p.startsWith('/')) {
            asset.p = `/templates/images/${asset.p}`;
            asset.u = '';
        }
    });

    // 5. Construct the final lightweight JSON
    const sceneJson = {
        ...template,
        assets: prunedAssets,
        layers: finalLayers.map(l => ({
            ...l,
            st: l.st - sceneIp, // Normalize to start at 0
        })),
        ip: 0,
        op: (sceneLayer?.op || 300) - sceneIp,
        nm: `ScenePreview_${sceneId}`
    };

    return sceneJson;
}

/**
 * DEEP CONTENT INJECTOR:
 * Recursively visits all assets to find the target slot composition/layer.
 */
function injectDeepContent(
    lottieJson: any,
    slots: SceneSlots | undefined,
    userImages: Record<string, string>,
    userTexts: Record<string, string>
) {
    if (!lottieJson || !slots) return lottieJson;

    // 1. Image Injection (Deep search)
    slots.photos?.forEach(photoSlot => {
        const imageUrl = userImages[photoSlot.id];
        if (!imageUrl) return;

        const imgLayer = findImageLayerDeep(photoSlot.id, lottieJson.assets);
        if (imgLayer && imgLayer.refId) {
            const imgAsset = lottieJson.assets.find((a: any) => a.id === imgLayer.refId);
            if (imgAsset) {
                imgAsset.u = '';
                imgAsset.p = imageUrl;
            }
        }
    });

    // 2. Text Injection (Deep search)
    slots.texts?.forEach(textSlot => {
        const textContent = userTexts[textSlot.id];
        if (textContent === undefined) return;

        const textComp = lottieJson.assets.find((a: any) => a.id === textSlot.id);
        if (textComp && textComp.layers) {
            textComp.layers.forEach((l: any) => {
                if (l.ty === 5 && l.t?.d?.k) {
                    l.t.d.k[0].s.t = textContent;
                }
            });
        }
    });

    return lottieJson;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate, sceneId, slots,
    userImages = {}, userTexts = {},
    width, height, previewFrame = 0,
    className = "", backgroundMode = 'transparent', backgroundColor = '#ffffff'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    // Prepare processed JSON with memoization
    const processedJson = useMemo(() => {
        const prepared = prepareSceneLottieFixed(fullTemplate, sceneId);
        if (!prepared) return null;
        return injectDeepContent(prepared, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;
        if (animRef.current) animRef.current.destroy();

        try {
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson
            });
            animRef.current = anim;

            anim.addEventListener('DOMLoaded', () => {
                // User-requested: "Freeze at frame 0 for preview"
                // But we allow previewFrame override if needed (defaulting to 0)
                anim.goToAndStop(previewFrame, true);

                // Secondary check for stability
                setTimeout(() => {
                    if (animRef.current) animRef.current.goToAndStop(previewFrame, true);
                }, 50);

                // Fix quality issues for injected images
                const svg = containerRef.current?.querySelector('svg');
                if (svg) {
                    svg.querySelectorAll('image').forEach(img => {
                        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                    });
                }
            });
        } catch (e) {
            console.error("[LottiePreview] Load failure during render:", e);
        }

        return () => {
            if (animRef.current) animRef.current.destroy();
        };
    }, [processedJson, previewFrame]);

    const displayW = fullTemplate?.w || width || 1920;
    const displayH = fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden ${className}`}>
            {!processedJson ? (
                <div className="text-xs text-gray-500 animate-pulse">Initializing Preview...</div>
            ) : (
                <div
                    ref={containerRef}
                    className="relative transition-opacity duration-300"
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
