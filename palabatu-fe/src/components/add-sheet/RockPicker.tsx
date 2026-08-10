import { useEffect, useState } from 'react'
import { Layers } from 'lucide-react'
import { fetchBouldersForCrag } from '../../lib/cragCache.js'
import type { BoulderListItem } from '../../types/boulder.js'

// One row, full sheet width, 16:9 photo (handoff.md decision 17: a 2-up
// grid renders each photo too small to actually recognise a rock by --
// "the entire justification for the middle level existing"). A photoless,
// unnamed rock identifies itself by a problem on it rather than a bare
// index (UX principle 3's amended fallback).
function RockRow({ boulder, onPick }: { boulder: BoulderListItem; onPick: () => void }) {
    const label = boulder.name ?? (boulder.sample_problem_name ? `${boulder.sample_problem_name}${boulder.problem_count > 1 ? ', and more' : ''}` : null)
    return (
        <button
            type="button"
            onClick={onPick}
            className="block w-full bg-surface border border-border rounded-[10px] overflow-hidden cursor-pointer text-left mt-2 hover:border-accent"
        >
            {boulder.image_urls[0] ? (
                <div className="aspect-video bg-panel">
                    <img src={boulder.image_urls[0]} alt={label ?? 'Rock'} className="w-full h-full object-cover" />
                </div>
            ) : null}
            <div className="flex items-center gap-2.5 px-3 py-2.5">
                {!boulder.image_urls[0] && <Layers size={16} className="shrink-0 text-text-faint" />}
                <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] text-text truncate">{label ?? 'No name yet'}</div>
                    <div className="text-xs text-text-muted mt-0.5">
                        {boulder.problem_count} {boulder.type === 'wall' ? 'route' : 'problem'}{boulder.problem_count === 1 ? '' : 's'}
                        {!boulder.name && !boulder.sample_problem_name && ' · no name yet'}
                        {!boulder.image_urls[0] && ' · no photo yet'}
                    </div>
                </div>
                {boulder.type === 'wall' && (
                    <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-wide text-text-muted border border-border rounded-full px-2 py-0.5">tebing</span>
                )}
            </div>
        </button>
    )
}

function AltRow({ title, subtitle, onPick }: { title: string; subtitle: string; onPick: () => void }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="block w-full bg-transparent border border-dashed border-text-faint rounded-[10px] cursor-pointer text-left mt-2 px-3 py-2.5 hover:border-accent"
        >
            <div className="text-[14.5px] text-accent font-medium">{title}</div>
            <div className="text-xs text-text-muted mt-0.5">{subtitle}</div>
        </button>
    )
}

export type RockListProps = {
    boulders: BoulderListItem[]
    onPick: (boulder: BoulderListItem) => void
    onNewRock: () => void
    /** Omitted for the re-parenting use (there's no "not sure" there --
     * you already know which rock you're moving away from). */
    onNotSure?: () => void
}

// The reusable list body: every rock at a spot, single column, plus "it's a
// new rock" and (in the add-sheet context) "not sure which one". Shared by
// LocationOverlay's inline expansion and the standalone RockPicker below.
export function RockList({ boulders, onPick, onNewRock, onNotSure }: RockListProps) {
    return (
        <div className="pb-2">
            {boulders.map(b => <RockRow key={b.id} boulder={b} onPick={() => onPick(b)} />)}
            <AltRow title="It's a new rock" subtitle="your photo becomes its topo" onPick={onNewRock} />
            {onNotSure && (
                <AltRow title="Not sure which one" subtitle="file it now — a photo lets someone match it up later" onPick={onNotSure} />
            )}
        </div>
    )
}

type RockPickerProps = {
    cragId: string
    onPick: (boulder: BoulderListItem) => void
    onNewRock: () => void
    /** Hides the rock being moved away from -- there's nothing to do by
     * re-picking the one it's already on. */
    excludeBoulderId?: string
}

// Standalone rock picker for a known spot -- used by the re-parenting UI
// ("move to another rock"), where the spot is fixed and only the rock
// changes (handoff.md decision 13's motivating case: filed against the
// wrong rock at the right spot).
export default function RockPicker({ cragId, onPick, onNewRock, excludeBoulderId }: RockPickerProps) {
    const [boulders, setBoulders] = useState<BoulderListItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setLoading(true)
        fetchBouldersForCrag(cragId).then(list => { setBoulders(list); setLoading(false) })
    }, [cragId])

    if (loading) return <p className="text-xs text-text-muted py-4">Loading rocks...</p>

    const visible = excludeBoulderId ? boulders.filter(b => b.id !== excludeBoulderId) : boulders
    return <RockList boulders={visible} onPick={onPick} onNewRock={onNewRock} />
}
