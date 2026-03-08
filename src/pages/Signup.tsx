import { useState } from 'react';
import Toast from '../components/Toast.js';
import { useAuth } from '../lib/AuthContext.js';

export default function Signup() {
    const { handleSignup, isLoading, toast, setToast } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <div className="space-y-4 flex flex-col justify-center h-screen max-w-md mx-auto">
            {toast && <Toast {...toast} />}
            <h1 className="text-2xl font-bold text-center">Sign Up</h1>

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
                onClick={() => handleSignup(email, password)}
                disabled={isLoading}
                className="bg-green-500 text-white px-4 py-2 rounded"
            >
                {isLoading ? 'Signing up...' : 'Sign Up'}
            </button>
        </div>
    );
}
