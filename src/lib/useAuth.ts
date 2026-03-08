import { useState } from 'react';
import { api } from '../lib/api.js';
import { useNavigate } from 'react-router-dom';
import type { ToastProps } from '../components/Toast.js'

export function useAuth() {
    const [isLoading, setIsLoading] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null);
    const [user, setUser] = useState<any>(() => {
        const token = localStorage.getItem('token');
        return token ? { token } : null;
    });
    const navigate = useNavigate();

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type, onClose: () => setToast(null) });
    };

    const handleLogin = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await api.post('/auth/signin', { email, password });
            if (data.error) {
                showToast(data.error, 'error')
            } else {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                showToast('Login Successful');
                navigate('/map');
            }
        } catch (err) {
            showToast('An error occurred during login', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const { data, error } = await api.post('/auth/signup', { email, password });
            if (data.error) {
                showToast(error?.message || 'Something went wrong, please try again', 'error');
            } else {
                localStorage.setItem('token', data.token);
                setUser(data.user);
                showToast('Signup successful, check your email for confirmation');
                navigate('/map');
            }
        } catch (error) {
            showToast('Something went wrong, please try again', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        showToast("Logged out successfully");
        navigate('/login');
    }

    return {
        isLoading,
        toast,
        showToast,
        setToast,
        handleLogin,
        handleSignup,
        handleLogout,
        user,
    };
}