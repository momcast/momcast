import React, { useState, useEffect, useRef } from 'react';
import { AdminScene, UserScene, DrawPath, Sticker } from '../app/types';
import { Icons } from './Icons';
import { ScenePreview } from './ScenePreview';
import { uploadImage } from '../app/firebase';

// =========================================================================================
// Helper Component: Example Color Picker
// =========================================================================================
const ColorPickerRainbow: React.FC<{ currentColor: string; onColorChange: (color: string) => void }> = ({ currentColor, onColorChange }) => {
    const baseColors = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8B00FF', '#000000', '#FFFFFF'];
    const [selectedBase, setSelectedBase] = useState('#FF0000');
    const RAINBOW_SHADES: Record<string, string[]> = {
        '#FF0000': ['#FFE5E5', '#FF8080', '#FF0000', '#B30000', '#660000'],
        '#FF7F00': ['#FFF2E5', '#FFBF80', '#FF7F00', '#B35900', '#663300'],
        '#FFFF00': ['#FFFFE5', '#FFFF80', '#FFFF00', '#B3B300', '#666600'],
        '#00FF00': ['#E5FFE5', '#80FF80', '#00FF00', '#00B300', '#006600'],
        '#00FFFF': ['#E5FFFF', '#80FFFF', '#00FFFF', '#00B3B3', '#006666'],
        '#0000FF': ['#E5E5FF', '#8080FF', '#0000FF', '#0000B3', '#000066'],
        '#8B00FF': ['#F3E5FF', '#C580FF', '#8B00FF', '#6100B3', '#370066'],
        '#000000': ['#E0E0E0', '#A0A0A0', '#606060', '#303030', '#000000'],
        '#FFFFFF': ['#FFFFFF', '#F9F9F9', '#F0F0F0', '#E0E0E0', '#D0D0D0'],
    };

    return (
        <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-1.5">
                {baseColors.map((color) => (
                    <button
                        key={color}
                        onClick={() => { setSelectedBase(color); onColorChange(color); }}
                        style={{ backgroundColor: color }}
                        className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${selectedBase === color ? 'border-gray-900 ring-2 ring-gray-100' : 'border-gray-50'}`}
                    />
                ))}
            </div>
            <div className="flex gap-1.5">
                {(RAINBOW_SHADES[selectedBase] || RAINBOW_SHADES['#000000']).map((shade) => (
                    <button
                        key={shade}
                        onClick={() => onColorChange(shade)}
                        style={{ backgroundColor: shade }}
                        className={`flex-1 h-10 rounded-xl border-2 transition-all ${currentColor.toLowerCase() === shade.toLowerCase() ? 'border-gray-900 shadow-inner' : 'border-gray-50'}`}
                    />
                ))}
            </div>
        </div>
    );
};

// =========================================================================================
// Helper Component: Sticker Overlay
// =========================================================================================
const StickerOverlay: React.FC<{
    sticker: Sticker;
    isSelected: boolean;
    onSelect: (e: React.PointerEvent) => void;
    onDelete: () => void;
    onUpdate: (updated: Sticker) => void;
}> = ({ sticker, isSelected, onSelect, onDelete, onUpdate }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const startPos = useRef({ x: 0, y: 0 });
    const startSticker = useRef<Sticker | null>(null);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        onSelect(e);
        startPos.current = { x: e.clientX, y: e.clientY };
        startSticker.current = { ...sticker };
    };

    const handleTransformDown = (e: React.PointerEvent) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsTransforming(true);
        startPos.current = { x: e.clientX, y: e.clientY };
        startSticker.current = { ...sticker };
    };

    useEffect(() => {
        const handleUp = () => { setIsDragging(false); setIsTransforming(false); };
        const handleMove = (e: PointerEvent) => {
            if (!startSticker.current) return;
            const dx = e.clientX - startPos.current.x;
            const dy = e.clientY - startPos.current.y;

            if (isDragging) {
                const pxPercent = 0.1;
                onUpdate({
                    ...startSticker.current,
                    x: startSticker.current.x + dx * pxPercent,
                    y: startSticker.current.y + dy * pxPercent,
                });
            } else if (isTransforming) {
                const scaleChange = dx * 0.01;
                const newScale = Math.max(0.2, startSticker.current.scale + scaleChange);
                onUpdate({ ...startSticker.current, scale: newScale });
            }
        };
        if (isDragging || isTransforming) {
            window.addEventListener('pointermove', handleMove);
            window.addEventListener('pointerup', handleUp);
        }
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [isDragging, isTransforming, onUpdate]);

    return (
        <>
            <div
                onPointerDown={handlePointerDown}
                className={`absolute touch-none select-none ${isSelected ? 'z-50' : 'z-auto'}`}
                style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(0deg)`,
                    cursor: isDragging ? 'grabbing' : 'grab'
                }}
            >
                <div className={`relative ${isSelected ? 'ring-2 ring-[#ffb3a3] ring-offset-2' : ''}`}>
                    <img src={sticker.src} alt="Sticker" className="w-16 h-16 md:w-24 md:h-24 object-contain pointer-events-none select-none" />

                    {isSelected && (
                        <>
                            <button
                                onPointerDown={(e) => { e.stopPropagation(); onDelete(); }}
                                className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-95 z-50 text-[10px]"
                            >
                                ✕
                            </button>
                            <div
                                onPointerDown={handleTransformDown}
                                className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-[#ffb3a3] rounded-full cursor-se-resize shadow-md z-50 flex items-center justify-center text-[8px]"
                            >
                                ↔
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

interface SceneEditorProps {
    adminScene: AdminScene;
    userScene: UserScene;
    isAdminMode: boolean;
    onClose: () => void;
    onSave: (updatedScene: AdminScene | UserScene) => void;
    width?: number;
    height?: number;
    lottieTemplate?: any;
}

// [Optimization] Use React.memo to prevent unnecessary re-renders of the entire editor
export const SceneEditor = React.memo<SceneEditorProps>(({
    adminScene, userScene, isAdminMode, onClose, onSave, width, height, lottieTemplate
}) => {
    // [Optimization] Initialize heavy state lazily or check if we need to defer
    // [Optimization] Initialize heavy state lazily or check if we need to defer
    const [isReady, setIsReady] = useState(true);

    // Effect removed: Instant load

    const [currentScene, setCurrentScene] = useState<AdminScene | UserScene>(() => {
        const base: AdminScene | UserScene = isAdminMode ? adminScene : userScene;

        return {
            ...base,
            position: base.position || { x: 0, y: 0 },
            zoom: base.zoom || 1,
            rotation: base.rotation || 0,
            backgroundMode: base.backgroundMode || 'transparent',
            backgroundColor: base.backgroundColor || '#ffffff',
            cropRect: base.cropRect || { top: 0, left: 0, right: 0, bottom: 0 },
            stickers: base.stickers || [],
            drawings: base.drawings || [],
            slotImages: (base as UserScene).slotImages || {},
            slotTexts: (base as UserScene).slotTexts || {},
            // 독립적 권한 초기값 (없으면 기본값 true)
            ...(isAdminMode ? {
                allowUserUpload: (base as AdminScene).allowUserUpload ?? true,
                allowUserDecorate: (base as AdminScene).allowUserDecorate ?? true,
                allowUserText: (base as AdminScene).allowUserText ?? true,
            } : {})
        };
    });

    const slots = isAdminMode ? (currentScene as AdminScene).slots : adminScene.slots;

    const [mode, setMode] = useState<'edit' | 'decorate' | 'camera'>('edit');
    const [isCropMode, setIsCropMode] = useState(false);
    const [activePhotoSlotId, setActivePhotoSlotId] = useState<string | null>(slots?.photos?.[0]?.id || null);

    const handleFileChangeForSlot = async (slotId: string, file: File) => {
        setIsUploading(true);
        try {
            const url = await uploadImage(file);
            setCurrentScene((prev: any) => ({
                ...prev,
                slotImages: { ...(prev.slotImages || {}), [slotId]: url },
                // Legacy compatibility for first slot
                ...(slotId === slots?.photos?.[0]?.id ? { userImageUrl: url } : {})
            }));
        } finally { setIsUploading(false); }
    };

    const handleTextChangeForSlot = (slotId: string, text: string) => {
        setCurrentScene((prev: any) => ({
            ...prev,
            slotTexts: { ...(prev.slotTexts || {}), [slotId]: text },
            // Legacy compatibility for first slot
            ...(slotId === slots?.texts?.[0]?.id ? { content: text } : {})
        }));
    };

    const [penColor, setPenColor] = useState('#000000');
    const [penWidth, setPenWidth] = useState(4);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isBrushActive, setIsBrushActive] = useState(false);
    const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
    const [showGuideOverlay, setShowGuideOverlay] = useState(true);


    const fileInputRef = useRef<HTMLInputElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [isUploading, setIsUploading] = useState(false);

    const canUpload = isAdminMode || adminScene.allowUserUpload !== false;
    const canDecorate = isAdminMode || adminScene.allowUserDecorate !== false;
    const canEditText = isAdminMode || adminScene.allowUserText !== false;


    const startCamera = async () => {
        setMode('camera');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
        } catch {
            alert("카메라 권한을 허용해주세요.");
            setMode('edit');
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            setCurrentScene((prev: AdminScene | UserScene) => ({
                ...prev,
                [isAdminMode ? 'overlayUrl' : 'userImageUrl']: canvas.toDataURL('image/png'),
                position: { x: 0, y: 0 }, zoom: 1, rotation: 0
            }));
            stopCamera();
            setMode('edit');
        }
    };

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const url = await uploadImage(file);
            setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, [isAdminMode ? 'overlayUrl' : 'userImageUrl']: url }));
        } finally { setIsUploading(false); }
    };

    const handleAddSticker = (url: string) => {
        const id = `st_${Date.now()}`;
        setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, stickers: [...prev.stickers, { id, src: url, x: 50, y: 50, scale: 1 }] }));
        setSelectedStickerId(id);
        setIsBrushActive(false); // Stop drawing
    };

    const handleViewportPointerDown = (e: React.PointerEvent) => {
        if (mode === 'camera' || isCropMode) return;
        if (selectedStickerId) setSelectedStickerId(null);

        const rect = viewportRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (mode === 'decorate') {
            if (!isBrushActive) return;
            setCurrentPath({ id: `dr_${Date.now()}`, points: [{ x, y }], color: penColor, width: penWidth });
            setIsDrawing(true);
            return;
        }

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const vWidth = rect.width;
        const vHeight = rect.height;
        const startX = e.clientX - (currentScene.position.x * vWidth / 100);
        const startY = e.clientY - (currentScene.position.y * vHeight / 100);

        const move = (me: PointerEvent) => {
            setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, position: { x: ((me.clientX - startX) / vWidth) * 100, y: ((me.clientY - startY) / vHeight) * 100 } }));
        };
        const up = (ue: PointerEvent) => {
            target.releasePointerCapture(ue.pointerId);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing || !currentPath || mode !== 'decorate') return;
        const rect = viewportRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setCurrentPath((prev: DrawPath | null) => prev ? { ...prev, points: [...prev.points, { x, y }] } : null);
    };

    const handlePointerUp = () => {
        if (isDrawing && currentPath) {
            setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, drawings: [...prev.drawings, currentPath] }));
            setCurrentPath(null);
            setIsDrawing(false);
        }
    };

    const handleUndo = () => {
        setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, drawings: prev.drawings.slice(0, -1) }));
    };

    const handleClearDrawings = () => {
        if (confirm('모든 그림을 삭제하시겠습니까?')) {
            setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, drawings: [] }));
        }
    };

    const handleCropDrag = (e: React.PointerEvent, dir: string) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const rect = viewportRef.current!.getBoundingClientRect();
        const vWidth = rect.width;
        const vHeight = rect.height;

        const move = (me: PointerEvent) => {
            const px = Math.max(0, Math.min(100, ((me.clientX - rect.left) / vWidth) * 100));
            const py = Math.max(0, Math.min(100, ((me.clientY - rect.top) / vHeight) * 100));

            setCurrentScene((prev: AdminScene | UserScene) => {
                const nr = { ...prev.cropRect };
                if (dir.includes('top')) nr.top = Math.max(0, Math.min(py, 100 - nr.bottom - 5));
                if (dir.includes('bottom')) nr.bottom = Math.max(0, Math.min(100 - py, 100 - nr.top - 5));
                if (dir.includes('left')) nr.left = Math.max(0, Math.min(px, 100 - nr.right - 5));
                if (dir.includes('right')) nr.right = Math.max(0, Math.min(100 - px, 100 - nr.left - 5));
                return { ...prev, cropRect: nr };
            });
        };

        const up = (ue: PointerEvent) => {
            target.releasePointerCapture(ue.pointerId);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const crop = currentScene.cropRect || { top: 0, left: 0, right: 0, bottom: 0 };
    const userPhotoUrl = isAdminMode ? null : (currentScene as UserScene).userImageUrl;
    // const cropImageSrc = isAdminMode ? ((currentScene as AdminScene).overlayUrl || null) : (userPhotoUrl || null);
    const transparencyGridStyle = {
        backgroundImage: 'linear-gradient(45deg, #f9f9f9 25%, transparent 25%), linear-gradient(-45deg, #f9f9f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f9f9f9 75%), linear-gradient(-45deg, transparent 75%, #f9f9f9 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        backgroundColor: '#ffffff'
    };

    if (!isReady) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center">
                <div className="bg-white w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl animate-spin">
                    <Icons.Change className="w-8 h-8 text-gray-300" />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center overflow-hidden">
            <div className="bg-white w-full h-full max-w-[1240px] md:h-[95vh] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden relative border border-gray-100 animate-in fade-in zoom-in-95 duration-300">

                {/* 1. Header (Scene Info) */}
                <header className="flex justify-between items-start px-8 pt-6 pb-2 bg-white shrink-0">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">{currentScene.name || `장면 ${currentScene.order || '??'}`}</h3>
                        <div className="flex items-center gap-3 text-[11px] font-medium text-gray-400">
                            <span className="flex items-center gap-1"><Icons.Clock /> {Math.round((lottieTemplate?.assets?.find((a: any) => a.id === currentScene.id)?.op || 120) / (lottieTemplate?.fr || 30))}초 재생</span>
                            <span className="flex items-center gap-1">🎵 가사 없음</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-300 hover:text-gray-900">
                        <Icons.Close />
                    </button>
                </header>

                {/* 2. Tool Row */}
                <div className="px-8 flex items-center justify-between py-4 border-t border-gray-50 bg-white shrink-0 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => {
                                const slot = slots?.photos.find(s => s.id === activePhotoSlotId);
                                if (slot && !slot.isEditable && !isAdminMode) {
                                    alert('이 사진은 다른 씬과 공유되어 있어 이곳에서 수정할 수 없습니다.');
                                    return;
                                }
                                fileInputRef.current?.click();
                            }}
                            className="flex flex-col items-center gap-1.5 group"
                        >
                            <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors"><Icons.Change /></div>
                            <span className="text-[10px] font-bold text-gray-600">변경</span>
                        </button>
                        <button
                            onClick={() => setCurrentScene((prev: any) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))}
                            className="flex flex-col items-center gap-1.5 group"
                        >
                            <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors"><Icons.Rotate /></div>
                            <span className="text-[10px] font-bold text-gray-600">회전</span>
                        </button>
                        <button
                            onClick={() => setIsCropMode(!isCropMode)}
                            className={`flex flex-col items-center gap-1.5 group ${isCropMode ? 'text-[#ffb3a3]' : ''}`}
                        >
                            <div className={`p-3 rounded-xl transition-colors ${isCropMode ? 'bg-[#ffb3a3]/10' : 'bg-gray-50 group-hover:bg-gray-100'}`}><Icons.Crop /></div>
                            <span className="text-[10px] font-bold">영역</span>
                        </button>
                    </div>

                    <div className="w-[1px] h-10 bg-gray-100 mx-2" />

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setCurrentScene((prev: any) => ({ ...prev, position: { x: 0, y: 0 } }))}
                            className="flex flex-col items-center gap-1.5 group"
                        >
                            <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors"><Icons.Plus className="rotate-45" /></div>
                            <span className="text-[10px] font-bold text-gray-600">정렬</span>
                        </button>
                        <button className="flex flex-col items-center gap-1.5 group opacity-40">
                            <div className="p-3 bg-gray-50 rounded-xl"><Icons.Admin /></div>
                            <span className="text-[10px] font-bold text-gray-600">맞춤</span>
                        </button>
                        <button
                            onClick={() => {
                                const modes: ('transparent' | 'solid' | 'blur')[] = ['transparent', 'solid', 'blur'];
                                const next = modes[(modes.indexOf(currentScene.backgroundMode || 'transparent') + 1) % 3];
                                setCurrentScene((prev: any) => ({ ...prev, backgroundMode: next }));
                            }}
                            className="flex flex-col items-center gap-1.5 group"
                        >
                            <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
                                <div className={`w-5 h-5 rounded-full border-2 ${currentScene.backgroundMode === 'solid' ? 'bg-black' : 'bg-white border-dashed'}`} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-600">배경</span>
                        </button>
                    </div>

                    <div className="w-[1px] h-10 bg-gray-100 mx-2" />

                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentScene((prev: any) => ({ ...prev, zoom: Math.max(0.5, prev.zoom - 0.2) }))} className="text-gray-300 hover:text-gray-900 transition-colors">축소</button>
                        <div className="relative w-24 h-6 flex items-center">
                            <input
                                type="range" min="0.5" max="4" step="0.1"
                                value={currentScene.zoom}
                                onChange={(e) => setCurrentScene((prev: any) => ({ ...prev, zoom: parseFloat(e.target.value) }))}
                                className="w-full accent-[#ffb3a3] cursor-pointer appearance-none bg-gray-100 h-1 rounded-full"
                            />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-[#ffb3a3]">{Math.round(currentScene.zoom * 100)}%</div>
                        </div>
                        <button onClick={() => setCurrentScene((prev: any) => ({ ...prev, zoom: Math.min(4, prev.zoom + 0.2) }))} className="text-gray-300 hover:text-gray-900 transition-colors">확대</button>
                    </div>
                </div>

                {/* 3. Main Stage (Preview) */}
                <div
                    className="flex-1 relative flex items-center justify-center p-4 md:p-8 overflow-hidden"
                    style={transparencyGridStyle}
                >
                    <div
                        ref={viewportRef}
                        className={`w-full max-w-4xl relative overflow-hidden bg-transparent shadow-[0_40px_100px_-20px_rgba(0,0,0,0.2)] rounded-2xl transition-all duration-500`}
                        style={{
                            aspectRatio: `${width || 1920} / ${height || 1080}`,
                        }}
                        onPointerDown={handleViewportPointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        <ScenePreview
                            scene={{ ...currentScene, isEditing: true, width, height, content: (isAdminMode ? (currentScene as AdminScene).defaultContent : (currentScene as UserScene).content) }}
                            adminConfig={isAdminMode ? undefined : adminScene}
                            isAdmin={isAdminMode}
                            hideOverlay={!showGuideOverlay}
                            lottieTemplate={lottieTemplate}
                        />

                        {/* Crop Overlay */}
                        {isCropMode && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-gray-100/40 backdrop-blur-sm">
                                <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
                                    <div
                                        className="absolute border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                                        style={{
                                            top: `${crop.top}%`,
                                            left: `${crop.left}%`,
                                            right: `${crop.right}%`,
                                            bottom: `${crop.bottom}%`
                                        }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg">영역 조절 중</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isUploading && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-[100] backdrop-blur-md">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-[#ffb3a3] border-t-transparent rounded-full animate-spin" />
                                    <span className="font-black text-[10px] uppercase tracking-widest text-[#ffb3a3]">Processing...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Text Input Area */}
                <div className="px-8 pb-32 pt-4 bg-white border-t border-gray-50 flex flex-col gap-4">
                    {slots && slots.texts.length > 0 ? (
                        slots.texts.map(slot => (
                            <div key={slot.id} className="w-full">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{slot.name}</span>
                                    {!slot.isEditable && !isAdminMode && <span className="text-[8px] bg-red-50 text-red-400 px-2 py-0.5 rounded font-black">이전 장면에서 연동됨</span>}
                                </div>
                                <textarea
                                    disabled={!slot.isEditable && !isAdminMode}
                                    className={`w-full p-6 text-center text-lg md:text-xl font-medium border border-gray-100 rounded-2xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-[#ffb3a3]/5 focus:border-[#ffb3a3] transition-all outline-none resize-none h-24 ${!slot.isEditable && !isAdminMode ? 'opacity-40 select-none' : ''}`}
                                    value={(currentScene as UserScene).slotTexts?.[slot.id] || (isAdminMode ? (currentScene as AdminScene).defaultContent : (currentScene as UserScene).content)}
                                    onChange={(e) => handleTextChangeForSlot(slot.id, e.target.value)}
                                    placeholder="내용을 입력해주세요"
                                />
                            </div>
                        ))
                    ) : (
                        <textarea
                            className="w-full p-6 text-center text-lg md:text-xl font-medium border border-gray-100 rounded-2xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-4 focus:ring-[#ffb3a3]/5 focus:border-[#ffb3a3] transition-all outline-none resize-none h-28"
                            value={isAdminMode ? (currentScene as AdminScene).defaultContent : (currentScene as UserScene).content}
                            onChange={(e) => setCurrentScene((prev: any) => ({ ...prev, [isAdminMode ? 'defaultContent' : 'content']: e.target.value }))}
                            placeholder="내용을 입력해주세요"
                        />
                    )}
                </div>

                {/* 5. Fixed Bottom Action */}
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-sm z-20">
                    <button
                        onClick={() => {
                            const sceneToSave = isAdminMode ? currentScene : { ...currentScene, overlayUrl: undefined };
                            onSave(sceneToSave);
                        }}
                        className="w-full py-5 bg-[#ffb3a3] text-white font-black rounded-3xl text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        확인
                    </button>
                </div>

                {/* Hidden File Input */}
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && activePhotoSlotId) handleFileChangeForSlot(activePhotoSlotId, file);
                }} />
            </div>
        </div>
    );
});

SceneEditor.displayName = 'SceneEditor';
