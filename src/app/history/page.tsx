'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getTemplates, getUserProjects, deleteProject, deleteTemplate, saveTemplate } from '../dbService';
import { Template, UserProject, UserRequest, UserScene, AdminScene } from '../types';
import { Icons } from '../../components/Icons';
import { ScenePreview } from '../../components/ScenePreview';
import { ExpiryBadge } from '../../components/ExpiryBadge';
import { getUserRequests } from '../dbService';

export default function HistoryPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [userProjects, setUserProjects] = useState<UserProject[]>([]);
    const [userRequests, setUserRequests] = useState<UserRequest[]>([]);

    // Request Modal State needed? - Let's implement full logic later if needed or check if we can simplify.
    // For now, let's just list items. The original AppWrapper had request modal logic on history view.
    // We should probably bring that over.

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            if (user.role === 'admin') {
                getTemplates().then(setTemplates);
            } else {
                Promise.all([
                    getTemplates(), // Need templates for references
                    getUserProjects(),
                    getUserRequests()
                ]).then(([tmpls, projs, reqs]) => {
                    setTemplates(tmpls);
                    setUserProjects(projs);
                    setUserRequests(reqs);
                });
            }
        }
    }, [user, isLoading, router]);

    const handleDeleteProject = async (id: string) => {
        if (!confirm('이 기록을 영구적으로 삭제하시겠습니까?')) return;
        await deleteProject(id);
        setUserProjects(prev => prev.filter(p => p.id !== id));
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('정말 이 템플릿을 삭제하시겠습니까?')) return;
        await deleteTemplate(id);
        setTemplates(prev => prev.filter(t => t.id !== id));
    };

    if (isLoading || !user) return null;

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            {user.role === 'admin' ? (
                <div>
                    <h2 className="text-4xl md:text-5xl font-black mb-12 md:mb-16 italic tracking-tighter">템플릿 관리.</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
                        {templates.map(tmpl => (
                            <div key={tmpl.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all flex flex-col relative group">
                                <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => router.push(`/editor/${tmpl.id}?type=template`)}>
                                    {tmpl.scenes[0] ? <ScenePreview scene={tmpl.scenes[0]} isAdmin={true} /> : <Icons.Change />}
                                </div>

                                <div className="p-6 border-t border-gray-50 flex flex-col gap-4 bg-white">
                                    <h3 className="text-lg font-black truncate cursor-pointer" onClick={() => router.push(`/editor/${tmpl.id}?type=template`)}>{tmpl.name}</h3>
                                    <div className="flex gap-2 relative z-20" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => router.push(`/editor/${tmpl.id}?type=template`)}
                                            className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-transform"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => handleDeleteTemplate(tmpl.id)}
                                            className="px-4 py-3 bg-red-50 text-red-500 rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-transform hover:bg-red-500 hover:text-white"
                                        >
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                                    onClick={() => router.push(`/editor/${item.id}`)}
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
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => router.push(`/editor/${item.id}`)}
                                            className="py-3.5 bg-gray-900 text-white rounded-xl font-black text-[10px] uppercase tracking-wider text-center shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2"
                                        >
                                            <Icons.Edit /> 수정
                                        </button>
                                        <button
                                            onClick={() => handleDeleteProject(item.id)}
                                            className="py-3.5 bg-white border border-red-100 text-red-500 rounded-xl font-black text-[10px] uppercase tracking-wider text-center hover:bg-red-50 transition-colors shadow-sm active:scale-95 transform flex items-center justify-center gap-2"
                                        >
                                            <Icons.Trash /> 삭제
                                        </button>
                                    </div>
                                    {/* Request status logic would go here. For brevity, omitted for now but should be added back */}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
