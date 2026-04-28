import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        if (!token) { setStatus('error'); return; }

        api.get(`/auth/verify-email?token=${token}`)
            .then(data => {
                if (data.error) setStatus('error');
                else {
                    setStatus('success');
                    setTimeout(() => navigate('/login'), 3000);
                }
            });
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            {status === 'loading' && <p>Verifying your email...</p>}
            {status === 'success' && <p className="text-green-600">Email verified! Redirecting to login...</p>}
            {status === 'error' && <p className="text-red-600">Invalid or expired link.</p>}
        </div>
    );
}