import 'leaflet/dist/leaflet.css'
import { api } from '../lib/api.js'
import Header from '../components/Header.js'
import { useAuth } from '../lib/AuthContext.js'
import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import PinpointMarker from '../components/PinpointMarker.js'
import ProblemDetails from '../components/ProblemDetails.js'
import Toast, { type ToastProps } from '../components/Toast.js'
import type { NewProblem, ProblemRow } from '../types/problem.js'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import AddProblemModal, { LocationPicker } from '../components/AddProblemModal.js'

const MAX_ZOOM = 18
function LocateMeButton() {
    const map = useMap();
    const [isLocating, setIsLocating] = useState(false);
    const [toast, setToast] = useState<ToastProps | null>(null);

    const handleLocate = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                map.flyTo([latitude, longitude], MAX_ZOOM, { duration: 1.5 });
                setIsLocating(false);
            },
            (err) => {
                console.error("GPS Error:", err);
                setToast({
                    message: "Could not find your location. Please check your browser's location permissions.",
                    type: 'error',
                    onClose: () => setToast(null)
                });
                setIsLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    return (
        <>
        {toast && <Toast {...toast} />}
        <button
            onClick={handleLocate}
            disabled={isLocating}
            title="Find my location"
            aria-label="Find my location"
            style={{
                position: 'absolute',
                bottom: '100px', // Just above your Add Problem FAB
                right: '24px',
                zIndex: 1000, // Must be high enough to float over the map tiles
                background: '#141210',
                border: '1px solid #c87a30',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                opacity: isLocating ? 0.6 : 1,
                transition: 'all 0.2s'
            }}
        >
            {isLocating ? (
                <img
                    src="/assets/locate_me/sandglass-24.png"
                    srcSet="/assets/locate_me/sandglass-24.png 1x, /assets/locate_me/sandglass-48.png 2x, /assets/locate_me/sandglass-72.png 3x"
                    alt=""
                    width={24}
                    height={24}
                    className="locate-sandglass-spin"
                />
            ) : (
                <img
                    src="/assets/locate_me/crosshair-24.png"
                    srcSet="/assets/locate_me/crosshair-24.png 1x, /assets/locate_me/crosshair-48.png 2x, /assets/locate_me/crosshair-72.png 3x"
                    alt=""
                    width={24}
                    height={24}
                />
            )}
        </button>
        </>
    );
}

export default function MapPage() {
    const [problems, setProblems] = useState<ProblemRow[]>([])
    const [isPicking, setIsPicking] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [selectedProblem, setSelectedProblem] = useState<ProblemRow | null>(null);
    const [editPickedCoords, setEditPickedCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [newProblem, setNewProblem] = useState<NewProblem>({
        name: '',
        grade: 'V0',
        location: '',
        lat: null,
        lng: null,
        imageFiles: [],
        imagePreviews: []
    })
    const { user } = useAuth()
    // const center: [number, number] = [-7.797068, 110.370529]
    const center: [number, number] = [-2.5, 118.0]
    const [userTitles, setUserTitles] = useState<string[]>([]);
    const [toast, setToast] = useState<ToastProps | null>(null);

    useEffect(() => {
        if (user?.id) {
            api.get(`/api/profiles/${user.id}`).then(data => {
                if (data && data.title) {
                    // Handle parsing if it comes back as a string or array
                    const parsedTitles = typeof data.title === 'string' ? JSON.parse(data.title) : data.title;
                    setUserTitles(parsedTitles || []);
                }
            });
        }
    }, [user])

    // const canAdd = userTitles.includes('Council') || userTitles.includes('Associate');
    const canAdd = !!user;

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
            setToast({ message: 'Please log in to add a problem', type: 'error', onClose: () => setToast(null) });
            return;
        }

        setNewProblem({
            name: '',
            grade: 'V0',
            location: '',
            lat: null,
            lng: null,
            imageFiles: [],
            imagePreviews: []
        });

        setShowModal(true)
    }

    return (
        <div style={{ position: 'fixed', top: '60px', left: 0, right: 0, bottom: 0 }}>
            {toast && <Toast {...toast} />}
            <Header />
            <MapContainer center={center} zoom={5} minZoom={3} maxZoom={18} style={{ height: '100%', width: '100%' }}>
                {/* <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri"
                />
                <MapFlyTo />
                <LocateMeButton />
                <ProximityClusters problems={problems} setSelectedProblem={setSelectedProblem} />
                {(showModal || selectedProblem) && isPicking && (
                    <LocationPicker onPick={(lat, lng) => {
                        if (showModal) {
                            setNewProblem(prev => ({ ...prev, lat, lng }));
                        } else {
                            setEditPickedCoords({ lat, lng });
                        }
                        setIsPicking(false);
                    }} />
                )}
            </MapContainer>

            {canAdd && (
                <img
                    src="/assets/add_fab/boring-plus-56.png"
                    srcSet="/assets/add_fab/boring-plus-56.png 1x, /assets/add_fab/boring-plus-112.png 2x, /assets/add_fab/boring-plus-168.png 3x"
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
            )}

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

            {selectedProblem && (
                <ProblemDetails
                    problem={selectedProblem}
                    userTitles={userTitles}
                    onClose={() => {
                        setSelectedProblem(null);
                        setEditPickedCoords(null);
                        setIsPicking(false);
                    }}
                    onDelete={(id) => {
                        setProblems(prev => prev.filter(p => p.id !== id));
                        setSelectedProblem(null);
                    }}
                    onUpdate={(updatedItem) => {
                        setProblems(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p));
                    }}
                    isPicking={isPicking}
                    setIsPicking={setIsPicking}
                    pickedCoords={editPickedCoords}
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

function ProximityClusters({ problems, setSelectedProblem }: { problems: ProblemRow[]; setSelectedProblem: (problem: ProblemRow) => void }) {
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

    const currentZoom = map?.getZoom?.() ?? 13

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
                            grade={item.grade}
                            creatorName={item.creator_name}
                            creatorId={item.created_by}
                            zoom={currentZoom}
                            onClickDetails={() => setSelectedProblem(item)}
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
                        zoom={currentZoom}
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

function MapFlyTo() {
    const map = useMap();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const lat = searchParams.get('lat');
        const lng = searchParams.get('lng');

        if (lat && lng) {
            map.flyTo([parseFloat(lat), parseFloat(lng)], MAX_ZOOM, { duration: 1.5 });
        }
    }, [map, searchParams]);

    return null;
}