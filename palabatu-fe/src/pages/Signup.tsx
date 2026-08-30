import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Toast from '../components/Toast.js';
import LegalModal from '../components/LegalModal.js';
import { useAuth } from '../lib/useAuth.js';

const inputStyle = {
    background: '#1a1612', border: '1px solid #2a2420',
    borderRadius: '10px', padding: '11px 14px',
    color: '#d8c8b8', fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px', outline: 'none', width: '100%'
};

const errorTextStyle = { fontSize: '12px', color: '#c85a5a', margin: '-6px 0 0' };

const legalLinkStyle = {
    background: 'none', border: 'none', padding: 0, margin: 0,
    font: 'inherit', color: '#c87a30', cursor: 'pointer'
};

type FieldKey = 'email' | 'username' | 'password' | 'confirmPassword' | 'terms' | 'guidelines';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
    const { handleSignup, isLoading, toast } = useAuth();
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [guidelinesAccepted, setGuidelinesAccepted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [invalidField, setInvalidField] = useState<FieldKey | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [shakeNonce, setShakeNonce] = useState(0);
    const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | 'guidelines' | null>(null);

    const emailRef = useRef<HTMLInputElement>(null);
    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmPasswordRef = useRef<HTMLInputElement>(null);
    const termsRef = useRef<HTMLInputElement>(null);
    const guidelinesRef = useRef<HTMLInputElement>(null);
    const fieldRefs: Record<FieldKey, React.RefObject<HTMLInputElement | null>> = {
        email: emailRef, username: usernameRef, password: passwordRef,
        confirmPassword: confirmPasswordRef, terms: termsRef, guidelines: guidelinesRef
    };

    // Focus happens after the field remounts (its `key` changes below to
    // restart the shake animation), so it has to run post-render in an
    // effect rather than right where validation fails.
    useEffect(() => {
        if (invalidField) fieldRefs[invalidField].current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invalidField, shakeNonce]);

    const clearInvalid = (field: FieldKey) => {
        if (invalidField === field) setInvalidField(null);
    };

    // Checked in field order (top to bottom) so that when multiple fields
    // are invalid, the highest one on the form is what gets flagged.
    const getError = (): { field: FieldKey; message: string } | null => {
        if (!email.trim()) return { field: 'email', message: 'Email is required' };
        if (!emailPattern.test(email.trim())) return { field: 'email', message: 'Enter a valid email address' };
        if (!username.trim()) return { field: 'username', message: 'Username is required' };
        if (!password) return { field: 'password', message: 'Password is required' };
        if (!confirmPassword) return { field: 'confirmPassword', message: 'Please confirm your password' };
        if (password !== confirmPassword) return { field: 'confirmPassword', message: 'Passwords do not match' };
        if (!termsAccepted) return { field: 'terms', message: 'You must accept the Terms of Service and Privacy Policy' };
        if (!guidelinesAccepted) return { field: 'guidelines', message: 'You must accept the Community Guidelines' };
        return null;
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const error = getError();
        if (error) {
            setInvalidField(error.field);
            setErrorMessage(error.message);
            setShakeNonce(n => n + 1);
            return;
        }
        setInvalidField(null);
        handleSignup(email, password, username.trim(), termsAccepted, guidelinesAccepted);
    };

    const borderColor = (field: FieldKey) => invalidField === field ? '#c85a5a' : '#2a2420';
    const shakeKey = (field: FieldKey) => invalidField === field ? `${field}-${shakeNonce}` : field;
    const shakeClass = (field: FieldKey) => invalidField === field ? 'field-shake' : '';

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        @keyframes field-shake {
            10%, 90% { transform: translateX(-1px); }
            20%, 80% { transform: translateX(2px); }
            30%, 50%, 70% { transform: translateX(-4px); }
            40%, 60% { transform: translateX(4px); }
        }
        .field-shake { animation: field-shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
    `}</style>
            <div style={{
                minHeight: 'var(--content-h)', background: '#0f0d0b',
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

                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <input
                            key={shakeKey('email')}
                            ref={emailRef}
                            type="email"
                            placeholder="Email"
                            autoComplete="email"
                            className={shakeClass('email')}
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); clearInvalid('email'); }}
                            style={{ ...inputStyle, borderColor: borderColor('email') }}
                            onFocus={e => e.target.style.borderColor = '#c87a30'}
                            onBlur={e => e.target.style.borderColor = borderColor('email')}
                        />
                        {invalidField === 'email' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <input
                            key={shakeKey('username')}
                            ref={usernameRef}
                            type="text"
                            placeholder="Username"
                            autoComplete="username"
                            className={shakeClass('username')}
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); clearInvalid('username'); }}
                            style={{ ...inputStyle, borderColor: borderColor('username') }}
                            onFocus={e => e.target.style.borderColor = '#c87a30'}
                            onBlur={e => e.target.style.borderColor = borderColor('username')}
                        />
                        {invalidField === 'username' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <div key={shakeKey('password')} className={shakeClass('password')} style={{ position: 'relative', width: '100%' }}>
                            <input
                                ref={passwordRef}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); clearInvalid('password'); }}
                                style={{ ...inputStyle, padding: '11px 40px 11px 14px', borderColor: borderColor('password') }}
                                onFocus={e => e.target.style.borderColor = '#c87a30'}
                                onBlur={e => e.target.style.borderColor = borderColor('password')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', padding: '4px', cursor: 'pointer',
                                    color: '#6a5848', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} style={{ flexShrink: 0 }} /> : <Eye size={18} style={{ flexShrink: 0 }} />}
                            </button>
                        </div>
                        {invalidField === 'password' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <div key={shakeKey('confirmPassword')} className={shakeClass('confirmPassword')} style={{ position: 'relative', width: '100%' }}>
                            <input
                                ref={confirmPasswordRef}
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirm password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); clearInvalid('confirmPassword'); }}
                                style={{ ...inputStyle, padding: '11px 40px 11px 14px', borderColor: borderColor('confirmPassword') }}
                                onFocus={e => e.target.style.borderColor = '#c87a30'}
                                onBlur={e => e.target.style.borderColor = borderColor('confirmPassword')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(v => !v)}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                style={{
                                    position: 'absolute', right: '10px', top: '50%',
                                    transform: 'translateY(-50%)', background: 'none',
                                    border: 'none', padding: '4px', cursor: 'pointer',
                                    color: '#6a5848', display: 'flex', alignItems: 'center'
                                }}
                            >
                                {showConfirmPassword ? <EyeOff size={18} style={{ flexShrink: 0 }} /> : <Eye size={18} style={{ flexShrink: 0 }} />}
                            </button>
                        </div>
                        {invalidField === 'confirmPassword' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <label
                            key={shakeKey('terms')}
                            className={shakeClass('terms')}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                fontSize: '12px', color: invalidField === 'terms' ? '#c85a5a' : '#8a7860',
                                cursor: 'pointer', lineHeight: 1.4
                            }}
                        >
                            <input
                                ref={termsRef}
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={(e) => { setTermsAccepted(e.target.checked); clearInvalid('terms'); }}
                                style={{ marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
                            />
                            <span>
                                I agree to the{' '}
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDoc('terms'); }}
                                    style={legalLinkStyle}
                                >Terms of Service</button>
                                {' '}and{' '}
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDoc('privacy'); }}
                                    style={legalLinkStyle}
                                >Privacy Policy</button>
                            </span>
                        </label>
                        {invalidField === 'terms' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <label
                            key={shakeKey('guidelines')}
                            className={shakeClass('guidelines')}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '8px',
                                fontSize: '12px', color: invalidField === 'guidelines' ? '#c85a5a' : '#8a7860',
                                cursor: 'pointer', lineHeight: 1.4
                            }}
                        >
                            <input
                                ref={guidelinesRef}
                                type="checkbox"
                                checked={guidelinesAccepted}
                                onChange={(e) => { setGuidelinesAccepted(e.target.checked); clearInvalid('guidelines'); }}
                                style={{ marginTop: '2px', flexShrink: 0, cursor: 'pointer' }}
                            />
                            <span>
                                I agree to follow the{' '}
                                <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDoc('guidelines'); }}
                                    style={legalLinkStyle}
                                >Community Guidelines</button>
                            </span>
                        </label>
                        {invalidField === 'guidelines' && <p style={errorTextStyle}>{errorMessage}</p>}

                        <button
                            type="submit"
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
                    </form>
                </div>
            </div>

            {legalDoc && <LegalModal initialDoc={legalDoc} onClose={() => setLegalDoc(null)} />}
        </>
    );
}
