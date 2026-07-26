import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh', background: '#0f0d0b', color: '#f0e0c8',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '16px', padding: '24px', textAlign: 'center'
        }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&family=DM+Sans:wght@400&display=swap');`}</style>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '72px', fontWeight: 900, color: '#c87a30' }}>404</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '15px', color: '#8a7060' }}>
                This route doesn't lead anywhere on the wall.
            </div>
            <Link to="/" style={{
                marginTop: '8px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
                padding: '10px 20px', borderRadius: '10px',
                background: 'linear-gradient(145deg, #c87a30, #8b4a18)',
                color: '#fef3e6', textDecoration: 'none', fontWeight: 500
            }}>
                Back to base camp
            </Link>
        </div>
    );
}
