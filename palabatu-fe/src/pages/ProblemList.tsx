import { api } from '../lib/api.js';
import Header from '../components/Header.js';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { Search, MapPin, Map as MapIcon } from 'lucide-react';
import { GRADE_SCALES } from '../lib/constants.js';

type ProblemRow = {
    id: string | number;
    name: string;
    location_name: string;
    latitude: number;
    longitude: number;
    grade: string;
    creator_name: string;
    created_by: string;
    send_count: number;
};

type SortBy = 'name' | 'sends';

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
        const index = GRADE_SCALE_ORDER[scale].indexOf(token);
        if (index !== -1) return [scale, index];
    }
    return [GRADE_SCALE_ORDER.length, 0];
}

// Grades may be a single token ("V5") or a range ("V5-V6"); rank by the
// lower bound, mirroring how palabatu-be/internal/problems/validate.go
// splits ranges.
function compareGrades(a: string, b: string): number {
    const [aScale, aIndex] = gradeRank(a.split('-')[0]);
    const [bScale, bIndex] = gradeRank(b.split('-')[0]);
    if (aScale !== bScale) return aScale - bScale;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.localeCompare(b);
}

export function ProblemList() {
    const [problems, setProblems] = useState<ProblemRow[]>([]);
    const [search, setSearch] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('All');
    const [sortBy, setSortBy] = useState<SortBy>('name');
    const [isLoading, setIsLoading] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        async function fetchProblems() {
            const data = await api.get('/api/problems');
            if (!data.error) setProblems(data as ProblemRow[]);
            setIsLoading(false);
        }
        fetchProblems();
    }, []);

    // Extract unique grades for our filter dropdown, ordered by difficulty within scale
    const availableGrades = useMemo(() => {
        const grades = new Set(problems.map(p => p.grade));
        return ['All', ...Array.from(grades).sort(compareGrades)];
    }, [problems]);

    // Filter + sort problems based on search, grade and sort choice
    const filteredProblems = useMemo(() => {
        const filtered = problems.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.location_name || '').toLowerCase().includes(search.toLowerCase());
            const matchesGrade = selectedGrade === 'All' || p.grade === selectedGrade;
            return matchesSearch && matchesGrade;
        });
        return filtered.sort((a, b) => (
            sortBy === 'sends'
                ? (b.send_count || 0) - (a.send_count || 0)
                : a.name.localeCompare(b.name)
        ));
    }, [problems, search, selectedGrade, sortBy]);

    const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, problem: ProblemRow) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/problems/${problem.id}`);
        }
    };

    return (
        <div className="min-h-screen bg-ink text-text font-sans pb-12">
            <Header />

            <div className="max-w-[800px] mx-auto px-6 pt-20">
                <h1 className="font-serif text-[32px] font-black text-text mb-1">Directory</h1>
                <p className="text-text-muted mb-6">Search and filter all problems in Palabatu.</p>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-3">
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
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="bg-panel border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text outline-none cursor-pointer transition-colors"
                    >
                        {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortBy)}
                        className="bg-panel border border-border focus:border-accent rounded-xl px-4 py-3 text-sm text-text outline-none cursor-pointer transition-colors"
                    >
                        <option value="name">Sort: Name (A-Z)</option>
                        <option value="sends">Sort: Most sent</option>
                    </select>
                </div>

                {!isLoading && (
                    <div className="text-xs text-text-dim mb-3">
                        {filteredProblems.length} {filteredProblems.length === 1 ? 'problem' : 'problems'} found
                    </div>
                )}

                {/* List */}
                {isLoading ? (
                    <div className="text-text-muted font-serif tracking-wider text-center py-16">Loading...</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredProblems.map(problem => (
                            <div
                                key={problem.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`View details for ${problem.name}`}
                                onClick={() => navigate(`/problems/${problem.id}`)}
                                onKeyDown={(e) => handleRowKeyDown(e, problem)}
                                className="bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 cursor-pointer transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-serif text-lg font-bold text-text truncate mb-1">{problem.name}</h3>
                                    <div className="flex items-center gap-1 text-xs text-text-dim">
                                        <MapPin size={12} /> {problem.location_name || 'Location not set'}
                                    </div>
                                    <div className="text-[11px] text-text-dim">
                                        Added by{' '}
                                        <Link
                                            to={`/profile/${problem.created_by}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-accent font-bold no-underline hover:underline"
                                        >
                                            @{problem.creator_name || 'unknown'}
                                        </Link>
                                        {' '}· {problem.send_count || 0} {problem.send_count === 1 ? 'send' : 'sends'}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 shrink-0">
                                    <span className="bg-accent/15 text-accent px-3.5 py-1.5 rounded-full text-[13px] font-bold">
                                        {problem.grade}
                                    </span>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Sends them to the map with coordinates in the URL!
                                            navigate(`/map?lat=${problem.latitude}&lng=${problem.longitude}`);
                                        }}
                                        className="bg-transparent border border-text-faint text-text-muted hover:text-accent hover:border-accent px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                        <MapIcon size={12} /> Locate
                                    </button>
                                </div>
                            </div>
                        ))}
                        {filteredProblems.length === 0 && (
                            <div className="text-text-muted text-center py-16">No problems found.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
