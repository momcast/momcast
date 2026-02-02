'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
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
 * STRATEGIC PATH NORMALIZER
 */
function normalizePath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    // Strip te-images/ and other subfolders for direct /templates/images focus
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * HYPER-PRUNING ENGINE v2: 
 * Aggressively trims JSON and filters out rendering glitches.
 */
function hyperPrune(template: any, sceneId: string) {
    if (!template || !sceneId) return null;

    const allAssets = template.assets || [];
    const usedAssetIds = new Set<string>();

    const collectDeepAssets = (compId: string) => {
        if (usedAssetIds.has(compId)) return;
        const asset = allAssets.find((a: any) => a.id === compId);
        if (!asset) return;
        usedAssetIds.add(compId);
        if (asset.layers) {
            asset.layers.forEach((l: any) => {
                if (l.refId) collectDeepAssets(l.refId);
            });
        }
    };

    // Find target scene comp
    const sceneAsset = allAssets.find((a: any) => a.id === sceneId || (a.nm && a.nm.toLowerCase() === sceneId.toLowerCase()));
    if (!sceneAsset) return null;

    collectDeepAssets(sceneAsset.id);

    // Deep Filter for Glitches
    const filterGlitchLayers = (layers: any[]) => {
        if (!layers) return [];
        return JSON.parse(JSON.stringify(layers)).map((l: any) => {
            const name = (l.nm || "").toLowerCase();

            // AGGRESSIVE TRANSITION FILTERING (The "White Line" fix)
            const isGlitchy =
                name.includes('transition') ||
                name.includes('트랜지션') ||
                name.includes('wipe') ||
                name.includes('radial') ||
                name.includes('빛') ||
                name.includes('flash') ||
                name.includes('선') ||
                name.includes('라인') ||
                name.includes('white') ||
                name.includes('shimmer') ||
                (l.ef && l.ef.some((e: any) => e.nm && (e.nm.includes('Wipe') || e.nm.includes('Transition'))));

            if (isGlitchy) {
                return { ...l, hd: true }; // Hide and set op to 0 for safety
            }

            // Recursively filter sub-asset layers if needed (pre-processing assets)
            return l;
        });
    };

    // Build optimized JSON
    const finalAssets = allAssets
        .filter((a: any) => usedAssetIds.has(a.id))
        .map((a: any) => {
            if (a.layers) {
                return { ...a, layers: filterGlitchLayers(a.layers) };
            }
            if (a.p) return { ...a, p: normalizePath(a.p), u: '' };
            return a;
        });

    const prunedJson = {
        v: template.v,
        fr: template.fr,
        ip: 0,
        op: sceneAsset.op || 300,
        w: sceneAsset.w || template.w,
        h: sceneAsset.h || template.h,
        nm: `HyperPruned_${sceneId}`,
        assets: finalAssets,
        layers: filterGlitchLayers(sceneAsset.layers)
    };

    return prunedJson;
}

/**
 * CONTENT INJECTOR
 */
function injectContent(json: any, slots: SceneSlots | undefined, userImages: Record<string, string>, userTexts: Record<string, string>) {
    if (!json || !slots) return json;

    const findAndReplace = (compId: string, url: string) => {
        const asset = json.assets.find((a: any) => a.id === compId);
        if (!asset || !asset.layers) return;
        asset.layers.forEach((l: any) => {
            if (l.ty === 2 && l.refId) {
                const imgAsset = json.assets.find((a: any) => a.id === l.refId);
                if (imgAsset) { imgAsset.p = url; imgAsset.u = ''; }
            } else if (l.ty === 0 && l.refId) {
                findAndReplace(l.refId, url);
            }
        });
    };

    slots.photos?.forEach(slot => {
        const url = userImages[slot.id];
        if (url) findAndReplace(slot.id, url);
    });

    slots.texts?.forEach(slot => {
        const text = userTexts[slot.id];
        if (text === undefined) return;
        const textComp = json.assets.find((a: any) => a.id === slot.id);
        if (textComp?.layers) {
            textComp.layers.forEach((l: any) => {
                if (l.ty === 5 && l.t?.d?.k) l.t.d.k[0].s.t = text;
            });
        }
    });

    return json;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate, sceneId, slots,
    userImages = {}, userTexts = {},
    width, height, previewFrame = 0,
    className = "", backgroundMode = 'transparent', backgroundColor = '#ffffff'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);
    const [isInView, setIsInView] = useState(false);

    // 1. Hyper-Pruning Engine
    const processedJson = useMemo(() => {
        const pruned = hyperPrune(fullTemplate, sceneId);
        if (!pruned) return null;
        return injectContent(pruned, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts]);

    // 2. Intersection Observer (RAM Manager)
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting),
            { threshold: 0.05, rootMargin: '200px' } // Preload a bit early
        );
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 3. Render Lifecycle
    useEffect(() => {
        if (!containerRef.current || !processedJson || !isInView) {
            if (animRef.current) { animRef.current.destroy(); animRef.current = null; }
            return;
        }

        try {
            if (animRef.current) animRef.current.destroy();

            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
                rendererSettings: {
                    hideOnTransparent: true,
                    progressiveLoad: false // Faster for small pruned JSONs
                }
            });
            animRef.current = anim;

            anim.addEventListener('DOMLoaded', () => {
                anim.goToAndStop(previewFrame, true);
                setTimeout(() => { if (animRef.current) animRef.current.goToAndStop(previewFrame, true); }, 50);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error(`[LottiePreview] Render Error:`, e);
        }

        return () => { if (animRef.current) { animRef.current.destroy(); animRef.current = null; } };
    }, [processedJson, isInView, previewFrame]);

    const displayW = processedJson?.w || fullTemplate?.w || width || 1920;
    const displayH = processedJson?.h || fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent ${className}`}>
            {!processedJson ? (
                <div className="text-[10px] text-gray-400">Pruning Scene...</div>
            ) : (
                <div
                    ref={containerRef}
                    className="relative"
                    style={{
                        width: isVertical ? 'auto' : '100%',
                        height: isVertical ? '100%' : 'auto',
                        aspectRatio: `${displayW} / ${displayH}`,
                        maxWidth: '100%',
                        maxHeight: '100%',
                        backgroundColor: backgroundMode === 'solid' ? backgroundColor : 'transparent'
                    }}
                >
                    {!isInView && <div className="absolute inset-0 bg-gray-50/10 backdrop-blur-sm" />}
                </div>
            )}
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
