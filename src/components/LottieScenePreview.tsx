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
 * PATH NORMALIZER: Ensures assets are loaded correctly.
 * Absolute URLs and DataURLs are preserved.
 */
function normalizeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    // Strip prefixes like 'images/' or 'te-images/' and point to our public flat folder
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * HYPER-PRUNING v4: Surgical Json Extraction
 */
function hyperPrune(template: any, sceneId: string) {
    if (!template || !sceneId) return null;

    const allAssets = template.assets || [];
    const usedAssetIds = new Set<string>();

    const collectRecursive = (compId: string) => {
        if (usedAssetIds.has(compId)) return;
        const asset = allAssets.find((a: any) => a.id === compId);
        if (!asset) return;
        usedAssetIds.add(compId);
        if (asset.layers) {
            asset.layers.forEach((l: any) => {
                if (l.refId) collectRecursive(l.refId);
            });
        }
    };

    // Find the scene comp
    const sceneComp = allAssets.find((a: any) => a.id === sceneId || (a.nm && a.nm.toLowerCase() === sceneId.toLowerCase()));
    if (!sceneComp) return null;

    collectRecursive(sceneComp.id);

    // Build lean JSON
    const prunedAssets = allAssets
        .filter((a: any) => usedAssetIds.has(a.id))
        .map((a: any) => {
            if (a.layers) {
                // Filter glitchy layers even in nested assets
                const subLayers = a.layers.map((l: any) => {
                    const nm = (l.nm || "").toLowerCase();
                    if (nm.includes('transition') || nm.includes('wipe')) return { ...l, hd: true };
                    return l;
                });
                return { ...a, layers: subLayers };
            }
            // For images, fix path and clear relative dir
            if (a.p) return { ...a, p: normalizeAssetPath(a.p), u: '' };
            return a;
        });

    return {
        v: template.v,
        fr: template.fr,
        ip: 0,
        op: sceneComp.op || 300,
        w: sceneComp.w || template.w,
        h: sceneComp.h || template.h,
        nm: `Hyper_${sceneId}`,
        assets: prunedAssets,
        layers: sceneComp.layers.map((l: any) => {
            const nm = (l.nm || "").toLowerCase();
            if (nm.includes('transition') || nm.includes('wipe')) return { ...l, hd: true };
            return l;
        })
    };
}

function applyContent(json: any, slots: SceneSlots | undefined, userImages: Record<string, string>, userTexts: Record<string, string>) {
    if (!json || !slots) return json;

    const replaceImage = (compId: string, url: string) => {
        const asset = json.assets.find((a: any) => a.id === compId);
        if (!asset || !asset.layers) return;
        asset.layers.forEach((l: any) => {
            if (l.ty === 2 && l.refId) {
                const imgAsset = json.assets.find((a: any) => a.id === l.refId);
                if (imgAsset) { imgAsset.p = url; imgAsset.u = ''; }
            } else if (l.ty === 0 && l.refId) {
                replaceImage(l.refId, url);
            }
        });
    };

    slots.photos?.forEach(slot => {
        const url = userImages[slot.id];
        if (url) replaceImage(slot.id, url);
    });

    slots.texts?.forEach(slot => {
        const text = userTexts[slot.id];
        if (text === undefined) return;
        const textAsset = json.assets.find((a: any) => a.id === slot.id);
        if (textAsset?.layers) {
            textAsset.layers.forEach((l: any) => {
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
    const [readyToRender, setReadyToRender] = useState(false);

    // 1. Intersection Observer
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                // Extra debounce to avoid jank during fast scroll
                setTimeout(() => setReadyToRender(true), 150);
            }
        }, { threshold: 0.01, rootMargin: '300px' });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // 2. Optimized JSON Generation
    const processedJson = useMemo(() => {
        if (!readyToRender) return null;
        const pruned = hyperPrune(fullTemplate, sceneId);
        if (!pruned) return null;
        return applyContent(pruned, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts, readyToRender]);

    // 3. Lottie Core
    useEffect(() => {
        if (!containerRef.current || !processedJson) return;

        try {
            if (animRef.current) animRef.current.destroy();
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
                rendererSettings: { progressiveLoad: true, hideOnTransparent: true }
            });
            animRef.current = anim;
            anim.addEventListener('DOMLoaded', () => {
                anim.goToAndStop(previewFrame, true);
                setTimeout(() => { if (animRef.current) animRef.current.goToAndStop(previewFrame, true); }, 50);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error(`Render Error [${sceneId}]:`, e);
        }
        return () => { if (animRef.current) animRef.current.destroy(); animRef.current = null; };
    }, [processedJson, previewFrame, sceneId]);

    const dW = processedJson?.w || fullTemplate?.w || width || 1920;
    const dH = processedJson?.h || fullTemplate?.h || height || 1080;
    const isV = dH > dW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            <div
                ref={containerRef}
                className="relative"
                style={{
                    width: isV ? 'auto' : '100%',
                    height: isV ? '100%' : 'auto',
                    aspectRatio: `${dW} / ${dH}`,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    backgroundColor: backgroundMode === 'solid' ? backgroundColor : 'transparent'
                }}
            >
                {!readyToRender && <div className="absolute inset-0 bg-gray-50/5" />}
                {readyToRender && !processedJson && <div className="text-[10px] text-gray-300">Loading...</div>}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
