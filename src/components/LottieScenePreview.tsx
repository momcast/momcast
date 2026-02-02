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

    // 1. Direct image layer check
    const imgLayer = comp.layers.find((l: any) => l.ty === 2);
    if (imgLayer) return imgLayer;

    // 2. Recursive check for nested precomps
    for (const layer of comp.layers) {
        if (layer.ty === 0 && layer.refId) {
            const found = findImageLayer(layer.refId, assets);
            if (found) return found;
        }
    }
    return null;
}

/**
 * Prepares a Lottie JSON by ensuring all internal asset paths are correct
 * and identifying the scene's start time in the main timeline.
 */
function prepareSceneLottie(fullTemplate: any, sceneId: string) {
    if (!fullTemplate || !sceneId) return null;

    // Deep copy to avoid mutating original template
    const copy = JSON.parse(JSON.stringify(fullTemplate));

    // Find the layer in the MAIN composition that references this sceneId
    const sceneLayer = copy.layers.find((l: any) => l.refId === sceneId || (l.nm && l.nm.toLowerCase().includes(sceneId.toLowerCase())));
    const sceneIp = sceneLayer ? sceneLayer.ip : 0;

    // Fix 404: Force asset paths to /templates/images/
    if (copy.assets) {
        copy.assets.forEach((asset: any) => {
            if (asset.p && !asset.p.startsWith('http') && !asset.p.startsWith('data:')) {
                asset.p = `/templates/images/${asset.p}`;
                asset.u = '';
            }
        });
    }

    return { lottie: copy, sceneIp };
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

    // 1. Photo replacement
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

    // 2. Text replacement
    slots.texts?.forEach(textSlot => {
        const textContent = userTexts[textSlot.id];
        if (textContent === undefined) return;

        const textComp = copy.assets.find((a: any) => a.id === textSlot.id);
        if (!textComp || !textComp.layers) return;

        textComp.layers.forEach((l: any) => {
            if (l.ty === 5 && l.t && l.t.d && l.t.d.k) {
                l.t.d.k[0].s.t = textContent;
            }
        });
    });

    // 3. Optional Background injection
    if (backgroundMode === 'solid' || backgroundMode === 'blur') {
        const bgLayer: any = {
            nm: '___MOMCAST_BG___', ty: 1, sw: w, sh: h, sc: backgroundColor || '#ffffff',
            ks: { o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [w / 2, h / 2] }, a: { a: 0, k: [w / 2, h / 2] }, s: { a: 0, k: [100, 100] } },
            ip: 0, op: 10000, st: 0, bm: 0
        };
        if (backgroundMode === 'blur') {
            const firstPhotoId = slots.photos?.[0]?.id;
            const firstImgUrl = firstPhotoId ? userImages[firstPhotoId] : null;
            if (firstImgUrl) {
                bgAssetId = 'asset_blur_bg';
                if (!copy.assets.find((a: any) => a.id === bgAssetId)) {
                    copy.assets.push({ id: bgAssetId, w: w, h: h, u: '', p: firstImgUrl, e: 0 });
                }
                bgLayer.ty = 2; bgLayer.refId = bgAssetId;
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

    const { processedJson, sceneIp } = useMemo(() => {
        const preparedResult = prepareSceneLottie(fullTemplate, sceneId);
        if (!preparedResult) return { processedJson: null, sceneIp: 0 };
        const injected = injectContent(preparedResult.lottie, slots, userImages, userTexts, backgroundMode, backgroundColor);
        return { processedJson: injected, sceneIp: preparedResult.sceneIp };
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
                const targetFrame = sceneIp + previewFrame;
                anim.goToAndStop(targetFrame, true);
                setTimeout(() => { if (animRef.current) animRef.current.goToAndStop(targetFrame, true); }, 100);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(img => img.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error("[LottiePreview] Load error:", e);
        }
        return () => animRef.current?.destroy();
    }, [processedJson, previewFrame, sceneIp]);

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
let bgAssetId: string;
