export default function FooterSection() {
    return (
        <section style={{
            position: 'fixed', bottom: '24px',
            pointerEvents: 'none',   // allows clicks to pass through
            width: '100%',              // ← spans full width so centering works
            textAlign: 'center',        // ← centers the text within it
            fontSize: '11px', color: '#2a2420',
            fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em',
        }}>
            <p>© {new Date().getFullYear()} palabatu — WC Ass Production.</p>
            <p>Ghul Dev</p>
        </section >
    );
}