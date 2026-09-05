import { Link, useLocation } from 'react-router-dom';

const SEGMENTS = [
    { to: '/directory', label: 'Overview' },
    { to: '/directory/spots', label: 'Spots' },
    { to: '/directory/all', label: 'All Problems' },
] as const;

// Shared nav for the three directory-adjacent pages (resolved 2026-09-04):
// a pill-style segmented control, not a third top-level nav item -- the
// mobile nav is already at its width budget, and these three routes are
// nested under Directory rather than siblings of it. Each segment is a real
// Link (not local tab state), so back/forward and
// sharing a link both keep working. Reuses the accent-tint-when-active pill
// language ProblemList.tsx's filter chips already established, rather than
// inventing a fourth look. Mounted at the top of Directory/SpotList/
// ProblemList, replacing their old "Back to Directory"/"See all lines"/
// "Browse spots" one-way links -- any one of the three is now one tap from
// either other.
export function DirectorySegmentedControl() {
    const { pathname } = useLocation();
    return (
        <nav
            aria-label="Directory sections"
            className="inline-flex items-center gap-1 bg-panel border border-border rounded-full p-1 mb-4 w-fit max-w-full overflow-x-auto"
        >
            {SEGMENTS.map(({ to, label }) => {
                const active = pathname === to;
                return (
                    <Link
                        key={to}
                        to={to}
                        aria-current={active ? 'page' : undefined}
                        className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${active
                            ? 'bg-accent/15 text-accent'
                            : 'text-text-muted hover:text-text-secondary'
                            }`}
                    >
                        {label}
                    </Link>
                );
            })}
        </nav>
    );
}
