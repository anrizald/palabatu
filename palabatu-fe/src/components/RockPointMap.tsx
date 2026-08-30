import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { MapContainer, TileLayer, Circle, Marker, Tooltip, useMap } from 'react-leaflet'
import LocationPicker from './LocationPicker.js'
import { buildBadgeIcon, buildTeardropIcon } from '../lib/mapIcons.js'
import type { BoulderType } from '../types/boulder.js'
// Geo helpers come from the add sheet's types module rather than a fourth
// hand-rolled copy (see its own note on the Directory/Landing precedent) --
// this component is used by that sheet and by BoulderDetailPage.
import { haversineKm, formatDistanceM, type Geo } from './add-sheet/types.js'

const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// Two real rocks can genuinely stand a few metres apart, so this sits far
// tighter than SpotMiniMap's 300 m spot threshold -- it's roughly phone-GPS
// accuracy, the distance past which "is this the rock already mapped?" stops
// being answerable from coordinates alone and needs a human to look.
const DUPLICATE_M = 15

// Matches the real map exactly (BoulderPinMarker's ring, lib/mapIcons' badge)
// so what you place here is recognisably the marker that will appear there.
// The rock being placed takes the accent ring -- it's the live subject;
// already-mapped rocks take the map's own quieter boulder ring.
const PIN_ICON = buildBadgeIcon({ ringColor: '#c87a30', size: 22 })
const SIBLING_ICON = buildBadgeIcon({ ringColor: '#8b4a18', size: 16 })
const CRAG_ICON = buildTeardropIcon({ ringColor: '#6a5848', size: 20 })

export type NearbyRock = { id: string; label: string; lat: number; lng: number }

type RockPointMapProps = {
    lat: number | null
    lng: number | null
    accuracyM: number | null
    onPick: (lat: number, lng: number, accuracyM: number | null) => void
    onClear: () => void
    /** The parent spot's pin: where the map opens, and the reference point
     * this rock is being placed relative to. */
    cragCenter: Geo
    cragName: string
    /** This spot's other rocks that already have a coordinate -- drawn so a
     * contributor can see they're about to pin a rock that's already there. */
    nearby: NearbyRock[]
    kind: BoulderType
    heightPx?: number
}

// Re-centres only when `trigger` changes, never merely because the pin moved.
// react-leaflet reads MapContainer's center once on mount, so some imperative
// nudge is needed -- but recentring on every pin change (SpotMiniMap's shape,
// where the pin is dropped once and confirmed) would fight the fine
// adjustment this picker is for: each corrective tap would recentre the map
// and shift the target out from under the next tap.
function Recenter({ center, trigger }: { center: [number, number]; trigger: number }) {
    const map = useMap()
    const centerRef = useRef(center)
    centerRef.current = center
    // Keyed on `trigger` alone -- `center` is read through a ref precisely so
    // it isn't a dependency here (see the note above).
    useEffect(() => {
        map.setView(centerRef.current)
    }, [map, trigger])
    return null
}

// "Where is this rock, within its spot?" -- the close-range sibling of
// SpotMiniMap, deliberately not a mode of it (the precedent RockFields'
// TypeSegment sets: identical appearance, opposite contract). A spot's pin is
// required, GPS-first, and warns about other spots 300 m away; a rock's pin is
// optional, opens on its parent spot rather than on the phone's current
// position, and compares against rocks metres away. Merging the two would mean
// a component that is mostly a flag.
export default function RockPointMap({
    lat, lng, accuracyM, onPick, onClear, cragCenter, cragName, nearby, kind, heightPx = 172,
}: RockPointMapProps) {
    const [locating, setLocating] = useState(false)
    const [locateError, setLocateError] = useState(false)
    // Bumped only by "use my location" -- deliberately not on mount, so a
    // rock never silently acquires the coordinates of wherever the phone
    // happens to be. handoff.md open item 13: draw the rocks that have a
    // coordinate, never invent one for the rest.
    const [recenterTrigger, setRecenterTrigger] = useState(0)

    const noun = kind === 'wall' ? 'wall' : 'rock'
    const hasPin = lat != null && lng != null
    const center: [number, number] = hasPin ? [lat, lng] : [cragCenter.lat, cragCenter.lng]

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) { setLocateError(true); return }
        setLocating(true)
        setLocateError(false)
        navigator.geolocation.getCurrentPosition(
            pos => {
                onPick(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
                setRecenterTrigger(t => t + 1)
                setLocating(false)
            },
            () => { setLocateError(true); setLocating(false) },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    // Nearest existing rocks to the dropped pin. Every sibling is drawn, but
    // only the closest few are labelled -- a busy spot would otherwise be a
    // wall of overlapping tooltips at this zoom.
    const ranked = useMemo(() => {
        if (!hasPin) return []
        const pin: Geo = { lat, lng }
        return nearby
            .map(r => ({ rock: r, km: haversineKm(pin, { lat: r.lat, lng: r.lng }) }))
            .sort((a, b) => a.km - b.km)
    }, [nearby, hasPin, lat, lng])

    const labelled = new Set(ranked.slice(0, 3).map(r => r.rock.id))
    const closest = ranked[0]
    const veryClose = closest && closest.km * 1000 < DUPLICATE_M
    const cragDistKm = hasPin ? haversineKm({ lat, lng }, cragCenter) : null

    return (
        <div className="flex flex-col gap-2">
            <div className="relative rounded-[10px] overflow-hidden border border-border" style={{ height: `${heightPx}px` }}>
                <MapContainer center={center} zoom={hasPin ? 18 : 17} maxZoom={20} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url={TILE_URL} maxNativeZoom={18} maxZoom={20} />
                    <Recenter center={center} trigger={recenterTrigger} />
                    <LocationPicker onPick={(pLat, pLng) => onPick(pLat, pLng, null)} />

                    {/* The spot's own pin, for orientation -- this rock is being
                        placed somewhere around it, not independently of it. */}
                    <Marker position={[cragCenter.lat, cragCenter.lng]} icon={CRAG_ICON} interactive={false}>
                        <Tooltip permanent direction="top" offset={[0, -18]} className="!bg-panel !text-text-muted !border-border !text-[10.5px]">
                            {cragName}
                        </Tooltip>
                    </Marker>

                    {nearby.map(rock => (
                        <Marker key={rock.id} position={[rock.lat, rock.lng]} icon={SIBLING_ICON} interactive={false}>
                            {labelled.has(rock.id) && (
                                <Tooltip permanent direction="right" offset={[10, 0]} className="!bg-panel !text-text-secondary !border-border !text-[11px]">
                                    {rock.label}
                                </Tooltip>
                            )}
                        </Marker>
                    ))}

                    {hasPin && (
                        <>
                            <Marker position={[lat, lng]} icon={PIN_ICON} />
                            {accuracyM != null && (
                                <Circle center={[lat, lng]} radius={accuracyM} pathOptions={{ color: '#c87a30', fillOpacity: 0.08, weight: 1, dashArray: '4 4' }} />
                            )}
                        </>
                    )}
                </MapContainer>

                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    aria-label={`Use my location for this ${noun}`}
                    className="absolute bottom-2 right-2 z-[500] w-11 h-11 rounded-full bg-panel border border-border text-text-secondary flex items-center justify-center disabled:opacity-50"
                >
                    <Crosshair size={18} className="shrink-0" />
                </button>
            </div>

            {locateError ? (
                <p className="text-xs text-danger">Could not read your location. Tap the map to place the {noun} instead.</p>
            ) : !hasPin ? (
                <p className="text-xs text-text-muted">
                    Optional. Stand at the {noun} and tap the crosshair, or tap the map. Skip it and the {noun} still belongs to {cragName}.
                </p>
            ) : veryClose && closest ? (
                <p className="text-xs text-danger">
                    <b className="text-text">{closest.rock.label}</b> is already pinned {formatDistanceM(closest.km)} away. The same {noun}? Two entries for one {noun} have to be merged later.
                </p>
            ) : (
                <p className="text-xs text-text-muted">
                    {accuracyM != null ? `Accurate to about ${Math.round(accuracyM)} m. ` : 'Tap again to adjust. '}
                    {cragDistKm != null && `${formatDistanceM(cragDistKm)} from ${cragName}.`}
                </p>
            )}

            {hasPin && (
                <button
                    type="button"
                    onClick={onClear}
                    className="self-start min-h-11 -my-2 bg-transparent border-0 text-xs text-text-muted underline cursor-pointer px-0"
                >
                    Remove the pin
                </button>
            )}
        </div>
    )
}
