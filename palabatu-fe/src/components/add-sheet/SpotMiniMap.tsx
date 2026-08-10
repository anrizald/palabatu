import { useEffect, useMemo, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import LocationPicker from '../LocationPicker.js'
import type { CragListItem } from '../../types/crag.js'
import { haversineKm, formatDistanceM, type Geo } from './types.js'

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const DEFAULT_CENTER: [number, number] = [-2.5, 118.0]

const PIN_ICON = L.divIcon({
    html: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c87a30" stroke-width="2"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" fill="#c87a30" fill-opacity="0.25"/><circle cx="12" cy="10" r="2.5" fill="#c87a30"/></svg>',
    iconSize: [26, 26],
    iconAnchor: [13, 24],
    className: '',
})

// Re-centers the map whenever the pin moves (e.g. "use my location"), since
// react-leaflet only reads MapContainer's center prop on mount.
function Recenter({ center }: { center: [number, number] }) {
    const map = useMap()
    useEffect(() => { map.setView(center) }, [map, center])
    return null
}

type SpotMiniMapProps = {
    lat: number | null
    lng: number | null
    accuracyM: number | null
    onPick: (lat: number, lng: number, accuracyM: number | null) => void
    /** Every existing spot, for the strong duplicate-spot prevention
     * decision 20 asks for -- drawn on the map with distance, not just
     * listed in a sorted picker. */
    allCrags: CragListItem[]
}

// The inline mini-map on the "Add a spot" sheet (handoff.md decision 20):
// shows the dropped pin, its accuracy radius, and nearby existing spots
// with their distances -- the strong form of duplicate-spot prevention, on
// the single most permanent write this app makes.
export default function SpotMiniMap({ lat, lng, accuracyM, onPick, allCrags }: SpotMiniMapProps) {
    const [locating, setLocating] = useState(false)

    useEffect(() => {
        if (lat != null || lng != null) return
        handleUseMyLocation()
        // Only auto-locate once, when the map first mounts with no pin yet.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) return
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            pos => { onPick(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy); setLocating(false) },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    const center: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER

    const nearby = useMemo(() => {
        if (lat == null || lng == null) return []
        const pin: Geo = { lat, lng }
        return allCrags
            .map(c => ({ crag: c, km: haversineKm(pin, { lat: c.lat, lng: c.lng }) }))
            .sort((a, b) => a.km - b.km)
            .slice(0, 3)
    }, [allCrags, lat, lng])

    const closest = nearby[0]
    const veryClose = closest && closest.km < 0.3 // under 300m -- likely the same place

    return (
        <div className="flex flex-col gap-2">
            <div className="relative rounded-[10px] overflow-hidden border border-border" style={{ height: '172px' }}>
                <MapContainer center={center} zoom={lat != null ? 15 : 5} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url={TILE_URL} maxNativeZoom={19} maxZoom={20} />
                    <Recenter center={center} />
                    <LocationPicker onPick={(pLat, pLng) => onPick(pLat, pLng, null)} />
                    {lat != null && lng != null && (
                        <>
                            <Marker position={[lat, lng]} icon={PIN_ICON} />
                            {accuracyM != null && (
                                <Circle center={[lat, lng]} radius={accuracyM} pathOptions={{ color: '#c87a30', fillOpacity: 0.08, weight: 1, dashArray: '4 4' }} />
                            )}
                        </>
                    )}
                    {nearby.map(({ crag, km }) => (
                        <CircleMarker key={crag.id} center={[crag.lat, crag.lng]} radius={5} pathOptions={{ color: '#6a5848', fillColor: '#6a5848', fillOpacity: 0.9, weight: 1 }}>
                            <Tooltip permanent direction="right" offset={[6, 0]} className="!bg-panel !text-text-secondary !border-border !text-[11px]">
                                {crag.name} &middot; {formatDistanceM(km)}
                            </Tooltip>
                        </CircleMarker>
                    ))}
                </MapContainer>
                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    aria-label="Use my location"
                    className="absolute bottom-2 right-2 z-[500] w-11 h-11 rounded-full bg-panel border border-border text-text-secondary flex items-center justify-center disabled:opacity-50"
                >
                    <Crosshair size={18} className="shrink-0" />
                </button>
            </div>

            {lat == null ? (
                <p className="text-xs text-text-muted">Tap the map to drop a pin, or use your location.</p>
            ) : veryClose && closest ? (
                <p className="text-xs text-danger">
                    <b className="text-text">{closest.crag.name}</b> is {formatDistanceM(closest.km)} from your pin. Same place? Adding it twice splits it in two.
                </p>
            ) : (
                <p className="text-xs text-text-muted">
                    {accuracyM != null ? `Accurate to about ${Math.round(accuracyM)} m.` : 'Drag the pin if you know better.'}
                    {closest && ` Nearest other spot is ${formatDistanceM(closest.km)}.`}
                </p>
            )}
        </div>
    )
}
