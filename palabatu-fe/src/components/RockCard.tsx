import { Mountain } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import FallbackImg from './FallbackImg.js';
import { rockLabel, type RecentRock } from '../lib/recentRocks.js';

// Recently documented's card -- a rock, not a problem (handoff-directory.md
// decision 2), linking to the rock rather than any one problem on it, which
// is where someone actually wants to land after seeing "3 new lines".
// Shared by Directory.tsx and Landing.tsx, same reasoning as SpotCard.
export function RockCard({ rock, navigate, className = '' }: {
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
                <p className="text-xs text-text-muted truncate">{rock.cragName || 'Spot not set'}</p>
            </div>
        </div>
    );
}
