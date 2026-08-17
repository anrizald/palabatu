import { Link, type NavigateFunction } from 'react-router-dom';
import { MapPin, Navigation, Mountain, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import FallbackImg from './FallbackImg.js';
import type { EnrichedProblem } from '../types/problem.js';

export type FooterStat = { icon: LucideIcon; label: string };

// The grade badge, or a "Project" chip when there isn't one yet. The add
// sheet actively invites skipping the grade ("skip it if it's still a
// project"), so rendering the badge unconditionally means the single most
// encouraged new state in the add flow shows up as an empty accent pill
// (handoff-directory.md finding 3). Weathered Stone, not accent -- decision
// 4: this is information about the problem, not an achievement.
function GradeChip({ grade, className = '' }: { grade: string | null; className?: string }) {
    if (grade) {
        return (
            <span className={`bg-ink border border-accent/40 text-accent px-3 py-1 rounded-full text-[13px] font-bold ${className}`}>
                {grade}
            </span>
        );
    }
    return (
        <span className={`bg-ink border border-text-muted/40 text-text-muted px-3 py-1 rounded-full text-[13px] font-bold ${className}`}>
            Project
        </span>
    );
}

// The spot, and the rock if it has a name -- both real links
// (handoff-directory.md decision 6). The spot answers "can I get there",
// the rock answers "what else is on it". Skips the rock segment when the
// boulder has no name rather than inventing a fallback label -- that's a
// rock-list concern (BoulderListItem.sample_problem_name), not this card's.
function SpotLine({ problem, tone }: { problem: EnrichedProblem; tone: 'dim' | 'secondary' }) {
    const color = tone === 'dim' ? 'text-text-dim' : 'text-text-secondary';
    return (
        <div className={`flex items-center gap-1 text-xs ${color} min-w-0 flex-1`}>
            <MapPin size={12} className="shrink-0" />
            <Link
                to={`/crags/${problem.crag_id}`}
                onClick={(e) => e.stopPropagation()}
                className="truncate shrink-0 hover:text-accent transition-colors"
            >
                {problem.crag_name || 'Spot not set'}
            </Link>
            {problem.boulder_name && (
                <>
                    <span className="shrink-0">·</span>
                    <Link
                        to={`/boulders/${problem.boulder_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate min-w-0 hover:text-accent transition-colors"
                    >
                        {problem.boulder_name}
                    </Link>
                </>
            )}
        </div>
    );
}

// Shared photo card: Directory's curated rows (Hot/Recent/Near You) and its
// Spotlight hero, the All Problems grid (ProblemList.tsx), and Landing's
// Explore rows all render this one component (handoff-directory.md finding
// 12 -- there used to be three of these). Defined at module scope rather
// than nested in a page so it keeps a stable component identity across
// renders -- a nested definition would remount every card (losing
// hover/focus state and re-firing image loads) on every keystroke in a
// search box.
//
// Takes an EnrichedProblem (see src/types/problem.ts) rather than the raw
// ProblemListItem -- the wire response no longer carries a thumbnail or
// coordinates (those moved to the boulder/crag), so the parent resolves
// them once via src/lib/cragCache.ts's enrichProblems() and hands down the
// resolved values.
export function ProblemCard({ problem, navigate, footerStat, className = '', variant = 'grid' }: {
    problem: EnrichedProblem;
    navigate: NavigateFunction;
    footerStat?: FooterStat | undefined;
    className?: string;
    variant?: 'grid' | 'hero';
}) {
    const stat = footerStat ?? { icon: Flame, label: `${problem.send_count || 0} ${problem.send_count === 1 ? 'send' : 'sends'}` };
    const StatIcon = stat.icon;
    const isHero = variant === 'hero';

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/problems/${problem.id}`);
        }
    };

    const locateButton = problem.mapLat != null && problem.mapLng != null && (
        <button
            onClick={(e) => {
                e.stopPropagation();
                // Sends them to the map with coordinates in the URL!
                navigate(`/map?lat=${problem.mapLat}&lng=${problem.mapLng}`);
            }}
            aria-label={`Locate ${problem.name} on the map`}
            title="Locate on map"
            className={`absolute ${isHero ? 'top-4 right-4 w-9 h-9' : 'top-3 right-3 w-8 h-8'} flex items-center justify-center bg-ink border border-border text-text-muted hover:text-accent hover:border-accent rounded-full cursor-pointer transition-colors`}
        >
            <Navigation size={isHero ? 15 : 14} className="shrink-0" />
        </button>
    );

    const creatorLine = (
        <Link
            to={`/profile/${problem.creator_slug}`}
            onClick={(e) => e.stopPropagation()}
            className="text-accent font-bold no-underline hover:underline"
        >
            {problem.creator_name || 'unknown'}
        </Link>
    );

    if (isHero) {
        return (
            <div
                role="button"
                tabIndex={0}
                aria-label={`View details for ${problem.name}`}
                onClick={() => navigate(`/problems/${problem.id}`)}
                onKeyDown={handleKeyDown}
                className={`group relative rounded-2xl overflow-hidden bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer transition-colors ${className}`}
            >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface">
                    {problem.thumbnailUrl ? (
                        <FallbackImg
                            src={problem.thumbnailUrl}
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
                        <div className="flex items-center gap-2 mb-2 min-w-0">
                            <GradeChip grade={problem.grade} />
                            <SpotLine problem={problem} tone="secondary" />
                        </div>
                        <h3 className="font-serif text-3xl sm:text-4xl font-bold text-text mb-2">{problem.name}</h3>
                        <div className="text-xs text-text-dim">
                            by {creatorLine} · {stat.label}
                        </div>
                    </div>

                    {locateButton}
                </div>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`View details for ${problem.name}`}
            onClick={() => navigate(`/problems/${problem.id}`)}
            onKeyDown={handleKeyDown}
            className={`group bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-2xl overflow-hidden cursor-pointer transition-colors hover:-translate-y-1 ${className}`}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                {problem.thumbnailUrl ? (
                    <FallbackImg
                        src={problem.thumbnailUrl}
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

                <GradeChip grade={problem.grade} className="absolute bottom-3 left-3" />

                {locateButton}
            </div>

            <div className="p-4">
                <h3 className="font-serif text-lg font-bold text-text truncate mb-1">{problem.name}</h3>
                <div className="mb-2">
                    <SpotLine problem={problem} tone="dim" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-dim pt-2 border-t border-border">
                    <span>by {creatorLine}</span>
                    <span className="flex items-center gap-1 shrink-0"><StatIcon size={11} className="shrink-0" />{stat.label}</span>
                </div>
            </div>
        </div>
    );
}
