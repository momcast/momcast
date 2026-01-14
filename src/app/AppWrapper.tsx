'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signOut, onAuthStateChange, signInWithNaver } from './authService'
import { useSession } from "next-auth/react";
import { getTemplates, saveTemplate, deleteTemplate, saveProject, getUserProjects, saveUserRequest, getAdminRequests, updateRequestStatus, getUserRequests } from './dbService';
import { sendDraftCompletionNotification } from './notificationService';
import { uploadImage } from './firebase'
import {
  type UserProfile,
  type Sticker,
  type DrawPath,
  type AdminScene,
  type Template,
  type UserScene,
  type UserProject,
  type BaseScene,
  type UserRequest
} from './types'

const Icons = {
  Change: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Rotate: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Crop: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 00-2 2v3m0 5v3a2 2 0 01-2 2h-3m-5 0H6a2 2 0 01-2-2v-3" /></svg>,
  Close: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Admin: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Plus: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Camera: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Undo: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
  Trash: () => <svg className="w-4 h-4" pointerEvents="none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Upload: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  ExternalLink: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
};

const STICKER_COUNT = 20;
const STICKER_URLS = Array.from({ length: STICKER_COUNT }, (_, i) => `/stickers/sticker_${i}.png`);

const transparencyGridStyle = {
  backgroundImage: 'linear-gradient(45deg, #f9f9f9 25%, transparent 25%), linear-gradient(-45deg, #f9f9f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f9f9f9 75%), linear-gradient(-45deg, transparent 75%, #f9f9f9 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  backgroundColor: '#ffffff'
};

const ScenePreview: React.FC<{
  scene: BaseScene & { userImageUrl?: string; overlayUrl?: string; isEditing?: boolean };
  adminConfig?: AdminScene;
  isAdmin?: boolean;
  className?: string;
}> = ({ scene, adminConfig, isAdmin, className = "" }) => {
  const displayScene = scene;
  const overlayConfig = (!isAdmin && adminConfig) ? adminConfig : (scene as AdminScene | UserScene); // fallback if it's admin scene itself

  const crop = displayScene.cropRect || { top: 0, left: 0, right: 0, bottom: 0 };
  const userImageUrl = displayScene.userImageUrl;

  const userCenterX = crop.left + (100 - crop.right - crop.left) / 2;
  const userCenterY = crop.top + (100 - crop.bottom - crop.top) / 2;

  const activeOverlay = isAdmin ? scene.overlayUrl : adminConfig?.overlayUrl;
  const oCrop = overlayConfig?.cropRect || { top: 0, left: 0, right: 0, bottom: 0 };
  const oCenterX = oCrop.left + (100 - oCrop.right - oCrop.left) / 2;
  const oCenterY = oCrop.top + (100 - oCrop.bottom - oCrop.top) / 2;

  return (
    <div
      className={`relative overflow-hidden aspect-video w-full ${className}`}
      style={displayScene.backgroundMode === 'solid' ? { backgroundColor: displayScene.backgroundColor } : (displayScene.backgroundMode === 'transparent' ? transparencyGridStyle : {})}
    >
      {displayScene.backgroundMode === 'blur' && userImageUrl && (
        <div className="absolute inset-0 scale-125 blur-3xl opacity-30 grayscale pointer-events-none" style={{ backgroundImage: `url(${userImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}

      {!isAdmin && userImageUrl && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            transform: `translate(${displayScene.position?.x || 0}%, ${displayScene.position?.y || 0}%) rotate(${displayScene.rotation || 0}deg) scale(${displayScene.zoom || 1})`,
            transformOrigin: `${userCenterX}% ${userCenterY}%`,
          }}
        >
          <img
            src={userImageUrl}
            alt="User Scene"
            className="w-full h-full object-contain pointer-events-none"
            style={{ clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` }}
          />
        </div>
      )}

      {activeOverlay && (
        <div
          className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-100"
          style={{
            transform: `translate(${overlayConfig?.position?.x || 0}%, ${overlayConfig?.position?.y || 0}%) rotate(${overlayConfig?.rotation || 0}deg) scale(${overlayConfig?.zoom || 1})`,
            transformOrigin: `${oCenterX}% ${oCenterY}%`,
            clipPath: `inset(${oCrop.top}% ${oCrop.right}% ${oCrop.bottom}% ${oCrop.left}%)`
          }}
        >
          <img src={activeOverlay} alt="Overlay" className="w-full h-full object-contain pointer-events-none" />
        </div>
      )}

      <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        {(displayScene.drawings || []).map((d: DrawPath) => (
          <polyline key={d.id} points={d.points.map((pt: { x: number, y: number }) => `${pt.x},${pt.y}`).join(' ')} fill="none" stroke={d.color} strokeWidth={d.width / 15} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {(displayScene.stickers || []).map((s: Sticker) => (
          // We only render simplified view here. For editing, the overlay is handled in parent or we inject handlers?
          // Actually, ScenePreview is shared. We need to pass down interaction handlers or keep it read-only.
          // IF isAdmin/Editor mode, we might want to handle it differently.
          // But ScenePreview acts as a "dumb" renderer in dashboard.
          // For the Editor, we might need to overlay controls ON TOP of ScenePreview?
          // OR: We pass a prop "renderStickers={false}" to ScenePreview and render them manually in SceneEditor.
          // Let's try passing custom renderer or just not rendering them in preview if in edit mode.
          !scene.isEditing ? (
            <div
              key={s.id}
              className="absolute pointer-events-none"
              style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
            >
              <img src={s.src} alt="Sticker" className="w-16 h-16 md:w-20 md:h-20 object-contain pointer-events-none" />
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
};

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
          transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(0deg)`, // Rotation not yet implemented fully properly
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

const ExpiryBadge: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) { setTimeLeft('만료됨'); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(`${days}일 ${hours}시간 남음`);
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-wider border border-red-100">
      <Icons.Clock /> {timeLeft}
    </div>
  );
};

const SceneEditor: React.FC<{
  adminScene: AdminScene;
  userScene: UserScene;
  isAdminMode: boolean;
  onClose: () => void;
  onSave: (updatedScene: AdminScene | UserScene) => void;
}> = ({ adminScene, userScene, isAdminMode, onClose, onSave }) => {
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
      // 독립적 권한 초기값 (없으면 기본값 true)
      ...(isAdminMode ? {
        allowUserUpload: (base as AdminScene).allowUserUpload ?? true,
        allowUserDecorate: (base as AdminScene).allowUserDecorate ?? true,
        allowUserText: (base as AdminScene).allowUserText ?? true,
      } : {})
    };
  });

  const [mode, setMode] = useState<'edit' | 'decorate' | 'camera'>('edit');
  const [isCropMode, setIsCropMode] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isUploading, setIsUploading] = useState(false);

  // 권한 체크 헬퍼
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
    // We don't necessarily exit 'decorate' mode, but we stop 'drawing' so pointer events can interact with stickers
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
  const cropImageSrc = isAdminMode ? ((currentScene as AdminScene).overlayUrl || null) : (userPhotoUrl || null);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-0 md:p-6 lg:p-10 w-screen h-screen overflow-hidden">
      <div className="bg-white w-full h-full md:h-[90vh] max-w-[1600px] md:rounded-[3rem] shadow-2xl flex flex-col md:flex-row overflow-hidden relative">
        <div className="h-[45vh] md:h-full md:flex-1 flex flex-col min-h-0 relative bg-[#ebebeb] shrink-0 overflow-hidden">
          <header className="flex justify-between items-center px-6 md:px-10 py-5 bg-white border-b border-gray-100 shrink-0 z-10">
            <h3 className="text-xl font-black text-gray-900 tracking-tight italic">{isAdminMode ? '템플릿 설계' : '맘캐스트'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900"><Icons.Close /></button>
          </header>

          <div className="flex-1 p-4 md:p-8 flex items-center justify-center relative overflow-hidden">
            <div
              ref={viewportRef}
              className={`w-full max-w-4xl aspect-video relative overflow-hidden bg-white shadow-2xl rounded-2xl touch-none select-none border border-gray-200 ${mode === 'decorate' && isBrushActive ? 'cursor-crosshair' : 'cursor-default'}`}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              <ScenePreview
                scene={{ ...currentScene, isEditing: true }} // Pass flag to hide static stickers relative to ScenePreview
                adminConfig={isAdminMode ? undefined : adminScene}
                isAdmin={isAdminMode}
              />

              {mode === 'camera' && (
                <div className="absolute inset-0 bg-black z-50">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4">
                    <div onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 active:scale-95 transition-transform cursor-pointer"></div>
                    <button onClick={() => { stopCamera(); setMode('edit'); }} className="px-6 py-2 bg-red-50 text-white rounded-full font-bold shadow-lg">취소</button>
                  </div>
                </div>
              )}

              {/* Render Interactive Stickers Layer */}
              <div className="absolute inset-0 z-40 overflow-hidden pointer-events-none">
                {(currentScene.stickers || []).map((s: Sticker) => (
                  <div key={s.id} className="pointer-events-auto">
                    <StickerOverlay
                      sticker={s}
                      isSelected={selectedStickerId === s.id}
                      onSelect={() => setSelectedStickerId(s.id)}
                      onDelete={() => {
                        setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, stickers: (prev.stickers || []).filter(st => st.id !== s.id) }));
                        setSelectedStickerId(null);
                      }}
                      onUpdate={(updated) => {
                        setCurrentScene((prev: AdminScene | UserScene) => ({
                          ...prev,
                          stickers: prev.stickers.map(st => st.id === s.id ? updated : st)
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>

              {isCropMode && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-2 bg-gray-100">
                  {cropImageSrc && (
                    <img src={cropImageSrc} alt="Image to crop" className="w-full h-full object-contain pointer-events-none select-none" />
                  )}
                  <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
                    <div
                      className="absolute border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                      style={{
                        top: `${crop.top}%`,
                        left: `${crop.left}%`,
                        right: `${crop.right}%`,
                        bottom: `${crop.bottom}%`
                      }}
                    >
                      {['topleft', 'topright', 'bottomleft', 'bottomright'].map(dir => (
                        <div key={dir} onPointerDown={(e) => handleCropDrag(e, dir)} className={`absolute ${dir.includes('top') ? 'top-0' : 'bottom-0'} ${dir.includes('left') ? 'left-0' : 'right-0'} w-12 h-12 pointer-events-auto cursor-pointer flex items-center justify-center -m-6`}>
                          <div className="w-6 h-6 border-4 border-[#ffb3a3] bg-white rounded-full shadow-xl" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-[100] backdrop-blur-sm"><span className="animate-pulse font-black text-xs uppercase tracking-widest text-[#ffb3a3]">사진 처리 중...</span></div>}
            </div>
          </div>
        </div>

        <aside className="flex-1 md:w-[420px] bg-white border-l border-gray-100 flex flex-col min-h-0 shrink-0 relative overflow-hidden">
          <div className="flex bg-gray-100 p-2 m-4 md:m-6 rounded-2xl shadow-inner border border-gray-50 shrink-0">
            <button
              onClick={() => { setMode('edit'); setIsCropMode(false); }}
              className={`flex-1 py-3 md:py-3.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'edit' && !isCropMode ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400'}`}
            >
              사진 편집
            </button>
            {(isAdminMode || canDecorate) && (
              <button
                onClick={() => {
                  setMode('decorate');
                  setIsCropMode(false);
                }}
                className={`flex-1 py-3 md:py-3.5 rounded-xl text-[10px] font-black uppercase transition-all ${mode === 'decorate' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400'}`}
              >
                꾸미기
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-8 pb-32">
            {mode === 'edit' && (
              <div className="space-y-8">
                {canUpload && (
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => fileInputRef.current?.click()} className="py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                      <Icons.Change /> {isAdminMode ? '오버레이 교체' : '사진 교체'}
                    </button>
                    <button onClick={startCamera} className="py-4 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><Icons.Camera /> 카메라</button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                {canUpload && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">배경 모드</span>
                    <div className="flex gap-2">
                      {['transparent', 'solid', 'blur'].map(b => (
                        <button key={b} onClick={() => setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, backgroundMode: b as 'transparent' | 'solid' | 'blur' }))} className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${currentScene.backgroundMode === b ? 'border-gray-900 bg-white shadow-sm text-gray-900' : 'border-gray-50 bg-gray-50 text-gray-400 hover:bg-white'}`}>{b === 'transparent' ? '투명' : b === 'solid' ? '색상' : '블러'}</button>
                      ))}
                    </div>
                    {currentScene.backgroundMode === 'solid' && <ColorPickerRainbow currentColor={currentScene.backgroundColor} onColorChange={c => setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, backgroundColor: c }))} />}
                  </div>
                )}
                {canUpload && (
                  <div className="space-y-6 border-t pt-8 border-gray-100">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">이미지 변형</span>
                    <div className="flex gap-4">
                      <button onClick={() => setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))} className="flex-1 py-4 bg-white border border-gray-100 rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 active:bg-gray-100 transition-colors shadow-sm"><Icons.Rotate /> 회전</button>
                      <button onClick={() => setIsCropMode(!isCropMode)} className={`flex-1 py-4 border rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-sm ${isCropMode ? 'bg-[#ffb3a3] text-white border-[#ffb3a3] shadow-lg' : 'bg-white border-gray-100 hover:bg-gray-50'}`}><Icons.Crop /> {isCropMode ? '완료' : '자르기'}</button>
                    </div>
                    <div className={`space-y-4 bg-gray-50 p-6 rounded-3xl border border-gray-100 transition-opacity ${isCropMode ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex justify-between text-[9px] font-black uppercase text-gray-500"><span>확대 / 축소</span><span>{Math.round(currentScene.zoom * 100)}%</span></div>
                      <input type="range" min="0.5" max="4" step="0.1" value={currentScene.zoom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, zoom: parseFloat(e.target.value) }))} className="w-full accent-[#ffb3a3] h-2 rounded-full cursor-pointer appearance-none bg-gray-200" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'decorate' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-gray-400">브러시 설정</span>
                    {!isBrushActive && <span className="text-[8px] font-black text-red-500 uppercase animate-pulse">색상을 선택하세요</span>}
                  </div>
                  <ColorPickerRainbow currentColor={penColor} onColorChange={(c: string) => { setPenColor(c); setIsBrushActive(true); }} />
                  <div className={`flex items-center gap-5 bg-gray-50 p-6 rounded-3xl shadow-inner border border-gray-100 transition-opacity ${!isBrushActive ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between text-[9px] font-black uppercase text-gray-500"><span>두께</span><span>{penWidth}px</span></div>
                      <input type="range" min="1" max="30" value={penWidth} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPenWidth(parseInt(e.target.value))} className="w-full accent-gray-900 h-2 rounded-full cursor-pointer bg-gray-200 appearance-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <button onClick={handleUndo} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 transition-all text-gray-500 font-black text-[9px] uppercase shadow-sm"><Icons.Undo /> 되돌리기</button>
                    <button onClick={handleClearDrawings} className="flex flex-col items-center justify-center gap-1.5 py-4 bg-white border border-gray-100 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all text-gray-500 font-black text-[9px] uppercase shadow-sm"><Icons.Trash /> 전체 삭제</button>
                    <button onClick={() => setIsBrushActive(false)} className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl font-black text-[9px] uppercase transition-all shadow-md ${isBrushActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-300'}`}>완료</button>
                  </div>
                </div>
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-gray-400">스티커 팩</span>
                  <div className="grid grid-cols-6 gap-2 p-3 bg-gray-50 rounded-[2.5rem] max-h-[350px] border border-gray-100 shadow-inner overflow-y-auto custom-scrollbar">
                    {STICKER_URLS.map((url, i) => (
                      <button key={i} onClick={() => handleAddSticker(url)} className="p-2 bg-white rounded-2xl hover:scale-110 transition-all aspect-square overflow-hidden shadow-sm border border-transparent flex items-center justify-center">
                        <img src={url} alt={`Sticker ${i}`} className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isAdminMode && (
              <div className="space-y-4 border-t pt-8 border-gray-100">
                <span className="text-[10px] font-black uppercase text-[#ffb3a3] tracking-widest">유저 권한 설정 (어드민 전용)</span>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { key: 'allowUserUpload', label: '사진 업로드 허용', icon: <Icons.Change /> },
                    { key: 'allowUserDecorate', label: '꾸미기(스티커 등) 허용', icon: <Icons.Change /> },
                    { key: 'allowUserText', label: '문구 작성 허용', icon: <Icons.Edit /> }
                  ].map((p) => {
                    // isAdminMode일 때만 이 UI가 노출되므로 AdminScene으로 확신할 수 있음
                    const scene = currentScene as AdminScene;
                    const isAllowed = scene[p.key as keyof AdminScene] ?? true;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setCurrentScene((prev) => {
                          const adminPrev = prev as AdminScene;
                          const key = p.key as keyof AdminScene;
                          return { ...prev, [key]: !adminPrev[key] };
                        })}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isAllowed ? 'bg-white border-gray-100 text-gray-900' : 'bg-gray-50 border-transparent text-gray-400 opacity-60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="scale-75 opacity-50">{p.icon}</span>
                          <span className="text-[10px] font-black uppercase">{p.label}</span>
                        </div>
                        <div className={`w-10 h-6 rounded-full relative transition-all ${isAllowed ? 'bg-[#03C75A]' : 'bg-gray-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isAllowed ? 'left-5' : 'left-1'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(isAdminMode || canEditText) && (
              <div className="space-y-4 border-t pt-8 border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">문구작성</span>
                </div>
                <textarea
                  className="w-full p-6 bg-gray-50 border border-gray-100 rounded-3xl text-sm h-32 md:h-36 resize-none outline-none focus:ring-4 focus:ring-[#ffb3a3]/5 focus:border-[#ffb3a3] transition-all leading-relaxed shadow-inner"
                  value={isAdminMode ? (currentScene as AdminScene).defaultContent : (currentScene as UserScene).content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setCurrentScene((prev: AdminScene | UserScene) => ({ ...prev, [isAdminMode ? 'defaultContent' : 'content']: e.target.value }));
                  }}
                  placeholder="오늘의 소중한 순간을 기록해보세요..."
                />
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-50 z-20">
            <button onClick={() => onSave(currentScene)} className="w-full py-5 bg-[#03C75A] text-white font-black rounded-[2rem] text-[11px] uppercase shadow-2xl tracking-[0.3em]">장면 저장하기</button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [view, setView] = useState<'dashboard' | 'editor' | 'history' | 'admin_requests'>('dashboard');
  const [prevView, setPrevView] = useState<'dashboard' | 'editor' | 'history' | 'admin_requests'>('dashboard');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [userProjects, setUserProjects] = useState<UserProject[]>([]);
  const [adminRequests, setAdminRequests] = useState<UserRequest[]>([]);
  const [userRequests, setUserRequests] = useState<UserRequest[]>([]);

  // Request Modals State
  const [requestModal, setRequestModal] = useState<{ type: 'draft' | 'final' | null, projectId: string | null }>({ type: null, projectId: null });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  const { data: session, status } = useSession();

  // 인증 상태 리스너 (Supabase)
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((profile: UserProfile | null) => {
      // NextAuth 세션이 없을 때만 Supabase 프로필 반영
      if (profile && status !== "authenticated") {
        setUser(profile);
      }
    });
    return () => subscription.unsubscribe();
  }, [status]);

  // NextAuth 세션 동기화 (Naver 등)
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = ((session.user as any).email || "").toLowerCase();
      const name = session.user.name || "네이버 사용자";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (session.user as any).id || email || "naver_user";

      // 어드민 조건: new2jjang@empas.com 계정만 어드민으로 인정
      const isAdmin = email === 'new2jjang@empas.com';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userData: any = {
        id: id,
        email: email,
        name: name,
        role: isAdmin ? 'admin' : 'user'
      };

      setUser(userData);

      if (status === "authenticated") {
        console.log("[Auth] User logged in:", { email, isAdmin });
      }
    }
  }, [session, status]);

  // 템플릿 로드 (Supabase에서 실시간 조회)
  useEffect(() => {
    getTemplates().then(setTemplates);
  }, []);

  // 사용자 프로젝트 로드 (만료 시간 체크 및 유효성 검사)
  useEffect(() => {
    if (user) {
      getUserProjects(user.id).then(setUserProjects);
      getUserRequests(user.id).then(setUserRequests);
    } else {
      setUserProjects([]);
      setUserRequests([]);
    }
  }, [user]);

  // 어드민 요청 로드
  useEffect(() => {
    if (user?.role === 'admin' && view === 'admin_requests') {
      import('./dbService').then(service => {
        service.getAdminRequests().then(requests => setAdminRequests(requests));
      });
    }
  }, [user, view]);

  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [activeProject, setActiveProject] = useState<UserProject | null>(null);
  const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);

  const handleFinalSave = () => {
    if (activeProject) {
      saveProject({
        id: activeProject.id,
        user_id: activeProject.userId,
        template_id: activeProject.templateId,
        name: activeProject.projectName,
        scenes: activeProject.userScenes,
        expires_at: activeProject.expires_at
      }).then(() => {
        setUserProjects((prev: UserProject[]) => {
          const filtered = prev.filter((p: UserProject) => p.id !== activeProject.id);
          return [activeProject, ...filtered];
        });
      });
      setActiveProject(null);
    } else if (activeTemplate) {
      saveTemplate(activeTemplate).then(() => {
        setTemplates((prev: Template[]) => {
          const filtered = prev.filter(t => t.id !== activeTemplate.id);
          return [activeTemplate, ...filtered];
        });
      });
      setActiveTemplate(null);
    }
    setView('history');
  };

  // [명예 회복] 템플릿 삭제 및 연쇄 삭제 로직
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('정말 이 템플릿을 삭제하시겠습니까? 관련 모든 데이터가 즉시 소멸됩니다.')) return;

    try {
      // 1. Supabase 서버에서 삭제
      await deleteTemplate(id);

      // 2. 상태 갱신
      const nextTemplates = templates.filter(t => t.id !== id);
      setTemplates(nextTemplates);

      // 3. 관련 사용자 프로젝트(게시물) 즉시 파괴 (공유 템플릿 삭제 시 로컬 캐시 정리)
      if (user) {
        const nextProjects = userProjects.filter(p => p.templateId !== id);
        setUserProjects(nextProjects);
        localStorage.setItem(`momcast_projects_${user.id}`, JSON.stringify(nextProjects));
      }

      if (activeTemplate?.id === id) setActiveTemplate(null);
      console.log(`[Admin] Template ${id} permanently deleted.`);
    } catch (error) {
      alert('템플릿 삭제 중 오류가 발생했습니다.');
      console.error(error);
    }
  };

  const handleDeleteProject = (id: string) => {
    if (!user) return;
    if (!window.confirm('이 기록을 영구적으로 삭제하시겠습니까?')) return;

    const nextProjects = userProjects.filter(p => p.id !== id);
    setUserProjects(nextProjects);
    localStorage.setItem(`momcast_projects_${user.id}`, JSON.stringify(nextProjects));

    if (activeProject?.id === id) setActiveProject(null);
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
  };



  const isAdminMode = user?.role === 'admin' && !activeProject;

  if (!user) return (
    <div className="min-h-screen bg-[#f5f6f7] flex flex-col items-center pt-24 px-4 font-['Noto_Sans_KR'] w-full overflow-x-hidden">
      <div className="w-full max-w-[460px] flex flex-col items-center">
        <h1 className="text-[64px] font-black text-[#ffb3a3] mb-14 tracking-tighter italic select-none">MOMCAST</h1>
        <div className="w-full bg-white border border-[#dadada] rounded-lg shadow-xl p-12 mb-10">
          <div className="space-y-5">
            <button
              onClick={() => signInWithNaver()}
              className="w-full py-5 bg-[#03C75A] text-white font-black text-xl rounded-lg shadow-lg hover:bg-[#02b350] transition-colors flex items-center justify-center gap-3"
            >
              <span className="bg-white text-[#03C75A] px-2 py-0.5 rounded text-[10px] font-bold">N</span>
              네이버 아이디로 로그인
            </button>
          </div>
        </div>
      </div>
      <footer className="mt-auto py-12 text-[12px] text-[#8e8e8e] text-center font-medium opacity-60 w-full"><p>Copyright © MOMCAST Corp. All Rights Reserved.</p></footer>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-['Noto_Sans_KR'] text-gray-900 w-full overflow-x-hidden">
      <header className="bg-white/80 border-b border-gray-100 sticky top-0 z-40 backdrop-blur-xl shrink-0 w-full">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 lg:px-24 py-5 md:py-8 flex justify-between items-center w-full">
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter cursor-pointer flex items-center gap-3 group" onClick={() => setView('dashboard')}>
            <img src="/momcast_logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover" /> MOMCAST
          </h1>
          <div className="flex items-center gap-4 md:gap-12">
            <nav className="flex gap-4 md:gap-10">
              <button onClick={() => setView('dashboard')} className={`text-[11px] font-black uppercase tracking-widest ${view === 'dashboard' ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>홈</button>
              <button onClick={() => setView('history')} className={`text-[11px] font-black uppercase tracking-widest ${view === 'history' ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>보관함</button>
              {user?.role === 'admin' && (
                <button onClick={() => setView('admin_requests')} className={`text-[11px] font-black uppercase tracking-widest ${view === 'admin_requests' ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>요청관리</button>
              )}
            </nav>
            <div className="flex items-center gap-3 md:gap-5 border-l pl-4 md:pl-5 border-gray-100">
              <span className="hidden lg:block text-[10px] font-black text-gray-300 truncate max-w-[150px]">{user?.email}</span>
              <button onClick={handleLogout} className="text-[10px] font-black text-gray-400 border border-gray-100 px-4 md:px-6 py-2 md:py-2.5 rounded-full flex items-center gap-2 hover:bg-gray-50 transition-colors">
                <Icons.Logout /> <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-12 lg:px-24 py-10 md:py-16 relative">
        {view === 'dashboard' && (
          <div className="w-full">
            {user.role === 'admin' ? (
              <div className="flex flex-col items-center justify-center py-20 md:py-32 space-y-12 animate-in fade-in slide-in-from-bottom-8">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-gray-900 leading-none">Create Your<br />Masterpiece.</h2>
                  <p className="text-gray-400 font-medium md:text-xl">새로운 추억의 틀, 템플릿을 지금 바로 설계해보세요.</p>
                </div>
                <button
                  onClick={() => {
                    setActiveTemplate({ id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, name: "새 템플릿", sceneCount: 0, scenes: [], created_at: new Date().toISOString() });
                    setActiveProject(null);
                    setPrevView(view);
                    setView('editor');
                  }}
                  className="bg-[#ffb3a3] text-white px-14 py-8 rounded-[3rem] font-black text-sm uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                >
                  <div className="p-3 bg-white/20 rounded-full"><Icons.Plus /></div>
                  템플릿 만들기 시작하기
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6 w-full">
                  <div className="space-y-2">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-gray-900">Archive.</h2>
                    <p className="text-gray-400 font-medium">소중한 순간들을 기록할 템플릿을 선택하세요.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col relative">
                      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => {
                        const expiry = new Date(); expiry.setDate(expiry.getDate() + 14);
                        setPrevView(view);
                        setActiveProject({
                          id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                          templateId: tmpl.id,
                          userId: user.id,
                          projectName: tmpl.name,
                          status: 'draft',
                          created_at: new Date().toISOString(),
                          expires_at: expiry.toISOString(),
                          userScenes: tmpl.scenes.map(s => ({
                            id: s.id,
                            content: s.defaultContent,
                            rotation: 0,
                            zoom: 1,
                            position: { x: 0, y: 0 },
                            backgroundMode: s.backgroundMode || 'transparent',
                            backgroundColor: s.backgroundColor || '#ffffff',
                            cropRect: { top: 0, right: 0, bottom: 0, left: 0 },
                            stickers: [],
                            drawings: []
                          }))
                        });
                        setActiveTemplate(tmpl); setView('editor');
                      }}>
                        {tmpl.scenes[0] ? (
                          <ScenePreview scene={tmpl.scenes[0]} isAdmin={true} className="scale-90 group-hover:scale-100 transition-transform duration-700" />
                        ) : (
                          <Icons.Plus />
                        )}
                      </div>
                      <div className="p-6 md:p-8 flex justify-between items-center border-t border-gray-50 bg-white">
                        <h3 className="text-lg md:text-xl font-black tracking-tight">{tmpl.name}</h3>
                      </div>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-xs italic">준비된 템플릿이 없습니다</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'history' && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            {user.role === 'admin' ? (
              <div>
                <h2 className="text-4xl md:text-5xl font-black mb-12 md:mb-16 italic tracking-tighter">템플릿 관리.</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
                  {templates.map(tmpl => (
                    <div key={tmpl.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all flex flex-col relative group">
                      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => { setActiveTemplate(tmpl); setActiveProject(null); setView('editor'); }}>
                        {tmpl.scenes[0] ? <ScenePreview scene={tmpl.scenes[0]} isAdmin={true} /> : <Icons.Change />}
                      </div>

                      <div className="p-6 border-t border-gray-50 flex flex-col gap-4 bg-white">
                        <h3 className="text-lg font-black truncate cursor-pointer" onClick={() => { setActiveTemplate(tmpl); setActiveProject(null); setView('editor'); }}>{tmpl.name}</h3>
                        {/* 관리 버튼 컨테이너: 이벤트 버블링을 여기서 원천 봉쇄 */}
                        <div className="flex gap-2 relative z-20" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setActiveTemplate(tmpl); setActiveProject(null); setView('editor'); }}
                            className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-transform"
                            type="button"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(tmpl.id)}
                            className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-transform hover:bg-red-500 hover:text-white"
                            type="button"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {templates.length === 0 && (
                    <div className="col-span-full py-32 text-center text-gray-300 font-black uppercase tracking-[0.5em] text-xs italic">등록된 템플릿이 없습니다</div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-4xl md:text-5xl font-black mb-12 md:mb-16 italic tracking-tighter">나의 기록들.</h2>
                <div className="grid gap-6 md:gap-8 w-full">
                  {userProjects.map(item => (
                    <div key={item.id} className="bg-white rounded-[2.5rem] border border-gray-100 flex flex-col sm:flex-row items-center shadow-sm hover:shadow-xl transition-all w-full relative group overflow-hidden">
                      <div
                        className="flex-1 flex flex-col sm:flex-row items-center gap-6 md:gap-10 p-6 md:p-10 cursor-pointer"
                        onClick={() => { setActiveProject(item); setActiveTemplate(templates.find(t => t.id === item.templateId) || null); setView('editor'); }}
                      >
                        <div className="w-full sm:w-56 aspect-[4/3] bg-gray-50 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-inner shrink-0 relative group-hover:scale-105 transition-transform">
                          {item.userScenes[0] && (
                            <ScenePreview
                              scene={item.userScenes[0]}
                              adminConfig={templates.find(t => t.id === item.templateId)?.scenes[0]}
                              isAdmin={false}
                            />
                          )}
                        </div>
                        <div className="flex-1 space-y-3 text-center sm:text-left">
                          <h4 className="text-2xl md:text-3xl font-black tracking-tight group-hover:text-[#ffb3a3] transition-colors">{item.projectName}</h4>
                          <div className="flex justify-center sm:justify-start"><ExpiryBadge expiresAt={item.expires_at} /></div>
                        </div>
                      </div>

                      <div className="w-full sm:w-80 p-6 md:p-8 sm:pl-0 flex flex-col gap-3 justify-center border-t sm:border-t-0 sm:border-l border-gray-100 z-20 relative bg-gray-50/10" onClick={(e) => e.stopPropagation()}>
                        {/* Row 1: Edit and Delete */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => { setPrevView(view); setActiveProject(item); setActiveTemplate(templates.find(t => t.id === item.templateId) || null); setView('editor'); }}
                            className="py-3.5 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-wider text-center shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                            type="button"
                          >
                            <Icons.Edit /> 수정
                          </button>
                          <button
                            onClick={() => handleDeleteProject(item.id)}
                            className="py-3.5 bg-white border border-red-100 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-wider text-center hover:bg-red-50 transition-colors shadow-sm active:scale-95 transform flex items-center justify-center gap-2"
                            type="button"
                          >
                            <Icons.Trash /> 삭제
                          </button>
                        </div>

                        {/* Row 2: Draft and Final Requests */}
                        <div className="flex flex-col gap-2">
                          {userRequests.find(r => r.projectId === item.id) ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">요청 상태</span>
                                <span className={`text-[10px] font-black uppercase ${userRequests.find(r => r.projectId === item.id)?.status === 'completed' ? 'text-green-500' : 'text-[#ffb3a3]'}`}>
                                  {userRequests.find(r => r.projectId === item.id)?.status === 'completed' ? '완료' : '처리 중'}
                                </span>
                              </div>
                              {userRequests.find(r => r.projectId === item.id)?.status === 'completed' && userRequests.find(r => r.projectId === item.id)?.resultUrl && (
                                <a
                                  href={userRequests.find(r => r.projectId === item.id)?.resultUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="py-3.5 bg-[#03C75A] text-white rounded-xl font-black text-[10px] uppercase tracking-wider text-center shadow-md active:scale-95 flex items-center justify-center gap-2"
                                >
                                  <Icons.ExternalLink /> 시안 확인하기
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setRequestModal({ type: 'draft', projectId: item.id })}
                                className="py-3.5 bg-white border-2 border-[#ffb3a3] text-[#ffb3a3] rounded-xl font-black text-[10px] uppercase tracking-wider text-center hover:bg-[#ffb3a3] hover:text-white transition-all shadow-sm active:scale-95"
                                type="button"
                              >
                                시안요청
                              </button>
                              <button
                                onClick={() => {
                                  const hasPaid = true;
                                  if (hasPaid) {
                                    setRequestModal({ type: 'final', projectId: item.id });
                                  } else {
                                    alert('결제 확인 부탁드립니다');
                                  }
                                }}
                                className="py-3.5 bg-[#ffb3a3] text-white rounded-xl font-black text-[10px] uppercase tracking-wider text-center shadow-md active:scale-95 hover:brightness-105 transition-all"
                                type="button"
                              >
                                최종요청
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {userProjects.length === 0 && (
                    <div className="py-32 text-center text-gray-300 font-black uppercase tracking-[0.5em] text-xs">기록된 장면이 없습니다</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'admin_requests' && (
          <div className="w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-gray-900">Incoming.</h2>
                <p className="text-gray-400 font-medium">사용자들로부터 접수된 최신 요청 목록입니다.</p>
              </div>
              <button
                onClick={() => alert('구글 드라이브 동기화 기능을 구현 중입니다.')}
                className="px-8 py-4 bg-gray-900 text-white rounded-full font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl"
              >
                <Icons.Clock /> G-Drive 동기화
              </button>
            </div>

            <div className="grid gap-6 w-full">
              {(adminRequests || []).map((req: UserRequest) => (
                <div key={req.id} className="bg-white rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start md:items-center border border-gray-100 hover:shadow-xl transition-all group shadow-sm">
                  <div className="w-full md:w-[280px] aspect-video bg-gray-50 rounded-3xl overflow-hidden shrink-0">
                    {req.userScenes && req.userScenes[0] && (
                      <ScenePreview
                        scene={req.userScenes[0] as UserScene}
                        adminConfig={undefined}
                        isAdmin={false}
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${req.type === 'draft' ? 'bg-purple-50 text-purple-500' : 'bg-green-50 text-green-500'}`}>
                        {req.type === 'draft' ? '시안 요청' : '최종 요청'}
                      </span>
                      <span className="text-[10px] font-black text-gray-300">
                        {req.createdAt ? new Date(req.createdAt).toLocaleString() : '방금 전'}
                      </span>
                    </div>
                    <h4 className="text-2xl font-black tracking-tight">{req.projectName}</h4>
                    <div className="flex flex-wrap gap-6">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase text-gray-400 block tracking-widest">연락처/메일</span>
                        <span className="text-sm font-bold text-gray-700">{req.contactInfo}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black uppercase text-gray-400 block tracking-widest">User ID</span>
                        <span className="text-sm font-bold text-gray-400">{req.userId}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {req.status !== 'completed' ? (
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer px-6 py-3 bg-[#ffb3a3] text-white rounded-full font-black text-[10px] uppercase shadow-md hover:scale-105 transition-all flex items-center gap-2">
                          <Icons.Upload /> 결과 업로드
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (!confirm('가공된 시안을 업로드하고 사용자에게 알림을 보낼까요?')) return;

                              try {
                                const url = await uploadImage(file);
                                await updateRequestStatus(req.id, 'completed', url);
                                await sendDraftCompletionNotification(req.contactInfo, req.projectName);
                                alert('시안 업로드 및 알림 전송이 완료되었습니다!');
                                // 리스트 갱신
                                getAdminRequests().then(setAdminRequests);
                              } catch (err) {
                                console.error(err);
                                alert('처리 중 오류가 발생했습니다.');
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-6 py-3 bg-gray-100 text-gray-400 rounded-full font-black text-[10px] uppercase">처리 완료</span>
                        {req.resultUrl && (
                          <a href={req.resultUrl} target="_blank" rel="noreferrer" className="p-3 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-gray-900 shadow-sm"><Icons.ExternalLink /></a>
                        )}
                      </div>
                    )}
                    <button className="p-4 bg-gray-50 text-gray-400 rounded-full hover:bg-gray-100 transition-all"><Icons.Edit /></button>
                  </div>
                </div>
              ))}
              {adminRequests.length === 0 && (
                <div className="py-32 text-center text-gray-200 font-black uppercase tracking-[0.5em] text-xs">접수된 요청이 아직 없습니다</div>
              )}
            </div>
          </div>
        )}

        {view === 'editor' && (activeTemplate || activeProject) && (
          <div className="pb-32 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 md:mb-16 gap-6 w-full">
              <div className="flex items-center gap-4 md:gap-8">
                <button onClick={() => setView(prevView)} className="p-3 md:p-4 bg-white border border-gray-100 rounded-full shadow-lg hover:scale-110 transition-transform"><Icons.Close /></button>
                {isAdminMode ? (
                  <div className="relative group">
                    <input className="text-3xl md:text-4xl font-black bg-transparent border-b-4 border-[#ffb3a3]/20 outline-none focus:border-[#ffb3a3] transition-all px-2 py-1 md:py-2 tracking-tighter italic" value={activeTemplate?.name} onChange={e => setActiveTemplate(prev => prev ? { ...prev, name: e.target.value } : null)} />
                    <span className="absolute -top-6 left-2 text-[8px] md:text-[9px] font-black uppercase text-[#ffb3a3] tracking-widest">템플릿 마스터 편집기</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight italic">{activeProject?.projectName}</h2>
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-gray-300 tracking-[0.3em]">기억을 다듬는 중</p>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <button onClick={() => setView('history')} className="px-8 py-5 bg-white border border-gray-200 text-gray-900 font-black rounded-[2rem] text-[11px] uppercase tracking-[0.1em] transition-all">보관함 이동</button>
                <button onClick={handleFinalSave} className="px-12 py-5 bg-[#03C75A] text-white font-black rounded-[2rem] text-[11px] uppercase shadow-2xl tracking-[0.3em] hover:brightness-105 transition-all">전체 저장</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
              {(activeProject ? activeProject.userScenes : activeTemplate?.scenes)?.map((item: AdminScene | UserScene, idx: number) => (
                <div key={idx} onClick={() => setEditingSceneIdx(idx)} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 hover:shadow-2xl transition-all cursor-pointer group relative shadow-sm w-full">
                  <div className="aspect-[4/3] bg-gray-50 relative flex items-center justify-center overflow-hidden border-b border-gray-50">
                    <ScenePreview
                      scene={item}
                      adminConfig={isAdminMode ? undefined : activeTemplate?.scenes[idx]}
                      isAdmin={isAdminMode}
                      className="group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500 backdrop-blur-[1px] z-[50]"><span className="bg-white px-6 py-3 rounded-full text-[9px] font-black uppercase shadow-2xl tracking-widest">장면 수정</span></div>
                  </div>
                  <div className="p-8 md:p-10"><p className="text-sm font-bold text-gray-400 line-clamp-2 italic leading-relaxed text-center">&quot;{(item as UserScene).content || (item as AdminScene).defaultContent || '이야기를 들려주세요...'}&quot;</p></div>
                </div>
              ))}
              {isAdminMode && (
                <button
                  onClick={() => setActiveTemplate(prev => prev ? {
                    ...prev,
                    scenes: [...prev.scenes, {
                      id: `sc_${Date.now()}`,
                      defaultContent: '',
                      stickers: [],
                      drawings: [],
                      position: { x: 0, y: 0 },
                      zoom: 1,
                      rotation: 0,
                      backgroundMode: 'transparent',
                      backgroundColor: '#ffffff',
                      cropRect: { top: 0, right: 0, bottom: 0, left: 0 },
                      // 장면 추가 시 기본값은 모두 허용
                      allowUserUpload: true,
                      allowUserDecorate: true,
                      allowUserText: true
                    }]
                  } : null)}
                  className="aspect-[4/3] bg-gray-50 border-4 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-300 hover:text-gray-900 transition-all group shadow-sm w-full z-10"
                >
                  <Icons.Plus />
                  <span className="text-[10px] font-black mt-3 uppercase tracking-widest">장면 추가</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {editingSceneIdx !== null && (activeTemplate || activeProject) && (
        <SceneEditor
          adminScene={activeTemplate ? activeTemplate.scenes[editingSceneIdx] : {} as AdminScene}
          userScene={activeProject ? activeProject.userScenes[editingSceneIdx] : {} as UserScene}
          isAdminMode={isAdminMode}
          onClose={() => setEditingSceneIdx(null)}
          onSave={(updated) => {
            if (activeProject) {
              const ns = [...activeProject.userScenes];
              ns[editingSceneIdx] = updated as UserScene;
              setActiveProject({ ...activeProject, userScenes: ns });
            } else if (activeTemplate) {
              const ns = [...activeTemplate.scenes];
              ns[editingSceneIdx] = updated as AdminScene;
              setActiveTemplate({ ...activeTemplate, scenes: ns });
            }
            setEditingSceneIdx(null);
          }}
        />
      )}

      {/* Request Modals */}
      {requestModal.type && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 duration-300">
            <div className="space-y-2">
              <h3 className="text-2xl font-black italic tracking-tighter">
                {requestModal.type === 'draft' ? '시안 요청하기' : '최종 파일 요청'}
              </h3>
              <p className="text-gray-400 font-medium text-sm">
                {requestModal.type === 'draft'
                  ? '시안 완료 시 알람이 전송됩니다'
                  : '작성해주신 메일로 영상 파일이 전송됩니다'}
              </p>
            </div>

            <div className="space-y-4">
              {requestModal.type === 'draft' ? (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">휴대폰 번호</span>
                  <input
                    type="tel"
                    placeholder="010-0000-0000"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#ffb3a3]/10 focus:border-[#ffb3a3] transition-all font-bold"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">이메일 주소</span>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-[#ffb3a3]/10 focus:border-[#ffb3a3] transition-all font-bold"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRequestModal({ type: null, projectId: null })}
                className="flex-1 py-4 bg-gray-100 text-gray-400 font-black rounded-2xl text-[11px] uppercase tracking-wider"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  try {
                    const project = userProjects.find(p => p.id === requestModal.projectId);
                    if (!project || !user) return;

                    await saveUserRequest({
                      project_id: project.id,
                      project_name: project.projectName,
                      user_id: user.id,
                      type: requestModal.type!,
                      contact_info: requestModal.type === 'draft' ? phoneNumber : emailAddress,
                      scenes: project.userScenes
                    });

                    alert('요청이 성공적으로 접수되었습니다!');
                    setRequestModal({ type: null, projectId: null });
                    setPhoneNumber('');
                    setEmailAddress('');
                    // 새로고침
                    getUserRequests(user.id).then(setUserRequests);
                  } catch {
                    alert('요청 중 오류가 발생했습니다.');
                  }
                }}
                className="flex-1 py-4 bg-[#03C75A] text-white font-black rounded-2xl text-[11px] uppercase tracking-wider shadow-lg shadow-[#03C75A]/20"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
