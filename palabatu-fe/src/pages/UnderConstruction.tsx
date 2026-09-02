import FooterSection from '../components/Footer.js';

const FRAMES = [1, 2, 3, 4];

/**
 * Full-screen block shown in place of the entire app while it's being
 * reworked -- same "nothing behind it is reachable" role ComingSoon plays for
 * the pre-launch waitlist, wired the same way (see App.tsx).
 *
 * Carries the brand lockup rather than the message alone: with the Header
 * gated out, this page is the only thing saying whose site this is.
 *
 * The pickaxe swing is four PNG frames rather than a real GIF: each frame
 * holds for a quarter of the loop, driven by one shared keyframe and staggered
 * animation-delays. The ember drop-shadow is load-bearing, not decoration --
 * the pickaxe head is near-black and would otherwise disappear into the ink
 * background.
 */
export default function UnderConstruction() {
    return (
        <>
            <div className="uc-wrap">
                <style>{`
                /* The curtain IS the document while it's mounted, so it locks
                   the shell to the dynamic viewport instead of inheriting
                   index.css's html/body/#root { height: 100% }. That
                   percentage resolves against the *large* viewport on a phone
                   (the one measured with the URL bar hidden), which is taller
                   than what's actually on screen -- so the page stayed
                   scrollable by exactly that strip. Global selectors are safe
                   here because this <style> unmounts with the page. */
                html, body, #root {
                    height: 100dvh;
                    overflow: hidden;
                    overscroll-behavior: none;
                }
                .uc-wrap {
                    height: 100%;
                    width: 100%;
                    box-sizing: border-box;
                    background: #0f0d0b;
                    display: flex;
                    justify-content: center;
                    /* Bottom padding clears the fixed footer overlay, which
                       would otherwise sit on the copy on a short screen. */
                    padding: 48px 24px calc(48px + var(--footer-h));
                    position: relative;
                    /* Not overflow:hidden -- on a very short (landscape) phone
                       the block genuinely can't fit, and clipping it would put
                       the copy permanently out of reach. It scrolls inside
                       itself only in that case; the document never does. */
                    overflow: auto;
                }
                /* The contour motif carried by the Landing hero and ComingSoon.
                   Inlined rather than shared: extracting it would mean editing
                   two working pages this branch has no other reason to touch. */
                .uc-topo {
                    position: fixed;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                }
                .uc-content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    gap: clamp(12px, 3vw, 32px);
                    max-width: 820px;
                    /* Centers vertically the way align-items:center did, but
                       without pinning the top edge out of scroll reach when
                       the block is taller than the viewport. */
                    margin: auto;
                }
                /* Lockup, status, message stack as one left-aligned column
                   beside the sprite, rather than centering above it -- a
                   narrow centered lockup over a much wider row reads as two
                   unrelated blocks. */
                .uc-col {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    text-align: left;
                }
                .uc-brand {
                    display: flex;
                    align-items: center;
                    gap: clamp(8px, 1.6vw, 12px);
                    margin-bottom: 14px;
                }
                .uc-mark {
                    width: clamp(44px, 12vw, 68px);
                    height: clamp(44px, 12vw, 68px);
                    object-fit: contain;
                    flex-shrink: 0;
                    filter: drop-shadow(0 3px 8px rgba(200,122,48,0.40));
                }
                .uc-wordmark {
                    font-family: 'Playfair Display', serif;
                    font-size: clamp(20px, 5.2vw, 30px);
                    font-weight: 900;
                    letter-spacing: 0.02em;
                    color: #f0e0c8;
                }
                .uc-eyebrow {
                    margin: 0 0 14px;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 12px;
                    font-weight: 600;
                    color: #c87a30;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                }
                .uc-sprite {
                    position: relative;
                    flex: 0 0 auto;
                    width: clamp(112px, 30vw, 190px);
                    aspect-ratio: 1;
                    filter: drop-shadow(0 0 2px rgba(200,122,48,0.45)) drop-shadow(0 0 14px rgba(200,122,48,0.22));
                }
                .uc-frame {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    opacity: 0;
                    animation: uc-swing 0.72s infinite;
                }
                .uc-frame:nth-child(2) { animation-delay: 0.18s; }
                .uc-frame:nth-child(3) { animation-delay: 0.36s; }
                .uc-frame:nth-child(4) { animation-delay: 0.54s; }

                @keyframes uc-swing {
                    0%, 24.9%  { opacity: 1; }
                    25%, 100%  { opacity: 0; }
                }

                .uc-copy {
                    margin: 0;
                    font-family: 'Playfair Display', serif;
                    font-weight: 700;
                    font-size: clamp(21px, 5.4vw, 34px);
                    line-height: 1.3;
                    color: #f0e0c8;
                }

                @media (max-width: 480px) {
                    .uc-brand { margin-bottom: 10px; }
                    .uc-eyebrow { margin-bottom: 10px; font-size: 11px; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .uc-frame { animation: none; opacity: 0; }
                    .uc-frame:first-child { opacity: 1; }
                }
            `}</style>

                <svg className="uc-topo" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                    <g fill="none" stroke="#f0e0c8" strokeWidth={1.1}>
                        <path opacity="0.05" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.06" transform="translate(600,400) scale(0.8) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.07" transform="translate(600,400) scale(0.6) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.08" transform="translate(600,400) scale(0.4) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                        <path opacity="0.09" transform="translate(600,400) scale(0.22) translate(-600,-400)" d="M780,140 C920,120 1040,220 1030,340 C1020,460 900,540 770,520 C640,500 560,400 580,290 C598,192 660,155 780,140 Z" />
                    </g>
                </svg>

                <div className="uc-content">
                    <div className="uc-sprite">
                        {FRAMES.map((n) => (
                            <img
                                key={n}
                                className="uc-frame"
                                src={`/assets/palbat_malu/palbat-malu-${n}.png`}
                                alt={n === 1 ? 'Palbat swinging a pickaxe' : ''}
                                aria-hidden={n === 1 ? undefined : true}
                            />
                        ))}
                    </div>

                    <div className="uc-col">
                        <div className="uc-brand">
                            <img className="uc-mark" src="/favicon_transparent.png" alt="" aria-hidden="true" />
                            <span className="uc-wordmark">palabatu</span>
                        </div>

                        <p className="uc-eyebrow">Coming soon</p>

                        <p className="uc-copy">bentar ya, Palbat lagi projekan</p>
                    </div>
                </div>
            </div>

            <FooterSection />
        </>
    );
}
