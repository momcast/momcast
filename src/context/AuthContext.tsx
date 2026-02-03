'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { onAuthStateChange, signOut as supabaseSignOut } from '../app/authService';
import { UserProfile } from '../app/types';

interface AuthContextType {
    user: UserProfile | null;
    isLoading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { data: session, status } = useSession();

    // Supabase Auth Listener
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null;

        const initSupabaseAuth = async () => {
            const { data } = onAuthStateChange((profile: UserProfile | null) => {
                if (status !== "authenticated") {
                    setUser(profile);
                    setIsLoading(false);
                }
            });
            subscription = data.subscription;
        };

        initSupabaseAuth();

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [status]);

    // NextAuth Sync
    useEffect(() => {
        if (status === "loading") return;

        if (status === "authenticated" && session?.user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const email = ((session.user as any).email || "").toLowerCase();
            const name = session.user.name || "네이버 사용자";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = (session.user as any).id || email || "naver_user";

            const isAdmin = email === 'new2jjang@empas.com';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const userData: any = {
                id: id,
                email: email,
                name: name,
                role: isAdmin ? 'admin' : 'user'
            };

            setUser(userData);
            setIsLoading(false);
        } else if (status === "unauthenticated" && !user) {
            // If Supabase also didn't find a user, we are done loading.
            // But Supabase listener handles its own setting.
            // Just ensure loading is false after checking NextAuth.
            // We might depend on Supabase listener for loading state if NextAuth is unauthenticated.
        }
    }, [session, status]);

    // Backup loading safety
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    const logout = async () => {
        await supabaseSignOut(); // This handles NextAuth signOut too internally if needed, or we call it explicitly
        // In authService.ts, signOut usually calls supabase.auth.signOut().
        // We should also clear local state.
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
