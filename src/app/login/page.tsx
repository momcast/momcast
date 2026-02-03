'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithNaver } from '../authService';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && user) {
            router.push('/');
        }
    }, [user, isLoading, router]);


    if (isLoading) return null; // Or a loading spinner

    return (
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
}
