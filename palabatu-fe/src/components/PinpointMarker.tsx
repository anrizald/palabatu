import L from 'leaflet'
import { Link } from 'react-router-dom'
import { Marker, Popup } from 'react-leaflet'
import { useEffect, useMemo, useRef } from 'react'

type Props = {
    position: [number, number]
    name?: string
    location?: string
    type?: 'pinpoint' | 'cluster'
    grade?: string
    creatorName?: string
    creatorId?: string
    zoom?: number
    onClickDetails?: () => void;
}

const MIN_ZOOM = 3
const MAX_ZOOM = 18
const MIN_ICON_SIZE = 16
const MAX_ICON_SIZE = 32

function iconSizeForZoom(zoom: number) {
    const t = Math.min(1, Math.max(0, (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)))
    return Math.round(MIN_ICON_SIZE + t * (MAX_ICON_SIZE - MIN_ICON_SIZE))
}

export default function PinpointMarker({ position, name, location, type = 'pinpoint', grade, creatorName, creatorId, zoom = MAX_ZOOM, onClickDetails }: Props) {
    const markerRef = useRef<L.Marker>(null)

    const markerIcon = useMemo(() => {
        const dpr = window.devicePixelRatio || 1
        const assetSize = dpr >= 3 ? 96 : dpr >= 2 ? 64 : 32
        const baseName = type === 'cluster' ? 'pinpoint-cluster' : 'pinpoint'
        const size = iconSizeForZoom(zoom)

        return L.divIcon({
            html: `<img src="/assets/pointers/${baseName}-${assetSize}.png" style="width:${size}px;height:${size}px" class="pinpoint-marker-bounce" />`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
            popupAnchor: [0, -size],
            className: 'pinpoint-marker-icon',
        })
    }, [type, zoom])

    useEffect(() => {
        markerRef.current?.setIcon(markerIcon)
    }, [markerIcon])

    return (
        <Marker position={position} ref={markerRef}>
            {(name || location) && (
                <Popup>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: '160px' }}>
                        {/* Header Row: Name and Grade Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
                            <strong style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#1a1612', lineHeight: '1.2' }}>
                                {name}
                            </strong>
                            {grade && (
                                <span style={{
                                    background: 'rgba(200,122,48,0.15)',
                                    color: '#c87a30',
                                    border: '1px solid #c87a3040',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700
                                }}>
                                    {grade}
                                </span>
                            )}
                        </div>

                        {/* Location */}
                        <div style={{ fontSize: '12px', color: '#6a5848', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📍 {location}
                        </div>

                        {/* Footer: Creator (or cluster hint) */}
                        {type === 'cluster' ? (
                            <div style={{ fontSize: '11px', color: '#8a7060', borderTop: '1px solid #f0e0c8', paddingTop: '6px', fontStyle: 'italic' }}>
                                Zoom in to view individual problems
                            </div>
                        ) : (
                            creatorName && (
                                <div style={{ fontSize: '11px', color: '#8a7060', borderTop: '1px solid #f0e0c8', paddingTop: '6px' }}>
                                    Added by <Link to={`/profile/${creatorId}`} style={{ fontWeight: 600, color: '#c87a30', textDecoration: 'none' }}>{creatorName}</Link>
                                </div>
                            )
                        )}
                        {type !== 'cluster' && onClickDetails && (
                            <button
                                onClick={onClickDetails}
                                style={{
                                    marginTop: '12px', width: '100%', padding: '6px',
                                    background: '#c87a30', color: '#fff', border: 'none',
                                    borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                                }}
                            >
                                View Details
                            </button>
                        )}
                    </div>
                </Popup>
            )}
        </Marker>
    )
}