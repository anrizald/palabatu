import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Toast from './Toast'

export default function Auth() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null);

    // auth
    const handleLogin = async () => {
        setLoading(true);
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
        setLoading(false)
    }

    const handleSignup = async () => {
        setLoading(true);

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            showToast(error.message, "error");
            setLoading(false);
            return;
        }

        // If signup is successful, show a success message
        const userId = data?.user?.id;
        if (userId) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: userId,
                    username: email.split('@')[0], // Use email prefix as username
                    title: 'New User',
                    avatar_url: '', // 
                    tags: { level: '', style: [] } // Default tags
                });

            if (profileError) {
                showToast("Signup successful, but failed to create profile", "error");
            } else {
                showToast("Signup successful, check your email for confirmation");
            }
        } else {
            showToast("Signup successful, but user not returned. Check email.", "error");
        }

        setLoading(false);
    };

    // callback
    const showToast = (message, type = "success") => {
        setToast({ message, type });
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
                <button onClick={handleLogin} disabled={loading} className="bg-blue-500 text-white px-4 py-2 rounded">
                    {loading ? 'Logging in...' : 'Login'}
                </button>
                <button onClick={handleSignup} disabled={loading} className="bg-green-500 text-white px-4 py-2 rounded">
                    {loading ? 'Signin up...' : 'Sign up'}
                </button>
            </div>
        </div>
    )
}