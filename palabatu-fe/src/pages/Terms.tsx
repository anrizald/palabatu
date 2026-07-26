const sectionStyle = { marginTop: '28px' };
const headingStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: 500,
    color: '#f0e0c8', marginBottom: '8px'
};
const bodyStyle = { fontSize: '14px', color: '#8a7060', lineHeight: 1.7 };

export default function Terms() {
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
                    }}>Terms of Service</h1>
                    <p style={{ fontSize: '13px', color: '#6a5848', marginBottom: '4px' }}>
                        This page is a placeholder. Palabatu is still in development and this text has
                        not been reviewed by a lawyer — treat every section below as a stub to be
                        replaced before the app is publicly launched, not as a binding agreement.
                    </p>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>1. What Palabatu is</h2>
                        <p style={bodyStyle}>
                            Palabatu is a community app for Indonesian bouldering enthusiasts: an
                            interactive spot map, climber profiles, and route/problem listings. By
                            creating an account you agree to use it in good faith and not to submit
                            false, abusive, or unsafe information (e.g. deliberately wrong grades,
                            spot locations, or route safety details).
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>2. Accounts</h2>
                        <p style={bodyStyle}>
                            You're responsible for your account and the content you post under it
                            (profile info, comments, sends, problem listings, photos). You can delete
                            your account at any time from account settings; your profile is removed,
                            problems you added stay on the map for the community but are no longer
                            attributed to you.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>3. User content</h2>
                        <p style={bodyStyle}>
                            You keep ownership of what you post (photos, comments, topo annotations),
                            and grant Palabatu the right to display it within the app. Don't upload
                            content you don't have the rights to.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>4. Safety disclaimer</h2>
                        <p style={bodyStyle}>
                            Bouldering carries inherent risk. Grades, spot locations, and route/hold
                            information are community-submitted and may be inaccurate or outdated.
                            Palabatu is not responsible for injuries, access disputes, or land-use
                            issues arising from use of information on this app — always exercise your
                            own judgment and verify conditions on site.
                        </p>
                    </div>

                    <div style={sectionStyle}>
                        <h2 style={headingStyle}>5. Changes</h2>
                        <p style={bodyStyle}>
                            These terms may change as the app develops. Material changes will be
                            communicated before they take effect once Palabatu is out of active
                            development.
                        </p>
                    </div>

                    <p style={{ fontSize: '12px', color: '#4a3c30', marginTop: '32px' }}>
                        See also the <a href="/privacy" style={{ color: '#c87a30', textDecoration: 'none' }}>Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </>
    );
}
