import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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

// The click-triggered "jump attack" popup, separate from the idle mining
// loop above -- windup (1-2), a shaken anticipation hold (3), the strike
// (4), and its follow-through (5). Durations are per-frame (slow-in on the
// windup, a snappy release) rather than a fixed interval, since a single
// tempo reads as mechanical for a hit. Indexes 2 and 4 (frames 3 and 5) are
// the "impact" beats -- see IMPACT_FRAME_INDEXES below.
const ATTACK_FRAME_DURATIONS_MS = [130, 150, 70, 90, 220];
const ATTACK_FRAME_COUNT = ATTACK_FRAME_DURATIONS_MS.length;
const IMPACT_FRAME_INDEXES = new Set([2, 4]);
// Reduced motion skips the frame-by-frame flip (rapid alternation is exactly
// what that preference asks to avoid) and just holds the final strike frame
// briefly instead -- still gives click feedback, no flicker.
const REDUCED_MOTION_HOLD_MS = 220;
// The popup leans a few degrees off-vertical, randomized fresh per click --
// a fixed centered pop read as too mechanical for a spam button. Range is
// positive (clockwise) so it always leans toward the top-right, matching
// where it's anchored -- the pickaxe should read as striking down into the
// button's top-right corner.
const ATTACK_TILT_MIN_DEG = 2;
const ATTACK_TILT_MAX_DEG = 10;

// A shower of small dots flung outward from the button, timed to land with
// the attack popup's final (impact) frame rather than firing at click time
// -- see PARTICLE_TRIGGER_DELAY_MS below for why it's scheduled
// independently rather than triggered from inside playAttack's own timer.
// Each click rerolls direction/size/speed per particle (computed once in
// triggerBurst and stored in state, not recomputed on every render, or the
// burst would re-scatter mid-flight) so consecutive clicks never look
// identical. Weighted toward brighter tones -- small dots in the deeper
// ember shades barely register against the near-black background at this
// size.
const PARTICLE_COUNT = 24;
const PARTICLE_COLORS = ['#ffd88a', '#f0a050', '#fef3e6', '#ffb84d', '#c87a30'];
// Sum of every frame's duration except the last -- i.e. how long after a
// click the last/impact frame would appear if that click's own attack
// sequence played out uninterrupted. Scheduled as its own timeout rather
// than fired from inside playAttack's step() specifically so a spammed
// click still produces its own burst on schedule even though a later click
// resets the shared attackFrame sequence back to frame 0 first (see the
// button's spam-tolerance contract in the component doc comment) -- without
// this decoupling, clicking faster than this delay would mean the "last
// frame" is never reached and no burst ever fires.
const PARTICLE_TRIGGER_DELAY_MS = ATTACK_FRAME_DURATIONS_MS.slice(0, -1).reduce((a, b) => a + b, 0);
// Longest possible delay + duration a particle can roll, plus slack --
// the timer that clears a burst must outlive every one of its particles'
// own CSS animation, or a click could clear particles still mid-flight.
const PARTICLE_MAX_LIFETIME_MS = 820;

type Particle = {
    angle: number;
    dist: number;
    size: number;
    delay: number;
    dur: number;
    color: string;
};

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
 *
 * Every click also plays a separate 5-frame "jump attack" popup
 * (palbat_allez/, distinct from the idle palbat_malu/ loop above and never
 * touched by it) anchored above the button itself. It's driven by JS state
 * rather than a CSS loop -- unlike the idle swing, this one plays once,
 * needs per-frame timing (slow windup, snappy release) rather than a fixed
 * interval, and two of its frames get a runtime grayscale+aura treatment
 * (see IMPACT_FRAME_INDEXES) that a plain opacity crossfade can't express.
 * A repeat click mid-animation restarts it from frame 0 rather than
 * queuing, matching the button's existing "built for spam taps" contract.
 * It also carries a small randomized tilt per click (ATTACK_TILT_MIN/MAX_DEG)
 * and sits anchored toward the button's top-right corner rather than
 * dead-centered above it -- less like a fixed HUD element popping up in the
 * same spot every time, more like Palbat is actually leaping off the button.
 *
 * A second effect -- PARTICLE_COUNT small dots flung outward from the button
 * itself -- fires from playAttack when it reaches the last frame (rather
 * than at click time) so the particles read as impact debris from the hit
 * landing, not as a click acknowledgment. Bursts are tracked as a list
 * (`bursts`, each with its own id) rather than a single "current burst"
 * value, specifically so the button stays spammable: a burst already in
 * flight finishes on its own instead of being cut off or rewound by the
 * next click's burst starting on top of it.
 */
export default function UnderConstruction() {
    const [hypeCount, setHypeCount] = useState<number | null>(null);
    const [attackFrame, setAttackFrame] = useState<number | null>(null);
    const [attackTilt, setAttackTilt] = useState(0);
    const attackTimerRef = useRef<number | null>(null);
    const [bursts, setBursts] = useState<{ id: number; particles: Particle[] }[]>([]);
    const burstIdRef = useRef(0);
    const burstTimeoutsRef = useRef<Set<number>>(new Set());

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
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        playAttack(reduceMotion);
        // Scheduled independently of playAttack's own timer -- see
        // PARTICLE_TRIGGER_DELAY_MS's doc comment for why a later click
        // must not be able to cancel an earlier click's pending burst.
        if (!reduceMotion) scheduleBurst();
    };

    // Steps attackFrame through 0..ATTACK_FRAME_COUNT-1 on its own per-frame
    // timer, then clears back to null. A repeat click mid-animation clears
    // the pending timer and restarts from frame 0 rather than queuing --
    // this is a spam button (see the doc comment above), so the attack
    // should feel as re-triggerable as the counter increment already is.
    const playAttack = (reduceMotion: boolean) => {
        if (attackTimerRef.current !== null) window.clearTimeout(attackTimerRef.current);
        setAttackTilt(ATTACK_TILT_MIN_DEG + Math.random() * (ATTACK_TILT_MAX_DEG - ATTACK_TILT_MIN_DEG));

        if (reduceMotion) {
            // No particle burst here -- reduced motion holds a static frame
            // rather than actually landing a hit, so there's no "impact"
            // moment for debris to spring from.
            setAttackFrame(ATTACK_FRAME_COUNT - 1);
            attackTimerRef.current = window.setTimeout(() => {
                attackTimerRef.current = null;
                setAttackFrame(null);
            }, REDUCED_MOTION_HOLD_MS);
            return;
        }

        const step = (i: number) => {
            setAttackFrame(i);
            attackTimerRef.current = window.setTimeout(() => {
                if (i + 1 < ATTACK_FRAME_COUNT) {
                    step(i + 1);
                } else {
                    attackTimerRef.current = null;
                    setAttackFrame(null);
                }
            }, ATTACK_FRAME_DURATIONS_MS[i]);
        };
        step(0);
    };

    // Fires PARTICLE_TRIGGER_DELAY_MS after the click that requested it,
    // regardless of anything a later click does to playAttack's own timer
    // in the meantime -- this is what keeps the burst spammable (see that
    // constant's doc comment).
    const scheduleBurst = () => {
        const timeoutId = window.setTimeout(() => {
            burstTimeoutsRef.current.delete(timeoutId);
            triggerBurst();
        }, PARTICLE_TRIGGER_DELAY_MS);
        burstTimeoutsRef.current.add(timeoutId);
    };

    // Appends a brand-new burst (unique id) rather than replacing a single
    // "current burst" value, so overlapping bursts from consecutive spammed
    // clicks all play out in full -- an in-flight burst from an earlier
    // click keeps animating untouched while a new one starts alongside it,
    // instead of being rewound or cut short. Each burst cleans up after
    // itself on its own timer.
    const triggerBurst = () => {
        const id = ++burstIdRef.current;
        const list: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
            angle: (360 / PARTICLE_COUNT) * i + (Math.random() * 26 - 13),
            dist: 42 + Math.random() * 56,
            size: 3 + Math.random() * 4,
            delay: Math.random() * 80,
            dur: 420 + Math.random() * 260,
            color: PARTICLE_COLORS[i % PARTICLE_COLORS.length] ?? '#c87a30',
        }));
        setBursts((prev) => [...prev, { id, particles: list }]);

        const timeoutId = window.setTimeout(() => {
            burstTimeoutsRef.current.delete(timeoutId);
            setBursts((prev) => prev.filter((b) => b.id !== id));
        }, PARTICLE_MAX_LIFETIME_MS);
        burstTimeoutsRef.current.add(timeoutId);
    };

    useEffect(() => {
        const burstTimeouts = burstTimeoutsRef.current;
        return () => {
            if (attackTimerRef.current !== null) window.clearTimeout(attackTimerRef.current);
            burstTimeouts.forEach((id) => window.clearTimeout(id));
            burstTimeouts.clear();
        };
    }, []);

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
                    position: relative;
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

                /* Anchored to the button itself (see position:relative on
                   .uc-hype-btn above) so it stays put regardless of layout
                   changes elsewhere on the page. Sits toward the button's
                   top-right corner rather than dead-centered above it, and
                   leans at a per-click random angle (inline style, see
                   attackTilt) -- reads as the pickaxe striking down into
                   that corner rather than a fixed HUD element. pointer-
                   events:none so the button stays clickable through it for
                   rapid re-taps. */
                .uc-attack-pop {
                    position: absolute;
                    right: -8%;
                    bottom: calc(100% + 4px);
                    width: clamp(64px, 16vw, 100px);
                    aspect-ratio: 1;
                    pointer-events: none;
                }
                .uc-attack-img {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                /* The two "impact" beats (frames 3 and 5, see
                   IMPACT_FRAME_INDEXES) flash to monochrome so the color
                   below reads as energy coming off Palbat rather than part
                   of him. */
                .uc-attack-img--impact {
                    filter: grayscale(100%) contrast(1.15);
                }
                .uc-attack-aura {
                    position: absolute;
                    inset: -35%;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(200,122,48,0.55) 0%, rgba(200,122,48,0) 70%);
                    z-index: -1;
                    animation: uc-aura-pulse 0.18s ease-out;
                }
                @keyframes uc-aura-pulse {
                    0%   { opacity: 0; transform: scale(0.6); }
                    40%  { opacity: 1; }
                    100% { opacity: 0.85; transform: scale(1); }
                }

                /* Covers the whole button so particles can fly outward past
                   its edges in any direction; overflow:visible since the
                   button itself sets no overflow, but stated explicitly
                   here so this doesn't silently break if that changes. */
                .uc-burst {
                    position: absolute;
                    inset: 0;
                    overflow: visible;
                    pointer-events: none;
                }
                .uc-particle {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: var(--size);
                    height: var(--size);
                    border-radius: 50%;
                    background: var(--color);
                    box-shadow: 0 0 4px rgba(200, 122, 48, 0.55);
                    /* rotate() then translateX() is what sends each particle
                       outward along its own --angle without computing
                       sin/cos per particle in JS. */
                    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
                    animation: uc-particle-burst var(--dur) var(--delay) cubic-bezier(0.15, 0.65, 0.35, 1) forwards;
                }
                @keyframes uc-particle-burst {
                    0% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(1);
                        opacity: 1;
                    }
                    65% { opacity: 1; }
                    100% {
                        transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist)) scale(0.25);
                        opacity: 0;
                    }
                }

                @media (max-width: 480px) {
                    .uc-brand { margin-bottom: 10px; }
                    .uc-copy { margin-bottom: 18px; }
                    .uc-hype-btn { padding: 9px 18px; font-size: 14px; }
                    .uc-attack-pop { right: -4%; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .uc-frame { animation: none; opacity: 0; }
                    .uc-frame:first-child { opacity: 1; }
                    .uc-attack-aura { animation: none; opacity: 0.85; transform: none; }
                    .uc-particle { animation: none; opacity: 0; }
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
                                {attackFrame !== null && (
                                    <span
                                        className="uc-attack-pop"
                                        aria-hidden="true"
                                        style={{ transform: `rotate(${attackTilt}deg)` }}
                                    >
                                        {IMPACT_FRAME_INDEXES.has(attackFrame) && (
                                            <span className="uc-attack-aura" />
                                        )}
                                        <img
                                            className={
                                                IMPACT_FRAME_INDEXES.has(attackFrame)
                                                    ? 'uc-attack-img uc-attack-img--impact'
                                                    : 'uc-attack-img'
                                            }
                                            src={`/assets/palbat_allez/palbat-allez-${attackFrame + 1}.png`}
                                            alt=""
                                        />
                                    </span>
                                )}
                                {bursts.map((burst) => (
                                    <span className="uc-burst" aria-hidden="true" key={burst.id}>
                                        {burst.particles.map((p, i) => (
                                            <span
                                                key={i}
                                                className="uc-particle"
                                                style={{
                                                    '--angle': `${p.angle}deg`,
                                                    '--dist': `${p.dist}px`,
                                                    '--size': `${p.size}px`,
                                                    '--delay': `${p.delay}ms`,
                                                    '--dur': `${p.dur}ms`,
                                                    '--color': p.color,
                                                } as CSSProperties}
                                            />
                                        ))}
                                    </span>
                                ))}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <FooterSection />
        </>
    );
}
