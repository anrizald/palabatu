import { api } from '../lib/api.js';
import { enrichProblems } from '../lib/cragCache.js';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowLeft, RotateCcw } from 'lucide-react';
import { GRADE_SCALES, detectGradeScale, boulderTypeToGradeType, type ProblemType } from '../lib/constants.js';
import { ProblemCard } from '../components/ProblemCard.js';
import { useAuth } from '../lib/useAuth.js';
import type { ProblemListItem, EnrichedProblem } from '../types/problem.js';
import type { ErrorResponse } from '../types/apitypes.js';

type SortBy = 'name' | 'sends' | 'newest';
type SentFilter = 'all' | 'unsent' | 'sent';
type TypeFilter = 'All' | ProblemType;

const SENT_FILTER_OPTIONS: { value: SentFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unsent', label: 'Unsent' },
    { value: 'sent', label: 'Sent' },
];

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
    { value: 'All', label: 'All' },
    { value: 'boulder', label: 'Boulder' },
    { value: 'rope', label: 'Rope' },
];

// Shared look for the Grade/Status filter chips — a clickable pill using the
// same accent-tint-when-active treatment as the grade badges on the cards
// themselves, instead of native <select> chrome.
function pillClass(active: boolean): string {
    return `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${active
        ? 'bg-accent/15 border-accent text-accent'
        : 'bg-transparent border-border text-text-dim hover:border-accent hover:text-text-secondary'
        }`;
}

// Ordered scales to rank grades against, so V0-V15/5.9-5.10a/etc. sort by
// actual difficulty instead of alphabetically. A grade is ranked by the
// first scale it's found in; anything unrecognized (legacy/freeform data)
// sorts last.
const GRADE_SCALE_ORDER: readonly (readonly string[])[] = [
    GRADE_SCALES.boulder['V-Scale'],
    GRADE_SCALES.boulder['Font'],
    GRADE_SCALES.rope['YDS'],
    GRADE_SCALES.rope['French'],
];

function gradeRank(token: string): [scale: number, index: number] {
    for (let scale = 0; scale < GRADE_SCALE_ORDER.length; scale++) {
        const index = GRADE_SCALE_ORDER[scale]!.indexOf(token);
        if (index !== -1) return [scale, index];
    }
    return [GRADE_SCALE_ORDER.length, 0];
}

// Grades may be a single token ("V5") or a range ("V5-V6"); rank by the
// lower bound, mirroring how palabatu-be/internal/problems/validate.go
// splits ranges.
function compareGrades(a: string, b: string): number {
    const [aScale, aIndex] = gradeRank(a.split('-')[0] ?? a);
    const [bScale, bIndex] = gradeRank(b.split('-')[0] ?? b);
    if (aScale !== bScale) return aScale - bScale;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
}

// Which scale a problem's grade belongs to (V-Scale/Font/YDS/French), for
// the Scale/Grade quick filters below. Type itself no longer comes from
// here (handoff-directory.md decision 5/finding 4) — it comes straight from
// the rock's boulder_type via boulderTypeToGradeType, since that's
// authoritative and a grade string can't reliably be reverse-guessed into
// one; scale still has to come from the grade token, since it isn't stored
// anywhere else. Unrecognized/legacy grades default to V-Scale, mirroring
// ProblemEditForm's detectGrade fallback.
function gradeScale(grade: string): string {
    return detectGradeScale(grade.split('-')[0] ?? grade)?.scale ?? 'V-Scale';
}

// The full searchable/filterable catalog — Directory.tsx owns the curated
// browsing experience (Spotlight/Hot/Recent/Near You) and links here via
// its "See all problems" CTA for people who already know what they want
// and just need search + filter + sort.
export function ProblemList() {
    const { user } = useAuth();
    const [problems, setProblems] = useState<EnrichedProblem[]>([]);
    const [search, setSearch] = useState('');
    const [spotFilter, setSpotFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
    const [scaleFilter, setScaleFilter] = useState('All');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [sentFilter, setSentFilter] = useState<SentFilter>('all');
    const [mySentIds, setMySentIds] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const navigate = useNavigate();

    const fetchProblems = useCallback(() => {
        setIsLoading(true);
        setLoadError(null);
        api.get<ProblemListItem[] | ErrorResponse>('/api/problems')
            .then(async data => {
                if (Array.isArray(data)) {
                    setProblems(await enrichProblems(data));
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

    // Sent/Unsent is profile-respective -- it needs the logged-in user's own
    // send list, not the aggregate send_count on each problem. Drops back to
    // 'all' (and the Status row itself hides, see below) when logged out.
    useEffect(() => {
        if (!user) {
            setMySentIds(new Set());
            setSentFilter('all');
            return;
        }
        api.get<string[] | ErrorResponse>('/api/sends/mine')
            .then(data => { if (Array.isArray(data)) setMySentIds(new Set(data)); })
            .catch(e => console.error('Failed to load your sends', e));
    }, [user]);

    // Type -> Scale -> Grade is a cascade: picking a type narrows which
    // scales apply, and either narrows which grades exist to pick from.
    // Selecting "All" at a level resets everything below it back to "All".
    const handleTypeFilter = (t: TypeFilter) => {
        setTypeFilter(t);
        setScaleFilter('All');
        setSelectedGrade('All');
    };
    const handleScaleFilter = (s: string) => {
        setScaleFilter(s);
        setSelectedGrade('All');
    };

    const scaleOptions = typeFilter === 'All' ? [] : Object.keys(GRADE_SCALES[typeFilter]);

    // Project is its own pill, not a Type/Scale-gated one (handoff-directory.md
    // decision 4) — an ungraded problem's type can't be reliably guessed from
    // its grade string anyway (finding 4, still open until tier 1 ships
    // boulder_type), so picking Project clears Type/Scale rather than risk a
    // Type=Rope + Project combo that silently returns zero results.
    const handleProjectFilter = () => {
        setSelectedGrade('Project');
        setTypeFilter('All');
        setScaleFilter('All');
    };

    const hasActiveFilters = search !== '' || spotFilter !== 'All' || typeFilter !== 'All'
        || scaleFilter !== 'All' || selectedGrade !== 'All' || sentFilter !== 'all' || sortBy !== 'name';
    const clearFilters = () => {
        setSearch('');
        setSpotFilter('All');
        setTypeFilter('All');
        setScaleFilter('All');
        setSelectedGrade('All');
        setSentFilter('all');
        setSortBy('name');
    };

    // Spot options for the missing hierarchy axis (finding 5) — every crag
    // that actually has a problem on it, name-sorted. Derived from the
    // loaded problems rather than a separate crags fetch: a crag with zero
    // problems would always filter to an empty grid anyway, so it's not a
    // useful option here (unlike /directory/spots, which exists precisely to
    // surface those).
    const spotOptions = useMemo(() => {
        const byId = new Map<string, string>();
        for (const p of problems) {
            if (p.crag_id && !byId.has(p.crag_id)) byId.set(p.crag_id, p.crag_name || 'Unnamed spot');
        }
        return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [problems]);

    // Grades available for the current Type/Scale selection, ordered by
    // difficulty within scale, so the picker only ever shows grades that
    // are actually relevant instead of every grade of every scale at once.
    const availableGrades = useMemo(() => {
        const grades = new Set(
            problems
                .filter((p): p is EnrichedProblem & { grade: string } => {
                    if (!p.grade) return false;
                    if (typeFilter !== 'All' && boulderTypeToGradeType(p.boulder_type) !== typeFilter) return false;
                    if (scaleFilter !== 'All' && gradeScale(p.grade) !== scaleFilter) return false;
                    return true;
                })
                .map(p => p.grade)
        );
        return ['All', ...Array.from(grades).sort(compareGrades)];
    }, [problems, typeFilter, scaleFilter]);

    // Filter + sort problems based on search, spot, type/scale/grade,
    // sent-status and sort choice
    const filteredProblems = useMemo(() => {
        const filtered = problems.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.crag_name || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.boulder_name || '').toLowerCase().includes(search.toLowerCase());
            const matchesSpot = spotFilter === 'All' || p.crag_id === spotFilter;
            const matchesType = typeFilter === 'All' || boulderTypeToGradeType(p.boulder_type) === typeFilter;
            const matchesScale = scaleFilter === 'All' || gradeScale(p.grade ?? '') === scaleFilter;
            // Falsy check, not `=== null` -- some rows store '' rather than a
            // true SQL NULL for "no grade yet" despite the string | null type
            // (confirmed live: "Slab Mantao"/"VCrazy" both have grade: '').
            // Matches GradeChip's own condition so a problem showing the
            // "Project" badge is always reachable through this filter.
            const matchesGrade = selectedGrade === 'All' || (selectedGrade === 'Project' ? !p.grade : p.grade === selectedGrade);
            const matchesSent = !user || sentFilter === 'all'
                || (sentFilter === 'unsent' ? !mySentIds.has(String(p.id)) : mySentIds.has(String(p.id)));
            return matchesSearch && matchesSpot && matchesType && matchesScale && matchesGrade && matchesSent;
        });
        return filtered.sort((a, b) => {
            if (sortBy === 'sends') return (b.send_count || 0) - (a.send_count || 0);
            if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            return a.name.localeCompare(b.name);
        });
    }, [problems, search, spotFilter, typeFilter, scaleFilter, selectedGrade, sentFilter, mySentIds, user, sortBy]);

    return (
        <div className="min-h-[var(--content-h)] bg-ink text-text font-sans pb-12">
            <div className="max-w-[1100px] mx-auto px-6 pt-6">
                <Link to="/directory" className="inline-flex items-center gap-1.5 text-xs text-text-dim hover:text-accent transition-colors w-fit mb-4">
                    <ArrowLeft size={14} className="shrink-0" /> Back to Directory
                </Link>

                <h1 className="font-serif text-[32px] font-black text-text mb-1">All Problems</h1>
                <p className="text-text-muted mb-6">Search the full catalog, filter by grade, sort however works for you.</p>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by name or location..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-panel border border-border focus:border-accent rounded-xl pl-10 pr-4 py-3 text-sm text-text placeholder:text-text-faint outline-none transition-colors"
                        />
                    </div>
                    <select
                        value={spotFilter}
                        onChange={(e) => setSpotFilter(e.target.value)}
                        className="bg-panel border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text outline-none cursor-pointer transition-colors"
                    >
                        <option value="All">All spots</option>
                        {spotOptions.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="bg-panel border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text outline-none cursor-pointer transition-colors"
                    >
                        <option value="name">Sort: Name (A-Z)</option>
                        <option value="sends">Sort: Most sent</option>
                        <option value="newest">Sort: Newest</option>
                    </select>
                    <button
                        onClick={clearFilters}
                        disabled={!hasActiveFilters}
                        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-medium bg-transparent border border-border text-text-dim hover:border-accent hover:text-text-secondary disabled:opacity-40 disabled:cursor-default disabled:hover:border-border disabled:hover:text-text-dim cursor-pointer transition-colors"
                    >
                        <RotateCcw size={14} className="shrink-0" /> Reset
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-text-dim shrink-0 mr-1">Type</span>
                    {TYPE_FILTER_OPTIONS.map(({ value, label }) => (
                        <button key={value} onClick={() => handleTypeFilter(value)} className={pillClass(typeFilter === value)}>
                            {label}
                        </button>
                    ))}
                </div>

                {typeFilter !== 'All' && (
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-text-dim shrink-0 mr-1">Scale</span>
                        <button onClick={() => handleScaleFilter('All')} className={pillClass(scaleFilter === 'All')}>All</button>
                        {scaleOptions.map(s => (
                            <button key={s} onClick={() => handleScaleFilter(s)} className={pillClass(scaleFilter === s)}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs text-text-dim shrink-0 mr-1">Grade</span>
                    <button onClick={() => setSelectedGrade('All')} className={pillClass(selectedGrade === 'All')}>All</button>
                    <button onClick={handleProjectFilter} className={pillClass(selectedGrade === 'Project')}>Project</button>
                    {typeFilter !== 'All' && availableGrades.filter(g => g !== 'All').map(g => (
                        <button key={g} onClick={() => setSelectedGrade(g)} className={pillClass(selectedGrade === g)}>
                            {g}
                        </button>
                    ))}
                </div>

                {user && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-xs text-text-dim shrink-0 mr-1">Status</span>
                        {SENT_FILTER_OPTIONS.map(({ value, label }) => (
                            <button key={value} onClick={() => setSentFilter(value)} className={pillClass(sentFilter === value)}>
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {!isLoading && !loadError && (
                    <div className="text-xs text-text-dim mb-3">
                        {filteredProblems.length} {filteredProblems.length === 1 ? 'line' : 'lines'} found
                    </div>
                )}

                {/* Grid */}
                {loadError ? (
                    <div className="flex flex-col items-center gap-3 text-center py-16">
                        <div className="text-text-muted">{loadError}</div>
                        <button onClick={fetchProblems} className="bg-transparent border-none text-sm text-accent hover:underline cursor-pointer p-0">
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="text-text-muted font-serif tracking-wider text-center py-16">Loading...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 sm:gap-5">
                        {filteredProblems.map(problem => (
                            <ProblemCard key={problem.id} problem={problem} navigate={navigate} />
                        ))}
                        {filteredProblems.length === 0 && (
                            <div className="col-span-full text-text-muted text-center py-16">
                                {problems.length === 0 ? (
                                    <>No problems added yet. <Link to="/map" className="text-accent hover:underline">Add one from the map</Link>.</>
                                ) : (
                                    <>No problems match your search. <button onClick={clearFilters} className="bg-transparent border-none text-accent hover:underline cursor-pointer p-0">Clear filters</button>.</>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
