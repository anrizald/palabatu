import { createContext } from 'react';
import type { ToastProps } from '../components/Toast.js';

export type User = {
    id: string;
    email: string;
    username: string;
    slug: string;
} | null;

export type AuthContextType = {
    user: User;
    isLoading: boolean;
    toast: ToastProps | null;
    setToast: (toast: ToastProps | null) => void;
    showToast: (message: string, type?: "success" | "error") => void;
    handleLogin: (email: string, password: string) => Promise<void>;
    handleSignup: (email: string, password: string) => Promise<void>;
    handleLogout: () => void;
};

export const AuthContext = createContext<AuthContextType | null>(null);
