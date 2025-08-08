import Toast from './Toast'
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null);

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
            }

            const userId = data?.user?.id;
            try {
                const userId = data?.user?.id
                if (!userId) throw new Error('User ID not found in signup response')
            }
            catch (error) {
                showToast(err?.message || 'Something went wrong, please try again', 'error');
            }
            // if (!userId) {
            //     showToast('Signup successful, but user not returned. Check email.', 'error'); // userId should always exist after a successful signup (inside the data object); if it's undefined, something unexpected occurred. We guard this case and alert the user, but it could indicate a bug or a malformed response (likely a bug since it passed the error validation above)
            //     return;
            // }

            const { error: profileError } = await supabase.from('profiles').insert({
                id: userId,
                username: email.split('@')[0],
                title: 'New User',
                avatar_url: '',
                tags: { level: '', style: [] },
            });
            if (profileError) {
                showToast('Signup successful, but failed to create profile', 'error');
                return;
            }

            showToast('Signup successful, check your email for confirmation');
        } catch (error) {
            showToast(error?.message || 'Something went wrong please try again', 'error');
        } finally {
            setIsLoading(false);
        }

        // const { data, error } = await supabase.auth.signUp({
        //     email,
        //     password,
        // });

        // if (error) {
        //     showToast(error.message, "error");
        //     setLoading(false);
        //     return;
        // }

        // // If signup is successful, show a success message
        // const userId = data?.user?.id;
        // if (userId) {
        //     const { error: profileError } = await supabase
        //         .from('profiles')
        //         .insert({
        //             id: userId,
        //             username: email.split('@')[0], // Use email prefix as username
        //             title: 'New User',
        //             avatar_url: '', // 
        //             tags: { level: '', style: [] } // Default tags
        //         });

        //     if (profileError) {
        //         showToast("Signup successful, but failed to create profile", "error");
        //     } else {
        //         showToast("Signup successful, check your email for confirmation");
        //     }
        // } else {
        //     showToast("Signup successful, but user not returned. Check email.", "error");
        // }

        // setLoading(false);
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