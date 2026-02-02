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
 * PATH NORMALIZER: Ensures assets are loaded correctly.
 */
function normalizePath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * DEEP INJECTOR: Replaced single match with forEach for multiple instances.
 */
function injectContentDeep(json: any, slots: SceneSlots | undefined, userImages: Record<string, string>, userTexts: Record<string, string>) {
    if (!json || !slots) return json;

    const findAndInjectImage = (compId: string, url: string) => {
        const asset = json.assets.find((a: any) => a.id === compId);
        if (!asset) return;
        if (asset.layers) {
            asset.layers.forEach((l: any) => {
                if (l.ty === 2 && l.refId) {
                    const imgAsset = json.assets.find((a: any) => a.id === l.refId);
                    if (imgAsset) { imgAsset.p = url; imgAsset.u = ''; }
                } else if (l.ty === 0 && l.refId) {
                    findAndInjectImage(l.refId, url);
                }
            });
        }
    };

    slots.photos?.forEach(slot => {
        const url = userImages[slot.id];
        if (url) findAndInjectImage(slot.id, url);
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

/**
 * PURE-COMP RESOLVER: 
 * Directly uses the Scene Asset as the root. 
 * This avoids buggy parent transitions (white lines) and shows the actual scene background.
 */
function resolvePureCompLottie(template: any, sceneId: string) {
    if (!template || !sceneId) return null;

    // Find the scene asset (the composition)
    const sceneAsset = template.assets?.find((a: any) =>
        a.id === sceneId || (a.nm && a.nm.toLowerCase() === sceneId.toLowerCase())
    );

    if (!sceneAsset || !sceneAsset.layers) return null;

    // Create a lean version of the template using the scene's layers
    const finalJson = {
        ...template,
        v: template.v,
        fr: template.fr,
        w: Number(sceneAsset.w) || template.w,
        h: Number(sceneAsset.h) || template.h,
        assets: (template.assets || []).map((a: any) => {
            if (a.p && !a.layers) return { ...a, p: normalizePath(a.p), u: '' };
            return a;
        }),
        layers: JSON.parse(JSON.stringify(sceneAsset.layers)).map((l: any) => ({
            ...l,
            // st: 0, // Keep internal st as is, but usually it's fine
        })),
        ip: 0,
        op: sceneAsset.op || 300,
        nm: `Pure_${sceneId}`
    };

    return finalJson;
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
        const pure = resolvePureCompLottie(fullTemplate, sceneId);
        if (!pure) return null;
        return injectContentDeep(pure, slots, userImages, userTexts);
    }, [fullTemplate, sceneId, slots, userImages, userTexts]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;
        if (animRef.current) animRef.current.destroy();

        try {
            const anim = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'svg',
                loop: false,
                autoplay: false,
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
            console.error("[LottiePreview] Pure-Comp Render Failure:", e);
        }
        return () => animRef.current?.destroy();
    }, [processedJson, previewFrame]);

    const displayW = processedJson?.w || fullTemplate?.w || width || 1920;
    const displayH = processedJson?.h || fullTemplate?.h || height || 1080;
    const isVertical = displayH > displayW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent ${className}`}>
            {!processedJson ? (
                <div className="text-[10px] text-gray-400">Loading Scene...</div>
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
