import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';

export default function Header() {
    const { user, handleLogout } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setIsSidebarOpen(false);

    const onLogoutClick = () => {
        closeSidebar();
        handleLogout();
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
                
                .nav-link {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    color: #8a7060;
                    text-decoration: none;
                    letter-spacing: 0.05em;
                    transition: color 0.2s;
                }
                .nav-link:hover { color: #d8c8b8; }
                
                .nav-logout {
                    font-family: 'DM Sans', sans-serif;
                    font-size: 13px;
                    color: #8a7060;
                    background: none;
                    border: none;
                    cursor: pointer;
                    letter-spacing: 0.05em;
                    transition: color 0.2s;
                    padding: 0;
                }
                .nav-logout:hover { color: #e07060; }
                
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

                /* --- NEW RESPONSIVE CLASSES --- */
                .desktop-menu {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                
                .hamburger-btn {
                    display: none;
                    background: none;
                    border: none;
                    color: #f0e0c8;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 4px;
                }

                .sidebar-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    z-index: 99;
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.3s ease;
                }
                .sidebar-overlay.open {
                    opacity: 1;
                    pointer-events: auto;
                }

                .mobile-sidebar {
                    position: fixed;
                    top: 0; right: -280px; /* Hidden off-screen to the right */
                    bottom: 0;
                    width: 250px;
                    background: #141210;
                    border-left: 1px solid #2a2420;
                    z-index: 100;
                    display: flex;
                    flex-direction: column;
                    padding: 24px;
                    transition: right 0.3s ease;
                    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
                }
                .mobile-sidebar.open {
                    right: 0; /* Slides in! */
                }

                .mobile-sidebar .nav-link, .mobile-sidebar .nav-logout {
                    font-size: 16px;
                    padding: 12px 0;
                    border-bottom: 1px solid #1e1a16;
                    text-align: left;
                }
                .mobile-sidebar .nav-signup {
                    margin-top: 12px;
                    text-align: center;
                }

                /* --- THE BREAKPOINT --- */
                @media (max-width: 768px) {
                    .desktop-menu { display: none !important; }
                    .hamburger-btn { display: block; }
                }
            `}</style>

            <nav style={{
                height: '60px', position: 'fixed',
                top: 0, left: 0, right: 0,
                background: 'rgba(15,13,11,0.9)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #1e1a16',
                zIndex: 50, padding: '0 24px',
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
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <Link to="/map" className="nav-link">Map</Link>
                        <Link to="/directory" className="nav-link">Directory</Link>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid #2a2420', paddingLeft: '16px' }}>
                        {!user ? (
                            <>
                                <Link to="/login" className="nav-link">Login</Link>
                                <Link to="/signup" className="nav-signup">Sign Up</Link>
                            </>
                        ) : (
                            <>
                                <Link to={`/profile/${user.id}`} className="nav-link">Profile</Link>
                                <button onClick={handleLogout} className="nav-logout">Logout</button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Side: MOBILE HAMBURGER ICON */}
                <button className="hamburger-btn" onClick={toggleSidebar}>
                    ☰
                </button>
            </nav>

            {/* --- MOBILE SIDEBAR DRAWER --- */}
            <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={closeSidebar} />

            <div className={`mobile-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                    <button onClick={closeSidebar} style={{ background: 'none', border: 'none', color: '#8a7060', fontSize: '28px', cursor: 'pointer' }}>
                        &times;
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Link to="/map" className="nav-link" onClick={closeSidebar}>Map</Link>
                    <Link to="/directory" className="nav-link" onClick={closeSidebar}>Directory</Link>

                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #2a2420', display: 'flex', flexDirection: 'column' }}>
                        {!user ? (
                            <>
                                <Link to="/login" className="nav-link" onClick={closeSidebar}>Login</Link>
                                <Link to="/signup" className="nav-signup" onClick={closeSidebar}>Sign Up</Link>
                            </>
                        ) : (
                            <>
                                <Link to={`/profile/${user.id}`} className="nav-link" onClick={closeSidebar}>Profile</Link>
                                <button onClick={onLogoutClick} className="nav-logout" style={{ marginTop: '12px' }}>Logout</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}