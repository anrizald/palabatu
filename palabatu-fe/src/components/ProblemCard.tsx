import { Link, type NavigateFunction } from 'react-router-dom';
import { MapPin, Navigation, Mountain, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import FallbackImg from './FallbackImg.js';
import type { ProblemRow } from '../types/problem.js';

export type FooterStat = { icon: LucideIcon; label: string };

// Shared photo card: Directory's curated rows (Hot/Recent/Near You) and the
// All Problems grid (ProblemList.tsx) both render these. Defined at module
// scope rather than nested in either page so it keeps a stable component
// identity across renders — a nested definition would remount every card
// (losing hover/focus state and re-firing image loads) on every keystroke
// in a search box.
export function ProblemCard({ problem, navigate, footerStat, className = '' }: {
    problem: ProblemRow;
    navigate: NavigateFunction;
    footerStat?: FooterStat | undefined;
    className?: string;
}) {
    const stat = footerStat ?? { icon: Flame, label: `${problem.send_count || 0} ${problem.send_count === 1 ? 'send' : 'sends'}` };
    const StatIcon = stat.icon;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/problems/${problem.id}`);
        }
    };

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
                {problem.image_urls?.[0] ? (
                    <FallbackImg
                        src={problem.image_urls[0]}
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
                    {problem.grade}
                </span>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        // Sends them to the map with coordinates in the URL!
                        navigate(`/map?lat=${problem.latitude}&lng=${problem.longitude}`);
                    }}
                    aria-label={`Locate ${problem.name} on the map`}
                    title="Locate on map"
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-ink border border-border text-text-muted hover:text-accent hover:border-accent rounded-full cursor-pointer transition-colors"
                >
                    <Navigation size={14} className="shrink-0" />
                </button>
            </div>

            <div className="p-4">
                <h3 className="font-serif text-lg font-bold text-text truncate mb-1">{problem.name}</h3>
                <div className="flex items-center gap-1 text-xs text-text-dim mb-2 truncate">
                    <MapPin size={12} className="shrink-0" /> {problem.location_name || 'Location not set'}
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-dim pt-2 border-t border-border">
                    <span>
                        by{' '}
                        <Link
                            to={`/profile/${problem.creator_slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-accent font-bold no-underline hover:underline"
                        >
                            {problem.creator_name || 'unknown'}
                        </Link>
                    </span>
                    <span className="flex items-center gap-1 shrink-0"><StatIcon size={11} className="shrink-0" />{stat.label}</span>
                </div>
            </div>
        </div>
    );
}
