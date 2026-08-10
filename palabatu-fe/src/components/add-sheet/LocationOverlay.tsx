import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { fetchBouldersForCrag } from '../../lib/cragCache.js'
import type { CragListItem } from '../../types/crag.js'
import type { BoulderListItem } from '../../types/boulder.js'
import { RockList } from './RockPicker.js'
import SpotFields from './SpotFields.js'
import { haversineKm, formatDistanceM, type Geo, type NewSpotDraft } from './types.js'

type SpotRow = { crag: CragListItem; km: number | null }

function sortedSpots(allCrags: CragListItem[], myLoc: Geo | null): SpotRow[] {
    return allCrags
        .map(crag => ({ crag, km: myLoc ? haversineKm(myLoc, { lat: crag.lat, lng: crag.lng }) : null }))
        .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
}

type LocationOverlayProps = {
    /** 'rock' intent only picks a spot (there's no rock to choose -- we're
     * creating one). 'problem' intent additionally expands the currently
     * selected spot's rocks in place (handoff.md decision 18). */
    intent: 'problem' | 'rock'
    allCrags: CragListItem[]
    myLoc: Geo | null
    initialExpandedCragId: string | null
    newSpotDraft: NewSpotDraft
    onNewSpotDraftChange: (v: NewSpotDraft) => void
    onPickSpotOnly: (crag: CragListItem) => void
    onPickSpotAndRock: (crag: CragListItem, boulder: BoulderListItem) => void
    onPickSpotNoRocks: (crag: CragListItem) => void
    onPickNewRock: (crag: CragListItem) => void
    onPickNotSure: (crag: CragListItem) => void
    onConfirmNewSpot: () => void
    onClose: () => void
}

// The full-sheet overlay (handoff.md decision 16): answers one question and
// hands control straight back to the exact scroll position underneath it.
// For "problem" intent this does double duty as the rock picker too --
// tapping a spot re-derives its rock question live (decision 18): 0 rocks
// resolves immediately, 1 auto-picks, 2+ expands in place because that's
// now the only thing left to answer.
export default function LocationOverlay({
    intent, allCrags, myLoc, initialExpandedCragId, newSpotDraft, onNewSpotDraftChange,
    onPickSpotOnly, onPickSpotAndRock, onPickSpotNoRocks, onPickNewRock, onPickNotSure, onConfirmNewSpot, onClose,
}: LocationOverlayProps) {
    const [query, setQuery] = useState('')
    const [expandedCragId, setExpandedCragId] = useState<string | null>(null)
    const [expandedBoulders, setExpandedBoulders] = useState<BoulderListItem[]>([])
    const [showNewSpot, setShowNewSpot] = useState(false)

    useEffect(() => {
        if (intent !== 'problem' || !initialExpandedCragId) return
        fetchBouldersForCrag(initialExpandedCragId).then(list => {
            if (list.length >= 2) {
                setExpandedCragId(initialExpandedCragId)
                setExpandedBoulders(list)
            }
        })
        // Only on mount -- re-expanding is driven by row taps after that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const spots = sortedSpots(allCrags, myLoc).filter(({ crag }) =>
        !query.trim() || crag.name.toLowerCase().includes(query.trim().toLowerCase())
    )

    const handleSpotClick = async (crag: CragListItem) => {
        if (intent === 'rock') { onPickSpotOnly(crag); return }
        const boulders = await fetchBouldersForCrag(crag.id)
        if (boulders.length === 0) { onPickSpotNoRocks(crag); return }
        if (boulders.length === 1 && boulders[0]) { onPickSpotAndRock(crag, boulders[0]); return }
        setExpandedCragId(crag.id)
        setExpandedBoulders(boulders)
    }

    return (
        <div className="absolute inset-0 z-10 bg-black/55 backdrop-blur-[3px] flex flex-col justify-end">
            <div className="bg-panel border border-border border-b-0 rounded-t-[20px] max-h-[88%] flex flex-col overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
                <div className="shrink-0 px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-3 border-b border-border">
                    <h3 className="font-serif font-bold text-[17px] text-text">{intent === 'rock' ? 'Which spot?' : 'Where is it?'}</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -m-2 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                        <X size={20} className="shrink-0" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
                    <div className="relative">
                        <Search size={15} className="shrink-0 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search spots"
                            className="w-full min-h-11 bg-surface border border-border rounded-[10px] pl-9 pr-3.5 py-2.5 text-text-secondary text-sm outline-none focus:border-accent"
                        />
                    </div>
                    <p className="text-xs text-text-muted mt-2.5 mb-1">Nearest first. Search if you're adding from home.</p>

                    {spots.map(({ crag, km }) => {
                        const isExpanded = expandedCragId === crag.id
                        return (
                            <div key={crag.id}>
                                <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    onClick={() => handleSpotClick(crag)}
                                    className={`flex items-center gap-3 w-full min-h-14 px-3 py-2.5 rounded-[10px] cursor-pointer text-left mt-1 border ${isExpanded ? 'bg-surface border-border' : 'bg-transparent border-transparent hover:bg-surface'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[15px] text-text truncate">{crag.name}</div>
                                        <div className="text-xs text-text-muted mt-0.5">
                                            {crag.problem_count
                                                ? `${crag.problem_count} problem${crag.problem_count === 1 ? '' : 's'} · ${crag.boulder_count} rock${crag.boulder_count === 1 ? '' : 's'}`
                                                : 'nothing here yet'}
                                        </div>
                                    </div>
                                    {km != null && (
                                        <div className="shrink-0 text-[13px] font-medium text-text-secondary text-right">
                                            {formatDistanceM(km)}
                                            <small className="block text-[10.5px] font-normal text-text-muted">away</small>
                                        </div>
                                    )}
                                </button>
                                {isExpanded && intent === 'problem' && (
                                    <RockList
                                        boulders={expandedBoulders}
                                        onPick={b => onPickSpotAndRock(crag, b)}
                                        onNewRock={() => onPickNewRock(crag)}
                                        onNotSure={() => onPickNotSure(crag)}
                                    />
                                )}
                            </div>
                        )
                    })}
                    {spots.length === 0 && query && (
                        <p className="text-xs text-text-muted px-1 mt-3">No spots match "{query}".</p>
                    )}

                    <button
                        type="button"
                        onClick={() => setShowNewSpot(true)}
                        className="block w-full bg-transparent border border-dashed border-text-faint rounded-[10px] cursor-pointer text-left mt-2 px-3 py-2.5 hover:border-accent"
                    >
                        <div className="text-[14.5px] text-accent font-medium">It's a new spot</div>
                        <div className="text-xs text-text-muted mt-0.5">name it and check the pin</div>
                    </button>

                    {showNewSpot && (
                        <div className="border border-border rounded-[10px] bg-surface p-3.5 mt-2.5">
                            <h4 className="text-sm font-medium text-text mb-3">What's this place called?</h4>
                            <SpotFields draft={newSpotDraft} onChange={onNewSpotDraftChange} allCrags={allCrags} collapsedDetails />
                            <button
                                type="button"
                                onClick={onConfirmNewSpot}
                                disabled={!newSpotDraft.name.trim() || newSpotDraft.lat == null}
                                className="w-full min-h-11 mt-3 rounded-[10px] border-0 text-on-accent font-medium text-sm cursor-pointer bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Use this spot
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
