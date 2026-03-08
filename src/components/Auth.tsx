import Toast from './Toast.js'
import { useState } from 'react';
import type { ToastProps } from './Toast.js'
import { api } from '../lib/api.js';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';

export default function Auth() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null);
    const navigate = useNavigate();
    // const [error, setError] = useState(null)

    // callback
    const showToast = (message: string, type: "success" | "error" = "success") => {
        setToast({ message, type, onClose: () => setToast(null) });
    };

    // auth
    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const data = await api.post('/auth/signin', { email, password });
            if (data.error) {
                showToast(data.error, 'error')
            } else {
                localStorage.setItem('token', data.token);
                showToast('Login Successful');
                navigate('/');
            }
        } catch (err) {
            showToast('An error occurred during login', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.post('/auth/signup', { email, password, username });
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                localStorage.setItem('token', data.token);
                showToast('Signup successful, check your email for confirmation');
                navigate('/');
            }
        } catch (error) {
            showToast('Something went wrong, please try again', 'error');
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