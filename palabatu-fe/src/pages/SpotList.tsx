import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, Compass, Mountain, Plus, Search } from 'lucide-react';
import { getAllCrags } from '../lib/cragCache.js';
import { haversineKm, formatDistanceM, type Geo } from '../components/add-sheet/types.js';
import { useAddSheet } from '../lib/useAddSheet.js';
import FallbackImg from '../components/FallbackImg.js';
import type { CragListItem } from '../types/crag.js';

type SortBy = 'nearest' | 'newest' | 'name';

// The place index handoff-directory.md finding 1 says is missing: a crag has
// a detail page and a map pin, and nothing that lists them. One row per
// crag, distance-sorted once location is on, always name-searchable
// (handoff.md UX principle 1: never proximity-only). Entirely tier 0 --
// GET /api/crags already carries boulder_count/problem_count/image_urls, so
// there's no per-row fan-out the way enrichProblems needs for the problem
// catalog.
export function SpotList() {
    const [crags, setCrags] = useState<CragListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [sortTouched, setSortTouched] = useState(false);

    const [geo, setGeo] = useState<Geo | null>(null);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    const navigate = useNavigate();
    const { openAddSheet } = useAddSheet();

    const fetchCrags = useCallback(() => {
        setIsLoading(true);
        setLoadError(null);
        getAllCrags()
            .then(data => setCrags(data))
            .catch(() => setLoadError('Failed to load spots. Check your connection.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        fetchCrags();
    }, [fetchCrags]);

    const requestLocation = () => {
        setLocating(true);
        setLocateError(null);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                setLocating(false);
                // Sort defaults to nearest once location is on
                // (handoff-directory.md decision 12), unless the user
                // already picked a sort of their own.
                if (!sortTouched) setSortBy('nearest');
            },
            () => {
                setLocateError("Could not get your location. Check your browser's location permissions.");
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSortChange = (value: SortBy) => {
        setSortTouched(true);
        setSortBy(value);
    };

    const totalLines = crags.reduce((sum, c) => sum + c.problem_count, 0);
    const totalRocks = crags.reduce((sum, c) => sum + c.boulder_count, 0);

    const visibleCrags = useMemo(() => {
        const filtered = crags.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
        const withDistance = geo
            ? filtered.map(c => ({ crag: c, distanceKm: haversineKm(geo, { lat: c.lat, lng: c.lng }) }))
            : filtered.map(c => ({ crag: c, distanceKm: null as number | null }));

        return withDistance.sort((a, b) => {
            if (sortBy === 'nearest' && a.distanceKm != null && b.distanceKm != null) {
                return a.distanceKm - b.distanceKm;
            }
            if (sortBy === 'newest') {
                return new Date(b.crag.created_at).getTime() - new Date(a.crag.created_at).getTime();
            }
            return a.crag.name.localeCompare(b.crag.name);
        });
    }, [crags, search, sortBy, geo]);

    return (
        <div className="min-h-[var(--content-h)] bg-ink text-text font-sans pb-12">
            <div className="max-w-[1100px] mx-auto px-6 pt-6">
                <Link to="/directory" className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors w-fit mb-4">
                    <ArrowLeft size={14} className="shrink-0" /> Back to Directory
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="font-serif text-[32px] font-black text-text mb-1">Spots</h1>
                        <p className="text-text-muted max-w-[560px]">
                            Where to go this weekend. Every crag that's been mapped, near or far.
                        </p>
                    </div>
                    <button
                        onClick={() => openAddSheet({ intent: 'spot', onAdded: fetchCrags })}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all cursor-pointer"
                    >
                        <Plus size={16} className="shrink-0" /> Add a spot
                    </button>
                </div>

                {!isLoading && !loadError && crags.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-text-dim mb-6">
                        <span><b className="text-text font-semibold">{crags.length}</b> spots</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-border" />
                        <span><b className="text-text font-semibold">{totalLines}</b> lines on <b className="text-text font-semibold">{totalRocks}</b> rocks</span>
                    </div>
                )}
                {(isLoading || loadError || crags.length === 0) && <div className="mb-6" />}

                {!isLoading && !loadError && crags.length > 0 && (
                    <>
                        <div className="flex flex-wrap gap-3 mb-3">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search spots..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full bg-panel border border-border focus:border-accent rounded-xl pl-10 pr-4 py-3 text-sm text-text placeholder:text-text-faint outline-none transition-colors"
                                />
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value as SortBy)}
                                className="bg-panel border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text outline-none cursor-pointer transition-colors"
                            >
                                {geo && <option value="nearest">Sort: Nearest</option>}
                                <option value="newest">Sort: Newest</option>
                                <option value="name">Sort: Name (A-Z)</option>
                            </select>
                        </div>

                        {!geo && (
                            <div className="flex items-center gap-2 text-xs text-text-dim mb-5">
                                <Compass size={13} className="shrink-0" />
                                <span>{locateError || 'Turn on location to sort by distance.'}</span>
                                <button
                                    onClick={requestLocation}
                                    disabled={locating}
                                    className="bg-transparent border-none text-accent hover:underline disabled:opacity-60 disabled:cursor-default cursor-pointer p-0"
                                >
                                    {locating ? 'Locating...' : 'Use my location'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {loadError ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <div className="text-text-muted">{loadError}</div>
                        <button onClick={fetchCrags} className="bg-transparent border-none text-sm text-accent hover:underline cursor-pointer p-0">
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="text-text-muted font-serif tracking-wider text-center py-16">Loading...</div>
                ) : crags.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                        <p className="text-text-muted">No spots added yet. Be the first to map one.</p>
                        <button
                            onClick={() => openAddSheet({ intent: 'spot', onAdded: fetchCrags })}
                            className="mt-1 inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all cursor-pointer"
                        >
                            <Plus size={16} className="shrink-0" /> Add a spot
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {visibleCrags.map(({ crag, distanceKm }) => (
                            <SpotRow key={crag.id} crag={crag} distanceKm={distanceKm} navigate={navigate} onAddedFirst={fetchCrags} />
                        ))}
                        {visibleCrags.length === 0 && (
                            <div className="text-text-muted text-center py-16">
                                No spots match your search.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// One row per crag. Empty spots (open item 1's dimmed-empty-crag treatment,
// carried over from the map) stay visible with their own CTA rather than
// disappearing -- a hidden spot is indistinguishable from one that doesn't
// exist, and invites the duplicate.
function SpotRow({ crag, distanceKm, navigate, onAddedFirst }: {
    crag: CragListItem;
    distanceKm: number | null;
    navigate: ReturnType<typeof useNavigate>;
    onAddedFirst: () => void;
}) {
    const { openAddSheet } = useAddSheet();
    const isEmpty = crag.problem_count === 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/crags/${crag.id}`);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`View ${crag.name}`}
            onClick={() => navigate(`/crags/${crag.id}`)}
            onKeyDown={handleKeyDown}
            className={`group flex items-center gap-4 bg-panel border rounded-2xl overflow-hidden cursor-pointer transition-colors p-3 ${isEmpty ? 'border-dashed border-border' : 'border-border hover:border-accent focus-visible:border-accent'
                } focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50`}
        >
            <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface shrink-0 ${isEmpty ? 'opacity-50' : ''}`}>
                {crag.image_urls[0] ? (
                    <FallbackImg
                        src={crag.image_urls[0]}
                        alt=""
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                        fallback={Mountain}
                        fallbackColor="var(--color-text-faint)"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Mountain size={24} className="text-text-faint shrink-0" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className={`font-serif text-lg font-bold truncate ${isEmpty ? 'text-text-muted' : 'text-text group-hover:text-accent transition-colors'}`}>
                        {crag.name}
                    </h3>
                    {distanceKm != null && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-text-dim">
                            <Compass size={11} className="shrink-0" />{formatDistanceM(distanceKm)}
                        </span>
                    )}
                </div>
                <p className="text-xs text-text-dim mt-1">
                    {isEmpty
                        ? 'Nothing documented yet'
                        : `${crag.problem_count} line${crag.problem_count === 1 ? '' : 's'} on ${crag.boulder_count} rock${crag.boulder_count === 1 ? '' : 's'}`}
                </p>

                {isEmpty && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openAddSheet({ cragId: crag.id, intent: 'problem', onAdded: onAddedFirst });
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                        <Plus size={12} className="shrink-0" /> Add the first one
                    </button>
                )}
            </div>
        </div>
    );
}
