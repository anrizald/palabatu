import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import FooterSection from '../components/Footer.js';

const STORAGE_KEY = 'palabatu_waitlist_email';

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ComingSoon() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedEmail, setSubmittedEmail] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setSubmittedEmail(saved);
            setSubmitted(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValidEmail(email)) {
            setError('Enter a valid email address.');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            const data = await api.post('/api/waitlist', { email });
            if (data.error) {
                setError(data.error);
                return;
            }
            // Remembered locally purely so a returning visitor in this same
            // browser sees the confirmation instead of the form again --
            // the source of truth is the waitlist_subscribers table.
            localStorage.setItem(STORAGE_KEY, email);
            setSubmittedEmail(email);
            setSubmitted(true);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

                .cs-wrap {
                    min-height: 100vh;
                    min-height: 100dvh;
                    width: 100%;
                    background: #0f0d0b;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    padding: 80px 24px;
                    text-align: center;
                    box-sizing: border-box;
                    position: relative;
                    overflow: hidden;
                }
                .cs-topo { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
                .cs-content { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; max-width: 460px; width: 100%; }
                .cs-eyebrow {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 12px; font-weight: 600; color: #c87a30;
                    letter-spacing: 0.14em; text-transform: uppercase;
                    margin: 0 0 18px;
                }
                .cs-title {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(30px, 6vw, 52px);
                    font-weight: 900; color: #f0e0c8;
                    margin: 0 0 14px; letter-spacing: -0.01em;
                }
                .cs-sub {
                    font-size: 15px; color: #8a7060; line-height: 1.7;
                    font-family: 'DM Sans', sans-serif;
                    margin: 0 0 36px;
                }
                .cs-form {
                    display: flex; gap: 10px; width: 100%;
                    flex-wrap: wrap; justify-content: center;
                }
                .cs-input {
                    flex: 1; min-width: 220px;
                    padding: 13px 16px;
                    background: #141210; border: 1px solid #2a2420; border-radius: 10px;
                    color: #f0e0c8; font-size: 14px;
                    font-family: 'DM Sans', sans-serif;
                    outline: none;
                }
                .cs-input:focus { border-color: #c87a30; }
                .cs-input::placeholder { color: #6a5848; }
                .cs-btn {
                    padding: 13px 24px;
                    background: linear-gradient(145deg, #c87a30, #8b4a18);
                    color: #fef3e6; border: none; border-radius: 10px;
                    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
                    cursor: pointer;
                    box-shadow: 0 2px 16px rgba(200,122,48,0.35);
                }
                .cs-btn:hover { filter: brightness(1.08); }
                .cs-error { color: #e07060; font-size: 12.5px; margin-top: 10px; font-family: 'DM Sans', sans-serif; }

                .cs-done {
                    display: flex; flex-direction: column; align-items: center; gap: 14px;
                }
                .cs-check {
                    width: 44px; height: 44px; border-radius: 50%;
                    background: rgba(200,122,48,0.12); border: 1px solid #c87a3050;
                    display: flex; align-items: center; justify-content: center;
                    color: #c87a30;
                }
                .cs-done p { font-size: 14px; color: #8a7060; font-family: 'DM Sans', sans-serif; margin: 0; }
                .cs-done b { color: #f0e0c8; }

                @media (max-width: 480px) {
                    .cs-form { flex-direction: column; }
                    .cs-btn { width: 100%; }
                }
            `}</style>

            <div className="cs-wrap">
                <svg className="cs-topo" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <g fill="none" stroke="#f0e0c8" strokeWidth={1.1}>
                        <path opacity="0.05" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.06" transform="translate(600,400) scale(0.8) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.07" transform="translate(600,400) scale(0.6) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.08" transform="translate(600,400) scale(0.4) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                    </g>
                </svg>

                <div className="cs-content">
                    <img
                        src="/favicon_transparent.png"
                        alt="Palabatu"
                        style={{
                            width: '72px', height: '72px', objectFit: 'contain',
                            marginBottom: '20px',
                            filter: 'drop-shadow(0 4px 8px rgba(200,122,48,0.4))'
                        }}
                    />
                    <p className="cs-eyebrow">Coming soon</p>
                    <h1 className="cs-title">kuat, pinter, boleh</h1>
                    <p className="cs-sub">
                        Palabatu — Indonesia's bouldering map — is under construction.
                        Leave your email and we'll let you know the moment it opens.
                    </p>

                    {submitted ? (
                        <div className="cs-done">
                            <div className="cs-check">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <p>You're on the list — we'll email <b>{submittedEmail}</b> when we launch.</p>
                        </div>
                    ) : (
                        <>
                            <form className="cs-form" onSubmit={handleSubmit} noValidate>
                                <input
                                    type="email"
                                    className="cs-input"
                                    placeholder="you@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    aria-label="Email address"
                                />
                                <button type="submit" className="cs-btn" disabled={submitting} style={{ opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                                    {submitting ? 'Joining...' : 'Join the waitlist'}
                                </button>
                            </form>
                            {error && <p className="cs-error">{error}</p>}
                        </>
                    )}
                </div>
            </div>

            <FooterSection />
        </>
    );
}
