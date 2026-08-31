import { api } from '../lib/api.js';
import { enrichProblems, getAllCrags, getBouldersForCrag, getApproachesForCrag } from '../lib/cragCache.js';
import { Link, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Mountain, Compass, Plus, ArrowRight, Navigation, Footprints, Layers } from 'lucide-react';
import { ProblemCard } from '../components/ProblemCard.js';
import FallbackImg from '../components/FallbackImg.js';
import { useAddSheet } from '../lib/useAddSheet.js';
import type { ProblemListItem, EnrichedProblem } from '../types/problem.js';
import type { CragListItem } from '../types/crag.js';
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

// A pick of either kind — Spotlight can showcase a climb or a place.
type SpotlightPick =
    | { kind: 'problem'; problem: EnrichedProblem }
    | { kind: 'spot'; crag: CragListItem };

// Deterministic "pick of the day": same pick for every visitor on a given
// calendar day, rotating to a new one tomorrow — no backend/curation feature
// needed. Draws from problems and spots (crags) in one combined pool, so
// Spotlight can land on a climb one day and a place the next; which kind
// shows up is proportional to how many of each have a photo, not a fixed
// 50/50 split — fine for now, revisit if spots end up crowded out once the
// problem count grows much larger than the spot count. Prefers photographed
// candidates of either kind (a text-only hero would be dull); only falls
// back to the full pool if *nothing* has a photo yet.
function pickSpotlight(problems: EnrichedProblem[], crags: CragListItem[]): SpotlightPick | null {
    const candidates: SpotlightPick[] = [
        ...problems.map(problem => ({ kind: 'problem' as const, problem })),
        ...crags.map(crag => ({ kind: 'spot' as const, crag })),
    ];
    if (candidates.length === 0) return null;

    const hasPhoto = (c: SpotlightPick) => c.kind === 'problem' ? !!c.problem.thumbnailUrl : c.crag.image_urls.length > 0;
    const withPhoto = candidates.filter(hasPhoto);
    const pool = withPhoto.length > 0 ? withPhoto : candidates;

    const todaySeed = new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < todaySeed.length; i++) {
        hash = (hash * 31 + todaySeed.charCodeAt(i)) >>> 0;
    }
    return pool[hash % pool.length]!;
}

type NearSpot = { crag: CragListItem; distanceKm: number };

// A rock with at least one recently-added line, plus the label/thumbnail its
// card needs (handoff-directory.md decision 2: "Recent" is deduplicated at
// the rock level, one card per rock instead of one per line on it).
type RecentRock = {
    boulderId: string;
    cragId: string;
    cragName: string | null;
    boulderName: string | null;
    thumbnailUrl: string | null;
    count: number;
    lastCreatedAt: string;
    sampleName: string;
};

// UX principle 3's photoless/unnamed-rock fallback ("Slab Mantap, Sit
// Start" rather than a bare index), computed from the recent batch itself
// rather than a fetched sample_problem_name — this card is already showing
// off a handful of that rock's newest lines, so the oldest of *those* is a
// fine stand-in for "the problem this rock is known by".
function rockLabel(rock: RecentRock): string {
    if (rock.boulderName) return rock.boulderName;
    return rock.count > 1 ? `${rock.sampleName}, and more` : rock.sampleName;
}

// A labeled, horizontally-scrolling row (Near You/Recent/Hot) — or, when
// there's nothing to show yet, a caller-supplied empty state (the "turn on
// location" prompt for Near You). Renders nothing at all when there's
// neither, so an empty row never leaves a dangling heading. Generic over the
// item type since each row is now a different entity (spots, rocks,
// problems — handoff-directory.md decision 2), not just ProblemCard reused
// three ways.
function RowSection<T>({ title, items, renderItem, seeAll, emptyState }: {
    title: string;
    items: T[];
    renderItem: (item: T) => React.ReactNode;
    seeAll?: string;
    emptyState?: React.ReactNode;
}) {
    if (items.length === 0 && !emptyState) return null;
    return (
        <section className="mb-10">
            <div className="flex items-center justify-between mb-3">
                <h2 className="font-serif text-xl font-bold text-text">{title}</h2>
                {seeAll && items.length > 0 && (
                    <Link to={seeAll} className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent transition-colors">
                        see all <ArrowRight size={12} className="shrink-0" />
                    </Link>
                )}
            </div>
            {items.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-proximity">
                    {items.map(renderItem)}
                </div>
            ) : emptyState}
        </section>
    );
}

// Near You's card — a spot, not a problem (decision 2: "Citatah · 800 m ·
// 14 lines on 3 rocks", never eight cards of the same rock crowding out the
// second-nearest place). Empty spots (open item 1's dimmed treatment) stay
// in the mix rather than being filtered out — a nearby spot with nothing on
// it yet is still worth knowing about.
function SpotCard({ crag, distanceKm, navigate, className = '' }: {
    crag: CragListItem;
    distanceKm: number;
    navigate: NavigateFunction;
    className?: string;
}) {
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
            className={`group bg-panel border rounded-2xl overflow-hidden cursor-pointer transition-colors hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${isEmpty ? 'border-dashed border-border' : 'border-border hover:border-accent focus-visible:border-accent'
                } ${className}`}
        >
            <div className={`relative aspect-[4/3] w-full overflow-hidden bg-surface ${isEmpty ? 'opacity-50' : ''}`}>
                {crag.image_urls[0] ? (
                    <FallbackImg
                        src={crag.image_urls[0]}
                        alt=""
                        width={400}
                        height={300}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        fallback={Mountain}
                        fallbackColor="var(--color-text-faint)"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                    </div>
                )}
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-ink/80 text-text-secondary text-[11px] px-2 py-1 rounded-full">
                    <Compass size={11} className="shrink-0" />{formatDistance(distanceKm)}
                </span>
            </div>
            <div className="p-4">
                <h3 className={`font-serif text-lg font-bold truncate mb-1 ${isEmpty ? 'text-text-muted' : 'text-text'}`}>{crag.name}</h3>
                <p className="text-xs text-text-dim">
                    {isEmpty
                        ? 'Nothing documented yet'
                        : `${crag.problem_count} line${crag.problem_count === 1 ? '' : 's'} on ${crag.boulder_count} rock${crag.boulder_count === 1 ? '' : 's'}`}
                </p>
            </div>
        </div>
    );
}

// Recently documented's card — a rock, not a problem (decision 2: one card
// per rock, "3 new lines", linking to the rock rather than any one problem
// on it, which is where someone actually wants to land after seeing it).
function RockCard({ rock, navigate, className = '' }: {
    rock: RecentRock;
    navigate: NavigateFunction;
    className?: string;
}) {
    const label = rockLabel(rock);
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/boulders/${rock.boulderId}`);
        }
    };
    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`View ${label}`}
            onClick={() => navigate(`/boulders/${rock.boulderId}`)}
            onKeyDown={handleKeyDown}
            className={`group bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-2xl overflow-hidden cursor-pointer transition-colors hover:-translate-y-1 ${className}`}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                {rock.thumbnailUrl ? (
                    <FallbackImg
                        src={rock.thumbnailUrl}
                        alt=""
                        width={400}
                        height={300}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        fallback={Mountain}
                        fallbackColor="var(--color-text-faint)"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                    </div>
                )}
                <span className="absolute bottom-3 left-3 bg-ink border border-accent/40 text-accent px-3 py-1 rounded-full text-[13px] font-bold">
                    {rock.count} new line{rock.count === 1 ? '' : 's'}
                </span>
            </div>
            <div className="p-4">
                <h3 className="font-serif text-lg font-bold text-text truncate mb-1">{label}</h3>
                <p className="text-xs text-text-dim truncate">{rock.cragName || 'Spot not set'}</p>
            </div>
        </div>
    );
}

// Spotlight's "place" hero — same visual language as ProblemCard's hero
// variant (rounded-2xl photo, bottom gradient panel, locate button), but for
// a crag: a "Spot" tag instead of a grade, "N lines on M rocks" instead of a
// send count, and an unconditional locate button since a crag's lat/lng are
// always present (unlike a problem's, which can be null). No creator link —
// CragListItem carries a display name but no profile slug to link to.
function SpotHero({ crag, navigate }: { crag: CragListItem; navigate: NavigateFunction }) {
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
            className="group relative rounded-2xl overflow-hidden bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer transition-colors"
        >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface">
                {crag.image_urls[0] ? (
                    <FallbackImg
                        src={crag.image_urls[0]}
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
                    <span className="inline-block bg-ink border border-text-muted/40 text-text-muted px-3 py-1 rounded-full text-[13px] font-bold mb-2">
                        Spot
                    </span>
                    <h3 className="font-serif text-3xl sm:text-4xl font-bold text-text mb-2">{crag.name}</h3>
                    <div className="text-xs text-text-dim">
                        by {crag.creator_name || 'unknown'} ·{' '}
                        {crag.problem_count > 0
                            ? `${crag.problem_count} line${crag.problem_count === 1 ? '' : 's'} on ${crag.boulder_count} rock${crag.boulder_count === 1 ? '' : 's'}`
                            : 'nothing documented yet'}
                    </div>
                </div>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/map?lat=${crag.lat}&lng=${crag.lng}`);
                    }}
                    aria-label={`Locate ${crag.name} on the map`}
                    title="Locate on map"
                    className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-ink border border-border text-text-muted hover:text-accent hover:border-accent rounded-full cursor-pointer transition-colors"
                >
                    <Navigation size={15} className="shrink-0" />
                </button>
            </div>
        </div>
    );
}

// One contribution-gap slot (decision 8): a single rotating banner asking
// for whichever of the three real gaps is nearest, not a chore list. Bounds
// its own fan-out rather than needing a new backend field — "nearest you"
// is already a geographic filter, so it only ever checks a handful of
// candidate spots (GAP_SCAN_LIMIT), not every crag in the system, using the
// same per-crag boulder/approach calls the map and CragDetailPage already
// make (cached by cragCache.ts, so repeat visits are free).
type Gap =
    | { kind: 'no-approach'; crag: CragListItem }
    | { kind: 'no-photo'; crag: CragListItem; boulderId: string; rockLabel: string; lineCount: number }
    | { kind: 'no-lines'; crag: CragListItem };

const GAP_SCAN_LIMIT = 8;

// Nearest-first when geo is on, list order otherwise (open item 4: "needs a
// call when building step 7" — went with the doc's own "probably: nearest
// first" default; personalising against the viewer's own sends as a
// tiebreak is a real idea, deferred rather than built here). Checked in the
// same priority order decision 8 lists the gaps in: a documented spot with
// no approach first, then a lined-but-photoless rock, then an entirely
// undocumented spot -- the first candidate crag that qualifies for any of
// them wins, so "nearest" always beats "which gap type".
async function findContributionGap(crags: CragListItem[], geo: Geo | null): Promise<Gap | null> {
    const ordered = geo
        ? [...crags].sort((a, b) => haversineKm(geo, { lat: a.lat, lng: a.lng }) - haversineKm(geo, { lat: b.lat, lng: b.lng }))
        : crags;

    for (const crag of ordered.slice(0, GAP_SCAN_LIMIT)) {
        const [boulders, approaches] = await Promise.all([
            getBouldersForCrag(crag.id),
            getApproachesForCrag(crag.id),
        ]);

        if (crag.problem_count > 0 && approaches.length === 0) {
            return { kind: 'no-approach', crag };
        }

        const photoless = boulders.find(b => b.problem_count > 0 && b.image_urls.length === 0);
        if (photoless) {
            return {
                kind: 'no-photo',
                crag,
                boulderId: photoless.id,
                rockLabel: photoless.name ?? photoless.sample_problem_name ?? 'that rock',
                lineCount: photoless.problem_count,
            };
        }

        if (crag.problem_count === 0) {
            return { kind: 'no-lines', crag };
        }
    }
    return null;
}

// Copy mirrors the voice CragDetailPage/BoulderDetailPage already use for
// these exact empty states (see `Jalan masuk`'s "Nobody has mapped the walk
// in yet... your photos are the difference between someone finding this
// place and giving up at a junction") rather than inventing a new tone.
function GapBanner({ gap, navigate, onAdded }: { gap: Gap; navigate: NavigateFunction; onAdded: () => void }) {
    const { openAddSheet } = useAddSheet();

    const content = gap.kind === 'no-approach'
        ? {
            Icon: Footprints,
            text: `Nobody's mapped the way in to ${gap.crag.name} yet. If you've been, your photos are the difference between someone finding this place and giving up at a junction.`,
            cta: 'Add the way in',
            onClick: () => navigate(`/crags/${gap.crag.id}/approaches/new`),
        }
        : gap.kind === 'no-photo'
            ? {
                Icon: Layers,
                text: `${gap.rockLabel} at ${gap.crag.name} already has ${gap.lineCount} line${gap.lineCount === 1 ? '' : 's'} and no photo. A picture is the difference between someone finding those lines and walking right past.`,
                cta: 'Add a photo',
                onClick: () => navigate(`/boulders/${gap.boulderId}`),
            }
            : {
                Icon: Mountain,
                text: `${gap.crag.name} is on the map with nothing documented yet. Be the first to add a line.`,
                cta: 'Add the first one',
                onClick: () => openAddSheet({ cragId: gap.crag.id, intent: 'problem', onAdded }),
            };

    return (
        <section className="mb-10">
            <div className="bg-panel border border-dashed border-border rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <content.Icon size={22} className="text-text-dim shrink-0" />
                <p className="text-sm text-text-secondary flex-1">{content.text}</p>
                <button
                    onClick={content.onClick}
                    className="shrink-0 inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-[10px] text-sm font-medium text-on-accent bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px transition-all cursor-pointer"
                >
                    <Plus size={15} className="shrink-0" /> {content.cta}
                </button>
            </div>
        </section>
    );
}

export default function Directory() {
    const [problems, setProblems] = useState<EnrichedProblem[]>([]);
    const [crags, setCrags] = useState<CragListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [geo, setGeo] = useState<Geo | null>(null);
    const [locating, setLocating] = useState(false);
    const [locateError, setLocateError] = useState<string | null>(null);

    const [gap, setGap] = useState<Gap | null>(null);

    const navigate = useNavigate();
    const { openAddSheet } = useAddSheet();

    // Spots and lines load together — the stat bar and the three empty-state
    // cases below (no spots / spots but no lines / normal) all need both at
    // once, so there's no correct partial-render to show in between.
    const loadAll = useCallback(() => {
        setIsLoading(true);
        setLoadError(null);
        Promise.all([
            api.get<ProblemListItem[] | ErrorResponse>('/api/problems'),
            getAllCrags(),
        ])
            .then(async ([problemsData, cragsData]) => {
                if (Array.isArray(problemsData)) {
                    setProblems(await enrichProblems(problemsData));
                } else {
                    setLoadError(problemsData.error || 'Failed to load problems.');
                }
                setCrags(cragsData);
            })
            .catch(() => setLoadError('Failed to load the directory. Check your connection.'))
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    // The gap slot loads independently of the main page (it costs several
    // extra, cached requests -- see findContributionGap) and re-runs once
    // geo turns on, since a newly-available location can surface a nearer
    // candidate than the list-order fallback found. Guarded by a `cancelled`
    // flag rather than an AbortController: cragCache's calls aren't
    // cancellable, but the check keeps a slow, superseded lookup (e.g. geo
    // arriving mid-flight) from clobbering a fresher one that finished first.
    useEffect(() => {
        if (crags.length === 0) return;
        let cancelled = false;
        findContributionGap(crags, geo).then(result => {
            if (!cancelled) setGap(result);
        });
        return () => { cancelled = true; };
    }, [crags, geo]);

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
    const spotlight = useMemo(() => pickSpotlight(problems, crags), [problems, crags]);

    const hotProblems = useMemo(() => (
        [...problems]
            .sort((a, b) => (b.send_count || 0) - (a.send_count || 0))
            .slice(0, ROW_LIMIT)
            .map(problem => ({ problem }))
    ), [problems]);

    // Near You, at the spot level (decision 2) — a crag's lat/lng are
    // required, so once there's at least one spot this is never empty; the
    // only reason it renders nothing is geo being off (handled by
    // RowSection's emptyState below), not a lack of results.
    const nearSpots = useMemo<NearSpot[]>(() => {
        if (!geo) return [];
        return crags
            .map(crag => ({ crag, distanceKm: haversineKm(geo, { lat: crag.lat, lng: crag.lng }) }))
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .slice(0, ROW_LIMIT);
    }, [crags, geo]);

    // Recently documented, at the rock level (decision 2) — group the
    // newest lines by the rock they're on so a single documentation session
    // becomes one legible card instead of N identical ones. Pool is capped
    // rather than "all problems" so a rock's activity from months ago
    // doesn't get pulled into "recent" just because nothing newer exists on
    // it since.
    const recentRocks = useMemo<RecentRock[]>(() => {
        const pool = [...problems]
            .filter(p => p.created_at)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 30);

        const byBoulder = new Map<string, EnrichedProblem[]>();
        for (const p of pool) {
            const group = byBoulder.get(p.boulder_id);
            if (group) group.push(p); else byBoulder.set(p.boulder_id, [p]);
        }

        return [...byBoulder.entries()]
            .map(([boulderId, group]) => {
                const latest = group[0]!; // pool is newest-first, so this group's first entry is its newest
                const oldest = group[group.length - 1]!;
                return {
                    boulderId,
                    cragId: latest.crag_id,
                    cragName: latest.crag_name,
                    boulderName: latest.boulder_name,
                    thumbnailUrl: latest.thumbnailUrl,
                    count: group.length,
                    lastCreatedAt: latest.created_at,
                    sampleName: oldest.name,
                };
            })
            .sort((a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime())
            .slice(0, ROW_LIMIT);
    }, [problems]);

    const totalSends = problems.reduce((sum, p) => sum + (p.send_count || 0), 0);

    return (
        <div className="min-h-[var(--content-h)] bg-ink text-text font-sans pb-12">
            <div className="max-w-[1100px] mx-auto px-6 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
                    <div>
                        <h1 className="font-serif text-[32px] font-black text-text mb-1">Directory</h1>
                        <p className="text-text-muted max-w-[560px]">
                            What's hot, what's fresh, and what's climbable nearby. Scroll around, then go find your next project.
                        </p>
                    </div>
                    <button
                        onClick={() => openAddSheet({ onAdded: loadAll })}
                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all cursor-pointer"
                    >
                        <Plus size={16} className="shrink-0" /> Add
                    </button>
                </div>

                {!isLoading && !loadError && crags.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-text-dim mb-8">
                        <span><b className="text-text font-semibold">{crags.length}</b> spots</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-border" />
                        <span><b className="text-text font-semibold">{problems.length}</b> lines</span>
                        <span className="w-[3px] h-[3px] rounded-full bg-border" />
                        <span><b className="text-text font-semibold">{totalSends}</b> sends logged</span>
                    </div>
                )}
                {(isLoading || loadError || crags.length === 0) && <div className="mb-6" />}

                {loadError ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <div className="text-text-muted">{loadError}</div>
                        <button onClick={loadAll} className="bg-transparent border-none text-sm text-accent hover:underline cursor-pointer p-0">
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="text-text-muted font-serif tracking-wider text-center py-16">Loading...</div>
                ) : crags.length === 0 ? (
                    // Case 1 of 3: no spots at all yet — the true bootstrap-empty state.
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                        <p className="text-text-muted">No spots added yet. Be the first to map one.</p>
                        <button
                            onClick={() => openAddSheet({ intent: 'spot', onAdded: loadAll })}
                            className="mt-1 inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all cursor-pointer"
                        >
                            <Plus size={16} className="shrink-0" /> Add a spot
                        </button>
                    </div>
                ) : problems.length === 0 ? (
                    // Case 2 of 3: spots exist, nothing documented on them yet —
                    // points at the spot index rather than saying "nothing here".
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                        <p className="text-text-muted max-w-[380px]">
                            {crags.length} spot{crags.length === 1 ? '' : 's'} mapped, nothing documented on them yet.
                        </p>
                        <div className="flex flex-wrap justify-center gap-3 mt-1">
                            <Link
                                to="/directory/spots"
                                className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium bg-transparent border border-border text-text-dim hover:border-accent hover:text-text-secondary transition-colors"
                            >
                                Browse spots <ArrowRight size={16} className="shrink-0" />
                            </Link>
                            <button
                                onClick={() => openAddSheet({ intent: 'problem', onAdded: loadAll })}
                                className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium text-on-accent shadow-[0_2px_12px_rgba(200,122,48,0.3)] bg-gradient-to-br from-accent to-accent-dark hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(200,122,48,0.4)] transition-all cursor-pointer"
                            >
                                <Plus size={16} className="shrink-0" /> Add a problem
                            </button>
                        </div>
                    </div>
                ) : (
                    // Case 3 of 3: the normal state — spots and lines are matched.
                    // Near You leads (decision 1: places first), then the rock-level
                    // Recent row, then Hot (problem-granular, left alone).
                    <>
                        {spotlight && (
                            <section className="mb-10">
                                <h2 className="font-serif text-xl font-bold text-text mb-3">Spotlight</h2>
                                {spotlight.kind === 'problem' ? (
                                    <ProblemCard problem={spotlight.problem} navigate={navigate} variant="hero" />
                                ) : (
                                    <SpotHero crag={spotlight.crag} navigate={navigate} />
                                )}
                            </section>
                        )}

                        <RowSection
                            title="Near You"
                            items={nearSpots}
                            seeAll="/directory/spots"
                            renderItem={({ crag, distanceKm }) => (
                                <SpotCard key={crag.id} crag={crag} distanceKm={distanceKm} navigate={navigate} className="shrink-0 w-60 snap-start" />
                            )}
                            emptyState={
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
                            }
                        />

                        {gap && <GapBanner gap={gap} navigate={navigate} onAdded={loadAll} />}

                        <RowSection
                            title="Recently documented"
                            items={recentRocks}
                            renderItem={(rock) => (
                                <RockCard key={rock.boulderId} rock={rock} navigate={navigate} className="shrink-0 w-60 snap-start" />
                            )}
                        />

                        <RowSection
                            title="Hot"
                            items={hotProblems}
                            seeAll="/directory/all"
                            renderItem={({ problem }) => (
                                <ProblemCard key={problem.id} problem={problem} navigate={navigate} className="shrink-0 w-60 snap-start" />
                            )}
                        />

                        <div className="flex flex-wrap justify-center gap-3 pt-2">
                            <Link
                                to="/directory/all"
                                className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium bg-transparent border border-border text-text-dim hover:border-accent hover:text-text-secondary transition-colors"
                            >
                                See all lines <ArrowRight size={16} className="shrink-0" />
                            </Link>
                            <Link
                                to="/directory/spots"
                                className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-[10px] text-sm font-medium bg-transparent border border-border text-text-dim hover:border-accent hover:text-text-secondary transition-colors"
                            >
                                Browse spots <ArrowRight size={16} className="shrink-0" />
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
