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
 * 에셋 경로 정규화 (templates/images 폴더 참조)
 */
function normalizeAssetPath(p: string): string {
    if (!p || typeof p !== 'string') return p;
    if (p.startsWith('http') || p.startsWith('data:') || p.startsWith('/')) return p;
    const filename = p.split('/').pop() || p;
    return `/templates/images/${filename}`;
}

/**
 * 씬 매칭 엔진 (원복 및 강화):
 * ID 매칭을 최우선으로 하여 씬이 안 나오는 문제를 근본적으로 해결합니다.
 */
function findSceneComp(template: any, sceneId: string) {
    if (!template || !sceneId) return null;
    const assets = template.assets || [];

    // 1. [최우선] ID 직접 매칭 (가장 확실함)
    let found = assets.find(a => a.id === sceneId);
    if (found) return found;

    // 2. 이름(nm) 정밀 매칭 (대소문자 무시)
    const lowerId = sceneId.toLowerCase();
    found = assets.find(a => a.nm && a.nm.toLowerCase() === lowerId);
    if (found) return found;

    // 3. 레이어 기반 매칭 (Scene 01 등 이름으로 찾기)
    const layers = template.layers || [];
    const rootLayer = layers.find(l => (l.nm || "").toLowerCase().includes(lowerId));
    if (rootLayer?.refId) {
        const asset = assets.find(a => a.id === rootLayer.refId);
        if (asset) return asset;
    }

    // 4. 마스터 컴포지션(comp_0) 레이어 뒤지기
    const comp0 = assets.find(a => a.id === 'comp_0');
    if (comp0?.layers) {
        const ml = comp0.layers.find(l => (l.nm || "").toLowerCase().includes(lowerId));
        if (ml?.refId) {
            const asset = assets.find(a => a.id === ml.refId);
            if (asset) return asset;
        }
    }

    // 5. 숫자로만 검색 (예: 20번 씬 -> "20" 포함된 에셋)
    const cleanNum = sceneId.replace(/[^0-9]/g, '');
    if (cleanNum) {
        found = assets.find(a => a.nm && a.nm.includes(cleanNum) && (a.nm.includes('Scene') || a.nm.includes('씬')));
        if (found) return found;
    }

    return null;
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

    // 뷰포트 감지 (성능 최적화)
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setIsInView(true);
        }, { threshold: 0.1, rootMargin: '400px' });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const processedJson = useMemo(() => {
        if (!isInView || !fullTemplate) return null;
        try {
            const targetComp = findSceneComp(fullTemplate, sceneId);
            if (!targetComp) {
                console.warn(`[LottiePreview] 매칭 실패: ${sceneId}`);
                return null;
            }

            // [최적화] 필요한 에셋만 추출 (Deep Collection)
            const allAssets = fullTemplate.assets || [];
            const usedIds = new Set<string>();
            const collect = (id: string) => {
                if (usedIds.has(id)) return;
                const asset = allAssets.find((a: any) => a.id === id);
                if (!asset || usedIds.has(id)) return;
                usedIds.add(id);
                if (asset.layers) asset.layers.forEach((l: any) => l.refId && collect(l.refId));
            };
            collect(targetComp.id);

            const prunedAssets = allAssets.filter((a: any) => usedIds.has(a.id)).map((a: any) => {
                const copy = { ...a };
                if (copy.p) { copy.p = normalizeAssetPath(copy.p); copy.u = ''; }
                return copy;
            });

            const finalJson = {
                v: fullTemplate.v, fr: fullTemplate.fr, ip: 0,
                op: targetComp.op || 300, w: targetComp.w || fullTemplate.w, h: targetComp.h || fullTemplate.h,
                assets: prunedAssets,
                layers: JSON.parse(JSON.stringify(targetComp.layers || []))
            };

            // [주입] 사진/텍스트 교체
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

            return finalJson;
        } catch (e) {
            console.error(`[LottiePreview] 매칭 로직 에러 [${sceneId}]:`, e);
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
        } catch (e) { console.error(`[LottiePreview] 렌더링 에러:`, e); }
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
                {!processedJson && isInView && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">LOADING...</div>}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
