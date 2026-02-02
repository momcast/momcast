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
 * PATH NORMALIZER: Strips prefixes and ensures flat assets/images path.
 */
function normalizeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;

    // Get only filename (strips te-images/ etc.)
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * RECURSIVE ASSET COLLECTOR
 */
function collectAssets(compId: string, allAssets: any[], collected: Map<string, any>) {
    if (collected.has(compId)) return;
    const asset = allAssets.find(a => a.id === compId);
    if (!asset) return;

    collected.set(compId, asset);
    if (asset.layers) {
        asset.layers.forEach((l: any) => {
            if (l.refId) collectAssets(l.refId, allAssets, collected);
        });
    }
}

/**
 * CONTEXTUAL RESOLVER: Extracts scene + its sibling background context.
 */
function resolveContextualLottie(template: any, sceneId: string) {
    if (!template || !sceneId) return null;

    const assets = template.assets || [];
    let targetLayer: any = null;
    let parentNode: any = template; // can be template root or an asset

    // 1. Find scene layer and its containing parent
    const findInLayers = (layers: any[], parentContainer: any): boolean => {
        for (const l of layers) {
            if (l.refId === sceneId || (l.nm && l.nm.includes(sceneId))) {
                targetLayer = l;
                parentNode = parentContainer;
                return true;
            }
            if (l.ty === 0 && l.refId) {
                const sub = assets.find((a: any) => a.id === l.refId);
                if (sub && sub.layers && findInLayers(sub.layers, sub)) return true;
            }
        }
        return false;
    };

    findInLayers(template.layers, template);

    if (!targetLayer) {
        // Manual fallback if not found in hierarchy
        const direct = assets.find((a: any) => a.id === sceneId);
        if (!direct) return null;
        targetLayer = { nm: sceneId, ty: 0, refId: sceneId, ip: 0, op: direct.op || 300, st: 0, ks: { p: { k: [template.w / 2, template.h / 2] }, a: { k: [template.w / 2, template.h / 2] }, s: { k: [100, 100] } } };
    }

    // 2. Identify context (siblings in the same container)
    const layers = parentNode.layers || [];
    const bgLayers = layers.filter((l: any) => {
        const isOtherScene = l.nm && (l.nm.toLowerCase().includes('scene') || l.nm.toLowerCase().includes('씬')) && (l.refId !== sceneId && !l.nm.includes(sceneId));
        // We take everything except other scenes that overlap in time
        return l !== targetLayer && !isOtherScene && l.ip <= targetLayer.ip && l.op >= targetLayer.ip;
    });

    const finalLayers = [...bgLayers, targetLayer];
    const usedAssets = new Map<string, any>();
    finalLayers.forEach(l => {
        if (l.refId) collectAssets(l.refId, assets, usedAssets);
    });

    // 3. Build optimized JSON
    const sceneJson = {
        ...template,
        assets: Array.from(usedAssets.values()).map(a => {
            if (a.p && !a.layers) return { ...a, p: normalizeAssetPath(a.p), u: '' };
            return a;
        }),
        layers: JSON.parse(JSON.stringify(finalLayers)).map((l: any) => ({
            ...l,
            st: l.st - targetLayer.st,
        })),
        ip: 0,
        op: (targetLayer.op || 300) - (targetLayer.ip || 0),
        nm: `ContextExtract_${sceneId}`
    };

    return sceneJson;
}

/**
 * DEEP SLOT CONTENT INJECTION
 */
function injectDeepSlotContent(json: any, slots: SceneSlots | undefined, userImages: Record<string, string>, userTexts: Record<string, string>) {
    if (!json || !slots) return json;

    const injectImageToAsset = (compId: string, url: string) => {
        const asset = json.assets.find((a: any) => a.id === compId);
        if (!asset) return;
        if (asset.layers) {
            asset.layers.forEach((l: any) => {
                if (l.ty === 2 && l.refId) {
                    const imgAsset = json.assets.find((a: any) => a.id === l.refId);
                    if (imgAsset) { imgAsset.p = url; imgAsset.u = ''; }
                } else if (l.ty === 0 && l.refId) {
                    injectImageToAsset(l.refId, url);
                }
            });
        }
    };

    slots.photos?.forEach(slot => {
        const url = userImages[slot.id];
        if (url) injectImageToAsset(slot.id, url);
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

    const processedJson = useMemo(() => {
        const contextual = resolveContextualLottie(fullTemplate, sceneId);
        if (!contextual) return null;
        return injectDeepSlotContent(contextual, slots, userImages, userTexts);
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
                setTimeout(() => { if (animRef.current) animRef.current.goToAndStop(previewFrame, true); }, 50);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error("[LottiePreview] Context Render Failure:", e);
        }
        return () => animRef.current?.destroy();
    }, [processedJson, previewFrame]);

    const displayW = fullTemplate?.w || width || 1920;
    const displayH = fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            {!processedJson ? (
                <div className="text-[10px] text-gray-400">Loading Context...</div>
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
