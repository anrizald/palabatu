import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.js';

export default function Header() {
    const { user, handleLogout } = useAuth();

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
                    <Link to="/" style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: '20px', fontWeight: 900,
                        color: '#f0e0c8', textDecoration: 'none',
                        letterSpacing: '0.02em'
                    }}>palabatu</Link>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <Link to="/map" className="nav-link">Map</Link>
                        <Link to="/about" className="nav-link">About</Link>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {!user ? (
                        <>
                            <Link to="/login" className="nav-link">Login</Link>
                            <Link to="/signup" className="nav-signup">Sign Up</Link>
                        </>
                    ) : (
                        <>
                            <Link to="/profile" className="nav-link">Profile</Link>
                            <button onClick={handleLogout} className="nav-logout">Logout</button>
                        </>
                    )}
                </div>
            </nav>
        </>
    );
}