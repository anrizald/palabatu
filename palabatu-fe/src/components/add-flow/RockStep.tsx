import { Plus, HelpCircle, Layers, X } from 'lucide-react'
import type { BoulderListItem } from '../../types/boulder.js'
import type { NewRockDraft } from './types.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"

type RockStepProps = {
    boulders: BoulderListItem[]
    loading: boolean
    onPickExisting: (boulder: BoulderListItem) => void
    isCreatingNew: boolean
    onStartNew: () => void
    onCancelNew: () => void
    newRock: NewRockDraft
    setNewRock: (v: NewRockDraft) => void
    onNotSure: () => void
    /** True when there's nothing to pick from (a brand-new spot, or a spot
     * with zero rocks so far) -- hides "pick from existing" affordances
     * that would otherwise show an empty grid. */
    hasNoExistingRocks: boolean
}

// "Which rock?" -- handoff.md's second add-flow step, picked by photo, not
// name or a dropdown. Skipped entirely by AddFlow when a spot has exactly
// one rock (nothing to choose); "it's a new rock" and "not sure" both
// always proceed, per the UX principle that a beginner who can't
// confidently classify must still be able to finish.
export default function RockStep({
    boulders, loading, onPickExisting, isCreatingNew, onStartNew, onCancelNew, newRock, setNewRock, onNotSure, hasNoExistingRocks,
}: RockStepProps) {
    if (isCreatingNew) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-[13px] text-text-dim">A new rock -- the thing you actually touch.</p>

                <div>
                    <div className={labelClass}>Photo</div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {newRock.imagePreviews.map((preview, idx) => (
                            <div key={idx} className="relative min-w-[90px] h-[90px] rounded-[10px] overflow-hidden shrink-0">
                                <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                <button
                                    onClick={() => setNewRock({
                                        ...newRock,
                                        imageFiles: newRock.imageFiles.filter((_, i) => i !== idx),
                                        imagePreviews: newRock.imagePreviews.filter((_, i) => i !== idx),
                                    })}
                                    className="absolute top-1 right-1 bg-black/60 text-white border-0 rounded-full w-5 h-5 cursor-pointer flex items-center justify-center"
                                    aria-label="Remove photo"
                                ><X size={12} className="shrink-0" /></button>
                            </div>
                        ))}
                        <label className="min-w-[90px] h-[90px] bg-surface border border-dashed border-text-faint rounded-[10px] cursor-pointer flex flex-col items-center justify-center text-text-dim text-xl shrink-0">
                            +
                            <span className="text-[10px] mt-1">Add Photo</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || [])
                                    const previews = files.map(f => URL.createObjectURL(f))
                                    setNewRock({
                                        ...newRock,
                                        imageFiles: [...newRock.imageFiles, ...files],
                                        imagePreviews: [...newRock.imagePreviews, ...previews],
                                    })
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div>
                    <div className={labelClass}>Rock type</div>
                    <input
                        value={newRock.rock_type}
                        onChange={e => setNewRock({ ...newRock, rock_type: e.target.value })}
                        placeholder="e.g. andesite, batu kapur -- optional"
                        className={inputClass}
                    />
                </div>

                <div>
                    <div className={labelClass}>Name</div>
                    <input
                        value={newRock.name}
                        onChange={e => setNewRock({ ...newRock, name: e.target.value })}
                        placeholder="Most rocks don't have one -- optional"
                        className={inputClass}
                    />
                </div>

                {!hasNoExistingRocks && (
                    <button onClick={onCancelNew} className="text-xs text-text-dim self-start cursor-pointer bg-transparent border-0">
                        &larr; Pick from existing rocks instead
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[13px] text-text-dim">Which rock -- the one you're actually standing at?</p>

            {loading ? (
                <p className="text-xs text-text-dim">Loading rocks...</p>
            ) : (
                <div className="grid grid-cols-3 gap-2.5">
                    {boulders.map((b, idx) => (
                        <button
                            key={b.id}
                            onClick={() => onPickExisting(b)}
                            className="relative aspect-square rounded-[10px] overflow-hidden border border-border cursor-pointer bg-surface"
                        >
                            {b.image_urls[0] ? (
                                <img src={b.image_urls[0]} className="w-full h-full object-cover" alt={b.name ?? `Rock ${idx + 1}`} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Layers size={22} className="shrink-0 text-text-faint" />
                                </div>
                            )}
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1.5 py-1 text-[10px] text-white truncate">
                                {b.name ?? `Rock ${idx + 1}`}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <button onClick={onStartNew} className="flex items-center justify-center gap-1.5 py-2.5 bg-transparent border border-dashed border-text-faint rounded-[10px] cursor-pointer text-text-dim font-sans text-[13px]">
                <Plus size={14} className="shrink-0" /> It's a new rock
            </button>
            <button onClick={onNotSure} className="flex items-center justify-center gap-1.5 py-2 bg-transparent border-0 cursor-pointer text-text-dim font-sans text-xs">
                <HelpCircle size={13} className="shrink-0" /> Not sure which rock
            </button>
        </div>
    )
}
