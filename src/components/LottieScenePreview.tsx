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

function normalizeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * MASTER MATCHING ENGINE: 
 * Finds the correct comp asset by looking through root layers or master comps.
 */
function findSceneComp(template: any, sceneId: string) {
    if (!template || !sceneId) return null;
    const assets = template.assets || [];
    const cleanSearch = sceneId.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Direct ID/Name match in assets
    let found = assets.find(a => a.id === sceneId || (a.nm && a.nm.toLowerCase() === sceneId.toLowerCase()));
    if (found) return found;

    // 2. Search in root layers
    const layers = template.layers || [];
    const rootLayer = layers.find(l => {
        const ln = (l.nm || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return ln === cleanSearch || ln.includes(cleanSearch);
    });
    if (rootLayer && rootLayer.refId) {
        const asset = assets.find(a => a.id === rootLayer.refId);
        if (asset) return asset;
    }

    // 3. Search in Master Compositions (comp_0, comp_1, etc.)
    const masterComps = assets.filter(a => a.layers && (a.id === 'comp_0' || (a.nm && a.nm.toLowerCase().includes('master'))));
    for (const master of masterComps) {
        const ml = master.layers.find(l => {
            const ln = (l.nm || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            return ln === cleanSearch || ln.includes(cleanSearch);
        });
        if (ml && ml.refId) {
            const asset = assets.find(a => a.id === ml.refId);
            if (asset) return asset;
        }
    }

    // 4. Fallback: Fuzzy asset name match
    return assets.find(a => {
        if (!a.nm) return false;
        const an = a.nm.toLowerCase().replace(/[^a-z0-9]/g, '');
        return an.includes(cleanSearch);
    });
}

function hyperPrune(template: any, sceneId: string) {
    if (!template || !sceneId) return null;
    const allAssets = template.assets || [];
    const usedAssetIds = new Set<string>();

    const targetComp = findSceneComp(template, sceneId);
    if (!targetComp) {
        console.warn(`[LottiePreview] Cannot find scene comp for "${sceneId}"`);
        return null;
    }

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

    collectRecursive(targetComp.id);

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
        op: targetComp.op || 300,
        w: targetComp.w || template.w,
        h: targetComp.h || template.h,
        nm: `Scene_${sceneId}`,
        assets: prunedAssets,
        layers: targetComp.layers || []
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
    const [status, setStatus] = useState<'init' | 'loading' | 'ready' | 'error'>('init');

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
        try {
            const pruned = hyperPrune(fullTemplate, sceneId);
            if (!pruned) {
                setStatus('error');
                return null;
            }
            const injected = applyContent(pruned, slots, userImages, userTexts);
            setStatus('ready');
            return injected;
        } catch (e) {
            console.error(`[LottiePreview] Preparation Error [${sceneId}]:`, e);
            setStatus('error');
            return null;
        }
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
                rendererSettings: { progressiveLoad: false, hideOnTransparent: true }
            });
            animRef.current = instance;

            instance.addEventListener('DOMLoaded', () => {
                if (!instance) return;
                instance.goToAndStop(previewFrame, true);
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
            }
        };
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
                {status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-red-400 font-mono text-center px-4">
                        SCENE NOT FOUND<br />Check Mapping
                    </div>
                )}
                {isInView && status === 'init' && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                        INIT...
                    </div>
                )}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
