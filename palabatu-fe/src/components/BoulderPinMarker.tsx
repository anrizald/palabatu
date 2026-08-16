import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { buildBadgeIcon } from '../lib/mapIcons.js'
import type { BoulderListItem } from '../types/boulder.js'

// Close-zoom map layer (handoff.md open item 13): a crag's individual
// rocks, each at their own lat/lng -- only drawn when a rock actually has
// one (many won't; never invented). A tailless badge, not a pin -- a
// boulder isn't a destination you travel to, it's an object sitting at a
// point once you've already arrived (see lib/mapIcons.ts), so it reads as
// visually distinct from the crag pin (PinpointMarker) rather than the
// same kind of thing at a different scale.
const ICON = buildBadgeIcon({ ringColor: '#8b4a18', size: 18, className: 'boulder-pin-icon' })

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
