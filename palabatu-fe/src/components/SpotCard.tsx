import { Compass, Footprints, Mountain } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import FallbackImg from './FallbackImg.js';
import { formatDistance } from '../lib/geo.js';
import type { CragListItem } from '../types/crag.js';

// "Is there a way in mapped" -- handoff-directory.md decision 7 names it as
// one of the four things a spot card must answer, alongside distance, line
// count and a photo. It reads as an approach guide's presence, not a count:
// two mapped walk-ins are not twice as reassuring as one, and the number
// would just be noise on a card. Sized down rather than dimmed down, per
// DESIGN.md's Sentence Rule -- copy never drops below Weathered Stone
// (text-muted) to signal "secondary".
export function WayInLine({ approachCount, className = '' }: { approachCount: number; className?: string }) {
    const mapped = approachCount > 0;
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] ${mapped ? 'text-text-secondary' : 'text-text-muted'} ${className}`}>
            <Footprints size={11} className="shrink-0" />
            {mapped ? 'Way in mapped' : 'No way in yet'}
        </span>
    );
}

// A spot, as a photo card. Near You on both Directory.tsx and Landing.tsx
// asks its question at the spot level (handoff-directory.md decision 2 --
// eight lines on one rock must never crowd out the second-nearest place),
// so both need this same card; it lives here rather than in either page for
// the same reason ProblemCard does (finding 12: three copies of a card is
// three places to fix every bug).
//
// Empty spots stay in the mix, dimmed with a dashed border rather than
// filtered out -- handoff.md open item 1's map treatment, carried over: a
// hidden spot is indistinguishable from one that doesn't exist, and invites
// somebody to add a duplicate.
export function SpotCard({ crag, distanceKm, navigate, className = '' }: {
    crag: CragListItem;
    distanceKm?: number | null;
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
                {distanceKm != null && (
                    <span className="absolute top-3 right-3 inline-flex items-center gap-1 bg-ink/80 text-text-secondary text-[11px] px-2 py-1 rounded-full">
                        <Compass size={11} className="shrink-0" />{formatDistance(distanceKm)}
                    </span>
                )}
            </div>
            <div className="p-4">
                <h3 className={`font-serif text-lg font-bold truncate mb-1 ${isEmpty ? 'text-text-muted' : 'text-text'}`}>{crag.name}</h3>
                <p className="text-xs text-text-muted">
                    {isEmpty
                        ? 'Nothing documented yet'
                        : `${crag.problem_count} line${crag.problem_count === 1 ? '' : 's'} on ${crag.boulder_count} rock${crag.boulder_count === 1 ? '' : 's'}`}
                </p>
                <WayInLine approachCount={crag.approach_count} className="mt-1.5" />
            </div>
        </div>
    );
}
