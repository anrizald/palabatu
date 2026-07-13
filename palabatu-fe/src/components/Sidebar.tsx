import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Map as MapIcon, Users, User, LogIn, UserPlus, LogOut, Flag, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext.js';

type SidebarProps = {
    isOpen: boolean;
    onClose: () => void;
    isAdmin?: boolean;
};

export default function Sidebar({ isOpen, onClose, isAdmin = false }: SidebarProps) {
    const { user, handleLogout } = useAuth();
    const location = useLocation();

    const isMapActive = location.pathname === '/map';
    const isDirectoryActive = location.pathname === '/directory';
    const isProfileActive = location.pathname.startsWith('/profile');

    const onLogoutClick = () => {
        onClose();
        handleLogout();
    };

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    return (
        <>
            <style>{`
                .sidebar-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 99;
                }

                .mobile-sidebar {
                    position: fixed;
                    top: 0; right: 0; bottom: 0;
                    width: min(78vw, 280px);
                    background: #141210;
                    border-left: 1px solid #2a2420;
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
                }

                .sidebar-brand-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 18px 20px;
                    border-bottom: 1px solid #1e1a16;
                }
                .sidebar-brand {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-family: 'Playfair Display', serif;
                    font-size: 18px;
                    font-weight: 900;
                    color: #f0e0c8;
                }
                .sidebar-close {
                    background: none;
                    border: none;
                    color: #8a7060;
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 8px;
                    display: flex;
                    transition: color 0.2s, background 0.2s;
                }
                .sidebar-close:hover { color: #f0e0c8; background: rgba(240,224,200,0.08); }

                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    padding: 12px;
                    gap: 2px;
                }

                .sidebar-item {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 15px;
                    color: #d8c8b8;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 13px 12px;
                    border-radius: 10px;
                    border-left: 3px solid transparent;
                    transition: background 0.2s, color 0.2s;
                }
                .sidebar-item svg { color: #8a7060; transition: color 0.2s; flex-shrink: 0; }
                .sidebar-item:hover { background: rgba(240,224,200,0.06); }
                .sidebar-item.active {
                    color: #f0e0c8;
                    background: rgba(200,122,48,0.12);
                    border-left-color: #c87a30;
                }
                .sidebar-item.active svg { color: #c87a30; }

                .sidebar-footer {
                    margin-top: auto;
                    padding: 16px 12px 24px;
                    border-top: 1px solid #1e1a16;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .sidebar-signup-btn {
                    justify-content: center;
                    margin-top: 8px;
                    background: linear-gradient(145deg, #c87a30, #8b4a18);
                    color: #fef3e6;
                    box-shadow: 0 2px 8px rgba(200,122,48,0.25);
                }
                .sidebar-signup-btn svg { color: #fef3e6; }
                .sidebar-signup-btn:hover { background: rgba(240,224,200,0.06); opacity: 0.9; }
                .sidebar-logout-btn {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 15px;
                    color: #8a7060;
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 13px 12px;
                    border-radius: 10px;
                    border-left: 3px solid transparent;
                    transition: background 0.2s, color 0.2s;
                    text-align: left;
                }
                .sidebar-logout-btn svg { color: #8a7060; transition: color 0.2s; }
                .sidebar-logout-btn:hover { background: rgba(224,112,96,0.08); color: #e07060; }
                .sidebar-logout-btn:hover svg { color: #e07060; }
            `}</style>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            className="sidebar-overlay"
                            onClick={onClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />

                        <motion.div
                            className="mobile-sidebar"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                        >
                            <div className="sidebar-brand-row">
                                <div className="sidebar-brand">
                                    <img
                                        src="/person_only-32.png"
                                        alt="Palabatu"
                                        style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                                    />
                                    palabatu
                                </div>
                                <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
                                    <X size={20} />
                                </button>
                            </div>

                            <nav className="sidebar-nav">
                                <Link to="/map" className={`sidebar-item ${isMapActive ? 'active' : ''}`} onClick={onClose}>
                                    <MapIcon size={18} /> Map
                                </Link>
                                <Link to="/directory" className={`sidebar-item ${isDirectoryActive ? 'active' : ''}`} onClick={onClose}>
                                    <Users size={18} /> Directory
                                </Link>
                                {isAdmin && (
                                    <Link to="/admin/reports" className="sidebar-item" onClick={onClose}>
                                        <Flag size={18} /> Reports
                                    </Link>
                                )}
                            </nav>

                            <div className="sidebar-footer">
                                {!user ? (
                                    <>
                                        <Link to="/login" className="sidebar-item" onClick={onClose}>
                                            <LogIn size={18} /> Login
                                        </Link>
                                        <Link to="/signup" className="sidebar-item sidebar-signup-btn" onClick={onClose}>
                                            <UserPlus size={18} /> Sign Up
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link to={`/profile/${user.id}`} className={`sidebar-item ${isProfileActive ? 'active' : ''}`} onClick={onClose}>
                                            <User size={18} /> Profile
                                        </Link>
                                        <button onClick={onLogoutClick} className="sidebar-logout-btn">
                                            <LogOut size={18} /> Logout
                                        </button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
