import { api } from '../lib/api.js';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { MapPin, Navigation, Mountain, Clock, Compass, Plus, ArrowRight } from 'lucide-react';
import FallbackImg from '../components/FallbackImg.js';
import { ProblemCard, type FooterStat } from '../components/ProblemCard.js';
import type { ProblemRow } from '../types/problem.js';
import type { ErrorResponse } from '../types/apitypes.js';

type Geo = { lat: number; lng: number };

const ROW_LIMIT = 10;

// Great-circle distance in km, for the "Near You" row — mirrors Landing.tsx's
// identical helper (kept as a separate copy rather than a shared lib module;
// each page's geo need is small and independent enough that extracting a
// shared module isn't worth the indirection yet).
function haversineKm(a: Geo, b: Geo): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatRelativeTime(dateStr: string): string {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    const months = Math.floor(days / 30);
    return months <= 1 ? '1 month ago' : `${months} months ago`;
}

// Deterministic "pick of the day": same problem for every visitor on a given
// calendar day, rotating to a new one tomorrow — no backend/curation feature
// needed. Prefers problems with a photo (a text-only spotlight would be a
// dull hero); falls back to the full pool if none have one yet.
function pickSpotlight(problems: ProblemRow[]): ProblemRow | null {
    if (problems.length === 0) return null;
    const withPhoto = problems.filter(p => p.image_urls?.length);
    const pool = withPhoto.length > 0 ? withPhoto : problems;
    const todaySeed = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < todaySeed.length; i++) {
        hash = (hash * 31 + todaySeed.charCodeAt(i)) >>> 0;
    }
    return pool[hash % pool.length]!;
}

// A labeled, horizontally-scrolling row of ProblemCards (Hot/Recent/Near
// You) — or, when there's nothing to show yet, a caller-supplied empty
// state (the "turn on location" prompt for Near You). Renders nothing at
// all when there's neither, so an empty row never leaves a dangling heading.
function RowSection({ title, items, navigate, emptyState }: {
    title: string;
    items: { problem: ProblemRow; footerStat?: FooterStat }[];
    navigate: NavigateFunction;
    emptyState?: React.ReactNode;
}) {
    if (items.length === 0 && !emptyState) return null;
    return (
        <section className="mb-10">
            <h2 className="font-serif text-xl font-bold text-text mb-3">{title}</h2>
            {items.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-proximity">
                    {items.map(({ problem, footerStat }) => (
                        <ProblemCard key={problem.id} problem={problem} navigate={navigate} footerStat={footerStat} className="shrink-0 w-60 snap-start" />
                    ))}
                </div>
            ) : emptyState}
        </section>
    );
}

export default function Directory() {
    const [problems, setProblems] = useState<ProblemRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [geo, setGeo] = useState<Geo | null>(null);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    const navigate = useNavigate();

    const fetchProblems = useCallback(() => {
        setIsLoading(true);
        setLoadError(null);
        api.get<ProblemRow[] | ErrorResponse>('/api/problems')
            .then(data => {
                if (Array.isArray(data)) {
                    setProblems(data);
                } else {
                    setLoadError(data.error || 'Failed to load problems.');
                }
            })
            .catch(() => setLoadError('Failed to load problems. Check your connection.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchProblems();
    }, [fetchProblems]);

    const requestLocation = () => {
        setLocating(true);
        setLocateError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
            },
            () => {
                setLocateError("Could not get your location. Check your browser's location permissions.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Today's featured pick — see pickSpotlight's own doc comment.
    const spotlight = useMemo(() => pickSpotlight(problems), [problems]);

    const hotProblems = useMemo(() => (
        [...problems]
            .sort((a, b) => (b.send_count || 0) - (a.send_count || 0))
            .slice(0, ROW_LIMIT)
            .map(problem => ({ problem }))
    ), [problems]);

    const recentProblems = useMemo(() => (
        [...problems]
            .filter(p => p.created_at)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, ROW_LIMIT)
            .map(problem => ({ problem, footerStat: { icon: Clock, label: formatRelativeTime(problem.created_at) } }))
    ), [problems]);

    const nearYouProblems = useMemo(() => {
        if (!geo) return [];
        return [...problems]
            .filter(p => p.latitude != null && p.longitude != null)
            .map(problem => ({ problem, distanceKm: haversineKm(geo, { lat: problem.latitude, lng: problem.longitude }) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, ROW_LIMIT)
            .map(({ problem, distanceKm }) => ({ problem, footerStat: { icon: Compass, label: formatDistance(distanceKm) } }));
    }, [problems, geo]);

    const totalSends = problems.reduce((sum, p) => sum + (p.send_count || 0), 0);
    const uniqueLocations = new Set(problems.map(p => p.location_name).filter(Boolean)).size;

    return (
        <div className="min-h-screen bg-ink text-text font-sans pb-12">
            <div className="max-w-[1100px] mx-auto px-6 pt-20">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="font-serif text-[32px] font-black text-text mb-1">Directory</h1>
                        <p className="text-text-muted max-w-[560px]">
                            What's hot, what's fresh, and what's climbable nearby. Scroll around, then go find your next project.
                        </p>
                    </div>
                    <Link
                        to="/map"
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all"
                    >
                        <Plus size={16} className="shrink-0" /> Add a problem
                    </Link>
                </div>

                {!isLoading && !loadError && problems.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-text-dim mb-8">
                        <span><b className="text-text font-semibold">{problems.length}</b> problems</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-border" />
                        <span><b className="text-text font-semibold">{uniqueLocations}</b> spots</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-border" />
                        <span><b className="text-text font-semibold">{totalSends}</b> sends logged</span>
                    </div>
                )}
                {(isLoading || loadError || problems.length === 0) && <div className="mb-6" />}

                {loadError ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <div className="text-text-muted">{loadError}</div>
                        <button onClick={fetchProblems} className="bg-transparent border-none text-sm text-accent hover:underline cursor-pointer p-0">
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="text-text-muted font-serif tracking-wider text-center py-16">Loading...</div>
                ) : problems.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                        <p className="text-text-muted">No problems added yet. Be the first to map one.</p>
                        <Link
                            to="/map"
                            className="mt-1 inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all"
                        >
                            <Plus size={16} className="shrink-0" /> Add a problem
                        </Link>
                    </div>
                ) : (
                    <>
                        {spotlight && (
                            <section className="mb-10">
                                <h2 className="font-serif text-xl font-bold text-text mb-3">Spotlight</h2>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`View details for ${spotlight.name}`}
                                    onClick={() => navigate(`/problems/${spotlight.id}`)}
                                    onKeyDown={(e) => {
                                        if (e.target !== e.currentTarget) return;
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            navigate(`/problems/${spotlight.id}`);
                                        }
                                    }}
                                    className="group relative rounded-2xl overflow-hidden bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer transition-colors"
                                >
                                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface">
                                        {spotlight.image_urls?.[0] ? (
                                            <FallbackImg
                                                src={spotlight.image_urls[0]}
                                                alt=""
                                                width={1100}
                                                height={620}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                fallback={Mountain}
                                                fallbackColor="var(--color-text-faint)"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Mountain size={48} className="text-text-faint shrink-0" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />

                                        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="bg-ink border border-accent/40 text-accent px-3 py-1 rounded-full text-[13px] font-bold">
                                                    {spotlight.grade}
                                                </span>
                                                <span className="flex items-center gap-1 text-xs text-text-secondary">
                                                    <MapPin size={12} className="shrink-0" /> {spotlight.location_name || 'Location not set'}
                                                </span>
                                            </div>
                                            <h3 className="font-serif text-3xl sm:text-4xl font-bold text-text mb-2">{spotlight.name}</h3>
                                            <div className="text-xs text-text-dim">
                                                by{' '}
                                                <Link
                                                    to={`/profile/${spotlight.creator_slug}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-accent font-bold no-underline hover:underline"
                                                >
                                                    {spotlight.creator_name || 'unknown'}
                                                </Link>
                                                {' '}· {spotlight.send_count || 0} {spotlight.send_count === 1 ? 'send' : 'sends'}
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/map?lat=${spotlight.latitude}&lng=${spotlight.longitude}`);
                                            }}
                                            aria-label={`Locate ${spotlight.name} on the map`}
                                            title="Locate on map"
                                            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-ink border border-border text-text-muted hover:text-accent hover:border-accent rounded-full cursor-pointer transition-colors"
                                        >
                                            <Navigation size={15} className="shrink-0" />
                                        </button>
                                    </div>
                                </div>
                            </section>
                        )}

                        <RowSection title="Hot" items={hotProblems} navigate={navigate} />
                        <RowSection title="Recent" items={recentProblems} navigate={navigate} />
                        <RowSection
                            title="Near You"
                            items={nearYouProblems}
                            navigate={navigate}
                            emptyState={
                                !geo ? (
                                    <div className="bg-panel border border-dashed border-border rounded-2xl px-6 py-8 flex flex-col items-center text-center gap-3">
                                        <Compass size={24} className="text-text-dim shrink-0" />
                                        <p className="text-sm text-text-muted max-w-[320px]">
                                            {locateError || "Turn on location to see what's climbable near you."}
                                        </p>
                                        <button
                                            onClick={requestLocation}
                                            disabled={locating}
                                            className="bg-transparent border border-accent text-accent hover:bg-accent/10 disabled:opacity-60 disabled:cursor-default rounded-lg px-4 py-2 text-sm cursor-pointer transition-colors"
                                        >
                                            {locating ? 'Locating...' : 'Use my location'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-text-muted text-sm py-6">No nearby problems found.</div>
                                )
                            }
                        />

                        <div className="flex justify-center pt-2">
                            <Link
                                to="/directory/all"
                                className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium bg-transparent border border-border text-text-dim hover:border-accent hover:text-text-secondary transition-colors"
                            >
                                See all problems <ArrowRight size={16} className="shrink-0" />
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
