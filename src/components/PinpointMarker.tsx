import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { useEffect, useMemo, useRef } from 'react'

type Props = {
    position: [number, number]
    name?: string
    location?: string
    type?: 'pinpoint' | 'cluster'
}

export default function PinpointMarker({ position, name, location, type = 'pinpoint' }: Props) {
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
                    <strong>{name}</strong><br />
                    {location}
                </Popup>
            )}
        </Marker>
    )
}
