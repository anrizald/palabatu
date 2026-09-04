import type { EnrichedProblem } from '../types/problem.js'

// The data behind components/RockCard.tsx. Split out of that file rather
// than living next to the component for the same reason AuthContext and
// AddSheetContext are split three ways: the react-refresh lint rule wants a
// component file to export only components.

// A rock with at least one recently-added line, plus the label/thumbnail its
// card needs (handoff-directory.md decision 2: "Recent" is deduplicated at
// the rock level, one card per rock instead of one per line on it).
export type RecentRock = {
    boulderId: string
    cragId: string
    cragName: string | null
    boulderName: string | null
    thumbnailUrl: string | null
    count: number
    lastCreatedAt: string
    sampleName: string
}

// UX principle 3's photoless/unnamed-rock fallback ("Slab Mantap, Sit Start"
// rather than a bare index), computed from the recent batch itself rather
// than a fetched sample_problem_name -- this card is already showing off a
// handful of that rock's newest lines, so the oldest of *those* is a fine
// stand-in for "the problem this rock is known by".
export function rockLabel(rock: RecentRock): string {
    if (rock.boulderName) return rock.boulderName
    return rock.count > 1 ? `${rock.sampleName}, and more` : rock.sampleName
}

// Group the newest lines by the rock they're on, so a single documentation
// session becomes one legible card instead of N identical ones
// (handoff-directory.md finding 2 -- a rock's photo is shared by every
// problem on it, so a problem-granular Recent row renders as the same
// photograph over and over).
//
// The pool is capped before grouping rather than grouping all problems: a
// rock whose activity was months ago shouldn't be pulled into "recent" just
// because nothing newer exists on it since.
export function groupRecentRocks(problems: EnrichedProblem[], limit: number, poolSize = 30): RecentRock[] {
    const pool = [...problems]
        .filter(p => p.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, poolSize)

    const byBoulder = new Map<string, EnrichedProblem[]>()
    for (const p of pool) {
        const group = byBoulder.get(p.boulder_id)
        if (group) group.push(p); else byBoulder.set(p.boulder_id, [p])
    }

    return [...byBoulder.entries()]
        .map(([boulderId, group]) => {
            const latest = group[0]! // pool is newest-first, so this group's first entry is its newest
            const oldest = group[group.length - 1]!
            return {
                boulderId,
                cragId: latest.crag_id,
                cragName: latest.crag_name,
                boulderName: latest.boulder_name,
                thumbnailUrl: latest.thumbnailUrl,
                count: group.length,
                lastCreatedAt: latest.created_at,
                sampleName: oldest.name,
            }
        })
        .sort((a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime())
        .slice(0, limit)
}
