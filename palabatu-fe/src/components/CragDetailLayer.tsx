import { useEffect, useState } from 'react'
import { getBouldersForCrag, getApproachesForCrag } from '../lib/cragCache.js'
import type { BoulderListItem } from '../types/boulder.js'
import type { ApproachListItem } from '../types/approach.js'
import BoulderPinMarker from './BoulderPinMarker.js'
import ApproachStartMarker from './ApproachStartMarker.js'

// The two close-zoom map layers for one crag (handoff.md open item 13):
// its rocks (only those with a coordinate) and its approaches' start
// points. Mounted only once a crag cluster resolves to a single crag AND
// the map is zoomed in close enough that per-rock precision is useful --
// see lib/constants.ts's DETAIL_ZOOM. Fetches are cached per crag
// (cragCache.ts), so re-mounting while panning around doesn't refetch.
//
// `onContentAvailability` (2026-08-17 pass) reports back once we know
// whether this crag actually has anything geocoded to draw here -- Map.tsx
// uses that to fully hide the crag pin only once it's genuinely redundant
// (real rock/trail pins on screen), and keeps it as a de-emphasized fallback
// otherwise (a crag can have boulders/problems with no coordinates at all,
// in which case this layer draws nothing and the crag pin must stay the only
// way to reach it).
export default function CragDetailLayer({ cragId, onContentAvailability }: {
    cragId: string
    onContentAvailability?: (hasContent: boolean) => void
}) {
    const [boulders, setBoulders] = useState<BoulderListItem[]>([])
    const [approaches, setApproaches] = useState<ApproachListItem[]>([])

    useEffect(() => {
        let cancelled = false
        Promise.all([getBouldersForCrag(cragId), getApproachesForCrag(cragId)]).then(([bList, aList]) => {
            if (cancelled) return
            setBoulders(bList)
            setApproaches(aList)
            const hasContent = bList.some(b => b.lat != null && b.lng != null) || aList.some(a => a.start_lat != null && a.start_lng != null)
            onContentAvailability?.(hasContent)
        })
        return () => { cancelled = true }
        // onContentAvailability intentionally excluded: Map.tsx passes an
        // inline closure that's stable in effect (keyed by cragId, not
        // identity), and including it would refetch on every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cragId])

    return (
        <>
            {boulders.map(b => <BoulderPinMarker key={b.id} boulder={b} />)}
            {approaches.map(a => <ApproachStartMarker key={a.id} approach={a} />)}
        </>
    )
}
