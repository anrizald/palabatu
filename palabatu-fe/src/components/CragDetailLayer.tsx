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
// see Map.tsx's DETAIL_ZOOM. Fetches are cached per crag (cragCache.ts), so
// re-mounting while panning around doesn't refetch.
export default function CragDetailLayer({ cragId }: { cragId: string }) {
    const [boulders, setBoulders] = useState<BoulderListItem[]>([])
    const [approaches, setApproaches] = useState<ApproachListItem[]>([])

    useEffect(() => {
        let cancelled = false
        getBouldersForCrag(cragId).then(list => { if (!cancelled) setBoulders(list) })
        getApproachesForCrag(cragId).then(list => { if (!cancelled) setApproaches(list) })
        return () => { cancelled = true }
    }, [cragId])

    return (
        <>
            {boulders.map(b => <BoulderPinMarker key={b.id} boulder={b} />)}
            {approaches.map(a => <ApproachStartMarker key={a.id} approach={a} />)}
        </>
    )
}
