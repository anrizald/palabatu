import { useState } from 'react';
import Toast from '../components/Toast.js';
import { useAuth } from '../lib/AuthContext.js';

export default function Signup() {
    const { handleSignup, isLoading, toast, setToast } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
    `}</style>
            <div style={{
                minHeight: '100vh', background: '#0f0d0b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'DM Sans', sans-serif", padding: '24px'
            }}>
                {toast && <Toast {...toast} />}
                <div style={{
                    width: '100%', maxWidth: '400px',
                    background: '#141210', border: '1px solid #2a2420',
                    borderRadius: '20px', padding: '40px 32px',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.6)'
                }}>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '28px', fontWeight: 900,
                        color: '#f0e0c8', marginBottom: '8px'
                    }}>Join Palabatu</h1>
                    <p style={{ fontSize: '13px', color: '#6a5848', marginBottom: '28px' }}>
                        Create your bouldering community account
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{
                                background: '#1a1612', border: '1px solid #2a2420',
                                borderRadius: '10px', padding: '11px 14px',
                                color: '#d8c8b8', fontFamily: "'DM Sans', sans-serif",
                                fontSize: '14px', outline: 'none', width: '100%'
                            }}
                            onFocus={e => e.target.style.borderColor = '#c87a30'}
                            onBlur={e => e.target.style.borderColor = '#2a2420'}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                background: '#1a1612', border: '1px solid #2a2420',
                                borderRadius: '10px', padding: '11px 14px',
                                color: '#d8c8b8', fontFamily: "'DM Sans', sans-serif",
                                fontSize: '14px', outline: 'none', width: '100%'
                            }}
                            onFocus={e => e.target.style.borderColor = '#c87a30'}
                            onBlur={e => e.target.style.borderColor = '#2a2420'}
                        />
                        <button
                            onClick={() => handleSignup(email, password)}
                            disabled={isLoading}
                            style={{
                                background: 'linear-gradient(145deg, #c87a30, #8b4a18)',
                                border: 'none', borderRadius: '10px',
                                padding: '12px', color: '#fef3e6',
                                fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
                                fontWeight: 500, cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading ? 0.5 : 1,
                                boxShadow: '0 2px 12px rgba(200,122,48,0.3)'
                            }}
                        >{isLoading ? 'Signing up...' : 'Sign Up'}</button>

                        <p style={{ textAlign: 'center', fontSize: '13px', color: '#4a3c30', marginTop: '4px' }}>
                            Already have an account?{' '}
                            <a href="/login" style={{ color: '#c87a30', textDecoration: 'none' }}>Log in</a>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
