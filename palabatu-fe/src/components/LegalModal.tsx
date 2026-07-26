import { useState } from 'react';

const sectionStyle = { marginTop: '24px' };
const headingStyle = {
    fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: 500,
    color: '#f0e0c8', marginBottom: '8px'
};
const bodyStyle = { fontSize: '14px', color: '#8a7060', lineHeight: 1.7 };

type Doc = 'terms' | 'privacy';

type LegalModalProps = {
    initialDoc: Doc;
    onClose: () => void;
};

function TermsContent() {
    return (
        <>
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
        </>
    );
}

function PrivacyContent() {
    return (
        <>
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
        </>
    );
}

export default function LegalModal({ initialDoc, onClose }: LegalModalProps) {
    const [doc, setDoc] = useState<Doc>(initialDoc);

    const tabStyle = (active: boolean) => ({
        background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px 12px',
        fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500,
        color: active ? '#f0e0c8' : '#6a5848',
        borderBottom: active ? '2px solid #c87a30' : '2px solid transparent'
    });

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(15,13,11,0.75)',
                backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', zIndex: 10001, padding: '16px'
            }}
        >
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap');
        .legal-tab { outline: none; border-radius: 4px; }
        .legal-tab:focus-visible { outline: 2px solid #c87a30; outline-offset: 2px; }
    `}</style>
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: '600px', maxHeight: '85vh',
                    background: '#141210', border: '1px solid #2a2420',
                    borderRadius: '20px', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 40px 80px rgba(0,0,0,0.6)', fontFamily: "'DM Sans', sans-serif",
                    overflow: 'hidden'
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    padding: '20px 24px 0', flexShrink: 0
                }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="legal-tab" style={tabStyle(doc === 'terms')} onClick={() => setDoc('terms')}>
                            Terms of Service
                        </button>
                        <button className="legal-tab" style={tabStyle(doc === 'privacy')} onClick={() => setDoc('privacy')}>
                            Privacy Policy
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'none', border: 'none', color: '#6a5848',
                            fontSize: '22px', lineHeight: 1, cursor: 'pointer', padding: '2px 4px'
                        }}
                    >&times;</button>
                </div>
                <div style={{ borderBottom: '1px solid #2a2420' }} />

                <div style={{ overflowY: 'auto', padding: '20px 24px 28px' }}>
                    <p style={{
                        fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: '#c87a30', fontWeight: 500, marginBottom: '10px'
                    }}>Draft — not yet reviewed or final</p>
                    <p style={{ fontSize: '13px', color: '#6a5848', marginBottom: '4px' }}>
                        Palabatu is still in development and this text has not been reviewed by
                        a lawyer — treat every section below as a stub to be replaced before the
                        app is publicly launched, not as a binding agreement.
                    </p>

                    {doc === 'terms' ? <TermsContent /> : <PrivacyContent />}
                </div>
            </div>
        </div>
    );
}
