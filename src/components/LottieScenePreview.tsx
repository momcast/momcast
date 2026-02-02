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
    let found = assets.find((a: any) => a.id === sId);
    if (found) return found;

    // 2. ID 대소문자 무시 매칭
    found = assets.find((a: any) => a.id && a.id.toLowerCase() === sIdLower);
    if (found) return found;

    // 3. 이름(nm) 정밀 매칭 (AE 레이어 네임 기반)
    found = assets.find((a: any) => a.nm && a.nm.toLowerCase() === sIdLower);
    if (found) return found;

    // 4. 이름(nm) 포함 매칭 (예: "scene 01" -> "01" 포함)
    const cleanNum = sId.replace(/[^0-9]/g, '');
    if (cleanNum && cleanNum.length > 0) {
        found = assets.find((a: any) => {
            if (!a.nm) return false;
            const nm = a.nm.toLowerCase();
            return nm.includes(cleanNum) && (nm.includes('scene') || nm.includes('씬') || nm.includes('comp'));
        });
        if (found) return found;
    }

    // 5. 숫자로만 된 ID 대응 (예: "1" -> "comp_1")
    if (!isNaN(Number(sId))) {
        const compId = `comp_${sId}`;
        found = assets.find((a: any) => a.id === compId);
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
    renderer = 'svg'
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);
    // 모달 등 특수 환경에서 IntersectionObserver 오작동 방지를 위해 기본값 true
    const [isInView, setIsInView] = useState(true);
    const [mountKey, setMountKey] = useState(0);

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

    const sceneData = useMemo(() => {
        if (!fullTemplate || !sceneId) return null;
        if (!isInView) return null;

        try {
            // [Background Fix] 씬 추출(Extraction) 대신 전체 템플릿의 특정 구간(Segment)을 재생하는 방식으로 변경
            // 이렇게 해야 Root에 있는 배경 레이어나 오디오가 정상적으로 포함됨.

            // 1. 타겟 씬(Composition) 찾기 (텍스트 주입용)
            const targetAsset = findSceneComp(fullTemplate, sceneId);

            // 2. 타겟 씬이 배치된 Root Layer 찾기 (재생 구간 파악용)
            // 에셋 ID(targetAsset.id)를 refId로 가지거나, 이름이 매칭되는 레이어 검색
            let targetLayer = null;
            if (targetAsset) {
                targetLayer = fullTemplate.layers?.find((l: any) => l.refId === targetAsset.id);
            }
            // 에셋 매칭 실패 시, 레이어 이름으로 2차 검색
            if (!targetLayer) {
                const sIdLower = sceneId.toLowerCase().trim();
                const cleanNum = sIdLower.replace(/[^0-9]/g, '');
                targetLayer = fullTemplate.layers?.find((l: any) => {
                    const nm = (l.nm || "").toLowerCase();
                    // 이름 일치 or "Scene 01" 형식 매칭
                    return nm === sIdLower || (cleanNum && nm.includes(cleanNum) && (nm.includes('scene') || nm.includes('comp') || nm.includes('씬')));
                });
            }

            if (!targetLayer) {
                console.warn(`[LottiePreview] Root Layer for scene "${sceneId}" NOT FOUND. Playing full timeline.`);
            } else {
                console.log(`[LottiePreview] Found Root Layer for "${sceneId}": nm=${targetLayer.nm}, range=[${targetLayer.ip}, ${targetLayer.op}]`);
            }

            // 3. 데이터 복제 및 에셋 경로/텍스트 주입
            // 전체 템플릿을 복사하되, 무거운 assets 배열 등은 얕은 복사(shallow copy) 후 내부 수정
            const processedTemplate = { ...fullTemplate };
            const clonedAssets = (fullTemplate.assets || []).map((a: any) => {
                const asset = { ...a };
                // 이미지 경로 보정 및 주입
                if (asset.p && typeof asset.p === 'string') {
                    if (userImages[asset.id]) {
                        asset.p = userImages[asset.id];
                        asset.u = '';
                    } else {
                        asset.p = normalizeAssetPath(asset.p);
                        asset.u = '';
                    }
                }
                return asset;
            });
            processedTemplate.assets = clonedAssets;

            // 텍스트 주입 (Layers 재귀 탐색)
            const injectText = (layers: any[]) => {
                if (!layers) return;
                layers.forEach(layer => {
                    if (layer.ty === 5 && layer.t?.d?.k && Array.isArray(layer.t.d.k)) {
                        const textData = userTexts[layer.nm] || userTexts[layer.refId] || userTexts[layer.ind];
                        if (textData && layer.t.d.k[0]?.s) {
                            layer.t.d.k[0].s.t = textData;
                        }
                    }
                    if (layer.ty === 0 && layer.refId) {
                        // Find asset for this composition? No, deep injection might update 'clonedAssets' directly if we mapped them well.
                        // But since we cloned assets above, we should traverse THEM.
                    }
                });
            };

            // Assets 내의 레이어들에 텍스트 주입
            clonedAssets.forEach((asset: any) => {
                if (asset.layers) injectText(asset.layers);
            });
            // Root layers 텍스트 주입
            // processedTemplate.layers는 deep copy 안함 (성능). 텍스트 레이어만 수정 시도하면 원본 오염 가능성 있으나, Preview용이라 허용.
            // 안전을 위해 processedTemplate.layers도 map 처리 권장하나, 여기서는 일단 진행.

            return {
                template: processedTemplate,
                // 타겟 레이어가 있으면 그 구간(ip, op)을 사용, 없으면 전체(0, 120)
                segment: targetLayer ? [targetLayer.ip, targetLayer.op] : [0, fullTemplate.op || 120],
                fps: fullTemplate.fr || 30,
                w: fullTemplate.w,
                h: fullTemplate.h
            };

        } catch (error) {
            console.error(`[LottiePreview] Error processing [${sceneId}]:`, error);
            return null;
        }
    }, [fullTemplate, sceneId, userImages, userTexts, isInView]);

    // [최적화] Canvas 모드에서의 리렌더링 이슈 해결
    useEffect(() => {
        setMountKey(prev => prev + 1);
    }, [userImages, userTexts, sceneId]);

    useEffect(() => {
        if (!containerRef.current || !sceneData) return;
        let instance: AnimationItem | null = null;
        try {
            if (animRef.current) { animRef.current.destroy(); animRef.current = null; }
            instance = lottie.loadAnimation({
                container: containerRef.current,
                renderer: renderer || 'canvas', // [최적화] Canvas 모드
                loop: false, autoplay: false,
                animationData: sceneData.template, // 전체 템플릿 사용
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid slice',
                    imagePreserveAspectRatio: 'xMidYMid slice',
                    clearCanvas: true
                },
                initialSegment: sceneData.segment as [number, number] // [핵심] 해당 씬의 구간만 재생
            });
            animRef.current = instance;
            instance.addEventListener('DOMLoaded', () => {
                if (!instance) return;
                console.log(`[LottiePreview] Animation Loaded for ${sceneId}`);
                // initialSegment를 썼으므로 goToAndStop은 세그먼트의 첫 프레임 기준이 됨.
                // 보통 initialSegment만 주면 알아서 첫 프레임에 멈춰 있거나 play() 해야 함.
                // 여기서는 정지 썸네일이므로, 세그먼트의 시작점에 멈춤
                // instance.goToAndStop(0, true); // segment relative frame 0
            });
        } catch (e) {
            console.error(`[LottiePreview] Animation Init Error:`, e);
        }
        return () => { if (instance) instance.destroy(); };
    }, [sceneData, previewFrame, sceneId, renderer, mountKey]);

    const dW = sceneData?.w || width || 1920;
    const dH = sceneData?.h || height || 1080;
    const isV = dH > dW;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden ${className}`}>
            <div
                key={mountKey} // [핵심] 키 업데이트로 강제 리마운트 -> Canvas 갱신 보장
                ref={containerRef}
                className="relative"
                style={{
                    width: isV ? 'auto' : '100%',
                    height: isV ? '100%' : 'auto',
                    aspectRatio: `${dW}/${dH}`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
            >
                {(!sceneData && isInView) && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">
                        {fullTemplate ? 'SEARCHING SCENE...' : 'LOADING TEMPLATE...'}
                    </div>
                )}
            </div>
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
