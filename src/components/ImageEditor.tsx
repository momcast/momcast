"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    X, Type, Smile, RotateCw, Crop as CropIcon,
    ChevronRight, Undo2, Trash2, Camera, Upload,
    Check, Palette, Minus, Plus, Move, Image as ImageIcon
} from 'lucide-react';

export interface Sticker {
    id: string;
    src: string;
    x: number;
    y: number;
    scale: number;
}

export interface DrawPath {
    id: string;
    points: { x: number; y: number }[];
    color: string;
    width: number;
}

interface CropRect {
    top: number;
    left: number;
    right: number;
    bottom: number;
}

interface ImageEditorProps {
    imageUrl: string;
    aspectRatio: number; // width / height
    initialData?: any;
    onSave: (finalImageUrl: string, rawData: any) => void;
    onClose?: () => void;
    isInline?: boolean; // Whether it's embedded in the page
    initialText?: string; // Text associated with this scene
}

const STICKER_URLS = Array.from({ length: 20 }, (_, i) => `/stickers/sticker_${i}.png`);

const transparencyGridStyle = {
    backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
    backgroundColor: '#ffffff'
};

export const ImageEditor: React.FC<ImageEditorProps> = ({
    imageUrl,
    aspectRatio,
    initialData,
    onSave,
    onClose,
    isInline = false,
    initialText = "",
}) => {
    const [mode, setMode] = useState<'edit' | 'decorate'>('edit');
    const [isCropMode, setIsCropMode] = useState(false);

    // Transformation State
    const [zoom, setZoom] = useState(initialData?.zoom || 1);
    const [rotation, setRotation] = useState(initialData?.rotation || 0);
    const [position, setPosition] = useState(initialData?.position || { x: 0, y: 0 });

    // Background State
    const [backgroundMode, setBackgroundMode] = useState<'transparent' | 'solid' | 'blur'>(initialData?.backgroundMode || 'transparent');
    const [backgroundColor, setBackgroundColor] = useState(initialData?.backgroundColor || '#ffffff');

    // Assets State
    const [cropRect, setCropRect] = useState<CropRect>(initialData?.cropRect || { top: 0, left: 0, right: 0, bottom: 0 });
    const [stickers, setStickers] = useState<Sticker[]>(initialData?.stickers || []);
    const [drawings, setDrawings] = useState<DrawPath[]>(initialData?.drawings || []);
    const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

    // Drawing State
    const [penColor, setPenColor] = useState('#ffb3a3');
    const [penWidth, setPenWidth] = useState(5);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);

    // Text State
    const [textContent, setTextContent] = useState(initialText);

    const viewportRef = useRef<HTMLDivElement>(null);

    // Sync with initialData if it changes (e.g. switching slots)
    useEffect(() => {
        if (initialData) {
            setZoom(initialData.zoom || 1);
            setRotation(initialData.rotation || 0);
            setPosition(initialData.position || { x: 0, y: 0 });
            setBackgroundMode(initialData.backgroundMode || 'transparent');
            setBackgroundColor(initialData.backgroundColor || '#ffffff');
            setCropRect(initialData.cropRect || { top: 0, left: 0, right: 0, bottom: 0 });
            setStickers(initialData.stickers || []);
            setDrawings(initialData.drawings || []);
        } else {
            // Reset if no data
            setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 });
            setBackgroundMode('transparent'); setBackgroundColor('#ffffff');
            setCropRect({ top: 0, left: 0, right: 0, bottom: 0 });
            setStickers([]); setDrawings([]);
        }
    }, [initialData]);

    // Sync Text separately as it might come from direct userTexts state
    useEffect(() => {
        setTextContent(initialText);
    }, [initialText]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isCropMode) return;
        const rect = viewportRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (mode === 'decorate') {
            setCurrentPath({ id: `dr_${Date.now()}`, points: [{ x, y }], color: penColor, width: penWidth });
            setIsDrawing(true);
            return;
        }

        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const startX = e.clientX - (position.x * rect.width / 100);
        const startY = e.clientY - (position.y * rect.height / 100);

        const move = (me: PointerEvent) => {
            setPosition({
                x: ((me.clientX - startX) / rect.width) * 100,
                y: ((me.clientY - startY) / rect.height) * 100
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

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDrawing || !currentPath || mode !== 'decorate') return;
        const rect = viewportRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setCurrentPath(prev => prev ? { ...prev, points: [...prev.points, { x, y }] } : null);
    };

    const handlePointerUp = () => {
        if (isDrawing && currentPath) {
            setDrawings(prev => [...prev, currentPath]);
            setCurrentPath(null);
            setIsDrawing(false);
        }
    };

    const handleCropHandleDrag = (e: React.PointerEvent, dir: string) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const rect = viewportRef.current!.getBoundingClientRect();

        const move = (me: PointerEvent) => {
            const px = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
            const py = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));

            setCropRect((prev: CropRect) => {
                const nr = { ...prev };
                if (dir.includes('top')) nr.top = Math.max(0, Math.min(py, 100 - nr.bottom - 5));
                if (dir.includes('bottom')) nr.bottom = Math.max(0, Math.min(100 - py, 100 - nr.top - 5));
                if (dir.includes('left')) nr.left = Math.max(0, Math.min(px, 100 - nr.right - 5));
                if (dir.includes('right')) nr.right = Math.max(0, Math.min(100 - px, 100 - nr.left - 5));
                return nr;
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

    const handleCropAreaDrag = (e: React.PointerEvent) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        const rect = viewportRef.current!.getBoundingClientRect();

        const startX = e.clientX;
        const startY = e.clientY;
        const startCrop = { ...cropRect };

        const move = (me: PointerEvent) => {
            const dx = ((me.clientX - startX) / rect.width) * 100;
            const dy = ((me.clientY - startY) / rect.height) * 100;

            setCropRect((prev: CropRect) => {
                const width = 100 - startCrop.left - startCrop.right;
                const height = 100 - startCrop.top - startCrop.bottom;

                let newLeft = Math.max(0, Math.min(100 - width, startCrop.left + dx));
                let newTop = Math.max(0, Math.min(100 - height, startCrop.top + dy));

                return {
                    left: newLeft,
                    top: newTop,
                    right: 100 - newLeft - width,
                    bottom: 100 - newTop - height
                };
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

    const handleAddSticker = (src: string) => {
        const id = `st_${Date.now()}`;
        setStickers(prev => [...prev, { id, src, x: 50, y: 50, scale: 1 }]);
        setSelectedStickerId(id);
    };

    const handleStickerDrag = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        setSelectedStickerId(id);

        const rect = viewportRef.current!.getBoundingClientRect();
        const sticker = stickers.find(s => s.id === id)!;
        const startX = e.clientX;
        const startY = e.clientY;
        const startStickerX = sticker.x;
        const startStickerY = sticker.y;

        const move = (me: PointerEvent) => {
            const dx = ((me.clientX - startX) / rect.width) * 100;
            const dy = ((me.clientY - startY) / rect.height) * 100;
            setStickers(prev => prev.map(s => s.id === id ? { ...s, x: startStickerX + dx, y: startStickerY + dy } : s));
        };
        const up = (ue: PointerEvent) => {
            target.releasePointerCapture(ue.pointerId);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const handleStickerScale = (e: React.PointerEvent, id: string) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);

        const startX = e.clientX;
        const sticker = stickers.find(s => s.id === id)!;
        const startScale = sticker.scale;

        const move = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            const newScale = Math.max(0.2, startScale + dx * 0.01);
            setStickers(prev => prev.map(s => s.id === id ? { ...s, scale: newScale } : s));
        };
        const up = (ue: PointerEvent) => {
            target.releasePointerCapture(ue.pointerId);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const finalizeImage = async () => {
        const canvas = document.createElement('canvas');
        const width = 1200; // standard high res for slot
        const height = 1200 / aspectRatio;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Draw Background
        if (backgroundMode === 'solid') {
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);
        } else if (backgroundMode === 'blur' && imageUrl) {
            const blurImg = new Image();
            blurImg.crossOrigin = "anonymous";
            blurImg.src = imageUrl;
            await new Promise(resolve => blurImg.onload = resolve);
            ctx.save();
            ctx.filter = 'blur(30px) brightness(0.8)';
            ctx.drawImage(blurImg, -width * 0.1, -height * 0.1, width * 1.2, height * 1.2);
            ctx.restore();
        } else {
            ctx.clearRect(0, 0, width, height); // Transparent
        }

        // 2. Draw Main Image
        const mainImg = new Image();
        mainImg.crossOrigin = "anonymous";
        mainImg.src = imageUrl;
        await new Promise(resolve => mainImg.onload = resolve);

        // Draw Main Image with Entity-based Transform & Clip
        ctx.save();
        // 1. Position the entire entity in the frame
        ctx.translate(width / 2, height / 2);
        ctx.translate((position.x / 100) * width, (position.y / 100) * height);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);

        // 2. Apply Clip (relative to the entity's virtual viewport-sized container)
        ctx.save();
        ctx.translate(-width / 2, -height / 2);
        ctx.beginPath();
        const cx = (cropRect.left / 100) * width;
        const cy = (cropRect.top / 100) * height;
        const cw = width * (1 - (cropRect.left + cropRect.right) / 100);
        const ch = height * (1 - (cropRect.top + cropRect.bottom) / 100);
        ctx.rect(cx, cy, cw, ch);
        ctx.clip();
        ctx.translate(width / 2, height / 2); // Translate back to center for drawing

        // 3. Draw the image itself
        const imgRatio = mainImg.width / mainImg.height;
        let drawW, drawH;
        if (imgRatio > aspectRatio) {
            drawW = width; drawH = width / imgRatio;
        } else {
            drawH = height; drawW = height * imgRatio;
        }
        ctx.drawImage(mainImg, -drawW / 2, -drawH / 2, drawW, drawH);

        ctx.restore(); // Restore clip
        ctx.restore(); // Restore entity transform

        // 3. Draw Drawings
        drawings.forEach(d => {
            ctx.beginPath();
            ctx.strokeStyle = d.color;
            ctx.lineWidth = (d.width / 100) * width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            d.points.forEach((p, i) => {
                const px = (p.x / 100) * width;
                const py = (p.y / 100) * height;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
        });

        // 4. Draw Stickers
        for (const s of stickers) {
            const sImg = new Image();
            sImg.src = s.src;
            await new Promise(resolve => sImg.onload = resolve);
            const sw = (width * 0.2) * s.scale;
            const sh = sw * (sImg.height / sImg.width);
            ctx.save();
            ctx.translate((s.x / 100) * width, (s.y / 100) * height);
            ctx.drawImage(sImg, -sw / 2, -sh / 2, sw, sh);
            ctx.restore();
        }

        const rawData = {
            zoom, rotation, position, backgroundMode, backgroundColor, cropRect, stickers, drawings
        };
        onSave(canvas.toDataURL('image/png'), rawData);
    };

    const editorContent = (
        <div className={`flex flex-col md:flex-row h-full w-full bg-white ${!isInline ? 'rounded-[2.5rem]' : ''} overflow-hidden`}>
            {/* Left: Viewport */}
            <div className="flex-1 bg-slate-100 flex flex-col relative overflow-hidden min-h-0">
                {!isInline && (
                    <header className="flex justify-between items-center px-8 py-5 bg-white border-b border-slate-100 shrink-0">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight italic uppercase">SCENE EDITOR</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </header>
                )}

                <div className="flex-1 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                    <div
                        ref={viewportRef}
                        className={`relative shadow-2xl rounded-xl overflow-hidden touch-none select-none border border-slate-200 group ${mode === 'decorate' ? 'cursor-crosshair' : 'cursor-default'}`}
                        style={{
                            aspectRatio: `${aspectRatio}`,
                            width: aspectRatio > 1 ? '100%' : 'auto',
                            height: aspectRatio > 1 ? 'auto' : '100%',
                            maxWidth: '100%',
                            maxHeight: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                    >
                        {/* Background Layer */}
                        {backgroundMode === 'solid' && (
                            <div className="absolute inset-0" style={{ backgroundColor }} />
                        )}
                        {backgroundMode === 'blur' && imageUrl && (
                            <div className="absolute inset-0 scale-125 blur-3xl opacity-50 grayscale pointer-events-none" style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover' }} />
                        )}
                        {backgroundMode === 'transparent' && (
                            <div className="absolute inset-0" style={transparencyGridStyle} />
                        )}

                        {/* Main Image Layer */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={!isCropMode ? {
                                transform: `translate(${position.x}%, ${position.y}%) rotate(${rotation}deg) scale(${zoom})`,
                                transformOrigin: '50% 50%',
                            } : {}}
                        >
                            <div
                                className="w-full h-full flex items-center justify-center"
                                style={!isCropMode ? { clipPath: `inset(${cropRect.top}% ${cropRect.right}% ${cropRect.bottom}% ${cropRect.left}%)` } : { opacity: 0.5 }}
                            >
                                <img
                                    src={imageUrl}
                                    alt="Editor Main"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>

                        {/* SVG Overlays */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {drawings.map(d => (
                                <polyline key={d.id} points={d.points.map(pt => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={d.color} strokeWidth={d.width / 10} strokeLinecap="round" strokeLinejoin="round" />
                            ))}
                            {currentPath && (
                                <polyline points={currentPath.points.map(pt => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={currentPath.color} strokeWidth={currentPath.width / 10} strokeLinecap="round" strokeLinejoin="round" />
                            )}
                        </svg>

                        {/* Stickers */}
                        <div className="absolute inset-0 z-40 overflow-hidden pointer-events-none">
                            {stickers.map(s => (
                                <div
                                    key={s.id}
                                    onPointerDown={(e) => handleStickerDrag(e, s.id)}
                                    className={`absolute pointer-events-auto touch-none select-none ${selectedStickerId === s.id ? 'z-50' : ''}`}
                                    style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
                                >
                                    <div className={`relative ${selectedStickerId === s.id ? 'ring-2 ring-[#ffb3a3] ring-offset-4 rounded-lg' : ''}`}>
                                        <img src={s.src} alt="Sticker" className="w-20 md:w-28 object-contain pointer-events-none select-none" />
                                        {selectedStickerId === s.id && (
                                            <button
                                                onPointerDown={(e) => { e.stopPropagation(); setStickers(prev => prev.filter(st => st.id !== s.id)); }}
                                                className="absolute -top-4 -right-4 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Crop Overlay */}
                        {isCropMode && (
                            <div className="absolute inset-0 z-50 pointer-events-none">
                                <div className="absolute inset-0 bg-black/40 z-10" />
                                <div
                                    onPointerDown={handleCropAreaDrag}
                                    className="absolute border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] z-20 pointer-events-auto cursor-move"
                                    style={{
                                        top: `${cropRect.top}%`,
                                        left: `${cropRect.left}%`,
                                        right: `${cropRect.right}%`,
                                        bottom: `${cropRect.bottom}%`
                                    }}
                                >
                                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 border-white/50">
                                        {[...Array(9)].map((_, i) => <div key={i} className="border border-white/30" />)}
                                    </div>
                                    {['topleft', 'topright', 'bottomleft', 'bottomright'].map(dir => (
                                        <div key={dir} onPointerDown={(e) => handleCropHandleDrag(e, dir)} className={`absolute ${dir.includes('top') ? 'top-0' : 'bottom-0'} ${dir.includes('left') ? 'left-0' : 'right-0'} w-10 h-10 pointer-events-auto cursor-pointer flex items-center justify-center -m-5`}>
                                            <div className="w-5 h-5 border-4 border-[#ffb3a3] bg-white rounded-full shadow-xl" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Draggable Hint */}
                    <div className="mt-6 flex items-center gap-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm"><Move className="w-3.5 h-3.5" /> Drag to Position</span>
                        <span className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm"><RotateCw className="w-3.5 h-3.5" /> Use sliders to adjust</span>
                    </div>
                </div>
            </div>

            {/* Right: Controls */}
            <aside className="w-full md:w-[380px] bg-white border-l border-slate-100 flex flex-col shrink-0 relative overflow-hidden p-8 gap-8">

                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setMode('edit')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${mode === 'edit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>기본 설정</button>
                    <button onClick={() => setMode('decorate')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${mode === 'decorate' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>꾸미기</button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-8 pr-2 scrollbar-thin">
                    {mode === 'edit' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-2">
                            {/* Image Transform */}
                            <div className="space-y-5">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Move className="w-3 h-3" /> 이미지 변형</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setRotation((r: number) => (r + 90) % 360)} className="py-4 bg-slate-50 rounded-2xl border border-slate-100 font-black text-[10px] uppercase text-slate-600 hover:bg-slate-100 transition-all flex flex-col items-center gap-2">
                                        <RotateCw className="w-5 h-5 opacity-70" /> 회전하기
                                    </button>
                                    <button onClick={() => setIsCropMode(!isCropMode)} className={`py-4 rounded-2xl border font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 ${isCropMode ? 'bg-[#ffb3a3] text-white border-[#ffb3a3] shadow-lg shadow-[#ffb3a3]/20' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
                                        <CropIcon className="w-5 h-5 opacity-70" /> {isCropMode ? '편집 완료' : '영역 자르기'}
                                    </button>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                        <span className="text-slate-400">배율(Zoom)</span>
                                        <span className="text-[#ffb3a3]">{Math.round(zoom * 100)}%</span>
                                    </div>
                                    <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full accent-[#ffb3a3] h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>

                            {/* Background Options */}
                            <div className="space-y-5 border-t pt-8 border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Palette className="w-3 h-3" /> 배경 설정</span>
                                <div className="flex gap-2">
                                    {['transparent', 'solid', 'blur'].map(b => (
                                        <button key={b} onClick={() => setBackgroundMode(b as any)} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${backgroundMode === b ? 'border-slate-800 text-slate-900 bg-white' : 'border-slate-50 text-slate-400 bg-slate-50 hover:bg-white'}`}>
                                            {b === 'transparent' ? '투명' : b === 'solid' ? '색상' : '블러'}
                                        </button>
                                    ))}
                                </div>
                                {backgroundMode === 'solid' && (
                                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        {['#ffffff', '#f8f9fc', '#ffb3a3', '#000000', '#3b82f6'].map(c => (
                                            <button key={c} onClick={() => setBackgroundColor(c)} style={{ backgroundColor: c }} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${backgroundColor === c ? 'border-slate-800 ring-2 ring-white' : 'border-slate-200'}`} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Scene Text Input */}
                            <div className="space-y-5 border-t pt-8 border-slate-100">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Type className="w-3 h-3" /> 장면 문구 수정</span>
                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                    <textarea
                                        value={textContent}
                                        onChange={(e) => setTextContent(e.target.value)}
                                        className="w-full p-4 bg-white border-none rounded-2xl text-xs font-medium resize-none h-28 focus:ring-2 focus:ring-[#ffb3a3]/20 shadow-sm"
                                        placeholder="이 장면에 들어갈 문구를 입력하세요..."
                                    />
                                    <p className="mt-3 text-[9px] font-bold text-slate-300 uppercase tracking-tight">작성하신 문구는 장면 저장 시 함께 적용됩니다.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'decorate' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-2">
                            <div className="space-y-4">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">그리기 도구</span>
                                <div className="flex flex-wrap gap-2">
                                    {['#ffb3a3', '#ff8e75', '#03C75A', '#3b82f6', '#000000', '#ffffff'].map(c => (
                                        <button key={c} onClick={() => setPenColor(c)} style={{ backgroundColor: c }} className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${penColor === c ? 'border-slate-950 ring-2 ring-slate-100' : 'border-slate-100'}`} />
                                    ))}
                                </div>
                                <input type="range" min="1" max="25" value={penWidth} onChange={(e) => setPenWidth(parseInt(e.target.value))} className="w-full accent-slate-900 h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer" />
                            </div>

                            <div className="space-y-4">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">스티커</span>
                                <div className="grid grid-cols-5 gap-2.5 max-h-[200px] overflow-y-auto pr-1">
                                    {STICKER_URLS.map((url, i) => (
                                        <button key={i} onClick={() => handleAddSticker(url)} className="aspect-square p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-100 overflow-hidden">
                                            <img src={url} alt={`sticker-${i}`} className="w-full h-full object-contain" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => setDrawings(prev => prev.slice(0, -1))} className="flex-1 py-4 bg-white border border-slate-100 rounded-2xl text-[9px] font-black uppercase text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-2">
                                    <Undo2 className="w-3.5 h-3.5" /> 한 단계 취소
                                </button>
                                <button onClick={() => { if (confirm('모든 꾸미기를 지울까요?')) { setDrawings([]); setStickers([]); } }} className="flex-1 py-4 bg-red-50 border border-red-100 rounded-2xl text-[9px] font-black uppercase text-red-500 hover:bg-red-100 flex items-center justify-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" /> 모두 지우기
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={finalizeImage} className="w-full py-6 bg-slate-900 text-white font-black rounded-3xl text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    장면 저장 및 적용
                </button>
            </aside>
        </div>
    );

    if (isInline) {
        return <div className="h-full w-full">{editorContent}</div>;
    }

    return (
        <div className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 font-['Inter',system-ui]">
            <div className="w-full h-full max-w-7xl relative">
                {editorContent}
            </div>
        </div>
    );
};
