'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getTemplates, deleteTemplate } from './dbService';
import { Template } from './types';
import { ScenePreview } from '../components/ScenePreview';
import { Icons } from '../components/Icons';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      getTemplates().then(setTemplates);
    }
  }, [user, isLoading, router]);


  const handleSync = async () => {
    if (!confirm('JSON 파일들로부터 템플릿 정보를 동기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/templates/sync', { method: 'POST' });
      if (res.ok) {
        alert('완료!');
        getTemplates().then(setTemplates);
      } else {
        alert('실패');
      }
    } catch (e) { alert('오류'); }
  }

  if (isLoading || !user) return null;

  return (
    <div className="w-full">
      <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6 w-full">
          <div className="space-y-2">
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-gray-900">{user.role === 'admin' ? 'Template Master.' : 'Archive.'}</h2>
            <p className="text-gray-400 font-medium">{user.role === 'admin' ? '템플릿 설정을 관리하고 컨텐츠를 구성하세요.' : '소중한 순간들을 기록할 템플릿을 선택하세요.'}</p>
          </div>
          {user.role === 'admin' && (
            <button onClick={handleSync} className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl">
              템플릿 동기화 (JSON)
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10 w-full">
          {templates.map(tmpl => (
            <div key={tmpl.id} className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col relative">
              <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => {
                // Create New Project Logic moved to Editor Page initialization
                // We redirect to editor with type=template query param
                router.push(`/editor/${tmpl.id}?type=template`);
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
        </div>
      </div>
    </div>
  );
}
