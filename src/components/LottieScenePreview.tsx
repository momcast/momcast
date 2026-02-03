'use client';

import React, { useEffect, useRef, useMemo } from 'react';
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
 * [Global Helper] 템플릿의 에셋을 '렌더링 가능한 상태'로 한 번만 패치함.
 * - 사용자 이미지 주입 (userImages)
 * - 비디오(.mp4) -> 대체 이미지(.jpg)
 * - 경로 정규화 (templates/images/...)
 */
function getPatchedAssets(template: any, userImages: Record<string, string> = {}) {
    if (!template || !template.assets) return [];

    return template.assets.map((a: any) => {
        // [User Image Injection] 사용자 이미지가 있으면 최우선 적용
        // userImages의 키는 assetId라고 가정 (예: image_0)
        if (userImages[a.id]) {
            return {
                ...a,
                u: '', // 로컬 경로는 비움
                p: userImages[a.id] // Blob URL or Base64
            };
        }

        // 이미 패치된 적이 있고(경로 보정됨), 사용자 이미지가 없다면 패스
        if (a.p && typeof a.p === 'string' && a.p.includes('/templates/images/')) return a;

        const asset = { ...a }; // Shallow Clone

        // [Fix] Precomp에 w, h가 없으면 렌더링 실패함 -> 강제 주입
        if (!asset.w) asset.w = template.w || 1920;
        if (!asset.h) asset.h = template.h || 1080;

        if (asset.p && typeof asset.p === 'string') {
            const lowerP = asset.p.toLowerCase();

            // 1. 비디오 -> 이미지 교체 (필수)
            if (lowerP.endsWith('.mp4') || lowerP.endsWith('.mov')) {
                // [Fix] Scene 20 배경 강제 주입 (사용자 요청: "이 화면 그대로 나오게 하라")
                // vid_9.mov (clip7.mov)는 Scene 20의 배경임.
                if (lowerP.includes('vid_9.mov') || lowerP.includes('clip7.mov')) {
                    asset.u = '';
                    asset.p = '/templates/images/custom_bg_20.png';
                } else {
                    asset.u = '';
                    asset.p = '/templates/images/img_11.jpg'; // 그 외 비디오는 기본 배경
                }
            }
            // 2. 이미지 경로 정규화
            else if (!lowerP.startsWith('data:') && !lowerP.startsWith('http')) {
                asset.u = '';
                asset.p = `/templates/images/${asset.p.split('/').pop()}`;
            }
        }
        return asset;
    });
}

function findSceneComp(assets: any[], sceneId: string) {
    if (!assets || !sceneId) return null;
    const sId = sceneId.trim().toLowerCase();

    // 1. ID 매칭
    let found = assets.find((a: any) => a.id === sceneId || a.id.toLowerCase() === sId);
    if (found) return found;

    // 2. 이름/숫자 매칭
    const cleanNum = sId.replace(/[^0-9]/g, '');
    if (cleanNum) {
        found = assets.find((a: any) => {
            const nm = (a.nm || '').toLowerCase();
            return nm.includes(cleanNum) && (nm.includes('scene') || nm.includes('씬') || nm.includes('comp'));
        });
    }
    return found || null;
}

export const LottieScenePreview: React.FC<Props> = React.memo(({
    fullTemplate,
    sceneId,
    userImages = {},
    width = 1920,
    height = 1080,
    className = "",
    // previewFrame = 0, // 항상 0프레임 고정 (요청사항)
}) => {
    // [DEBUG] 버전 확인용 로그
    useEffect(() => {
        console.log('[[LottieScenePreview] Zero-Clone v3.0 Activated - No Timeline Play]');
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const animRef = useRef<AnimationItem | null>(null);

    // [최적화 1] Assets 패칭 (User Image 변경 시에도 갱신)
    const patchedAssets = useMemo(() => {
        return getPatchedAssets(fullTemplate, userImages);
    }, [fullTemplate, userImages]); // userImages 의존성 추가

    // [최적화 2] 렌더링용 미니멀 JSON 생성 (Zero-Clone)
    // - layers: 타겟 씬의 레이어 (참조)
    // - assets: 위에서 만든 패치된 에셋 (참조)
    // -> 복사 비용 거의 없음.
    const minimalJson = useMemo(() => {
        if (!fullTemplate || !sceneId || !patchedAssets) return null;

        const targetComp = findSceneComp(fullTemplate.assets, sceneId);
        if (!targetComp) return null;

        // [Fix] Layer Timing Correction
        // Normalization(0점 정렬)은 AE의 싱크를 깨뜨리므로 롤백했습니다.
        // 대신, 음수 ip로 인한 잠재적 렌더링 문제를 방지하기 위해 ip만 0으로 클램핑합니다.
        const clampedLayers = targetComp.layers.map((l: any) => ({
            ...l,
            ip: Math.max(0, l.ip || 0) // Ensure visibility starts at 0 if it was negative
        }));

        return {
            v: fullTemplate.v || "5.5.7",
            fr: fullTemplate.fr || 30,
            ip: 0,
            op: targetComp.op || 120, // 씬 길이만큼
            w: targetComp.w || fullTemplate.w || 1920,
            h: targetComp.h || fullTemplate.h || 1080,
            nm: `Preview ${sceneId}`,
            ddd: 0,
            fonts: fullTemplate.fonts,   // [Fix] 폰트 스타일 정보 복사
            chars: fullTemplate.chars,   // [Fix] 글자 정보 복사
            markers: fullTemplate.markers, // [Fix] 마커 정보 복사
            assets: patchedAssets, // [핵심] User Image가 주입된 에셋 참조
            layers: clampedLayers // [Fix] 원본 싱크 유지 (Normalization 롤백)
        };
    }, [fullTemplate, sceneId, patchedAssets]);

    // [RENDERER] 동기 실행 (즉시 렌더링)
    useEffect(() => {
        if (!containerRef.current || !minimalJson) return;

        // Cleanup
        if (animRef.current) {
            animRef.current.destroy();
            animRef.current = null;
        }

        try {
            // console.time(`[Lottie] Render ${sceneId}`);
            const instance = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'canvas', // [Fix] SVG 아티팩트 방지를 위해 Canvas로 복귀 (IP Clamping으로 효과 문제도 해결 기대)
                loop: false,
                autoplay: false, // 자동재생 X
                animationData: minimalJson,
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid slice',
                    imagePreserveAspectRatio: 'xMidYMid slice',
                    clearCanvas: true,
                    progressiveLoad: false, // 즉시 로드
                }
            });
            animRef.current = instance;

            instance.addEventListener('DOMLoaded', () => {
                // console.timeEnd(`[Lottie] Render ${sceneId}`);
                instance.goToAndStop(0, true); // 0프레임 즉시 이동
            });

        } catch (e) {
            console.error(`[Lottie] Error ${sceneId}`, e);
        }

        return () => {
            if (animRef.current) animRef.current.destroy();
        };
    }, [minimalJson]); // sceneId가 바뀌어 minimalJson이 갱신되면 즉시 재실행

    // 비율 유지
    const isV = height > width;

    return (
        <div className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-gray-50 ${className}`}>
            <div
                ref={containerRef}
                style={{
                    width: isV ? 'auto' : '100%',
                    height: isV ? '100%' : 'auto',
                    aspectRatio: `${width}/${height}`,
                    maxWidth: '100%',
                    maxHeight: '100%'
                }}
            />
        </div>
    );
});

LottieScenePreview.displayName = 'LottieScenePreview';
