import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

// Shared "Added by" attribution disclaimer, used by ProblemDetailPage, the
// ProblemDetails panel (opened from the map), and PinpointMarker's map
// popup — all three show a problem's creator and all three want the same
// caveat next to it.
export const ADDED_BY_DISCLAIMER =
    "Being added on Palabatu doesn't mean first ascent or first discovery — outdoor climbing culture existed long before us.";

type Props = {
    text: string;
    size?: number;
    style?: CSSProperties;
};

const TOOLTIP_WIDTH = 210;
const EDGE_MARGIN = 8;
const GAP = 8;

type Position = { top: number; left: number };

// Small hover/tap disclosure bubble for a short caveat next to inline text.
// Deliberately plain inline styles (not Tailwind) so it renders identically
// inside PinpointMarker's Leaflet popup, which doesn't use Tailwind classes
// at all. State-driven open/close (not CSS :hover) so it's also reachable by
// tap on touch devices, where hover doesn't exist — this app is used as an
// installable PWA on phones.
//
// Positioning is collision-aware and portaled to document.body:
// - Portaling matters specifically for the map popup — Leaflet pans its
//   panes with a `transform` on an ancestor, which would otherwise hijack
//   `position: fixed` into being relative to that transformed pane instead
//   of the viewport. Rendering at the body root sidesteps that (and any
//   modal's overflow clipping) while getBoundingClientRect still gives true
//   viewport coordinates regardless of transforms in the chain.
// - The bubble first mounts invisibly so its real rendered size (wrapped
//   text can be 2-3 lines) can be measured, then it's flipped above/below
//   the trigger — whichever side actually has room — and clamped
//   horizontally so it never runs past the viewport edge, before becoming
//   visible. All in one layout-effect pass, so there's no visible jump.
export default function InfoTooltip({ text, size = 13, style }: Props) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState<Position | null>(null);
    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!open) {
            setPos(null);
            return;
        }
        const trigger = triggerRef.current;
        const tooltip = tooltipRef.current;
        if (!trigger || !tooltip) return;

        const triggerRect = trigger.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const fitsAbove = triggerRect.top - GAP - tooltipRect.height >= 0;
        const top = fitsAbove
            ? triggerRect.top - GAP - tooltipRect.height
            : Math.min(triggerRect.bottom + GAP, vh - tooltipRect.height - EDGE_MARGIN);

        // Anchored to the trigger's own left edge rather than centered on it.
        // The icon always sits at the *end* of a "...in Palabatu (i)" line, so
        // growing the bubble rightward keeps it clear of that label instead of
        // centering back over it — that's the actual collision that matters
        // here (compact cards put very little room above/below the trigger,
        // but there's reliably clear space to its right).
        let left = triggerRect.left;
        left = Math.max(EDGE_MARGIN, Math.min(left, vw - tooltipRect.width - EDGE_MARGIN));

        setPos({ top, left });
    }, [open]);

    // A brief aside isn't worth keeping glued to its trigger through a
    // scroll/resize — close it instead of re-measuring continuously.
    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    return (
        <span
            ref={triggerRef}
            style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', ...style }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            <button
                type="button"
                aria-label="About 'Added by'"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpen((v) => !v);
                }}
                onBlur={() => setOpen(false)}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    margin: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                }}
            >
                <Info size={size} style={{ flexShrink: 0 }} />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        role="tooltip"
                        style={{
                            position: 'fixed',
                            top: pos ? `${pos.top}px` : 0,
                            left: pos ? `${pos.left}px` : 0,
                            visibility: pos ? 'visible' : 'hidden',
                            width: `${TOOLTIP_WIDTH}px`,
                            padding: '8px 10px',
                            borderRadius: '10px',
                            background: '#0f0d0b',
                            border: '1px solid #2a2420',
                            color: '#d8c8b8',
                            fontSize: '11px',
                            lineHeight: 1.4,
                            fontWeight: 400,
                            fontFamily: "'DM Sans', sans-serif",
                            zIndex: 99999,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            pointerEvents: 'none',
                        }}
                    >
                        {text}
                    </div>,
                    document.body
                )}
        </span>
    );
}
