import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/useAuth.js';
import Sidebar from './Sidebar.js';
import NotificationBell from './NotificationBell.js';
import FeedbackModal from './FeedbackModal.js';
import Toast, { type ToastProps } from './Toast.js';
import type { Profile as AuthProfile } from '../types/auth.js';
import type { ErrorResponse } from '../types/apitypes.js';
import type { FeedbackType } from '../types/feedback.js';

export default function Header() {
    const { user } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userTitles, setUserTitles] = useState<string[]>([]);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);
    const closeSidebar = () => setIsSidebarOpen(false);
    const openFeedback = () => { closeSidebar(); setIsFeedbackOpen(true); };

    const submitFeedback = async ({ type, message, email }: { type: FeedbackType; message: string; email: string }) => {
        setIsSubmittingFeedback(true);
        try {
            const res = await api.post<Partial<ErrorResponse>>('/api/feedback', { type, message, email, page_url: window.location.pathname });
            if (res.error) {
                setToast({ message: `Error: ${res.error}`, type: 'error', onClose: () => setToast(null) });
            } else {
                setIsFeedbackOpen(false);
                setToast({ message: 'Thanks for the feedback!', type: 'success', onClose: () => setToast(null) });
            }
        } catch (e) {
            console.error('Feedback submission failed', e);
            setToast({ message: 'Failed to send feedback. Check your connection.', type: 'error', onClose: () => setToast(null) });
        } finally {
            setIsSubmittingFeedback(false);
        }
    };

    const isMapActive = location.pathname === '/map';
    const isDirectoryActive = location.pathname.startsWith('/directory');
    const isProfileActive = !!user && location.pathname === `/profile/${user.slug}`;
    const isAdmin = userTitles.includes('Council') || userTitles.includes('Associate');
    const isOwner = !!user && user.email === import.meta.env.VITE_OWNER_EMAIL;

    useEffect(() => {
        if (!user?.id) {
            setUserTitles([]);
            return;
        }
        api.get<AuthProfile | ErrorResponse>(`/api/profiles/${user.id}`).then(data => {
            if (!('error' in data) && data.title) {
                const parsed = typeof data.title === 'string' ? JSON.parse(data.title) : data.title;
                setUserTitles(parsed || []);
            }
        });
    }, [user]);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');

                .nav-link {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    color: #967b6a;
                    text-decoration: none;
                    letter-spacing: 0.05em;
                    transition: color 0.2s;
                    padding-bottom: 4px;
                    box-shadow: inset 0 -2px 0 0 transparent;
                }
                .nav-link:hover { color: #d8c8b8; }
                .nav-link.active {
                    color: #f0e0c8;
                    box-shadow: inset 0 -2px 0 0 #c87a30;
                }

                .nav-signup {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    padding: 7px 16px;
                    background: linear-gradient(145deg, #c87a30, #8b4a18);
                    color: #fef3e6;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    text-decoration: none;
                    transition: opacity 0.2s;
                    box-shadow: 0 2px 8px rgba(200,122,48,0.25);
                }
                .nav-signup:hover { opacity: 0.85; }

                .nav-feedback-btn {
                    appearance: none;
                    background: none;
                    border: none;
                    margin: 0;
                    padding-top: 0;
                    padding-left: 0;
                    padding-right: 0;
                    text-rendering: inherit;
                    cursor: pointer;
                }

                /* --- RESPONSIVE MENU --- */
                .desktop-menu {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .hamburger-btn {
                    display: none;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    color: #f0e0c8;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    transition: background 0.2s;
                }
                .hamburger-btn:hover { background: rgba(240,224,200,0.08); }

                /* --- THE BREAKPOINT --- */
                @media (max-width: 768px) {
                    .desktop-menu { display: none !important; }
                    .hamburger-btn { display: flex; }
                }
            `}</style>

            <nav style={{
                // Height comes from --header-h so the shell's reserved dead
                // zone and the bar itself can never drift apart; the inset
                // padding keeps the row's contents clear of a notch.
                height: 'var(--header-h)',
                paddingTop: 'env(safe-area-inset-top, 0px)',
                position: 'fixed',
                top: 0, left: 0, right: 0,
                background: 'rgba(15,13,11,0.9)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #1e1a16',
                zIndex: 50, paddingLeft: '24px', paddingRight: '24px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                {/* Left Side: Logo & Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                        src="/person_only-32.png"
                        alt="Palabatu"
                        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                    />
                    <Link to="/" style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '20px', fontWeight: 900,
                        color: '#f0e0c8', textDecoration: 'none',
                        letterSpacing: '0.02em'
                    }}>palabatu</Link>
                </div>

                {/* Middle/Right Side: DESKTOP MENU */}
                <div className="desktop-menu" style={{ gap: '32px' }}>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <Link to="/map" className={`nav-link ${isMapActive ? 'active' : ''}`}>Map</Link>
                        <Link to="/directory" className={`nav-link ${isDirectoryActive ? 'active' : ''}`}>Directory</Link>
                        <button className="nav-link nav-feedback-btn" onClick={openFeedback}>Feedback</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid #2a2420', paddingLeft: '16px' }}>
                        {!user ? (
                            <>
                                <Link to="/login" className="nav-link">Login</Link>
                                <Link to="/signup" className="nav-signup">Sign Up</Link>
                            </>
                        ) : (
                            <>
                                {isAdmin && <Link to="/admin/reports" className="nav-link">Reports</Link>}
                                {isAdmin && <Link to="/admin/merge-requests" className="nav-link">Merges</Link>}
                                {isOwner && <Link to="/developer" className="nav-link">Developer</Link>}
                                <Link to={`/profile/${user.slug}`} className={`nav-link ${isProfileActive ? 'active' : ''}`}>Profile</Link>
                                <NotificationBell />
                            </>
                        )}
                    </div>
                </div>

                {/* Right Side: MOBILE HAMBURGER ICON */}
                <button className="hamburger-btn" onClick={toggleSidebar} aria-label={isSidebarOpen ? 'Close menu' : 'Open menu'}>
                    <AnimatePresence mode="wait" initial={false}>
                        {isSidebarOpen ? (
                            <motion.span
                                key="close"
                                style={{ display: 'inline-flex' }}
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <X size={22} style={{ flexShrink: 0 }} />
                            </motion.span>
                        ) : (
                            <motion.span
                                key="menu"
                                style={{ display: 'inline-flex' }}
                                initial={{ rotate: 90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: -90, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <Menu size={22} style={{ flexShrink: 0 }} />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </nav>

            <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} isAdmin={isAdmin} isOwner={isOwner} onOpenFeedback={openFeedback} />

            {toast && <Toast {...toast} />}
            {isFeedbackOpen && (
                <FeedbackModal
                    onClose={() => setIsFeedbackOpen(false)}
                    onSubmit={submitFeedback}
                    isSubmitting={isSubmittingFeedback}
                    showEmailField={!user}
                />
            )}
        </>
    );
}
