'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from './Icons';
import { useAuth } from '../context/AuthContext';

export const Header = () => {
    const { user, logout } = useAuth();
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

    if (!user) return null;

    return (
        <header className="bg-white/80 border-b border-gray-100 sticky top-0 z-40 backdrop-blur-xl shrink-0 w-full">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 lg:px-24 py-5 md:py-8 flex justify-between items-center w-full">
                <Link href="/" className="text-2xl md:text-3xl font-black tracking-tighter cursor-pointer flex items-center gap-3 group">
                    <img src="/momcast_logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover" /> MOMCAST
                </Link>
                <div className="flex items-center gap-4 md:gap-12">
                    <nav className="flex gap-4 md:gap-10">
                        <Link href="/" className={`text-[11px] font-black uppercase tracking-widest ${isActive('/') && pathname === '/' ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>홈</Link>
                        <Link href="/history" className={`text-[11px] font-black uppercase tracking-widest ${isActive('/history') ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>보관함</Link>
                        {user?.role === 'admin' && (
                            <Link href="/admin" className={`text-[11px] font-black uppercase tracking-widest ${isActive('/admin') ? 'text-[#ffb3a3] border-b-2 border-[#ffb3a3] pb-1' : 'text-gray-400'}`}>요청관리</Link>
                        )}
                    </nav>
                    <div className="flex items-center gap-3 md:gap-5 border-l pl-4 md:pl-5 border-gray-100">
                        <span className="hidden lg:block text-[10px] font-black text-gray-300 truncate max-w-[150px]">{user?.email}</span>
                        <button onClick={logout} className="text-[10px] font-black text-gray-400 border border-gray-100 px-4 md:px-6 py-2 md:py-2.5 rounded-full flex items-center gap-2 hover:bg-gray-50 transition-colors">
                            <Icons.Logout /> <span className="hidden sm:inline">로그아웃</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};
