import { api } from '../lib/api.js';
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

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
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
    `}</style>
            <div style={{
                minHeight: '100vh', background: '#0f0d0b',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Sans', sans-serif", padding: '24px',
                textAlign: 'center'
            }}>
                <div style={{
                    background: '#141210', border: '1px solid #2a2420',
                    borderRadius: '20px', padding: '48px 40px',
                    maxWidth: '400px', width: '100%',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.6)'
                }}>
                    {status === 'loading' && (
                        <>
                            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
                            <p style={{ color: '#8a7060', fontSize: '14px' }}>Verifying your email...</p>
                        </>
                    )}
                    {status === 'success' && (
                        <>
                            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🧗</div>
                            <h2 style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '24px', fontWeight: 900,
                                color: '#f0e0c8', marginBottom: '8px'
                            }}>You're verified!</h2>
                            <p style={{ color: '#5dbb6a', fontSize: '13px' }}>Redirecting to login...</p>
                        </>
                    )}
                    {status === 'error' && (
                        <>
                            <div style={{ fontSize: '36px', marginBottom: '16px' }}>❌</div>
                            <h2 style={{
                                fontFamily: "'Playfair Display', serif",
                                fontSize: '24px', fontWeight: 900,
                                color: '#f0e0c8', marginBottom: '8px'
                            }}>Link expired</h2>
                            <p style={{ color: '#e07060', fontSize: '13px', marginBottom: '24px' }}>
                                This link is invalid or has expired.
                            </p>
                            <a href="/signup" style={{
                                padding: '10px 24px',
                                background: 'linear-gradient(145deg, #c87a30, #8b4a18)',
                                color: '#fef3e6', borderRadius: '10px',
                                textDecoration: 'none', fontSize: '13px'
                            }}>Sign up again</a>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}