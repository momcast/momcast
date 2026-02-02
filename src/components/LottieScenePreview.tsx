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
 * PATH FIXER: Safely prepends asset paths without duplicates.
 */
function safeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    return `/templates/images/${p}`;
}

/**
 * RECURSIVE SLOT SEARCH: Finds image/text layers even if deeply nested.
 */
function findLayerInAsset(compId: string, assets: any[], type: number): any | null {
    const asset = assets.find((a: any) => a.id === compId);
    if (!asset || !asset.layers) return null;

    const direct = asset.layers.find((l: any) => l.ty === type);
    if (direct) return direct;

    for (const l of asset.layers) {
        if (l.ty === 0 && l.refId) {
            const found = findLayerInAsset(l.refId, assets, type);
            if (found) return found;
        }
    }
    return null;
}

/**
 * ASSET COLLECTOR: Minimally collects required assets for a composition.
 */
function collectAssetTree(compId: string, allAssets: any[], collected: Map<string, any>) {
    if (collected.has(compId)) return;
    const asset = allAssets.find(a => a.id === compId);
    if (!asset) return;

    collected.set(compId, asset);
    if (asset.layers) {
        asset.layers.forEach((l: any) => {
            if (l.refId) collectAssetTree(l.refId, allAssets, collected);
        });
    }
}

/**
 * ZERO-CLONE PREPROCESSOR: 
 * Resolves the AE composition hierarchy to find the actual scene timeline.
 * Typical structures: Root -> Render -> SceneList -> Individual Scene
 */
function resolveSceneLottie(template: any, sceneId: string) {
    if (!template || !sceneId) return null;

    const assets = template.assets || [];
    let sceneLayer: any = null;
    let masterIp = 0;

    // 1. Recursive search for the scene layer in ALL assets and root layers
    const findSceneLayerRecursive = (layers: any[], currentIpOffset: number): any => {
        if (!layers) return null;
        for (const l of layers) {
            if (l.refId === sceneId || (l.nm && (l.nm.toLowerCase().includes(sceneId.toLowerCase()) || l.nm.includes('씬')))) {
                masterIp = currentIpOffset + (l.ip || 0);
                return l;
            }
            if (l.ty === 0 && l.refId) {
                const subAsset = assets.find((a: any) => a.id === l.refId);
                if (subAsset) {
                    const found = findSceneLayerRecursive(subAsset.layers, currentIpOffset + (l.st || 0));
                    if (found) return found;
                }
            }
        }
        return null;
    };

    sceneLayer = findSceneLayerRecursive(template.layers, 0);

    // 2. Identify global backgrounds (layers that overlap with sceneIp at ANY level)
    // For simplicity and speed, we mainly collect background layers from the ROOT and the level above the scene.
    const bgLayers: any[] = [];
    if (template.layers) {
        template.layers.forEach((l: any) => {
            const isSceneNode = l.nm && (l.nm.toLowerCase().includes('scene') || l.nm.toLowerCase().includes('씬'));
            if (!isSceneNode && l.refId !== sceneId && l.ip <= masterIp && l.op >= masterIp) {
                bgLayers.push(l);
            }
        });
    }

    const finalLayers = [...bgLayers, sceneLayer].filter(Boolean);
    const usedAssets = new Map<string, any>();
    finalLayers.forEach(l => {
        if (l.refId) collectAssetTree(l.refId, assets, usedAssets);
    });

    // 3. Build optimized JSON (Shallow clone where possible)
    const result = {
        ...template,
        assets: Array.from(usedAssets.values()).map(a => {
            if (a.p && !a.layers) { // For image assets, ensure safe path
                return { ...a, p: safeAssetPath(a.p), u: '' };
            }
            return a;
        }),
        layers: JSON.parse(JSON.stringify(finalLayers)).map((l: any) => ({
            ...l,
            st: l.st - masterIp, // Normalize timing
        })),
        ip: 0,
        op: (sceneLayer?.op || 300) - (sceneLayer?.ip || 0),
        nm: `Export_${sceneId}`
    };

    return result;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate, sceneId, slots,
    userImages = {}, userTexts = {},
    width, height, previewFrame = 0,
    className = "", backgroundMode = 'transparent', backgroundColor = '#ffffff'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    const processedJson = useMemo(() => {
        const resolved = resolveSceneLottie(fullTemplate, sceneId);
        if (!resolved) return null;

        // Content Injection
        slots?.photos?.forEach(slot => {
            const url = userImages[slot.id];
            if (!url) return;
            const imgLayer = findLayerInAsset(slot.id, resolved.assets, 2);
            if (imgLayer && imgLayer.refId) {
                const asset = resolved.assets.find((a: any) => a.id === imgLayer.refId);
                if (asset) { asset.p = url; asset.u = ''; }
            }
        });

        slots?.texts?.forEach(slot => {
            const text = userTexts[slot.id];
            if (text === undefined) return;
            const textComp = resolved.assets.find((a: any) => a.id === slot.id);
            if (textComp?.layers) {
                textComp.layers.forEach((l: any) => {
                    if (l.ty === 5 && l.t?.d?.k) l.t.d.k[0].s.t = text;
                });
            }
        });

        return resolved;
    }, [fullTemplate, sceneId, slots, userImages, userTexts]);

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
                setTimeout(() => animRef.current?.goToAndStop(previewFrame, true), 30);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error("[LottiePreview] Render Error:", e);
        }
        return () => animRef.current?.destroy();
    }, [processedJson, previewFrame]);

    const displayW = fullTemplate?.w || width || 1920;
    const displayH = fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            {!processedJson ? (
                <div className="text-[10px] text-gray-400">Loading Scene...</div>
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
