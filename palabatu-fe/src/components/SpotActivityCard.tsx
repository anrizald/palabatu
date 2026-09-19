import { Fragment } from 'react';
import { Link, type NavigateFunction } from 'react-router-dom';
import { Mountain } from 'lucide-react';
import FallbackImg from './FallbackImg.js';
import { formatActivitySpan, formatContributorList, type Contributor, type RecentActivity } from '../lib/recentActivity.js';

// Directory's "Recently documented" card, at the crag level -- Directory-
// only. Landing keeps RockCard/groupRecentRocks for its own Recent tab: a
// shopfront wants one rock and one concrete photo, while a returning
// contributor's activity feed wants "what happened where, and who did it",
// which spans several rocks and people. Click target is the crag page, not
// any one rock on it -- no single rock is "the" rock here.
function ContributorNames({ contributors }: { contributors: Contributor[] }) {
    const shown = contributors.slice(0, 2);
    const overflow = contributors.length - shown.length;

    return (
        <>
            {shown.map((c, i) => (
                <Fragment key={c.slug ?? `${c.name}-${i}`}>
                    {i > 0 && (contributors.length === 2 ? ' and ' : ', ')}
                    {c.slug ? (
                        <Link
                            to={`/profile/${c.slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-accent font-bold no-underline hover:underline"
                        >
                            {c.name}
                        </Link>
                    ) : (
                        <span className="text-accent font-bold">{c.name}</span>
                    )}
                </Fragment>
            ))}
            {overflow > 0 && `, +${overflow}`}
        </>
    );
}

export function SpotActivityCard({ activity, navigate, className = '' }: {
    activity: RecentActivity;
    navigate: NavigateFunction;
    className?: string;
}) {
    const rockPhrase = activity.rockCount === 1 ? 'on 1 rock' : `across ${activity.rockCount} rocks`;
    const spanPhrase = formatActivitySpan(activity.oldestAt, activity.newestAt);
    const ariaLabel = `View ${activity.cragName || 'this spot'}: ${formatContributorList(activity.contributors.map(c => c.name))} added ${activity.lineCount} line${activity.lineCount === 1 ? '' : 's'} ${rockPhrase} ${spanPhrase}`;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(`/crags/${activity.cragId}`);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={ariaLabel}
            onClick={() => navigate(`/crags/${activity.cragId}`)}
            onKeyDown={handleKeyDown}
            className={`group bg-panel border border-border hover:border-accent focus-visible:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-2xl overflow-hidden cursor-pointer transition-colors hover:-translate-y-1 ${className}`}
        >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
                {activity.thumbnailUrl ? (
                    <FallbackImg
                        src={activity.thumbnailUrl}
                        alt=""
                        width={400}
                        height={300}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        fallback={Mountain}
                        fallbackColor="var(--color-text-faint)"
                    />
                ) : (
                    // The absence is the message, not a gap to fill -- no
                    // second CTA here, GapBanner already owns that ask
                    // directly above this row.
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 text-center">
                        <Mountain size={32} className="text-text-faint shrink-0" />
                        <p className="text-xs text-text-muted">No photo of this rock yet</p>
                    </div>
                )}
            </div>
            <div className="p-4">
                <h3 className="font-serif text-lg font-bold text-text truncate mb-1">{activity.cragName || 'Spot not set'}</h3>
                <p className="text-xs text-text-muted">
                    <ContributorNames contributors={activity.contributors} /> added {activity.lineCount} line{activity.lineCount === 1 ? '' : 's'} {rockPhrase} {spanPhrase}.
                </p>
            </div>
        </div>
    );
}
