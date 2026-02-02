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
    renderer?: 'svg' | 'canvas' | 'html';
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
 * 템플릿 Assets에서 특정 씬(Comp)을 찾는 통합 엔진
 */
function findSceneComp(template: any, sceneId: string) {
    if (!template || !sceneId) return null;
    const assets = template.assets || [];
    const sId = sceneId.trim();
    const sIdLower = sId.toLowerCase();

    // 1. [최우선] ID 정밀 매칭
    let found = assets.find(a => a.id === sId);
    if (found) return found;

    // 2. ID 대소문자 무시 매칭
    found = assets.find(a => a.id && a.id.toLowerCase() === sIdLower);
    if (found) return found;

    // 3. 이름(nm) 정밀 매칭 (AE 레이어 네임 기반)
    found = assets.find(a => a.nm && a.nm.toLowerCase() === sIdLower);
    if (found) return found;

    // 4. 이름(nm) 포함 매칭 (예: "scene 01" -> "01" 포함)
    const cleanNum = sId.replace(/[^0-9]/g, '');
    if (cleanNum && cleanNum.length > 0) {
        found = assets.find(a => {
            if (!a.nm) return false;
            const nm = a.nm.toLowerCase();
            return nm.includes(cleanNum) && (nm.includes('scene') || nm.includes('씬') || nm.includes('comp'));
        });
        if (found) return found;
    }

    // 5. 숫자로만 된 ID 대응 (예: "1" -> "comp_1")
    if (!isNaN(Number(sId))) {
        const compId = `comp_${sId}`;
        found = assets.find(a => a.id === compId);
        if (found) return found;
    }

    return null;
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
    backgroundMode = 'transparent',
    backgroundColor = '#ffffff',
    className = "",
    renderer = 'canvas'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);
    // 모달 등 특수 환경에서 IntersectionObserver 오작동 방지를 위해 기본값 true
    const [isInView, setIsInView] = useState(true);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setIsInView(true);
            },
            { threshold: 0.1 }
        );
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const processedJson = useMemo(() => {
        if (!fullTemplate || !sceneId) return null;
        if (!isInView) return null;

        try {
            const targetComp = findSceneComp(fullTemplate, sceneId);

            if (!targetComp) {
                console.warn(`[LottiePreview] Scene "${sceneId}" NOT FOUND in template assets.`);
                return null;
            }

            console.log(`[LottiePreview] Scene "${sceneId}" matched as Comp ID: ${targetComp.id}, Layers: ${targetComp.layers?.length || 0}`);

            // [수정] 에셋을 가지치기(Pruning)하지 않고 전체를 유지하되 경로만 치환합니다.
            // 가지치기는 마스크, 매트, 중첩 컴포지션 참조를 깨뜨릴 위험이 큽니다.
            const processedAssets = (fullTemplate.assets || []).map((a: any) => {
                const asset = { ...a };
                if (asset.p && typeof asset.p === 'string' && !userImages[asset.id]) {
                    asset.p = normalizeAssetPath(asset.p);
                    asset.u = '';
                }
                // 사용자 이미지 주입
                if (userImages[asset.id]) {
                    console.log(`[LottiePreview] Injecting User Image: ${asset.id}`);
                    asset.p = userImages[asset.id];
                    asset.u = '';
                }
                return asset;
            });

            const result = {
                ...fullTemplate,
                assets: processedAssets,
                layers: JSON.parse(JSON.stringify(targetComp.layers || [])),
                w: targetComp.w || fullTemplate.w,
                h: targetComp.h || fullTemplate.h,
                ip: 0,
                op: Math.max(targetComp.op || 0, fullTemplate.op || 0, 120),
                fr: fullTemplate.fr || 30
            };

            console.log(`[LottiePreview] Ready to render "${sceneId}". Total assets: ${processedAssets.length}`);

            // [데이터 주입] 텍스트 슬롯 (모든 에셋/컴포지션 포함 재귀적 처리)
            let injectedTexts = 0;
            const injectTextToComp = (compLayers: any[]) => {
                if (!compLayers) return;
                compLayers.forEach((layer: any) => {
                    if (layer.ty === 5 && layer.t?.d?.k && Array.isArray(layer.t.d.k) && layer.t.d.k.length > 0) {
                        // 1. 레이어 이름(nm)으로 매칭 (예: "텍스트01")
                        // 2. 레이어 refId로 매칭 (AE에서 텍스트 컴포지션을 쓸 경우)
                        const textData = userTexts[layer.nm] || userTexts[layer.refId] || userTexts[layer.ind];
                        if (textData && layer.t.d.k[0].s) {
                            console.log(`[LottiePreview] Injecting Text: ${layer.nm || layer.ind} -> ${textData}`);
                            layer.t.d.k[0].s.t = textData;
                            injectedTexts++;
                        }
                    }
                    // 만약 이 레이어가 컴포지션 레이어(ty: 0)라면, 
                    // 해당 컴포지션의 Asset ID 등을 체크하여 userTexts에 매칭되는 데이터가 있는지 확인
                    if (layer.ty === 0 && layer.refId && userTexts[layer.refId]) {
                        // AE에서 텍스트 레이어를 컴포지션으로 감싸서 관리하는 경우 대응
                        // 이 경우 컴포지션 내부의 모든 텍스트 레이어에 같은 텍스트를 주입하거나 
                        // 내부 레이어를 직접 찾아가야 함 (현재는 단순 컴포지션 ID 매칭 시 내부 ty:5 레이어에 주입 시도)
                    }
                });
            };

            // 1. 루트 레이어 주입
            injectTextToComp(result.layers);

            // 2. 모든 에셋(컴포지션) 내 레이어 주입
            if (result.assets) {
                result.assets.forEach((asset: any) => {
                    if (asset.layers) {
                        injectTextToComp(asset.layers);
                    }
                });
            }

            console.log(`[LottiePreview] Ready to render "${sceneId}". Total assets: ${processedAssets.length}, Texts: ${injectedTexts}`);
            return result;
        } catch (error) {
            console.error(`[LottiePreview] Error [${sceneId}]:`, error);
            return null;
        }
    }, [fullTemplate, sceneId, userImages, userTexts, isInView]);

    useEffect(() => {
        if (!containerRef.current || !processedJson) return;
        let instance: AnimationItem | null = null;
        try {
            if (animRef.current) { animRef.current.destroy(); animRef.current = null; }
            instance = lottie.loadAnimation({
                container: containerRef.current,
                renderer: renderer || 'canvas', // [최적화] SVG -> Canvas 전환 (성능 향상 및 마스킹 아티팩트/흰줄 제거)
                loop: false, autoplay: false,
                animationData: processedJson,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid slice',
                    imagePreserveAspectRatio: 'xMidYMid slice'
                }
            });
            animRef.current = instance;
            instance.addEventListener('DOMLoaded', () => {
                if (!instance) return;
                console.log(`[LottiePreview] Animation Loaded for ${sceneId}`);
                instance.goToAndStop(previewFrame, true);
                const svg = containerRef.current?.querySelector('svg');
                if (svg) svg.querySelectorAll('image').forEach(i => i.setAttribute('preserveAspectRatio', 'xMidYMid slice'));
            });
        } catch (e) {
            console.error(`[LottiePreview] Animation Init Error:`, e);
        }
        return () => { if (instance) instance.destroy(); };
    }, [processedJson, previewFrame, sceneId]);

    const dW = processedJson?.w || width || 1920;
    const dH = processedJson?.h || height || 1080;
    const isV = dH > dW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            <div ref={containerRef} className="relative"
                style={{
                    width: isV ? 'auto' : '100%',
                    height: isV ? '100%' : 'auto',
                    aspectRatio: `${dW}/${dH}`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
            >
                {(!processedJson && isInView) && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                        {fullTemplate ? 'SEARCHING SCENE...' : 'LOADING TEMPLATE...'}
                    </div>
                )}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
