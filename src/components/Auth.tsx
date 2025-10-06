import Toast from './Toast.js'
import { useState } from 'react';
import type { ToastProps } from './Toast.js'
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState<ToastProps | null>(null);

    // callback
    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type, onClose: () => setToast(null) });
    };

    // auth
    const handleLogin = async () => {
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            showToast(error.message, "error");
        }
        else {
            showToast("Login successful");
        }
        setIsLoading(false)
    }

    const handleSignup = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                showToast(error?.message || 'Something went wrong, please try again', 'error');
                return;
            } else {
                showToast('Signup successful, check your email for confirmation');
            }

            // const userId = data?.user?.id;
            // if (!userId) throw new Error('User ID not found in signup response')

            // const { error: profileError } = await supabase.from('profiles').insert({
            //     id: userId,
            //     username: email.split('@')[0],
            //     title: [],
            //     avatar_url: '',
            //     tags: { level: '', style: [] },
            // });
            // if (profileError) {
            //     console.error('Error creating profile:', profileError);
            //     showToast('Signup successful, but failed to create profile', 'error');
            //     return;
            // }

        } catch (error) {
            showToast((error as Error)?.message || 'Something went wrong please try again', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4 flex flex-col justify-center h-screen max-w-md mx-auto">
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border p-2 w-full"
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border p-2 w-full"
            />

            <div className="space-x-2">
                <button onClick={handleLogin} disabled={isLoading} className="bg-blue-500 text-white px-4 py-2 rounded">
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
                <button onClick={handleSignup} disabled={isLoading} className="bg-green-500 text-white px-4 py-2 rounded">
                    {isLoading ? 'Signin up...' : 'Sign up'}
                </button>
            </div>
        </div>
    )
}