'use client';

import React, { useEffect, useRef, useMemo, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import { SceneSlots } from '../app/types';

interface Props {
    fullTemplate: any;
    sceneId: string;
    slots?: SceneSlots;
    userImages?: Record<string, string>;
    userTexts?: Record<string, string>;
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
 */
function normalizeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    // Strip prefixes like 'te-images/' and point to our public flat folder
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * HYPER-PRUNING v5: Balanced extraction for reliability.
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

    const sceneComp = allAssets.find((a: any) => a.id === sceneId || (a.nm && a.nm.toLowerCase() === sceneId.toLowerCase()));
    if (!sceneComp) {
        console.warn(`[LottiePreview] Scene asset ${sceneId} not found.`);
        return null;
    }
    collectRecursive(sceneComp.id);

    // Build optimized assets with corrected paths
    const prunedAssets = allAssets
        .filter((a: any) => usedAssetIds.has(a.id))
        .map((a: any) => {
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
        layers: sceneComp.layers // No aggressive hiding for now to restore background
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
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsInView(true);
        }, { threshold: 0.01, rootMargin: '300px' });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const processedJson = useMemo(() => {
        if (!isInView) return null;
        const pruned = hyperPrune(fullTemplate, sceneId);
        if (!pruned) return null;
        return applyContent(pruned, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts, isInView]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;

        let instance: AnimationItem | null = null;
        try {
            if (animRef.current) {
                try { animRef.current.destroy(); } catch (e) { }
                animRef.current = null;
            }

            instance = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
                rendererSettings: { progressiveLoad: false }
            });
            animRef.current = instance;

            instance.addEventListener('DOMLoaded', () => {
                if (!instance) return;
                instance.goToAndStop(previewFrame, true);
                setIsLoaded(true);
                // Ensure image scaling
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error(`[LottiePreview] Render Error [${sceneId}]:`, e);
        }

        return () => {
            if (instance) {
                try { instance.destroy(); } catch (e) { }
                if (animRef.current === instance) animRef.current = null;
                instance = null;
            }
        };
    }, [processedJson, previewFrame, sceneId]);

    const dW = processedJson?.w || fullTemplate?.w || width || 1920;
    const dH = processedJson?.h || fullTemplate?.h || height || 1080;
    const isV = dH > dW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`} style={{ backgroundColor }}>
            <div
                ref={containerRef}
                className="relative"
                style={{
                    width: isV ? 'auto' : '100%',
                    height: isV ? '100%' : 'auto',
                    aspectRatio: `${dW} / ${dH}`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
            >
                {!isLoaded && isInView && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                        RENDERING...
                    </div>
                )}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
