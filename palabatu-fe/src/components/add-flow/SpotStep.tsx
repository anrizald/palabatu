import { useMemo, useState } from 'react'
import { Search, MapPin, Plus, Compass } from 'lucide-react'
import type { CragListItem } from '../../types/crag.js'
import type { NewSpotDraft } from './types.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"

type SpotStepProps = {
    crags: CragListItem[]
    onPickExisting: (crag: CragListItem) => void
    isCreatingNew: boolean
    onStartNew: () => void
    onCancelNew: () => void
    newSpot: NewSpotDraft
    setNewSpot: (v: NewSpotDraft) => void
    pickedCoords: { lat: number; lng: number } | null
    isPicking: boolean
    onStartPicking: () => void
}

// "Where is it?" -- handoff.md's first add-flow step. Search existing spots
// by name, or drop into a short new-spot form (name + required pin +
// optional patokan/access notes). Nothing is created here -- AddFlow only
// POSTs the draft at final submit, so backing out mid-wizard never leaves
// an orphan crag row.
export default function SpotStep({
    crags, onPickExisting, isCreatingNew, onStartNew, onCancelNew,
    newSpot, setNewSpot, pickedCoords, isPicking, onStartPicking,
}: SpotStepProps) {
    const [query, setQuery] = useState('')

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return crags
        return crags.filter(c => c.name.toLowerCase().includes(q))
    }, [crags, query])

    if (isCreatingNew) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-text-dim">A new spot -- the place you park and walk in from.</p>

                <div>
                    <div className={labelClass}>What's it called? *</div>
                    <input
                        value={newSpot.name}
                        onChange={e => setNewSpot({ ...newSpot, name: e.target.value })}
                        placeholder="e.g. Goa Agung"
                        className={inputClass}
                    />
                </div>

                <div>
                    <div className={labelClass}>Drop a pin *</div>
                    {pickedCoords ? (
                        <div className="flex gap-2 items-center">
                            <div className="flex-1 px-3.5 py-2.5 bg-associate/10 border border-associate rounded-[10px] text-associate font-sans text-[13px] flex items-center gap-1.5">
                                <MapPin size={13} className="shrink-0" /> {pickedCoords.lat.toFixed(4)}, {pickedCoords.lng.toFixed(4)}
                            </div>
                            <button onClick={onStartPicking} className="px-3.5 py-2.5 bg-transparent border border-border rounded-[10px] cursor-pointer text-text-muted font-sans text-xs whitespace-nowrap">
                                Change
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onStartPicking}
                            disabled={isPicking}
                            className="w-full py-2.5 bg-transparent border border-border rounded-[10px] cursor-pointer text-text-dim font-sans text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <MapPin size={14} className="shrink-0" /> {isPicking ? 'Click on the map…' : 'Click to pick on map'}
                        </button>
                    )}
                </div>

                <div>
                    <div className={labelClass}>Patokan (directions)</div>
                    <textarea
                        value={newSpot.directions}
                        onChange={e => setNewSpot({ ...newSpot, directions: e.target.value })}
                        placeholder="Landmarks to find the spot -- optional"
                        rows={2}
                        className={inputClass}
                    />
                </div>

                <div>
                    <div className={labelClass}>Access notes</div>
                    <textarea
                        value={newSpot.access_notes}
                        onChange={e => setNewSpot({ ...newSpot, access_notes: e.target.value })}
                        placeholder="Land status, permission, parking -- optional"
                        rows={2}
                        className={inputClass}
                    />
                </div>

                <button onClick={onCancelNew} className="text-xs text-text-dim self-start cursor-pointer bg-transparent border-0">
                    &larr; Search existing spots instead
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[13px] text-text-dim">Where is it -- the place you park and walk in from?</p>

            <div className="relative">
                <Search size={14} className="shrink-0 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search spots..."
                    className={inputClass + ' pl-9'}
                />
            </div>

            <div className="flex flex-col gap-1.5 max-h-[240px] overflow-y-auto">
                {matches.map(crag => (
                    <button
                        key={crag.id}
                        onClick={() => onPickExisting(crag)}
                        className="text-left px-3.5 py-2.5 bg-surface border border-border rounded-[10px] cursor-pointer flex items-center gap-2.5"
                    >
                        <Compass size={16} className="shrink-0 text-accent" />
                        <div>
                            <div className="text-sm text-text font-medium">{crag.name}</div>
                            <div className="text-[11px] text-text-dim">
                                {crag.boulder_count} rock{crag.boulder_count === 1 ? '' : 's'} · {crag.problem_count} problem{crag.problem_count === 1 ? '' : 's'}
                            </div>
                        </div>
                    </button>
                ))}
                {matches.length === 0 && query && (
                    <p className="text-xs text-text-dim px-1">No spots match "{query}".</p>
                )}
            </div>

            <button onClick={onStartNew} className="flex items-center justify-center gap-1.5 py-2.5 bg-transparent border border-dashed border-text-faint rounded-[10px] cursor-pointer text-text-dim font-sans text-[13px]">
                <Plus size={14} className="shrink-0" /> Can't find it? Add a new spot
            </button>
        </div>
    )
}
