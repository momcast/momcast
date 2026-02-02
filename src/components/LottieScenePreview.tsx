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
 * Creates a Lottie JSON that only shows the specified scene
 * but keeps ALL assets to ensure backgrounds/videos/images work.
 */
function prepareSceneLottie(fullTemplate: any, sceneId: string) {
    if (!fullTemplate || !sceneId) return null;
    const copy = JSON.parse(JSON.stringify(fullTemplate));

    const sceneComp = copy.assets?.find((a: any) => a.id === sceneId);
    if (!sceneComp) return null;

    // SCENE_ROOT dimension setup - IMPORTANT: viewBox undefined error fix
    const w = sceneComp.w || copy.w || 1920;
    const h = sceneComp.h || copy.h || 1080;

    // Replace root layers with a single layer that references our scene composition
    copy.layers = [{
        ddd: 0,
        ind: 1,
        ty: 0, // Precomp
        nm: "SCENE_ROOT",
        refId: sceneId,
        ks: {
            o: { a: 0, k: 100 },
            r: { a: 0, k: 0 },
            p: { a: 0, k: [w / 2, h / 2] },
            a: { a: 0, k: [w / 2, h / 2] },
            s: { a: 0, k: [100, 100] }
        },
        ip: sceneComp.ip || 0,
        op: sceneComp.op || 300,
        st: 0
    }];

    copy.w = w;
    copy.h = h;

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
            sw: copy.w,
            sh: copy.h,
            sc: backgroundColor || '#ffffff',
            ks: {
                o: { a: 0, k: 100 },
                r: { a: 0, k: 0 },
                p: { a: 0, k: [copy.w / 2, copy.h / 2] },
                a: { a: 0, k: [copy.w / 2, copy.h / 2] },
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
                    copy.assets.push({ id: blurAssetId, w: copy.w, h: copy.h, u: '', p: firstImgUrl, e: 0 });
                }
                bgLayer.refId = blurAssetId;
                bgLayer.ef = [{
                    ty: 29, nm: 'Blur', mn: 'ADBE Gaussian Blur 2', en: 1,
                    ef: [{ ty: 0, nm: 'Blur', mn: 'ADBE Gaussian Blur 2-0001', v: { a: 0, k: 60 } }]
                }];
            }
        }
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
    const { processedJson, sceneIp } = useMemo(() => {
        const preparedResult = prepareSceneLottie(fullTemplate, sceneId);
        if (!preparedResult) return { processedJson: null, sceneIp: 0 };
        const injected = injectContent(preparedResult.lottie, slots, userImages, userTexts, backgroundMode, backgroundColor);
        return { processedJson: injected, sceneIp: preparedResult.sceneIp };
    }, [fullTemplate, sceneId, slots, userImages, userTexts, backgroundMode, backgroundColor]);

    // 2. Load Animation
    useEffect(() => {
        if (!containerRef.current || !processedJson) return;

        if (animRef.current) {
            animRef.current.destroy();
            animRef.current = null;
        }

        try {
            // Fix 404: Set assetsPath to /templates/ for generic templates
            // In Production, it should be the URL where assets are stored.
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
                assetsPath: '/templates/images/' // Assuming all assets are in images/ subfolder
            });

            animRef.current = anim;

            anim.addEventListener('DOMLoaded', () => {
                // Correct frame calculation: scene composition start frame + offset
                const targetFrame = sceneIp + previewFrame;
                anim.goToAndStop(targetFrame, true);

                setTimeout(() => {
                    if (animRef.current) animRef.current.goToAndStop(targetFrame, true);
                }, 100);

                const svg = containerRef.current?.querySelector('svg');
                if (svg) {
                    svg.querySelectorAll('image').forEach(img => {
                        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                    });
                }
            });

        } catch (e) {
            console.error("Lottie load error:", e);
        }

        return () => {
            animRef.current?.destroy();
            animRef.current = null;
        };
    }, [processedJson, previewFrame, sceneIp]);

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
                        height: isVertical ? '100%' : 'auto',
                        aspectRatio: `${displayW} / ${displayH}`
                    }}
                />
            )}
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
