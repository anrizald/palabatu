import 'leaflet/dist/leaflet.css'
import { Search, X, Hourglass, Crosshair, Plus } from 'lucide-react'
import { getAllCrags } from '../lib/cragCache.js'
import { useAuth } from '../lib/useAuth.js'
import { useAddSheet } from '../lib/useAddSheet.js'
import { useIsMobile } from '../lib/useIsMobile.js'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import PinpointMarker from '../components/PinpointMarker.js'
import ClusterCardRail from '../components/ClusterCardRail.js'
import CragDetailLayer from '../components/CragDetailLayer.js'
import MapLegend from '../components/MapLegend.js'
import Toast, { type ToastProps } from '../components/Toast.js'
import type { CragListItem } from '../types/crag.js'
import { MapContainer, TileLayer, useMapEvents, useMap } from 'react-leaflet'
import { ZoomControlButtons } from '../components/MapControls.js'
import FallbackImg from '../components/FallbackImg.js'
import { circleButtonStyle, DETAIL_ZOOM } from '../lib/constants.js'

const MAX_ZOOM = 18
// Padded bounding box around Indonesia (Sabang to Merauke) — keeps panning within the country.
const INDONESIA_BOUNDS: [[number, number], [number, number]] = [
    [-14.5, 89.5],
    [9.5, 146.5],
]

type SearchResult = {
    place_id: number
    display_name: string
    lat: string
    lon: string
}

function LocationSearchBox() {
    const map = useMap();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 3) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        const controller = new AbortController();
        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=id&q=${encodeURIComponent(trimmed)}`,
                    { signal: controller.signal }
                );
                const data = await res.json();
                setResults(data);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Search error:', err);
                }
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        map.flyTo([parseFloat(result.lat), parseFloat(result.lon)], MAX_ZOOM, { duration: 1.5 });
        setQuery(result.display_name);
        setResults([]);
        setShowDropdown(false);
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setShowDropdown(false);
    };

    const trimmedQuery = query.trim();

    let dropdownContent: ReactNode = null;
    if (isSearching) {
        dropdownContent = (
            <div style={{ padding: '10px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#967b6a' }}>
                Searching...
            </div>
        );
    } else if (results.length === 0) {
        dropdownContent = (
            <div style={{ padding: '10px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#967b6a' }}>
                No results found
            </div>
        );
    } else {
        dropdownContent = (
            <>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '240px', overflowY: 'auto' }}>
                    {results.map(r => (
                        <li key={r.place_id}>
                            <button
                                onClick={() => handleSelect(r)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: '1px solid #1e1a16',
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    color: '#f0e0c8',
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '13px',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,122,48,0.15)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                {r.display_name}
                            </button>
                        </li>
                    ))}
                </ul>
                <div style={{ padding: '6px 12px', fontSize: '10px', color: '#5a4c40', fontFamily: "'DM Sans', sans-serif", textAlign: 'right' }}>
                    Search by OpenStreetMap
                </div>
            </>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{ width: 'min(320px, calc(100vw - 32px))' }}
        >
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#141210',
                border: '1px solid #2a2420',
                borderRadius: '10px',
                padding: '10px 12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}>
                <Search size={16} color="#967b6a" style={{ flexShrink: 0 }} />
                <input
                    type="text"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    onKeyDown={e => {
                        if (e.key === 'Escape') setShowDropdown(false);
                        else if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]!);
                    }}
                    placeholder="Search a place or paste coordinates..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#f0e0c8',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        minWidth: 0,
                    }}
                />
                {query && (
                    <button
                        onClick={handleClear}
                        aria-label="Clear search"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                        <X size={14} color="#967b6a" style={{ flexShrink: 0 }} />
                    </button>
                )}
            </div>

            {showDropdown && trimmedQuery.length >= 3 && (
                <div style={{
                    marginTop: '6px',
                    background: '#141210',
                    border: '1px solid #2a2420',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                }}>
                    {dropdownContent}
                </div>
            )}
        </div>
    );
}

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
                    ...circleButtonStyle,
                    width: '48px',
                    height: '48px',
                    cursor: 'pointer',
                    opacity: isLocating ? 0.6 : 1,
                }}
            >
                {isLocating ? (
                    <FallbackImg
                        src="/assets/locate_me/sandglass-24.png"
                        srcSet="/assets/locate_me/sandglass-24.png 1x, /assets/locate_me/sandglass-48.png 2x, /assets/locate_me/sandglass-72.png 3x"
                        alt=""
                        width={24}
                        height={24}
                        className="locate-sandglass-spin"
                        fallback={Hourglass}
                    />
                ) : (
                    <FallbackImg
                        src="/assets/locate_me/crosshair-24.png"
                        srcSet="/assets/locate_me/crosshair-24.png 1x, /assets/locate_me/crosshair-48.png 2x, /assets/locate_me/crosshair-72.png 3x"
                        alt=""
                        width={24}
                        height={24}
                        fallback={Crosshair}
                    />
                )}
            </button>
        </>
    );
}

export default function MapPage() {
    const [crags, setCrags] = useState<CragListItem[]>([])
    const { user } = useAuth()
    const { openAddSheet } = useAddSheet()
    const navigate = useNavigate()
    // const center: [number, number] = [-7.797068, 110.370529]
    const center: [number, number] = [-2.5, 118.0]

    const canAdd = !!user;

    const loadCrags = () => {
        getAllCrags().then(setCrags)
    }

    useEffect(() => { loadCrags() }, [])

    const handleFAB = () => openAddSheet({ onAdded: loadCrags })

    return (
        // Full-bleed to the bottom edge: the footer is a transparent overlay and
        // the tiles are meant to show through behind it. Only the map's own
        // controls below hold back by --footer-h so they don't collide with it
        // -- index.css scopes that lift to .leaflet-full-bleed-page specifically
        // (not every .leaflet-container app-wide) since this is the one map
        // that actually shares the viewport's bottom edge with the footer.
        // (The elevated look that creates is a known open item -- see chat
        // 2026-08-31 -- not yet resolved; the footer-credit-merge tried in the
        // same discussion was reverted, so this still runs Leaflet's own
        // attribution control.)
        <div className="leaflet-full-bleed-page" style={{ position: 'fixed', top: 'var(--header-h)', left: 0, right: 0, bottom: 0 }}>
            <MapContainer
                center={center}
                zoom={5}
                minZoom={5}
                maxZoom={20}
                zoomControl={false}
                maxBounds={INDONESIA_BOUNDS}
                maxBoundsViscosity={1.0}
                style={{ height: '100%', width: '100%' }}
            >
                {/* <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /> */}
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Tiles &copy; Esri &mdash; Source: Esri"
                    maxNativeZoom={18}
                    maxZoom={20}
                />
                <MapFlyTo />
                <div
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '12px',
                    }}
                >
                    <LocationSearchBox />
                    <ZoomControlButtons />
                </div>
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(24px + var(--footer-h))',
                        left: '16px',
                        zIndex: 1000,
                    }}
                >
                    <MapLegend />
                </div>
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(24px + var(--footer-h))',
                        right: '24px',
                        zIndex: 1000, // Must be high enough to float over the map tiles
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                    }}
                >
                    <LocateMeButton />
                    {canAdd && (
                        <button
                            onClick={handleFAB}
                            aria-label="Add Problem"
                            style={{
                                ...circleButtonStyle,
                                width: '48px',
                                height: '48px',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            <FallbackImg
                                src="/assets/add_fab/boring-plus-56.png"
                                srcSet="/assets/add_fab/boring-plus-56.png 1x, /assets/add_fab/boring-plus-112.png 2x, /assets/add_fab/boring-plus-168.png 3x"
                                alt=""
                                width={24}
                                height={24}
                                fallback={Plus}
                            />
                        </button>
                    )}
                </div>
                <ProximityClusters
                    crags={crags}
                    onViewSpot={crag => navigate(`/crags/${crag.id}`)}
                    onAddFirst={crag => openAddSheet({ cragId: crag.id, onAdded: loadCrags })}
                />
            </MapContainer>
        </div>
    )
}

type Cluster = {
    lat: number
    lng: number
    items: CragListItem[]
}

function ProximityClusters({ crags, onViewSpot, onAddFirst }: { crags: CragListItem[]; onViewSpot: (crag: CragListItem) => void; onAddFirst: (crag: CragListItem) => void }) {
    const map = useMap()
    const isMobile = useIsMobile()
    const [tick, setTick] = useState(0)
    const [mobileCluster, setMobileCluster] = useState<Cluster | null>(null)
    // Crag IDs confirmed (via CragDetailLayer's onContentAvailability) to have
    // at least one geocoded rock or approach-start -- once true, the crag pin
    // is genuinely redundant with what's now on screen and gets hidden
    // outright rather than merely de-emphasized (see the render below).
    // Grows only, never shrinks back within a session: whether a crag has any
    // geocoded content is a fact about its data, not something that flickers.
    const [cragsWithDetail, setCragsWithDetail] = useState<Set<string>>(new Set())
    const markCragHasDetail = (cragId: string, hasContent: boolean) => {
        if (!hasContent) return
        setCragsWithDetail(prev => prev.has(cragId) ? prev : new Set(prev).add(cragId))
    }

    // Only zoom needs to retrigger clustering: latLngToContainerPoint distances
    // between markers are pan-invariant (panning is a pure translation that
    // cancels out when diffing two container points), so recomputing on
    // moveend was pure waste — and worse, it re-rendered the marker/Popup tree
    // on every pan-end, which made Leaflet's Popup re-adjustPan and snap the
    // view back onto an open card no matter how far the user had panned away.
    useMapEvents({
        zoomend() { setTick(t => t + 1) },
    })

    const clusters: Cluster[] = useMemo(() => {
        if (!map) return []
        const zoom = map.getZoom?.()
        const thresholdPx = computeThresholdPx(zoom)
        const points = crags.map(c => ({
            item: c,
            pt: map.latLngToContainerPoint([c.lat, c.lng])
        }))

        const used = new Set<number>()
        const result: Cluster[] = []

        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue
            const base = points[i]
            if (!base) continue
            const group: CragListItem[] = [base.item]
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
                lat: acc.lat + it.lat,
                lng: acc.lng + it.lng,
            }), { lat: 0, lng: 0 })
            result.push({
                lat: lat / group.length,
                lng: lng / group.length,
                items: group,
            })
        }
        return result
        // tick intentionally included though unread here: it's bumped by the
        // zoomend handler above purely to force this memo to recompute, since
        // map.getZoom()/latLngToContainerPoint reads are imperative and not
        // themselves reactive dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, crags, tick])

    const currentZoom = map?.getZoom?.() ?? 13

    const focusItem = (item: CragListItem) => {
        map.flyTo([item.lat, item.lng], MAX_ZOOM, { duration: 1.2 })
        onViewSpot(item)
    }

    return (
        <>
            {clusters.map((c, idx) => {
                if (c.items.length === 1) {
                    const item = c.items[0]
                    if (!item) return null
                    const isEmpty = item.problem_count === 0
                    const showDetail = currentZoom >= DETAIL_ZOOM
                    const hasDetail = cragsWithDetail.has(item.id)
                    return (
                        <Fragment key={item.id}>
                            {/* Crag pin: hidden outright once its own rocks/trail
                                are confirmed on screen (genuinely redundant at
                                that point, not just crowded); de-emphasized
                                (capped size, no bounce) while zoomed in but
                                before that's confirmed, since it may still be
                                the only marker this crag has -- many rocks have
                                no coordinate at all (handoff.md open item 13). */}
                            {!(showDetail && hasDetail) && (
                                <PinpointMarker
                                    position={[item.lat, item.lng]}
                                    name={item.name}
                                    directions={item.directions}
                                    boulderCount={item.boulder_count}
                                    problemCount={item.problem_count}
                                    creatorName={item.creator_name}
                                    zoom={currentZoom}
                                    dimmed={isEmpty}
                                    deemphasized={showDetail}
                                    onViewSpot={() => onViewSpot(item)}
                                    onAddFirst={() => onAddFirst(item)}
                                />
                            )}
                            {/* Close-zoom layers (handoff.md open item 13):
                                a crag's own rocks and its approaches' start
                                points, each at their own coordinate --
                                distinct from this far-out "there's climbing
                                here" pin. */}
                            {showDetail && (
                                <CragDetailLayer
                                    cragId={item.id}
                                    onContentAvailability={hasContent => markCragHasDetail(item.id, hasContent)}
                                />
                            )}
                        </Fragment>
                    )
                }
                return (
                    <PinpointMarker
                        key={`cluster-${idx}`}
                        position={[c.lat, c.lng]}
                        name={`${c.items.length} spots`}
                        type="cluster"
                        zoom={currentZoom}
                        clusterItems={c.items}
                        onSelectItem={focusItem}
                        {...(isMobile ? { onClusterTap: () => setMobileCluster(c) } : {})}
                    />
                )
            })}
            <MobileClusterSheet
                cluster={mobileCluster}
                onClose={() => setMobileCluster(null)}
                onSelect={item => {
                    setMobileCluster(null)
                    focusItem(item)
                }}
            />
        </>
    )
}

function MobileClusterSheet({ cluster, onClose, onSelect }: { cluster: Cluster | null; onClose: () => void; onSelect: (item: CragListItem) => void }) {
    if (!cluster) return null

    return (
        <>
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,6,0.45)', zIndex: 1150 }}
            />
            <div
                style={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1200,
                    background: '#141210',
                    borderTop: '1px solid #2a2420',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#967b6a' }}>
                        {cluster.items.length} locations here
                    </span>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                    >
                        <X size={18} color="#967b6a" style={{ flexShrink: 0 }} />
                    </button>
                </div>
                <div style={{ padding: '0 16px 4px' }}>
                    <ClusterCardRail items={cluster.items} onSelect={onSelect} />
                </div>
            </div>
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