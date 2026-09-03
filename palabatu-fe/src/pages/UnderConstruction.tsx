import { useEffect, useState } from 'react';
import FooterSection from '../components/Footer.js';
import { api } from '../lib/api.js';
import type { CountResponse } from '../types/apitypes.js';

const FRAMES = [1, 2, 3, 4];

// How often an idle tab re-checks the hype count for other visitors'
// clicks. Decorative, not urgent -- this is a coming-soon curtain, not a
// live leaderboard -- so a plain interval is enough; no websocket/SSE push
// infra exists anywhere in this app yet, and this counter isn't reason
// enough to add the first one.
const HYPE_POLL_MS = 8000;

/**
 * Full-screen block shown in place of the entire app while it's being
 * reworked -- same "nothing behind it is reachable" role ComingSoon plays for
 * the pre-launch waitlist, wired the same way (see App.tsx).
 *
 * The pickaxe swing is four PNG frames rather than a real GIF: each frame
 * holds for a quarter of the loop, driven by one shared keyframe and staggered
 * animation-delays. The ember drop-shadow is load-bearing, not decoration --
 * the pickaxe head is near-black and would otherwise disappear into the ink
 * background.
 *
 * The "Allez" button drives internal/hype, a single global public counter --
 * GET /api/hype hydrates the starting number (seeded at a random phantom
 * value by migrations/0019, never zero) and is then re-polled every
 * HYPE_POLL_MS, plus immediately whenever the tab regains visibility, so a
 * visitor who leaves the tab open (or backgrounded) still sees other
 * people's clicks land instead of a number frozen at whatever it was on
 * load. Each local click increments optimistically and fires POST
 * /api/hype/click; that response is intentionally ignored (a burst of rapid
 * clicks fires overlapping requests, and syncing to whichever lands last
 * would make the number visibly jump around mid-spam), but a poll response
 * is folded in via Math.max rather than a plain overwrite -- otherwise a
 * poll whose request predates this tab's own just-applied optimistic click
 * could momentarily walk the number backward. Anyone can click as many
 * times as they want -- no auth, no per-endpoint rate limit on the click
 * route beyond its own generous one (see internal/hype's doc comment).
 */
export default function UnderConstruction() {
    const [hypeCount, setHypeCount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchHype = () => {
            api.get<CountResponse>('/api/hype')
                .then((res) => {
                    if (cancelled || typeof res.count !== 'number') return;
                    setHypeCount((c) => (c === null ? res.count : Math.max(c, res.count)));
                })
                .catch(() => {
                    // Decorative counter -- a failed fetch just leaves the
                    // button showing whatever it last knew.
                });
        };

        fetchHype();
        const intervalId = window.setInterval(() => {
            if (!document.hidden) fetchHype();
        }, HYPE_POLL_MS);

        const handleVisibility = () => {
            if (!document.hidden) fetchHype();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const handleAllez = () => {
        setHypeCount((c) => (c ?? 0) + 1);
        api.post<CountResponse>('/api/hype/click', {}).catch(() => {
            // Best-effort; see the doc comment above for why the response
            // isn't used to correct local state.
        });
    };

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
                    flex-wrap: wrap;
                    gap: clamp(6px, 1.4vw, 10px) clamp(8px, 1.6vw, 12px);
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
                    margin: 0;
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
                    margin: 0 0 22px;
                    font-family: 'Playfair Display', serif;
                    font-weight: 700;
                    font-size: clamp(21px, 5.4vw, 34px);
                    line-height: 1.3;
                    color: #f0e0c8;
                }

                .uc-hype {
                    display: flex;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 12px clamp(10px, 2vw, 16px);
                }
                .uc-hype-label {
                    margin: 0;
                    font-family: 'DM Sans', sans-serif;
                    font-size: clamp(13px, 3vw, 15px);
                    font-weight: 500;
                    color: #d8c8b8;
                }
                .uc-hype-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    border: none;
                    border-radius: 10px;
                    padding: 10px 22px;
                    background: #c87a30;
                    color: #fef3e6;
                    font-family: 'DM Sans', sans-serif;
                    font-size: 15px;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                    cursor: pointer;
                    transition: transform 0.08s ease, background-color 0.15s ease;
                }
                .uc-hype-btn:hover {
                    background: #d6892f;
                }
                /* :active rather than a JS-driven "pressed" class -- the
                   button is meant to survive rapid repeat taps, and a native
                   pseudo-class reacts every time with no state or re-render
                   in the way. */
                .uc-hype-btn:active {
                    transform: scale(0.94);
                    background: #ab6a29;
                }
                .uc-hype-count {
                    min-width: 2.4em;
                    padding: 2px 10px;
                    border-radius: 999px;
                    background: rgba(15, 13, 11, 0.28);
                    font-variant-numeric: tabular-nums;
                    text-align: center;
                }

                @media (max-width: 480px) {
                    .uc-brand { margin-bottom: 10px; }
                    .uc-copy { margin-bottom: 18px; }
                    .uc-hype-btn { padding: 9px 18px; font-size: 14px; }
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
                            <span className="uc-eyebrow">Coming soon</span>
                        </div>

                        <p className="uc-copy">bentar ya, Palbat lagi projekan</p>

                        <div className="uc-hype">
                            <p className="uc-hype-label">semangatin yuk</p>
                            <button type="button" className="uc-hype-btn" onClick={handleAllez}>
                                <span>Allez</span>
                                {hypeCount !== null && (
                                    <span className="uc-hype-count">{hypeCount.toLocaleString('id-ID')}</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <FooterSection />
        </>
    );
}
