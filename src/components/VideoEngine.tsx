"use client";

import React, { useEffect, useRef, useState } from 'react';
import lottie, { AnimationItem } from 'lottie-web';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { Play, Pause, Film } from 'lucide-react'; // Ensure these are imported from lucide-react or defined locally

interface VideoEngineProps {
    templateData: any;
    userImages: Record<string, string>; // mapping of asset ID to object URL
    userTexts: Record<string, string>; // mapping of layer Name to string
    onProgress?: (progress: number) => void;
    onComplete?: (blob: Blob) => void;
}

export const VideoEngine: React.FC<VideoEngineProps> = ({
    templateData,
    userImages,
    userTexts,
    onProgress,
    onComplete,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<AnimationItem | null>(null);
    const ffmpegRef = useRef<FFmpeg | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isEncoding, setIsEncoding] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentProgress, setCurrentProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const loadFFmpeg = async () => {
            const ffmpeg = new FFmpeg();
            const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            ffmpegRef.current = ffmpeg;
            setIsLoaded(true);
        };

        loadFFmpeg();

        // Setup Audio
        const audio = new Audio('/images/aud_0.mp3');
        audio.loop = false;
        audioRef.current = audio;

        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (containerRef.current && templateData) {
            // 1. Deep clone template
            const modifiedTemplate = JSON.parse(JSON.stringify(templateData));

            // 2. Update image assets
            if (modifiedTemplate.assets) {
                modifiedTemplate.assets.forEach((asset: any) => {
                    if (userImages[asset.id]) {
                        asset.p = userImages[asset.id];
                        asset.u = ""; // clear path since we use blob/base64/objectURL
                    }
                });
            }

            // 3. Update text layers recursively
            const updateTexts = (layers: any[]) => {
                layers.forEach((layer: any) => {
                    // Text layer type is 5
                    if (layer.ty === 5 && userTexts[layer.nm]) {
                        if (layer.t?.d?.k?.[0]?.s) {
                            layer.t.d.k[0].s.t = userTexts[layer.nm];
                        }
                    }
                    // If it's a pre-composition (ty: 0), recurse into its asset layers
                    if (layer.ty === 0 && layer.refId) {
                        const asset = modifiedTemplate.assets?.find((a: any) => a.id === layer.refId);
                        if (asset && asset.layers) {
                            updateTexts(asset.layers);
                        }
                    }
                });
            };

            if (modifiedTemplate.layers) {
                updateTexts(modifiedTemplate.layers);
            }

            // 4. Initialize Lottie
            if (animationRef.current) {
                animationRef.current.destroy();
            }

            animationRef.current = lottie.loadAnimation({
                container: containerRef.current,
                renderer: 'canvas',
                loop: false,
                autoplay: false,
                animationData: modifiedTemplate,
                rendererSettings: {
                    context: canvasRef.current?.getContext('2d') as CanvasRenderingContext2D,
                    preserveAspectRatio: 'xMidYMid slice',
                }
            });

            animationRef.current.addEventListener('DOMLoaded', () => {
                const totalFrames = animationRef.current?.totalFrames || 0;
                const frameRate = templateData.fr || 30;
                setDuration(totalFrames / frameRate);
            });

            // Initial render
            animationRef.current.goToAndStop(0, true);

            return () => animationRef.current?.destroy();
        }
    }, [templateData, userImages, userTexts]);

    // Playback Sync
    useEffect(() => {
        let raf: number;
        const sync = () => {
            if (animationRef.current && isPlaying) {
                const anim = animationRef.current;
                const audio = audioRef.current;

                if (audio) {
                    const currentFrame = audio.currentTime * (templateData.fr || 30);
                    anim.goToAndStop(currentFrame, true);
                    setCurrentTime(audio.currentTime);

                    if (audio.ended) {
                        setIsPlaying(false);
                        anim.goToAndStop(0, true);
                        audio.currentTime = 0;
                    }
                }
                raf = requestAnimationFrame(sync);
            }
        };

        if (isPlaying) {
            audioRef.current?.play();
            raf = requestAnimationFrame(sync);
        } else {
            audioRef.current?.pause();
        }

        return () => cancelAnimationFrame(raf);
    }, [isPlaying, templateData.fr]);

    const exportVideo = async () => {
        if (!ffmpegRef.current || !animationRef.current || !canvasRef.current) return;

        setIsEncoding(true);
        const ffmpeg = ffmpegRef.current;
        const animation = animationRef.current;
        const canvas = canvasRef.current;
        const totalFrames = animation.totalFrames;

        // Clear files from previous run (Only the main output is critical to delete)
        try {
            await ffmpeg.deleteFile('output.mp4');
        } catch (e) { }

        // 1. Render Frames (Turbo Tuning: 15fps, minimal delay, direct buffer write)
        const ctx = canvas.getContext('2d');
        const frameStep = 2; // Capture every 2nd frame (15fps)
        let capturedCount = 0;

        for (let i = 0; i < totalFrames; i += frameStep) {
            if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            animation.goToAndStop(i, true);
            // Force lottie to render the frame to the canvas
            // @ts-ignore
            if (animation.renderer?.renderFrame) {
                // @ts-ignore
                animation.renderer.renderFrame(i);
            }

            // Safely wait for browser paint
            await new Promise(resolve => setTimeout(resolve, 10));
            await new Promise(resolve => requestAnimationFrame(resolve));

            const frameData = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.4) // Lower quality for speed
            );

            if (frameData) {
                const fileName = `frame_${capturedCount.toString().padStart(5, '0')}.jpg`;
                // Direct buffer write is faster than fetchFile
                const buffer = await frameData.arrayBuffer();
                await ffmpeg.writeFile(fileName, new Uint8Array(buffer));
                capturedCount++;
            }

            if (onProgress) onProgress(Math.round((i / totalFrames) * 90));
            setCurrentProgress(Math.round((i / totalFrames) * 90));
        }

        // 2. Load Audio
        const audioData = await fetchFile('/images/aud_0.mp3');
        await ffmpeg.writeFile('audio.mp3', audioData);

        // 3. Encode (Smaller 480p + Higher CRF for extreme speed)
        const outputFrameRate = (templateData.fr || 30) / frameStep;
        await ffmpeg.exec([
            '-framerate', String(outputFrameRate),
            '-i', 'frame_%05d.jpg',
            '-i', 'audio.mp3',
            '-vf', 'scale=480:-2', // Further downscale to 480p width
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '35', // Significant speed boost by reducing encoding density
            '-map', '0:v:0',
            '-map', '1:a:0',
            '-shortest',
            '-pix_fmt', 'yuv420p',
            '-y',
            'output.mp4'
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data as any], { type: 'video/mp4' });

        if (onComplete) onComplete(blob);
        setIsEncoding(false);
    };

    const togglePlay = () => setIsPlaying(!isPlaying);
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (audioRef.current) audioRef.current.currentTime = val;
        if (animationRef.current) animationRef.current.goToAndStop(val * (templateData.fr || 30), true);
        setCurrentTime(val);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800/50 group flex flex-col items-center justify-center">
            <div ref={containerRef} className="hidden" />
            <canvas
                ref={canvasRef}
                width={templateData?.w || 1920}
                height={templateData?.h || 1080}
                className="w-full h-full object-contain"
            />

            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">
                    Engine Initializing...
                </div>
            )}

            {/* Play/Pause Overlay */}
            {isLoaded && !isEncoding && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button
                        onClick={togglePlay}
                        className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/20 hover:scale-110 active:scale-95 transition-all shadow-2xl"
                    >
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                    </button>
                </div>
            )}

            {/* Bottom Player Bar */}
            {isLoaded && !isEncoding && (
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="flex flex-col gap-4">
                        <input
                            type="range"
                            min="0"
                            max={duration || 0.1}
                            step="0.01"
                            value={currentTime}
                            onChange={handleSeek}
                            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500 overflow-hidden"
                        />
                        <div className="flex justify-between items-center text-white/50 font-black text-[10px] uppercase tracking-widest">
                            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                            <button
                                onClick={exportVideo}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[9px] flex items-center gap-2 shadow-xl shadow-blue-600/20"
                            >
                                <Film className="w-3 h-3" />
                                Fast Draft Export
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isEncoding && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-white p-12 backdrop-blur-xl">
                    <div className="text-2xl font-black mb-6 tracking-tighter uppercase italic text-blue-400">Exporting Draft</div>
                    <div className="w-full max-w-md bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full transition-all duration-300 shadow-[0_0_20px_rgba(59,130,246,0.5)]" style={{ width: `${currentProgress}%` }}></div>
                    </div>
                    <div className="mt-4 text-[10px] font-bold text-slate-500 tracking-[0.2em]">{currentProgress}% COMPLETE</div>
                    <p className="mt-8 text-[9px] font-medium text-slate-500 max-w-xs text-center leading-relaxed">Fast Draft mode: Reducing resolution and quality for quick preview generation.</p>
                </div>
            )}
        </div>
    );
};
