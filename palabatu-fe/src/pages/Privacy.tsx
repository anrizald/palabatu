const sectionStyle = { marginTop: '28px' };
const headingStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: 500,
    color: '#f0e0c8', marginBottom: '8px'
};
const bodyStyle = { fontSize: '14px', color: '#8a7060', lineHeight: 1.7 };

export default function Privacy() {
    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
    `}</style>
            <div style={{
                background: '#0f0d0b', fontFamily: "'DM Sans', sans-serif",
                padding: '80px 24px', display: 'flex', justifyContent: 'center'
            }}>
                <div style={{ width: '100%', maxWidth: '640px' }}>
                    <p style={{
                        fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: '#c87a30', fontWeight: 500, marginBottom: '10px'
                    }}>Draft — not yet reviewed or final</p>
                    <h1 style={{
                        fontFamily: "'Playfair Display', serif", fontSize: '32px',
                        fontWeight: 900, color: '#f0e0c8', marginBottom: '8px'
                    }}>Privacy Policy</h1>
                    <p style={{ fontSize: '13px', color: '#6a5848', marginBottom: '4px' }}>
                        This page is a placeholder. Palabatu is still in development and this text has
                        not been reviewed by a lawyer — treat it as a stub describing, roughly, what
                        data the app actually stores today, to be replaced with a properly drafted
                        policy (consistent with Indonesia's UU PDP) before public launch.
                    </p>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>What we collect</h2>
                        <p style={bodyStyle}>
                            Account: email, a hashed password, and username. Profile (optional, set
                            by you after signup): avatar photo, bio, location text, and climbing
                            level/style tags. Activity: problems/routes you add, sends you log,
                            comments you post, and topo annotations you draw on problem photos. We
                            also record the date you accepted these terms.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>How it's used</h2>
                        <p style={bodyStyle}>
                            To run the app: authenticating you, displaying your profile and activity
                            to other climbers, sending account emails (verification, password reset),
                            and hosting photos you upload (via Cloudinary). We don't sell your data or
                            share it with advertisers.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>What's public</h2>
                        <p style={bodyStyle}>
                            Your username, avatar, bio, location text, climbing tags, and activity
                            (problems added, sends, comments) are visible to other users on your
                            profile page. Your email and password are never shown to other users.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>Your controls</h2>
                        <p style={bodyStyle}>
                            You can edit or clear your profile fields at any time, and permanently
                            delete your account (with password confirmation) from account settings —
                            this removes your profile and personal data; problems you added stay on
                            the map for the community but are no longer attributed to you.
                        </p>
                    </div>

                    <p style={{ fontSize: '12px', color: '#4a3c30', marginTop: '32px' }}>
                        See also the <a href="/terms" style={{ color: '#c87a30', textDecoration: 'none' }}>Terms of Service</a>.
                    </p>
                </div>
            </div>
        </>
    );
}
