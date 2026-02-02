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
    isEditor?: boolean; // If true, might apply different scaling/fitting
}

/**
 * Helper: Extract single scene from full template JSON
 */
function extractSceneLottie(fullTemplate: any, sceneCompId: string): any {
    if (!fullTemplate || !sceneCompId) return null;
    const sceneComp = fullTemplate.assets?.find((a: any) => a.id === sceneCompId);
    if (!sceneComp) return null;

    const usedAssetIds = new Set<string>();
    function collectAssets(layers: any[]) {
        if (!layers) return;
        layers.forEach(layer => {
            if (layer.refId) usedAssetIds.add(layer.refId);
            if (layer.layers) collectAssets(layer.layers);
        });
    }
    collectAssets(sceneComp.layers || []);

    let prevSize = 0;
    while (usedAssetIds.size > prevSize) {
        prevSize = usedAssetIds.size;
        Array.from(usedAssetIds).forEach(id => {
            const asset = fullTemplate.assets?.find((a: any) => a.id === id);
            if (asset && asset.layers) collectAssets(asset.layers);
        });
    }

    const sceneAssets = fullTemplate.assets?.filter((a: any) => usedAssetIds.has(a.id)) || [];

    return {
        v: fullTemplate.v,
        fr: fullTemplate.fr,
        ip: 0,
        op: (sceneComp.op || 100) - (sceneComp.ip || 0),
        w: sceneComp.w,
        h: sceneComp.h,
        nm: sceneComp.nm,
        ddd: 0,
        assets: sceneAssets,
        layers: sceneComp.layers || []
    };
}

/**
 * Injects user content into the Lottie JSON assets
 */
function injectContent(lottieJson: any, slots: SceneSlots | undefined, userImages: Record<string, string>, userTexts: Record<string, string>) {
    if (!lottieJson) return null;
    const copy = JSON.parse(JSON.stringify(lottieJson));

    if (!slots) return copy;

    // 1. Photo replacement
    slots.photos?.forEach(photoSlot => {
        const imageUrl = userImages[photoSlot.id];
        if (!imageUrl) return;

        const photoComp = copy.assets.find((a: any) => a.id === photoSlot.id);
        if (!photoComp || !photoComp.layers) return;

        const imgLayer = photoComp.layers.find((l: any) => l.ty === 2);
        if (!imgLayer || !imgLayer.refId) return;

        const imgAsset = copy.assets.find((a: any) => a.id === imgLayer.refId);
        if (imgAsset) {
            imgAsset.u = '';
            imgAsset.p = imageUrl;
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
    isEditor = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    // 1. Process Lottie JSON (memoized)
    const processedJson = useMemo(() => {
        const extracted = extractSceneLottie(fullTemplate, sceneId);
        if (!extracted) return null;
        return injectContent(extracted, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts]);

    // 2. Load Animation
    useEffect(() => {
        if (!containerRef.current || !processedJson) return;

        if (animRef.current) {
            animRef.current.destroy();
        }

        try {
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
                animationData: processedJson,
            });

            animRef.current = anim;

            anim.addEventListener('DOMLoaded', () => {
                // Go to specific frame after DOM is ready
                anim.goToAndStop(previewFrame, true);

                // Ensure all images are covered properly
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
        };
    }, [processedJson, previewFrame]);

    const isVertical = height > width;

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
                    className="relative bg-white"
                    style={{
                        width: isVertical ? 'auto' : '100%',
                        height: isVertical ? '100%' : 'auto',
                        aspectRatio: `${width} / ${height}`
                    }}
                />
            )}
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
