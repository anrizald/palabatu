import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { useEffect, useMemo, useRef } from 'react'

type Props = {
    position: [number, number]
    name?: string
    location?: string
    type?: 'pinpoint' | 'cluster'
    grade?: string
    creatorName?: string
    onClickDetails?: () => void;
}

export default function PinpointMarker({ position, name, location, type = 'pinpoint', grade, creatorName, onClickDetails }: Props) {
    const markerRef = useRef<any>(null)

    const markerIcon = useMemo(() => (L as any).icon({
        iconUrl: type === 'cluster'
            ? '/assets/pointers/pinpoint-cluster.gif'
            : '/assets/pointers/pinpoint.gif',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
    }) as any, [type])

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
                                    Added by <span style={{ fontWeight: 600, color: '#c87a30' }}>@{creatorName}</span>
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
