'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { getTemplates, getUserProjects, saveProject, saveTemplate, updateRequestStatus, saveUserRequest } from '../../dbService';
import { requestNaverPay } from '../../paymentService';
import { sendAdminOrderNotification } from '../../notificationService';
import { Template, UserProject, UserRequest, AdminScene, UserScene } from '../../types';
import { Icons } from '../../../components/Icons';
import { ScenePreview } from '../../../components/ScenePreview';
import { SceneEditor } from '../../../components/SceneEditor';
import { VideoEngine } from '../../../components/VideoEngine';
import { getUserRequests } from '../../dbService'; // Fix import

export default function EditorPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const projectIdOrTemplateId = params?.projectId as string;
    const isTemplateMode = searchParams?.get('type') === 'template';

    const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
    const [activeProject, setActiveProject] = useState<UserProject | null>(null);
    const [editingSceneIdx, setEditingSceneIdx] = useState<number | null>(null);
    const [templateDimensions, setTemplateDimensions] = useState({ width: 1920, height: 1080 });
    const [lottieTemplate, setLottieTemplate] = useState<any>(null);

    // Request Modal State
    const [requestModal, setRequestModal] = useState<{ type: 'draft' | 'final' | null }>({ type: null });
    const [phoneNumber, setPhoneNumber] = useState('');
    const [emailAddress, setEmailAddress] = useState('');

    // Rendering State
    const [isRendering, setIsRendering] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [renderingProgress, setRenderingProgress] = useState(0);
    const [isCloudRendering, setIsCloudRendering] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }

        if (isLoading || !projectIdOrTemplateId) return;

        const loadData = async () => {
            try {
                if (isTemplateMode) { // Creating new project from template or Admin editing template
                    const templates = await getTemplates();
                    const template = templates.find(t => t.id === projectIdOrTemplateId);
                    if (template) {
                        setActiveTemplate(template);
                        if (user?.role !== 'admin') {
                            // Initialize new project
                            const expiry = new Date(); expiry.setDate(expiry.getDate() + 14);
                            setActiveProject({
                                id: crypto.randomUUID(),
                                templateId: template.id,
                                userId: user!.id,
                                projectName: template.name,
                                status: 'draft',
                                created_at: new Date().toISOString(),
                                expires_at: expiry.toISOString(),
                                userScenes: template.scenes.map(s => ({
                                    id: s.id,
                                    content: s.defaultContent,
                                    rotation: 0,
                                    zoom: 1,
                                    position: { x: 0, y: 0 },
                                    backgroundMode: s.backgroundMode || 'transparent',
                                    backgroundColor: s.backgroundColor || '#ffffff',
                                    cropRect: { top: 0, right: 0, bottom: 0, left: 0 },
                                    stickers: [],
                                    drawings: [],
                                    width: s.width,
                                    height: s.height
                                }))
                            });
                        }
                    }
                } else { // Load existing project
                    const projects = await getUserProjects();
                    const project = projects.find(p => p.id === projectIdOrTemplateId);
                    if (project) {
                        const templates = await getTemplates();
                        const template = templates.find(t => t.id === project.templateId);
                        setActiveTemplate(template || null);
                        setActiveProject(project);

                        // If user is admin but viewing a project, just view it as is?
                        // Admin editing template is handled by isTemplateMode=true (passed from history)
                    }
                }
            } catch (e) {
                console.error(e);
            }
        };
        loadData();
    }, [user, isLoading, projectIdOrTemplateId, isTemplateMode, router]);


    // Load Lottie
    useEffect(() => {
        const loadLottie = async () => {
            const templateId = activeTemplate?.id || activeProject?.templateId;
            if (templateId) {
                try {
                    const res = await fetch(`/templates/${templateId}.json`);
                    if (res.ok) {
                        const data = await res.json();
                        setLottieTemplate(data);
                        if (data.w && data.h) {
                            setTemplateDimensions({ width: data.w, height: data.h });
                        }
                    }
                } catch (e) {
                    console.error("Failed to load template json", e);
                }
            }
        };
        loadLottie();
    }, [activeTemplate, activeProject]);

    const handleFinalSave = async () => {
        if (activeProject) {
            try {
                await saveProject({
                    id: activeProject.id,
                    user_id: activeProject.userId,
                    template_id: activeProject.templateId,
                    name: activeProject.projectName,
                    scenes: activeProject.userScenes,
                    expires_at: activeProject.expires_at,
                    status: activeProject.status,
                    created_at: activeProject.created_at
                });
                alert('저장되었습니다!');
                // Don't redirect, let them stay
            } catch (e) { alert('오류 발생'); }
        } else if (activeTemplate && user?.role === 'admin') {
            try {
                await saveTemplate(activeTemplate);
                alert('템플릿 저장됨');
            } catch (e) { alert('오류 발생'); }
        }
    };

    const getInheritedContent = (idx: number) => {
        // ... (Same logic as AppWrapper, simplified for brevity or copy-paste)
        /* Copying simplified logic from previous viewed implementation */
        const item = activeProject ? activeProject.userScenes[idx] : activeTemplate?.scenes[idx];
        if (!item) return "";
        const currentContent = (item as UserScene).content || (item as AdminScene).defaultContent;
        if (currentContent && currentContent.trim() !== "") return currentContent;
        return "";
    };

    if (isLoading || !user) return null;
    const isAdminMode = user.role === 'admin' && isTemplateMode;
    const scenes = activeProject ? activeProject.userScenes : activeTemplate?.scenes;

    return (
        <div className="pb-32 w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 md:mb-16 gap-6 w-full">
                <div className="flex items-center gap-4 md:gap-8">
                    <button onClick={() => router.back()} className="p-3 md:p-4 bg-white border border-gray-100 rounded-full shadow-lg hover:scale-110 transition-transform"><Icons.Close /></button>
                    <div>
                        <h2 className="text-3xl md:text-4xl font-black tracking-tight italic">{activeProject?.projectName || activeTemplate?.name}</h2>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/history')} className="px-8 py-5 bg-white border border-gray-200 text-gray-900 font-black rounded-[2rem] text-[11px] uppercase tracking-[0.1em] transition-all">보관함 이동</button>
                    <button onClick={() => setIsRendering(true)} className="px-8 py-5 bg-blue-600 text-white font-black rounded-[2rem] text-[11px] uppercase shadow-2xl tracking-[0.1em] hover:bg-blue-500 transition-all">비디오 미리보기</button>
                    <button onClick={handleFinalSave} className="px-12 py-5 bg-[#03C75A] text-white font-black rounded-[2rem] text-[11px] uppercase shadow-2xl tracking-[0.3em] hover:brightness-105 transition-all">전체 저장</button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
                {scenes?.map((item: any, idx: number) => (
                    <div key={idx} onClick={() => setEditingSceneIdx(idx)} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 hover:shadow-2xl transition-all cursor-pointer group relative shadow-sm w-full">
                        <div
                            className="relative bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-50"
                            style={{ aspectRatio: `${item.width || templateDimensions.width} / ${item.height || templateDimensions.height}` }}
                        >
                            <ScenePreview
                                scene={{ ...item, content: getInheritedContent(idx) }}
                                adminConfig={isAdminMode ? undefined : activeTemplate?.scenes[idx]}
                                isAdmin={isAdminMode}
                                className="group-hover:scale-105 transition-transform duration-500"
                                lottieTemplate={lottieTemplate}
                            />
                            <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500 backdrop-blur-[1px] z-[50]"><span className="bg-white px-6 py-3 rounded-full text-[9px] font-black uppercase shadow-2xl tracking-widest">장면 수정</span></div>
                        </div>
                        <div className="p-8 md:p-10">
                            <p className="text-sm font-bold text-gray-400 line-clamp-2 italic leading-relaxed text-center">
                                "{getInheritedContent(idx) || '이야기를 들려주세요...'}"
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Editor Modal */}
            {editingSceneIdx !== null && (
                <SceneEditor
                    adminScene={activeTemplate?.scenes[editingSceneIdx] || {} as AdminScene}
                    userScene={activeProject?.userScenes[editingSceneIdx] || {} as UserScene}
                    isAdminMode={isAdminMode}
                    width={templateDimensions.width}
                    height={templateDimensions.height}
                    onClose={() => setEditingSceneIdx(null)}
                    onSave={(updated) => {
                        if (activeProject) {
                            const ns = [...activeProject.userScenes];
                            ns[editingSceneIdx] = updated as UserScene;
                            setActiveProject({ ...activeProject, userScenes: ns });
                        } else if (isAdminMode && activeTemplate) {
                            const ns = [...activeTemplate.scenes];
                            ns[editingSceneIdx] = updated as AdminScene;
                            setActiveTemplate({ ...activeTemplate, scenes: ns });
                        }
                        setEditingSceneIdx(null);
                    }}
                    lottieTemplate={lottieTemplate}
                />
            )}

            {/* Video Rendering Modal (Simplified) */}
            {isRendering && lottieTemplate && (
                <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6 md:p-12">
                    <div className="w-full h-full max-w-6xl flex flex-col gap-8">
                        <header className="flex justify-between items-center text-white shrink-0">
                            <h2 className="text-3xl font-black tracking-tighter italic uppercase">VIDEO ENGINE</h2>
                            <button onClick={() => setIsRendering(false)} className="text-white">CLOSE</button>
                        </header>
                        <div className="flex-1 bg-black rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 relative">
                            <VideoEngine
                                templateData={lottieTemplate}
                                userImages={{/* Simplified: Map user images */ }}
                                userTexts={{/* Simplified: Map user texts */ }}
                                onProgress={setRenderingProgress}
                                onComplete={(blob) => setVideoUrl(URL.createObjectURL(blob))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
