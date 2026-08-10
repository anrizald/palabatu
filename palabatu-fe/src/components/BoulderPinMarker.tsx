import L from 'leaflet'
import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import type { BoulderListItem } from '../types/boulder.js'

// Close-zoom map layer (handoff.md open item 13): a crag's individual
// rocks, each at their own lat/lng -- only drawn when a rock actually has
// one (many won't; never invented). Visually distinct from the crag pin
// (PinpointMarker) so the two layers don't read as the same kind of thing.
const ICON = L.divIcon({
    html: '<div style="width:14px;height:14px;border-radius:9999px;background:#8b4a18;border:2px solid #fef3e6;box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: '',
})

export default function BoulderPinMarker({ boulder }: { boulder: BoulderListItem }) {
    if (boulder.lat == null || boulder.lng == null) return null
    const label = boulder.name ?? boulder.sample_problem_name ?? 'Unnamed rock'

    return (
        <Marker position={[boulder.lat, boulder.lng]} icon={ICON}>
            <Popup>
                <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: '150px' }}>
                    <strong style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: '#1a1612' }}>{label}</strong>
                    <div style={{ fontSize: '11px', color: '#6a5848', marginTop: '4px' }}>
                        {boulder.problem_count} {boulder.type === 'wall' ? 'route' : 'problem'}{boulder.problem_count === 1 ? '' : 's'}
                    </div>
                    <Link to={`/boulders/${boulder.id}`} style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: '#c87a30', fontWeight: 600, textDecoration: 'none' }}>
                        View rock
                    </Link>
                </div>
            </Popup>
        </Marker>
    )
}
