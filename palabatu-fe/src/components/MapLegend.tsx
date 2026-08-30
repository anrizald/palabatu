import { useState } from 'react'
import { Info, X, MapPin, Layers, Mountain, Footprints } from 'lucide-react'
import FallbackImg from './FallbackImg.js'
import { circleButtonStyle } from '../lib/constants.js'

// Collapsible legend for the map's marker family (2026-08-17, prompted by
// "why did this rock have a badge and that one didn't" being undiscoverable
// just from staring at the map -- see handoff.md open item 13 for what each
// layer actually means). Collapsed by default so it doesn't compete with
// LocationSearchBox/ZoomControlButtons (top-left) or LocateMeButton/the add
// FAB (bottom-right) -- this is the one open corner. Uses the real pointer
// PNGs (not the mapIcons.ts SVG builders) so the legend matches what's
// actually drawn on the map, not the onerror fallback.
const ROWS: { icon: React.ReactNode; label: string; detail: string }[] = [
    {
        icon: (
            <FallbackImg
                src="/assets/pointers/pinpoint-32.png"
                srcSet="/assets/pointers/pinpoint-32.png 1x, /assets/pointers/pinpoint-64.png 2x, /assets/pointers/pinpoint-96.png 3x"
                alt="" width={22} height={22} fallback={MapPin}
            />
        ),
        label: 'Spot',
        detail: 'A climbing area, like Goa Agung. Always shown.',
    },
    {
        icon: (
            <FallbackImg
                src="/assets/pointers/pinpoint-32.png"
                srcSet="/assets/pointers/pinpoint-32.png 1x, /assets/pointers/pinpoint-64.png 2x, /assets/pointers/pinpoint-96.png 3x"
                alt="" width={22} height={22} fallback={MapPin} style={{ opacity: 0.5 }}
            />
        ),
        label: 'Spot, dimmed',
        detail: "Marked, but nothing's been documented there yet.",
    },
    {
        icon: (
            <FallbackImg
                src="/assets/pointers/pinpoint-cluster-32.png"
                srcSet="/assets/pointers/pinpoint-cluster-32.png 1x, /assets/pointers/pinpoint-cluster-64.png 2x, /assets/pointers/pinpoint-cluster-96.png 3x"
                alt="" width={22} height={22} fallback={Layers}
            />
        ),
        label: 'Multiple spots',
        detail: 'Several spots close together at this zoom. Zoom in or tap to split them apart.',
    },
    {
        icon: (
            <FallbackImg
                src="/assets/pointers/boulder-24.png"
                srcSet="/assets/pointers/boulder-24.png 1x, /assets/pointers/boulder-48.png 2x, /assets/pointers/boulder-72.png 3x"
                alt="" width={18} height={18} fallback={Mountain}
            />
        ),
        label: 'Rock',
        detail: "One rock within a spot. Only appears once you're zoomed into that spot, and only for rocks with a saved location.",
    },
    {
        icon: (
            <FallbackImg
                src="/assets/pointers/trail-32.png"
                srcSet="/assets/pointers/trail-32.png 1x, /assets/pointers/trail-64.png 2x, /assets/pointers/trail-96.png 3x"
                alt="" width={22} height={22} fallback={Footprints}
            />
        ),
        label: 'Walk-in start',
        detail: 'Where to park or start walking, if a guide exists for that spot.',
    },
]

export default function MapLegend() {
    const [open, setOpen] = useState(false)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
            {open && (
                <div
                    style={{
                        background: '#141210',
                        border: '1px solid #2a2420',
                        borderRadius: '16px',
                        padding: '18px',
                        width: 'min(272px, calc(100vw - 64px))',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: '#f0e0c8' }}>
                            Map legend
                        </strong>
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close legend"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6a5848', display: 'flex', padding: 0 }}
                        >
                            <X size={16} style={{ flexShrink: 0 }} />
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {ROWS.map(row => (
                            <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <div style={{ width: '22px', flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: '2px' }}>
                                    {row.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#f0e0c8' }}>{row.label}</div>
                                    <div style={{ fontSize: '11px', color: '#6a5848', lineHeight: 1.4, marginTop: '2px' }}>{row.detail}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <button
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Hide map legend' : 'Show map legend'}
                title="Map legend"
                style={{ ...circleButtonStyle, width: '40px', height: '40px', cursor: 'pointer' }}
            >
                <Info size={18} color="#c87a30" style={{ flexShrink: 0 }} />
            </button>
        </div>
    )
}
