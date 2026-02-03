import React, { useState, useEffect, useRef } from 'react';
import { BaseScene, AdminScene, UserScene, DrawPath, Sticker } from '../app/types';
import { LottieScenePreview } from './LottieScenePreview';
import { Icons } from './Icons';

interface Props {
    scene: BaseScene & {
        userImageUrl?: string;
        overlayUrl?: string;
        isEditing?: boolean;
        width?: number;
        height?: number;
        content?: string;
        slotImages?: Record<string, string>;
        slotTexts?: Record<string, string>;
    };
    adminConfig?: AdminScene;
    isAdmin?: boolean;
    className?: string;
    hideOverlay?: boolean;
    lottieTemplate?: any;
}

export const ScenePreview: React.FC<Props> = React.memo(({ scene, adminConfig, isAdmin, className = "", hideOverlay = false, lottieTemplate }) => {
    const displayScene = scene;
    // const overlayConfig = (!isAdmin && adminConfig) ? adminConfig : (scene as AdminScene | UserScene);
    const width = scene.width || 1920;
    const height = scene.height || 1080;
    const isVertical = height > width;

    // [Performance] Lazy Loading State
    const [isInView, setIsInView] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.disconnect(); // Load once and keep
            }
        }, { rootMargin: '200px' }); // Preload slightly before appearing

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Prepare Slot Data for Lottie
    const slots = isAdmin ? (scene as AdminScene).slots : adminConfig?.slots;
    const userImages = { ...(scene as UserScene).slotImages };
    const userTexts = { ...(scene as UserScene).slotTexts };

    // Fallback for first slot mapping
    if (slots?.photos?.[0] && !userImages[slots.photos[0].id] && displayScene.userImageUrl) {
        userImages[slots.photos[0].id] = displayScene.userImageUrl;
    }
    if (slots?.texts?.[0] && !userTexts[slots.texts[0].id] && displayScene.content) {
        userTexts[slots.texts[0].id] = displayScene.content;
    }

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden w-full h-full ${className} bg-transparent flex items-center justify-center`}
            style={{ aspectRatio: `${width} / ${height}` }}
        >
            {/* 1. Lottie Background (Lazy Loaded) */}
            {lottieTemplate && scene.id && isInView ? (
                <LottieScenePreview
                    fullTemplate={lottieTemplate}
                    sceneId={scene.id}
                    slots={slots}
                    userImages={userImages}
                    userTexts={userTexts}
                    width={width}
                    height={height}
                    previewFrame={isAdmin ? (scene as AdminScene).previewFrame : adminConfig?.previewFrame}
                    backgroundMode={displayScene.backgroundMode}
                    backgroundColor={displayScene.backgroundColor}
                    className="absolute inset-0 z-0"
                />
            ) : (
                /* Fallback / Placeholder */
                <div
                    className="absolute inset-0 flex items-center justify-center bg-white"
                    style={{
                        backgroundColor: displayScene.backgroundMode === 'solid' ? displayScene.backgroundColor : '#ffffff',
                        backgroundImage: displayScene.backgroundMode === 'transparent' ? 'none' : undefined
                    }}
                >
                    {displayScene.backgroundMode === 'blur' && displayScene.userImageUrl && (
                        <div className="absolute inset-0 scale-125 blur-3xl opacity-30 grayscale pointer-events-none" style={{ backgroundImage: `url(${displayScene.userImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                    )}
                    {/* Show simple image if available while loading or as fallback */}
                    {displayScene.userImageUrl ? (
                        <div
                            className="w-full h-full relative"
                            style={{
                                aspectRatio: `${width}/${height}`,
                                transform: `translate(${displayScene.position?.x || 0}%, ${displayScene.position?.y || 0}%) rotate(${displayScene.rotation || 0}deg) scale(${displayScene.zoom || 1})`
                            }}
                        >
                            <img src={displayScene.userImageUrl} className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 opacity-20">
                            <Icons.Change className="w-12 h-12" />
                            <span className="text-[10px] font-black uppercase tracking-widest">No Image</span>
                        </div>
                    )}
                </div>
            )}

            {/* 2. Interactive Overlays (Drawings & Stickers) - Locked to content area */}
            <div
                className="relative z-10 pointer-events-none"
                style={{
                    width: isVertical ? 'auto' : '100%',
                    height: isVertical ? '100%' : 'auto',
                    aspectRatio: `${width} / ${height}`
                }}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {(displayScene.drawings || []).map((d: DrawPath) => (
                        <polyline key={d.id} points={d.points.map((pt: { x: number, y: number }) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={d.color} strokeWidth={d.width / 15} strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                </svg>
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
                    {(displayScene.stickers || []).map((s: Sticker) => (
                        !scene.isEditing ? (
                            <div
                                key={s.id}
                                className="absolute pointer-events-none"
                                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
                            >
                                <img src={s.src} alt="Sticker" loading="lazy" className="w-16 h-16 md:w-20 md:h-20 object-contain pointer-events-none" />
                            </div>
                        ) : null
                    ))}
                </div>
            </div>
        </div>
    );
});

ScenePreview.displayName = 'ScenePreview';
