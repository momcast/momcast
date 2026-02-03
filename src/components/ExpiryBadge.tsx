import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';

export const ExpiryBadge: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
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
