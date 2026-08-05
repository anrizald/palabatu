import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { AuthContext } from './authContextInstance.js';
import type { User } from './authContextInstance.js';
import type { ToastProps } from '../components/Toast.js';
import type { SessionResponse, SigninResponse } from '../types/auth.js';
import type { ErrorResponse } from '../types/apitypes.js';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        api.get<Partial<SessionResponse>>('/auth/session').then(data => {
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
            const data = await api.post<SigninResponse | ErrorResponse>('/auth/signin', { email, password });
            if ('error' in data) {
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

    const handleSignup = async (email: string, password: string, username: string, termsAccepted: boolean, guidelinesAccepted: boolean) => {
        setIsLoading(true);
        try {
            const data = await api.post<Partial<ErrorResponse>>('/auth/signup', {
                email, password, username,
                terms_accepted: termsAccepted,
                guidelines_accepted: guidelinesAccepted
            });
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('Signup successful! Check your email for verification');
                navigate('/login');
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