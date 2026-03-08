import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import type { ToastProps } from '../components/Toast.js';

type User = {
    id: string;
    email: string;
    username: string;
} | null;

type AuthContextType = {
    user: User;
    isLoading: boolean;
    toast: ToastProps | null;
    setToast: (toast: ToastProps | null) => void;
    showToast: (message: string, type?: "success" | "error") => void;
    handleLogin: (email: string, password: string) => Promise<void>;
    handleSignup: (email: string, password: string, username: string) => Promise<void>;
    handleLogout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get('/auth/session').then(data => {
            if (data?.user) setUser(data.user);
            else localStorage.removeItem('token');
        });
    }, []);

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type, onClose: () => setToast(null) });
    };

    const handleLogin = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await api.post('/auth/signin', { email, password });
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                showToast('Login successful');
                navigate('/map');
            }
        } catch {
            showToast('Something went wrong', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (email: string, password: string, username: string) => {
        setIsLoading(true);
        try {
            const data = await api.post('/auth/signup', { email, password, username });
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                showToast('Signup successful');
                navigate('/map');
            }
        } catch {
            showToast('Something went wrong', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        showToast('Logged out successfully');
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, toast, setToast, showToast, handleLogin, handleSignup, handleLogout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
}