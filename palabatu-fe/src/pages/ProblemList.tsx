import { api } from '../lib/api.js';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowLeft, RotateCcw } from 'lucide-react';
import { GRADE_SCALES } from '../lib/constants.js';
import { ProblemCard } from '../components/ProblemCard.js';
import type { ProblemRow } from '../types/problem.js';
import type { ErrorResponse } from '../types/apitypes.js';

type SortBy = 'name' | 'sends' | 'newest';
type SentFilter = 'all' | 'unsent' | 'sent';

const SENT_FILTER_OPTIONS: { value: SentFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unsent', label: 'Unsent' },
    { value: 'sent', label: 'Sent' },
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

// The full searchable/filterable catalog — Directory.tsx owns the curated
// browsing experience (Spotlight/Hot/Recent/Near You) and links here via
// its "See all problems" CTA for people who already know what they want
// and just need search + filter + sort.
export function ProblemList() {
    const [problems, setProblems] = useState<ProblemRow[]>([]);
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [sentFilter, setSentFilter] = useState<SentFilter>('all');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

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

    const hasActiveFilters = search !== '' || selectedGrade !== 'All' || sentFilter !== 'all' || sortBy !== 'name';
    const clearFilters = () => {
        setSearch('');
        setSelectedGrade('All');
        setSentFilter('all');
        setSortBy('name');
    };

    // Extract unique grades for our filter dropdown, ordered by difficulty within scale
    const availableGrades = useMemo(() => {
        const grades = new Set(problems.map(p => p.grade));
        return ['All', ...Array.from(grades).sort(compareGrades)];
    }, [problems]);

    // Filter + sort problems based on search, grade, sent-status and sort choice
    const filteredProblems = useMemo(() => {
        const filtered = problems.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.location_name || '').toLowerCase().includes(search.toLowerCase());
            const matchesGrade = selectedGrade === 'All' || p.grade === selectedGrade;
            const matchesSent = sentFilter === 'all'
                || (sentFilter === 'unsent' ? (p.send_count || 0) === 0 : (p.send_count || 0) > 0);
            return matchesSearch && matchesGrade && matchesSent;
        });
        return filtered.sort((a, b) => {
            if (sortBy === 'sends') return (b.send_count || 0) - (a.send_count || 0);
            if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            return a.name.localeCompare(b.name);
        });
    }, [problems, search, selectedGrade, sentFilter, sortBy]);

    return (
        <div className="min-h-screen bg-ink text-text font-sans pb-12">
            <div className="max-w-[1100px] mx-auto px-6 pt-20">
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
                    <span className="text-xs text-text-dim shrink-0 mr-1">Grade</span>
                    {availableGrades.map(g => (
                        <button key={g} onClick={() => setSelectedGrade(g)} className={pillClass(selectedGrade === g)}>
                            {g}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-xs text-text-dim shrink-0 mr-1">Status</span>
                    {SENT_FILTER_OPTIONS.map(({ value, label }) => (
                        <button key={value} onClick={() => setSentFilter(value)} className={pillClass(sentFilter === value)}>
                            {label}
                        </button>
                    ))}
                </div>

                {!isLoading && !loadError && (
                    <div className="text-xs text-text-dim mb-3">
                        {filteredProblems.length} {filteredProblems.length === 1 ? 'problem' : 'problems'} found
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
