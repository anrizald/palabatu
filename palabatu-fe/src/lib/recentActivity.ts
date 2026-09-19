import type { ProblemListItem } from '../types/problem.js'

// The data behind components/SpotActivityCard.tsx -- Directory-only. Split
// out of the component file for the same react-refresh reason
// recentRocks.ts is.
//
// Unlike recentRocks.ts (grouped per rock, shared with Landing), this groups
// per crag: a returning contributor's "what happened where, and who did it"
// question spans several rocks and several people in one place, and a
// crag-level card is what answers it without duplicating the crag name on
// several rock cards in a row.

export type Contributor = { name: string; slug: string | null }

export type RecentActivity = {
    cragId: string
    cragName: string | null
    thumbnailUrl: string | null
    contributors: Contributor[]
    lineCount: number
    rockCount: number
    oldestAt: string
    newestAt: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WINDOW_DAYS = 30

// An explicit time window, not a count-based pool: a fixed-size pool is an
// invisible time cut that slides with catalog size -- as the app gets
// busier the same 30-newest-problems pool covers a shorter and shorter
// span, silently understating both the line count and the span text at
// once. An explicit window makes both exact, and costs nothing given
// GET /api/problems is unpaginated.
export function groupRecentActivity(problems: ProblemListItem[], limit: number, windowDays = WINDOW_DAYS): RecentActivity[] {
    const cutoff = Date.now() - windowDays * MS_PER_DAY
    const windowed = problems
        .filter(p => p.created_at && new Date(p.created_at).getTime() >= cutoff)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const byCrag = new Map<string, ProblemListItem[]>()
    for (const p of windowed) {
        const group = byCrag.get(p.crag_id)
        if (group) group.push(p); else byCrag.set(p.crag_id, [p])
    }

    const activity = [...byCrag.entries()].map(([cragId, group]): RecentActivity => {
        // group is newest-first (inherited from `windowed`'s sort). Walking
        // it that way makes both the contributor order (most-recent-first)
        // and the thumbnail pick (the most recently documented rock that
        // has a photo) fall out of one pass.
        const contributorsByCreator = new Map<string | null, Contributor>()
        const boulderIds = new Set<string>()
        let thumbnailUrl: string | null = null

        for (const p of group) {
            if (!contributorsByCreator.has(p.created_by)) {
                contributorsByCreator.set(p.created_by, { name: p.creator_name || 'unknown', slug: p.creator_slug })
            }
            boulderIds.add(p.boulder_id)
            if (thumbnailUrl === null && p.topo_url) thumbnailUrl = p.topo_url
        }

        const newest = group[0]!
        const oldest = group[group.length - 1]!

        return {
            cragId,
            cragName: newest.crag_name,
            thumbnailUrl,
            contributors: [...contributorsByCreator.values()],
            lineCount: group.length,
            rockCount: boulderIds.size,
            oldestAt: oldest.created_at,
            newestAt: newest.created_at,
        }
    })

    return activity
        .sort((a, b) => new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime())
        .slice(0, limit)
}

// "Rizal" / "Rizal and Admin3" / "Rizal, Admin3, +9" -- overflow kicks in
// after 2 named, no "and" once it does. A plain-string formatter for
// non-visual uses (aria-labels); SpotActivityCard renders the same rule with
// real links for the visible copy rather than calling this and losing them.
export function formatContributorList(names: string[]): string {
    if (names.length === 0) return 'Someone'
    if (names.length === 1) return names[0]!
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names[0]}, ${names[1]}, +${names.length - 2}`
}

const WEEK_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four' }

function startOfLocalDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// "today" / "on Tuesday" / "this week" / "in two weeks" -- resolved in the
// viewer's own browser timezone (new Date()), not WIB. Bucket edges beyond
// "this week" vs "in N weeks" were left for whoever built this to pick;
// these are reasonable defaults, not a settled spec -- revisit the exact
// wording if it reads oddly once more real spans are seen.
export function formatActivitySpan(oldestAt: string, newestAt: string): string {
    const oldestDay = startOfLocalDay(new Date(oldestAt))
    const newestDay = startOfLocalDay(new Date(newestAt))
    const diffDays = Math.round((newestDay.getTime() - oldestDay.getTime()) / MS_PER_DAY)

    if (diffDays === 0) {
        const today = startOfLocalDay(new Date())
        if (newestDay.getTime() === today.getTime()) return 'today'
        return `on ${newestDay.toLocaleDateString(undefined, { weekday: 'long' })}`
    }

    const weeks = Math.round(diffDays / 7)
    if (weeks <= 1) return 'this week'
    if (weeks in WEEK_WORDS) return `in ${WEEK_WORDS[weeks]} weeks`
    return 'in about a month'
}
