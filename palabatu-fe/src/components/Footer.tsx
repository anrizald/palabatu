export default function FooterSection() {
    return (
        <footer style={{
            // Occupies exactly the dead zone the shell reserves for it
            // (--footer-h in index.css), pinned to the very bottom rather than
            // floating 24px above it -- a fixed bar that sits at an arbitrary
            // offset can't be reserved against, which is how page content used
            // to end up underneath this.
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: 'var(--footer-h)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            // Deliberately transparent, with no background of its own: this is
            // an overlay, and the page (map tiles included) is meant to render
            // straight through behind it. The reserved --footer-h band exists
            // to keep *other UI* out of this strip, not to mask the page.
            pointerEvents: 'none',   // allows clicks to pass through
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            // Weathered Stone, the Sentence Rule's floor. This was #2a2420
            // (Cold Slate, the *border* token) at 1.27:1 -- the app's lowest
            // contrast anywhere, and on every page. The rule's own remedy for
            // copy that feels too loud at the floor is to cut it or shrink its
            // role, never to dim it below: hence the smaller 10px size here,
            // holding roughly the visual weight the dimming was reaching for.
            fontSize: '10px', color: '#967b6a',
            fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em',
        }}>
            {/* One row, not two stacked lines: the strip is permanently unusable
                space on a phone, so it stays as shallow as the type allows. */}
            <span>© {new Date().getFullYear()} palabatu</span>
            <span aria-hidden="true">·</span>
            <span>Ghul Dev</span>
        </footer>
    );
}
