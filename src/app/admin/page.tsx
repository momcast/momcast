'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getAdminRequests } from '../dbService';
import { UserRequest, UserScene } from '../types';
import { Icons } from '../../components/Icons';
import { ScenePreview } from '../../components/ScenePreview';

export default function AdminPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [adminRequests, setAdminRequests] = useState<UserRequest[]>([]);

    useEffect(() => {
        if (!isLoading) {
            if (!user || user.role !== 'admin') {
                router.push('/');
                return;
            }
            getAdminRequests().then(setAdminRequests);
        }
    }, [user, isLoading, router]);

    if (isLoading || !user || user.role !== 'admin') return null;

    return (
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
                {adminRequests.map((req) => (
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
                                    <span className="text-sm font-bold text-gray-700">{req.userId}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <a href={req.videoUrl || '#'} target="_blank" rel="noreferrer" className="p-3 bg-white border border-gray-100 rounded-full text-gray-400 hover:text-gray-900 shadow-sm"><Icons.ExternalLink /></a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
