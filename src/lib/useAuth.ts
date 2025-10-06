import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';
import type { ToastProps } from '../components/Toast.js'

export function useAuth() {
    const [isLoading, setIsLoading] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type, onClose: () => setToast(null) });
    };

    useEffect(() => {

        // check initial session
        supabase.auth.getSession().then(({ data }) => {
            setUser(data?.session?.user ?? null);
        });

        // listen for auth state changes
        const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => {
            subscription?.subscription.unsubscribe();
        };
    }, []);

    const handleLogin = async (email: string, password: string) => {
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            showToast(error.message, "error");
        }
        else {
            showToast("Login successful");
            navigate('/map'); // Redirect to map page
        }
        setIsLoading(false)
    };

    const handleSignup = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                showToast(error?.message || 'Something went wrong, please try again', 'error');
                return;
            }
            showToast('Signup successful, check your email for confirmation');
            navigate('/login'); // Redirect to login page

            // Optionally create a profile in the 'profiles' table
        } catch (error) {
            showToast((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
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