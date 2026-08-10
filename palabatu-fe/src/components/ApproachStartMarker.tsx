import L from 'leaflet'
import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { START_TYPE_LABELS, type ApproachListItem } from '../types/approach.js'

// Third map layer (handoff.md open item 13, resolved 2026-08-09(g)): an
// approach's start point -- parking or the drop-off -- as its own marker
// kind, distinct from both the far-out crag pin and close-zoom rock pins.
// A moss-tinted pin (the app's "found/confirmed" hue) reads as "this is
// where you begin", not "this is a rock to climb".
const ICON = L.divIcon({
    html: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5dbb6a" stroke-width="2"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" fill="#5dbb6a" fill-opacity="0.3"/><circle cx="12" cy="10" r="2.5" fill="#5dbb6a"/></svg>',
    iconSize: [22, 22],
    iconAnchor: [11, 20],
    className: '',
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
