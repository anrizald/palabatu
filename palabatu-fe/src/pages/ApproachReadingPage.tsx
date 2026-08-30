import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { Map as MapIcon, X, ChevronLeft, ChevronRight, Wifi, Check, Navigation, AlertTriangle } from 'lucide-react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import { api } from '../lib/api.js'
import { START_TYPE_LABELS, type Approach } from '../types/approach.js'
import type { ErrorResponse } from '../types/apitypes.js'

const CACHE_PREFIX = 'approach-photos-'
const STORAGE_PREFIX = 'palabatu:approach:'
const NEARBY_THRESHOLD_M = 100
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
    const R = 6371000
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
}

// Offline mechanism (handoff.md decision 21): a step's caption/order/coords
// were already persisted to localStorage on load (text is tiny, and that
// alone makes the guide legible with no signal); this hook additionally
// tries the Cache Storage API for the photo itself, falling back to network
// -- no service-worker registration needed, Cache Storage is directly
// available to page JS.
function useCachedImage(url: string | undefined, cacheName: string) {
    const [src, setSrc] = useState<string | null>(null)
    useEffect(() => {
        if (!url) { setSrc(null); return }
        let cancelled = false
        let objectUrl: string | null = null
        void (async () => {
            if ('caches' in window) {
                try {
                    const cache = await caches.open(cacheName)
                    const cached = await cache.match(url)
                    if (cached) {
                        const blob = await cached.blob()
                        objectUrl = URL.createObjectURL(blob)
                        if (!cancelled) setSrc(objectUrl)
                        return
                    }
                } catch { /* fall through to network */ }
            }
            if (!cancelled) setSrc(url)
        })()
        return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
    }, [url, cacheName])
    return src
}

function numberedIcon(n: number, active: boolean) {
    return L.divIcon({
        html: `<div style="width:${active ? 30 : 24}px;height:${active ? 30 : 24}px;border-radius:9999px;background:${active ? '#c87a30' : '#2a2420'};color:${active ? '#fef3e6' : '#967b6a'};display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;border:2px solid ${active ? '#fef3e6' : '#3a322c'};">${n}</div>`,
        iconSize: [active ? 30 : 24, active ? 30 : 24],
        iconAnchor: [active ? 15 : 12, active ? 15 : 12],
        className: '',
    })
}

// Map overview: a second way to read the same steps, for planning at home
// rather than walking -- an index into the reading view, not a separate
// feature. Only pinned steps appear.
function MapOverview({ approach, activeIdx, onSelect, onClose }: { approach: Approach; activeIdx: number; onSelect: (i: number) => void; onClose: () => void }) {
    const pinned = approach.steps.map((s, idx) => ({ s, idx })).filter(x => x.s.lat != null && x.s.lng != null)
    const center: [number, number] = pinned[0] ? [pinned[0].s.lat!, pinned[0].s.lng!] : [-2.5, 118]

    // Portaled to document.body (see the main component's return below for
    // why): the global Footer is also position:fixed at the page root and
    // otherwise wins the paint order at the bottom of the viewport.
    return createPortal((
        <div className="fixed inset-0 z-[200] bg-ink flex flex-col">
            <div className="shrink-0 flex items-center gap-2.5 px-3.5 py-3 border-b border-border bg-panel">
                <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-text truncate">Jalan masuk</div>
                    <div className="text-xs text-text-muted mt-0.5">{approach.steps.length} langkah &middot; tap one to see the photo</div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                    <X size={20} className="shrink-0" />
                </button>
            </div>
            <div style={{ height: '280px' }} className="shrink-0 border-b border-border">
                <MapContainer center={center} zoom={pinned.length ? 15 : 5} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url={TILE_URL} maxNativeZoom={19} maxZoom={20} />
                    {pinned.map(({ s, idx }) => (
                        <Marker key={s.id} position={[s.lat!, s.lng!]} icon={numberedIcon(idx + 1, idx === activeIdx)} eventHandlers={{ click: () => onSelect(idx) }} />
                    ))}
                </MapContainer>
            </div>
            <div className="flex-1 overflow-y-auto px-3.5 py-2.5">
                {approach.steps.map((s, idx) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => onSelect(idx)}
                        aria-current={idx === activeIdx}
                        className={`flex items-center gap-2.5 w-full min-h-11 px-2.5 py-2 rounded-[10px] cursor-pointer text-left mt-1 border ${idx === activeIdx ? 'bg-surface border-border' : 'bg-transparent border-transparent hover:bg-surface'}`}
                    >
                        <span className={`shrink-0 w-[26px] h-[26px] rounded-full text-xs font-medium flex items-center justify-center ${idx === activeIdx ? 'bg-accent text-on-accent' : 'bg-surface border border-border text-text-secondary'}`}>{idx + 1}</span>
                        <span className="flex-1 min-w-0 text-sm text-text-secondary truncate">{s.caption}</span>
                    </button>
                ))}
            </div>
        </div>
    ), document.body)
}

// The offline-first, one-step-at-a-time reading view (handoff.md decision
// 21) -- the deliverable. Tuned for standing at a junction, in direct sun,
// one bar of signal, one hand, possibly wet: the photo gets the screen,
// captions sit on solid ground (never over the photo), and offline state is
// stated rather than assumed.
export default function ApproachReadingPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [approach, setApproach] = useState<Approach | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [view, setView] = useState<'read' | 'map'>('read')
    const [i, setI] = useState(0)
    const [saved, setSaved] = useState<boolean | null>(null)
    const [saving, setSaving] = useState(false)
    const [nearestIdx, setNearestIdx] = useState<number | null>(null)

    const cacheName = id ? CACHE_PREFIX + id : ''
    const storageKey = id ? STORAGE_PREFIX + id : ''

    useEffect(() => {
        if (!id) return
        const loadFromCache = () => {
            const cached = localStorage.getItem(storageKey)
            if (cached) { try { setApproach(JSON.parse(cached)); return true } catch { /* fall through */ } }
            return false
        }
        api.get<Approach | ErrorResponse>(`/api/approaches/${id}`).then(res => {
            if ('error' in res) { if (!loadFromCache()) setNotFound(true); return }
            setApproach(res)
            localStorage.setItem(storageKey, JSON.stringify(res))
        }).catch(() => { if (!loadFromCache()) setNotFound(true) })
    }, [id, storageKey])

    useEffect(() => {
        if (!approach || !cacheName || !('caches' in window)) { setSaved(false); return }
        void caches.open(cacheName).then(async cache => {
            const results = await Promise.all(approach.steps.map(s => cache.match(s.photo_url)))
            setSaved(results.every(Boolean))
        })
    }, [approach, cacheName])

    const handleSaveOffline = async () => {
        if (!approach || !cacheName || !('caches' in window)) return
        setSaving(true)
        try {
            const cache = await caches.open(cacheName)
            await Promise.all(approach.steps.map(s => cache.add(s.photo_url).catch(() => {})))
            const results = await Promise.all(approach.steps.map(s => cache.match(s.photo_url)))
            setSaved(results.every(Boolean))
        } finally {
            setSaving(false)
        }
    }

    // Hedged, never auto-advancing (handoff.md's explicit requirement):
    // telling someone they've arrived when they haven't is worse than
    // saying nothing.
    useEffect(() => {
        if (!approach || !navigator.geolocation) return
        const pinned = approach.steps.some(s => s.lat != null && s.lng != null)
        if (!pinned) return
        const watchId = navigator.geolocation.watchPosition(pos => {
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            const distances = approach.steps
                .map((s, idx) => ({ idx, m: s.lat != null && s.lng != null ? haversineM(here, { lat: s.lat, lng: s.lng }) : Infinity }))
                .filter(d => d.m <= NEARBY_THRESHOLD_M)
                .sort((a, b) => a.m - b.m)
            setNearestIdx(distances[0]?.idx ?? null)
        }, () => {}, { enableHighAccuracy: true, maximumAge: 30000 })
        return () => navigator.geolocation.clearWatch(watchId)
    }, [approach])

    const step = approach?.steps[i]
    const cachedSrc = useCachedImage(step?.photo_url, cacheName)

    if (notFound) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Guide not found</div>
                <button type="button" onClick={() => navigate('/map')} className="text-accent text-sm bg-transparent border-0 cursor-pointer hover:underline">Back to the map</button>
            </div>
        )
    }
    if (!approach || !step) {
        return (
            <div className="min-h-[var(--content-h)] bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading...</div>
            </div>
        )
    }

    if (view === 'map') {
        return <MapOverview approach={approach} activeIdx={i} onSelect={idx => { setI(idx); setView('read') }} onClose={() => setView('read')} />
    }

    const last = i === approach.steps.length - 1
    const label = approach.name ?? `dari ${START_TYPE_LABELS[approach.start_type].toLowerCase()}`
    const hasPins = approach.steps.some(s => s.lat != null)

    // Portaled to document.body -- the global Footer (also position:fixed,
    // rendered later in the document at the page root) otherwise wins the
    // paint order at the bottom of the viewport against a fixed-inset view
    // like this one, same fix as AddSheet.
    return createPortal((
        <div className="fixed inset-0 z-[200] bg-ink flex flex-col">
            <div className="shrink-0 flex items-center gap-2 px-3.5 py-3 border-b border-border bg-panel">
                <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-text truncate">Jalan masuk &mdash; {label}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                        {approach.duration_minutes ? `${approach.duration_minutes} menit · ` : ''}{approach.steps.length} langkah
                    </div>
                </div>
                {hasPins && (
                    <button type="button" onClick={() => setView('map')} aria-label="see all on a map" title="see all on a map" className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                        <MapIcon size={20} className="shrink-0" />
                    </button>
                )}
                <button type="button" onClick={() => navigate(`/crags/${approach.crag_id}`)} aria-label="Close" className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                    <X size={20} className="shrink-0" />
                </button>
            </div>

            <div className={`shrink-0 flex items-center gap-2 px-3.5 py-2 text-xs border-b ${saved ? 'bg-associate/[0.08] border-associate/25' : 'bg-accent/[0.09] border-accent/25'}`}>
                {saved ? <Check size={15} className="shrink-0 text-associate" /> : <Wifi size={15} className="shrink-0 text-accent" />}
                <span className="flex-1 text-text-secondary">{saved ? 'Saved on your phone — works with no signal.' : 'Not saved yet. Do it before you lose signal.'}</span>
                {!saved && (
                    <button type="button" onClick={handleSaveOffline} disabled={saving} className="shrink-0 min-h-8 px-2.5 py-1 border border-accent rounded-lg text-accent text-xs font-medium cursor-pointer bg-transparent disabled:opacity-50">
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 relative min-h-0 bg-surface">
                    {cachedSrc && <img src={cachedSrc} alt="" className="w-full h-full object-cover" />}
                    <span className="absolute top-3 left-3 min-w-[30px] h-[30px] px-2.5 rounded-full bg-black/80 border border-border text-text text-[13px] font-medium flex items-center justify-center">{i + 1} / {approach.steps.length}</span>
                    {nearestIdx === i && (
                        <span className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-accent/95 text-on-accent text-xs font-medium">
                            <Navigation size={13} className="shrink-0" /> you're about here
                        </span>
                    )}
                </div>
                <div className="shrink-0 bg-panel border-t border-border px-4 pt-3.5 pb-3">
                    <p className="text-[17px] leading-snug text-text">{step.caption}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {step.careful_flag && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-text bg-surface border border-danger/40 rounded-full px-2.5 py-1">
                                <AlertTriangle size={13} className="shrink-0 text-danger" /> careful here
                            </span>
                        )}
                        {i === 0 && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary bg-surface border border-border rounded-full px-2.5 py-1">
                                {START_TYPE_LABELS[approach.start_type]}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="shrink-0 flex gap-1 px-4 pb-2.5 bg-panel">
                {approach.steps.map((s, idx) => <span key={s.id} className={`flex-1 h-[3px] rounded-full ${idx <= i ? 'bg-accent' : 'bg-border'}`} />)}
            </div>

            <div className="shrink-0 flex items-center gap-2.5 px-3.5 pt-2.5 pb-[calc(14px+env(safe-area-inset-bottom))] bg-panel border-t border-border">
                <button type="button" onClick={() => setI(v => v - 1)} disabled={i === 0} aria-label="Previous" className="shrink-0 w-16 min-h-[52px] rounded-[10px] border border-border bg-surface text-text-secondary flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft size={18} className="shrink-0" />
                </button>
                {last ? (
                    <button type="button" onClick={() => navigate(`/crags/${approach.crag_id}`)} className="flex-1 min-h-[52px] rounded-[10px] border border-associate/45 bg-surface text-associate font-medium text-[15px] flex items-center justify-center gap-2 cursor-pointer">
                        <Check size={18} className="shrink-0" /> Sampai! Lihat batunya
                    </button>
                ) : (
                    <button type="button" onClick={() => setI(v => v + 1)} className="flex-1 min-h-[52px] rounded-[10px] border-0 bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] text-on-accent font-medium text-[15px] flex items-center justify-center gap-2 cursor-pointer shadow-[0_2px_16px_rgba(200,122,48,0.3)]">
                        Berikutnya <ChevronRight size={18} className="shrink-0" />
                    </button>
                )}
            </div>
        </div>
    ), document.body)
}
