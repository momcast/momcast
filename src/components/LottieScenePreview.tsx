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
 * Creates a Lottie JSON that only shows the specified scene content
 */
function prepareSceneLottie(fullTemplate: any, sceneId: string) {
    if (!fullTemplate || !sceneId) return null;

    // Deep copy to avoid mutating original template
    const copy = JSON.parse(JSON.stringify(fullTemplate));

    // Find the scene composition in assets
    const sceneComp = copy.assets?.find((a: any) => a.id === sceneId);
    if (!sceneComp || !sceneComp.layers) {
        console.warn(`[LottiePreview] Scene asset ${sceneId} not found or has no layers.`);
        return null;
    }

    // Defensive check for dimensions
    const w = Number(sceneComp.w) || Number(copy.w) || 1920;
    const h = Number(sceneComp.h) || Number(copy.h) || 1080;

    /**
     * MAJOR REFACTOR: Instead of nesting, make the scene composition the main layers.
     * This avoids expression breakage and ensures all relative sizes are correct.
     */
    copy.layers = sceneComp.layers;
    copy.w = w;
    copy.h = h;

    // Set timing to match the scene's length
    // But for previewing, we often just want a fixed range or frame 0.
    copy.ip = 0;
    copy.op = (sceneComp.op || 300) - (sceneComp.ip || 0);

    return { lottie: copy, sceneIp: sceneComp.ip || 0 };
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

    // Dimensions for background layer
    const w = Number(copy.w) || 1920;
    const h = Number(copy.h) || 1080;

    // 1. Photo replacement (Recursive search)
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

    // 3. Background injection
    if (backgroundMode === 'solid' || backgroundMode === 'blur') {
        const bgLayer: any = {
            nm: '___MOMCAST_BG___',
            ty: 1, // Solid
            sw: w,
            sh: h,
            sc: backgroundColor || '#ffffff',
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [w / 2, h / 2] },
                a: { a: 0, k: [w / 2, h / 2] },
                s: { a: 0, k: [100, 100] }
            },
            ip: 0,
            op: 10000,
            st: 0,
            bm: 0
        };

        if (backgroundMode === 'blur') {
            const firstPhotoId = slots.photos?.[0]?.id;
            const firstImgUrl = firstPhotoId ? userImages[firstPhotoId] : null;

            if (firstImgUrl) {
                bgLayer.ty = 2; // Image
                const blurAssetId = 'asset_blur_bg';
                if (!copy.assets.find((a: any) => a.id === blurAssetId)) {
                    copy.assets.push({ id: blurAssetId, w: w, h: h, u: '', p: firstImgUrl, e: 0 });
                }
                bgLayer.refId = blurAssetId;
                bgLayer.ef = [{
                    ty: 29, nm: 'Blur', mn: 'ADBE Gaussian Blur 2', en: 1,
                    ef: [{ ty: 0, nm: 'Blur', mn: 'ADBE Gaussian Blur 2-0001', v: { a: 0, k: 60 } }]
                }];
            }
        }
        // Place background layer at the beginning of layers array
        copy.layers.unshift(bgLayer);
    }

    return copy;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate,
    sceneId,
    slots,
    userImages = {},
    userTexts = {},
    width = 1920,
    height = 1080,
    previewFrame = 0,
    className = "",
    isEditor = false,
    backgroundMode = 'transparent',
    backgroundColor = '#ffffff'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    // 1. Process Lottie JSON (memoized)
    const processedJson = useMemo(() => {
        const preparedResult = prepareSceneLottie(fullTemplate, sceneId);
        if (!preparedResult) return null;
        return injectContent(preparedResult.lottie, slots, userImages, userTexts, backgroundMode, backgroundColor);
    }, [fullTemplate, sceneId, slots, userImages, userTexts, backgroundMode, backgroundColor]);

    // 2. Load Animation
    useEffect(() => {
        if (!containerRef.current || !processedJson) return;

        if (animRef.current) {
            animRef.current.destroy();
            animRef.current = null;
        }

        try {
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
                // Paths: assets are in /templates/images/ usually, but some might be in root
                // Lottie will try p if u is empty.
                assetsPath: '/templates/images/'
            });

            animRef.current = anim;

            anim.addEventListener('DOMLoaded', () => {
                // Since we replaced the root with the scene composition, 
                // the previewFrame is now relative to the beginning of the composition (frame 0).
                anim.goToAndStop(previewFrame, true);

                setTimeout(() => {
                    if (animRef.current) animRef.current.goToAndStop(previewFrame, true);
                }, 100);

                const svg = containerRef.current?.querySelector('svg');
                if (svg) {
                    svg.querySelectorAll('image').forEach(img => {
                        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                    });
                }
            });

        } catch (e) {
            console.error("[LottiePreview] Load error:", e);
        }

        return () => {
            if (animRef.current) {
                animRef.current.destroy();
                animRef.current = null;
            }
        };
    }, [processedJson, previewFrame]);

    const displayW = width || 1920;
    const displayH = height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div
            className={`relative overflow-hidden w-full ${className} bg-transparent flex items-center justify-center`}
            style={{ aspectRatio: '16 / 9' }}
        >
            {!processedJson ? (
                <div className="text-xs text-gray-400">Preview Unavailable</div>
            ) : (
                <div
                    ref={containerRef}
                    className="relative bg-transparent"
                    style={{
                        width: isVertical ? 'auto' : '100%',
                        height: isVertical ? '450px' : 'auto', // Fixed height for editor if needed?
                        maxHeight: '100%',
                        aspectRatio: `${displayW} / ${displayH}`
                    }}
                />
            )}
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
