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
 * MASTER MATCHING ENGINE v2: Powerful cross-reference search.
 */
function findSceneComp(template: any, sceneId: string) {
    if (!template || !sceneId) return null;
    const assets = template.assets || [];
    const layers = template.layers || [];

    const searchId = String(sceneId).toLowerCase();
    const cleanSearch = searchId.replace(/[^0-9]/g, ''); // Extract numbers (e.g. "20")

    // 1. Root Layers direct/fuzzy match
    const rootLayer = layers.find(l => {
        const ln = (l.nm || "").toLowerCase();
        return ln === searchId || ln.includes(searchId) || (cleanSearch && ln.includes(cleanSearch) && ln.includes('scene'));
    });
    if (rootLayer?.refId) {
        const asset = assets.find(a => a.id === rootLayer.refId);
        if (asset) return asset;
    }

    // 2. Search in Master Comp (comp_0)
    const comp0 = assets.find(a => a.id === 'comp_0');
    if (comp0?.layers) {
        const ml = comp0.layers.find(l => {
            const ln = (l.nm || "").toLowerCase();
            return ln === searchId || ln.includes(searchId) || (cleanSearch && ln.includes(cleanSearch) && ln.includes('scene'));
        });
        if (ml?.refId) {
            const asset = assets.find(a => a.id === ml.refId);
            if (asset) return asset;
        }
    }

    // 3. Asset Name direct match
    const assetByName = assets.find(a => a.nm && a.nm.toLowerCase().includes(searchId));
    if (assetByName) return assetByName;

    return null;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate, sceneId, slots,
    userImages = {}, userTexts = {},
    width, height, previewFrame = 0,
    className = "", backgroundMode = 'transparent', backgroundColor = '#ffffff',
    isEditor = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);
    const [isInView, setIsInView] = useState(false);
    const [debugInfo, setDebugInfo] = useState<{ scene: string, comp: string, assets: number } | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsInView(true);
        }, { threshold: 0.01, rootMargin: '400px' });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const processedJson = useMemo(() => {
        if (!isInView || !fullTemplate) return null;
        try {
            const targetComp = findSceneComp(fullTemplate, sceneId);
            if (!targetComp) {
                console.warn(`[LottiePreview] Scene "${sceneId}" not found.`);
                return null;
            }

            // Simple Pruning for Speed & Reliability
            const allAssets = fullTemplate.assets || [];
            const usedIds = new Set<string>();
            const collect = (id: string) => {
                if (usedIds.has(id)) return;
                const asset = allAssets.find((a: any) => a.id === id);
                if (!asset) return;
                usedIds.add(id);
                if (asset.layers) asset.layers.forEach((l: any) => l.refId && collect(l.refId));
            };
            collect(targetComp.id);

            const prunedAssets = allAssets.filter((a: any) => usedIds.has(a.id)).map((a: any) => {
                const copy = { ...a };
                if (copy.p) { copy.p = normalizeAssetPath(copy.p); copy.u = ''; }
                return copy;
            });

            // Content Injection
            const finalJson = {
                v: fullTemplate.v, fr: fullTemplate.fr, ip: 0,
                op: targetComp.op || 300, w: targetComp.w || fullTemplate.w, h: targetComp.h || fullTemplate.h,
                assets: prunedAssets,
                layers: JSON.parse(JSON.stringify(targetComp.layers || []))
            };

            // Deep Injection
            const inject = (compId: string, url: string) => {
                const asset = finalJson.assets.find((a: any) => a.id === compId);
                if (!asset?.layers) return;
                asset.layers.forEach((l: any) => {
                    if (l.ty === 2 && l.refId) {
                        const img = finalJson.assets.find((a: any) => a.id === l.refId);
                        if (img) { img.p = url; img.u = ''; }
                    } else if (l.ty === 0 && l.refId) inject(l.refId, url);
                });
            };
            slots?.photos?.forEach(s => userImages[s.id] && inject(s.id, userImages[s.id]));
            slots?.texts?.forEach(s => {
                const txt = userTexts[s.id];
                if (txt === undefined) return;
                const asset = finalJson.assets.find((a: any) => a.id === s.id);
                asset?.layers?.forEach((l: any) => { if (l.ty === 5 && l.t?.d?.k) l.t.d.k[0].s.t = txt; });
            });

            setDebugInfo({ scene: sceneId, comp: targetComp.id, assets: prunedAssets.length });
            return finalJson;
        } catch (e) {
            console.error(`[LottiePreview] Logic Error [${sceneId}]:`, e);
            return null;
        }
    }, [fullTemplate, sceneId, slots, userImages, userTexts, isInView]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;
        let instance: AnimationItem | null = null;
        try {
            if (animRef.current) { animRef.current.destroy(); animRef.current = null; }
            instance = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false, autoplay: false,
                animationData: processedJson,
                rendererSettings: { progressiveLoad: false, hideOnTransparent: true }
            });
            animRef.current = instance;
            instance.addEventListener('DOMLoaded', () => {
                if (!instance) return;
                instance.goToAndStop(previewFrame, true);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(i => i.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) { console.error(`[LottiePreview] Lottie Error:`, e); }
        return () => { if (instance) instance.destroy(); };
    }, [processedJson, previewFrame]);

    const dW = processedJson?.w || 1920;
    const dH = processedJson?.h || 1080;
    const isV = dH > dW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            <div ref={containerRef} className="relative"
                style={{ width: isV ? 'auto' : '100%', height: isV ? '100%' : 'auto', aspectRatio: `${dW}/${dH}`, maxWidth: '100%', maxHeight: '100%' }}
            >
                {/* DEBUG OVERLAY (Only visible in dev) */}
                {debugInfo && (
                    <div className="absolute top-1 left-1 bg-black/50 text-[8px] text-white p-1 rounded font-mono pointer-events-none z-50">
                        {debugInfo.scene} -> {debugInfo.comp} ({debugInfo.assets} assets)
                    </div>
                )}
                {!processedJson && isInView && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">LOADING...</div>}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
