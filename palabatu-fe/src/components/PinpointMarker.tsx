import L from 'leaflet'
import { Layers } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { useEffect, useMemo, useRef } from 'react'
import ClusterCardRail from './ClusterCardRail.js'
import InfoTooltip, { ADDED_BY_DISCLAIMER } from './InfoTooltip.js'
import type { CragListItem } from '../types/crag.js'

// One pin per crag (handoff.md decision 3) -- boulders and problems don't
// get their own pins on the default map layer. `dimmed` renders the
// "someone marked this, nobody's documented it yet" empty-crag state
// (handoff.md open item 1): visible, but visually distinct from a crag
// with real content, with its own CTA rather than fading into nothing.
type Props = {
    position: [number, number]
    name?: string
    directions?: string | null
    boulderCount?: number
    problemCount?: number
    creatorName?: string | null
    type?: 'pinpoint' | 'cluster'
    zoom?: number
    dimmed?: boolean
    onViewSpot?: () => void
    onAddFirst?: () => void
    clusterItems?: CragListItem[]
    onSelectItem?: (item: CragListItem) => void
    onClusterTap?: () => void
}

const MIN_ZOOM = 3
const MAX_ZOOM = 18
const MIN_ICON_SIZE = 16
const MAX_ICON_SIZE = 32

function iconSizeForZoom(zoom: number) {
    const t = Math.min(1, Math.max(0, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)))
    return Math.round(MIN_ICON_SIZE + t * (MAX_ICON_SIZE - MIN_ICON_SIZE))
}

// Leaflet marker icons are raw HTML (not React-rendered), so a failed PNG load
// can't fall back to a lucide component the normal way. Instead these mirror
// lucide's map-pin/layers path data as inline SVGs and swap the <img> src to
// one of them on error.
const LUCIDE_SVG_ATTRS = 'fill="none" stroke="#f0e0c8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const MARKER_BADGE = '<circle cx="12" cy="12" r="11" fill="#1a1612" stroke="#c87a30" stroke-width="1.25"/>'

const PINPOINT_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${LUCIDE_SVG_ATTRS}>${MARKER_BADGE}<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
const CLUSTER_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${LUCIDE_SVG_ATTRS}>${MARKER_BADGE}<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></svg>`

const PINPOINT_FALLBACK_URI = `data:image/svg+xml,${encodeURIComponent(PINPOINT_FALLBACK_SVG)}`
const CLUSTER_FALLBACK_URI = `data:image/svg+xml,${encodeURIComponent(CLUSTER_FALLBACK_SVG)}`

export default function PinpointMarker({
    position, name, directions, boulderCount = 0, problemCount = 0, creatorName, type = 'pinpoint', zoom = MAX_ZOOM,
    dimmed = false, onViewSpot, onAddFirst, clusterItems, onSelectItem, onClusterTap,
}: Props) {
    const markerRef = useRef<L.Marker>(null)

    const markerIcon = useMemo(() => {
        const dpr = window.devicePixelRatio || 1
        const assetSize = dpr >= 3 ? 96 : dpr >= 2 ? 64 : 32
        const baseName = type === 'cluster' ? 'pinpoint-cluster' : 'pinpoint'
        const size = iconSizeForZoom(zoom)
        const fallbackUri = type === 'cluster' ? CLUSTER_FALLBACK_URI : PINPOINT_FALLBACK_URI
        const opacity = dimmed ? 0.5 : 1

        return L.divIcon({
            html: `<img src="/assets/pointers/${baseName}-${assetSize}.png" style="width:${size}px;height:${size}px;opacity:${opacity}" class="pinpoint-marker-bounce" onerror="this.onerror=null;this.src='${fallbackUri}'" />`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -size],
            className: 'pinpoint-marker-icon',
        })
    }, [type, zoom, dimmed])

    useEffect(() => {
        markerRef.current?.setIcon(markerIcon)
    }, [markerIcon])

    const isMobileClusterTap = type === 'cluster' && !!onClusterTap
    const isClusterRail = type === 'cluster' && !!clusterItems?.length && !!onSelectItem

    return (
        <Marker
            position={position}
            ref={markerRef}
            {...(isMobileClusterTap ? { eventHandlers: { click: onClusterTap! } } : {})}
        >
            {!isMobileClusterTap && name && (
                <Popup
                    maxWidth={isClusterRail ? 370 : 300}
                    {...(isClusterRail ? { className: 'cluster-popup' } : {})}
                >
                    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: '160px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                            <strong style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: isClusterRail ? '#f7ead4' : '#1a1612', lineHeight: '1.2' }}>
                                {name}
                            </strong>
                        </div>

                        {type !== 'cluster' && (
                            <div style={{ fontSize: '12px', color: '#6a5848', marginBottom: '8px' }}>
                                {problemCount > 0
                                    ? `${boulderCount} rock${boulderCount === 1 ? '' : 's'} · ${problemCount} problem${problemCount === 1 ? '' : 's'}`
                                    : 'No problems yet'}
                                {directions && <div style={{ marginTop: '2px', fontStyle: 'italic' }}>{directions}</div>}
                            </div>
                        )}

                        {type === 'cluster' ? (
                            isClusterRail ? (
                                <div style={{ borderTop: '1px solid #2a2420', paddingTop: '8px' }}>
                                    <ClusterCardRail items={clusterItems!} onSelect={onSelectItem!} />
                                </div>
                            ) : (
                                <div style={{ fontSize: '11px', color: '#8a7060', borderTop: '1px solid #f0e0c8', paddingTop: '6px', fontStyle: 'italic' }}>
                                    Zoom in to view individual spots
                                </div>
                            )
                        ) : (
                            creatorName && (
                                <div style={{ fontSize: '11px', color: '#8a7060', borderTop: '1px solid #f0e0c8', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span>
                                        Added by <Link to={`/profile/${creatorName}`} style={{ fontWeight: 600, color: '#c87a30', textDecoration: 'none' }}>{creatorName}</Link> in Palabatu
                                    </span>
                                    <InfoTooltip text={ADDED_BY_DISCLAIMER} style={{ color: '#8a7060' }} />
                                </div>
                            )
                        )}

                        {type !== 'cluster' && (dimmed ? (
                            onAddFirst && (
                                <button
                                    onClick={onAddFirst}
                                    style={{
                                        marginTop: '12px', width: '100%', padding: '6px',
                                        background: 'transparent', color: '#c87a30', border: '1px solid #c87a30',
                                        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                    }}
                                >
                                    <Layers size={13} style={{ flexShrink: 0 }} /> Add the first one
                                </button>
                            )
                        ) : (
                            onViewSpot && (
                                <button
                                    onClick={onViewSpot}
                                    style={{
                                        marginTop: '12px', width: '100%', padding: '6px',
                                        background: '#c87a30', color: '#fff', border: 'none',
                                        borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                    }}
                                >
                                    View Spot
                                </button>
                            )
                        ))}
                    </div>
                </Popup>
            )}
        </Marker>
    )
}
