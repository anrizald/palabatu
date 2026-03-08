import { useState } from 'react';
import Toast from '../components/Toast.js';
import { useAuth } from '../lib/AuthContext.js';

export default function Login() {
    const { handleLogin, isLoading, toast, setToast } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="space-y-4 flex flex-col justify-center h-screen max-w-md mx-auto">
            {toast && <Toast {...toast} />}
            <h1 className="text-2xl font-bold text-center">Login</h1>

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

            <button
                onClick={() => handleLogin(email, password)}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded"
            >
                {isLoading ? 'Logging in...' : 'Login'}
            </button>
        </div>
    );
}