import L from 'leaflet'
import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { renderTeardropSvg } from '../lib/mapIcons.js'
import { START_TYPE_LABELS, type ApproachListItem } from '../types/approach.js'

// Third map layer (handoff.md open item 13, resolved 2026-08-09(g)): an
// approach's start point -- parking or the drop-off -- as its own marker
// kind, distinct from both the far-out crag pin and close-zoom rock badges.
// A tailed pin, not a badge -- "this is where you begin" is a destination
// like the crag pin, not an object sitting at a point (see lib/mapIcons.ts)
// -- in moss (the app's "found/confirmed" hue), so it reads as "walk here"
// rather than "this is a rock to climb". Hand-drawn art (trail-32/64/96.png),
// DPR-picked the same way as PinpointMarker.tsx/BoulderPinMarker.tsx, with
// the shared teardrop SVG as the <img onerror> fallback.
const RING_COLOR = '#5dbb6a'
const SIZE = 22

const dpr = window.devicePixelRatio || 1
const ASSET_SIZE = dpr >= 3 ? 96 : dpr >= 2 ? 64 : 32
const FALLBACK_URI = `data:image/svg+xml,${encodeURIComponent(renderTeardropSvg({ ringColor: RING_COLOR }))}`

const ICON = L.divIcon({
    html: `<img src="/assets/pointers/trail-${ASSET_SIZE}.png" style="width:${SIZE}px;height:${SIZE}px" onerror="this.onerror=null;this.src='${FALLBACK_URI}'" />`,
    iconSize: [SIZE, SIZE],
    iconAnchor: [SIZE / 2, SIZE],
    popupAnchor: [0, -SIZE],
    className: 'approach-start-icon',
})

export default function ApproachStartMarker({ approach }: { approach: ApproachListItem }) {
    if (approach.start_lat == null || approach.start_lng == null) return null
    const label = approach.name ?? `dari ${START_TYPE_LABELS[approach.start_type].toLowerCase()}`

    return (
        <Marker position={[approach.start_lat, approach.start_lng]} icon={ICON}>
            <Popup>
                <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: '150px' }}>
                    <strong style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: '#1a1612' }}>Jalan masuk</strong>
                    <div style={{ fontSize: '11px', color: '#6a5848', marginTop: '4px' }}>{label} &middot; {approach.step_count} langkah</div>
                    <Link to={`/approaches/${approach.id}`} style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#c87a30', fontWeight: 600, textDecoration: 'none' }}>
                        Read the guide
                    </Link>
                </div>
            </Popup>
        </Marker>
    )
}
