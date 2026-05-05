import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api.js'
import Header from '../components/Header.js'
import { useAuth } from '../lib/AuthContext.js'
import { useEffect, useMemo, useState } from 'react'
import PinpointMarker from '../components/PinpointMarker.js'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import AddProblemModal, { LocationPicker } from '../components/AddProblemModal.js'

type ProblemRow = {
    id: string | number
    name: string
    location_name: string
    latitude: number
    longitude: number
}

type NewProblem = {
    name: string
    grade: string
    location: string
    lat: number | null
    lng: number | null
}

export default function MapPage() {
    const [problems, setProblems] = useState<ProblemRow[]>([])
    const [isPicking, setIsPicking] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [newProblem, setNewProblem] = useState<NewProblem>({
        name: '',
        grade: 'V0',
        location: '',
        lat: null,
        lng: null
    })
    const { user } = useAuth()
    const center: [number, number] = [-7.797068, 110.370529]

    useEffect(() => {
        async function fetchProblems() {
            const data = await api.get('/api/problems');
            if (data.error) {
                console.error('Error fetching problems:', data.error)
            } else {
                setProblems(data as ProblemRow[])
            }
        }
        fetchProblems()
    }, [])

    const handleFAB = () => {
        if (!user) {
            alert('Please log in to add a problem');
            return;
        }
        setShowModal(true)
    }

    return (
        // <div className="h-[calc(100vh-64px)] w-full pt-16 -z-1">
        <div style={{ position: 'fixed', top: '60px', left: 0, right: 0, bottom: 0 }}>
            <Header />
            {/* <MapContainer center={center} zoom={5} className="h-full w-full"> */}
            <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <ProximityClusters problems={problems} />
                {showModal && isPicking && (
                    <LocationPicker onPick={(lat, lng) => {
                        setNewProblem(prev => ({ ...prev, lat, lng }));
                        setIsPicking(false);
                    }} />
                )}
            </MapContainer>

            {/* FAB */}
            <img
                src="/plus_button.png"
                alt="Add Problem"
                onClick={handleFAB}
                style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    width: '56px',
                    height: '56px',
                    cursor: 'pointer',
                    zIndex: 1000,
                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.4))',
                    transition: 'transform 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            />

            {showModal && (
                <AddProblemModal
                    onClose={() => setShowModal(false)}
                    onAdded={(problem) => {
                        setProblems(prev => [...prev, problem]);
                    }}
                    newProblem={newProblem}
                    setNewProblem={setNewProblem}
                    isPicking={isPicking}
                    setIsPicking={setIsPicking}
                />
            )}
        </div>
    )
}

type Cluster = {
    lat: number
    lng: number
    items: ProblemRow[]
}

function ProximityClusters({ problems }: { problems: ProblemRow[] }) {
    const map = useMap()
    const [tick, setTick] = useState(0)

    useMapEvents({
        moveend() { setTick(t => t + 1) },
        zoomend() { setTick(t => t + 1) },
    })

    const clusters: Cluster[] = useMemo(() => {
        if (!map) return []
        const zoom = map.getZoom?.()
        const thresholdPx = computeThresholdPx(zoom)
        const points = problems.map(p => ({
            item: p,
            pt: map.latLngToContainerPoint([p.latitude, p.longitude])
        }))

        const used = new Set<number>()
        const result: Cluster[] = []

        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue
            const base = points[i]
            if (!base) continue
            const group: ProblemRow[] = [base.item]
            used.add(i)
            for (let j = i + 1; j < points.length; j++) {
                if (used.has(j)) continue
                const cand = points[j]
                if (!cand) continue
                const dx = base.pt.x - cand.pt.x
                const dy = base.pt.y - cand.pt.y
                const dist = Math.hypot(dx, dy)
                if (dist <= thresholdPx) {
                    group.push(cand.item)
                    used.add(j)
                }
            }

            // centroid in lat/lng
            const { lat, lng } = group.reduce((acc, it) => ({
                lat: acc.lat + it.latitude,
                lng: acc.lng + it.longitude,
            }), { lat: 0, lng: 0 })
            result.push({
                lat: lat / group.length,
                lng: lng / group.length,
                items: group,
            })
        }
        return result
    }, [map, problems, tick])

    return (
        <>
            {clusters.map((c, idx) => {
                if (c.items.length === 1) {
                    const item = c.items[0]
                    if (!item) return null
                    return (
                        <PinpointMarker
                            key={item.id}
                            position={[item.latitude, item.longitude]}
                            name={item.name}
                            location={item.location_name}
                        />
                    )
                }
                return (
                    <PinpointMarker
                        key={`cluster-${idx}`}
                        position={[c.lat, c.lng]}
                        name={`${c.items.length} locations`}
                        location={c.items.slice(0, 3).map(i => i.name).join(', ')}
                        type="cluster"
                    />
                )
            })}
        </>
    )
}

function computeThresholdPx(zoom: number | undefined) {
    if (zoom === undefined) return 40
    const maxPx = 80
    const minPx = 18
    const scaled = maxPx - zoom * 5
    return Math.max(minPx, Math.min(maxPx, scaled))
}