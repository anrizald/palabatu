import type { BoulderType } from '../../types/boulder.js'
import RockPointMap, { type NearbyRock } from '../RockPointMap.js'
import type { Geo, NewRockDraft } from './types.js'

const inputClass = "w-full min-h-11 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none focus:border-accent"
const labelClass = "block text-[12.5px] font-medium text-text-muted mb-1.5"

// The "batu / tebing" choice is a required binary that arrives pre-answered
// -- a real segmented control, deliberately not the grade-chip component
// (handoff.md's tier-2 finding 9: identical appearance, opposite contract).
function TypeSegment({ value, onChange }: { value: BoulderType; onChange: (v: BoulderType) => void }) {
    return (
        <div className="flex p-[3px] bg-surface border border-border rounded-[10px]">
            {([['boulder', 'Batu · a rock'], ['wall', 'Tebing · a wall']] as const).map(([v, label]) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onChange(v)}
                    aria-pressed={value === v}
                    className={`flex-1 min-h-[38px] rounded-lg text-[13.5px] font-medium cursor-pointer border-0 ${value === v ? 'bg-panel text-text shadow-sm' : 'bg-transparent text-text-muted'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}

type RockFieldsProps = {
    draft: NewRockDraft
    onChange: (v: NewRockDraft) => void
    /** The resolved spot's pin and name, or null while the breadcrumb still
     * points at a spot being created -- the pin question has no frame of
     * reference until there's a spot to place the rock within. */
    cragCenter: Geo | null
    cragName: string
    /** The resolved spot's already-pinned rocks, for the duplicate nudge. */
    nearbyRocks: NearbyRock[]
}

// The "Add a rock" tab's fields, one level down from SpotFields (handoff.md
// decision 19): photo or name is required, never both, never neither.
export default function RockFields({ draft, onChange, cragCenter, cragName, nearbyRocks }: RockFieldsProps) {
    const set = (patch: Partial<NewRockDraft>) => onChange({ ...draft, ...patch })

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className={labelClass}>Is it a rock or a wall?</label>
                <TypeSegment value={draft.type} onChange={type => set({ type })} />
            </div>

            <div>
                <label className={labelClass}>Photo <span className="font-normal opacity-85">&middot; the wide shot lines get drawn on</span></label>
                {draft.imagePreviews.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {draft.imagePreviews.map((preview, idx) => (
                            <div key={idx} className="relative min-w-[90px] h-[90px] rounded-[10px] overflow-hidden shrink-0 border border-border">
                                <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                <button
                                    type="button"
                                    onClick={() => set({
                                        imageFiles: draft.imageFiles.filter((_, i) => i !== idx),
                                        imagePreviews: draft.imagePreviews.filter((_, i) => i !== idx),
                                    })}
                                    className="absolute top-1 right-1 bg-black/60 text-white border-0 rounded-full w-5 h-5 cursor-pointer flex items-center justify-center"
                                    aria-label="Remove photo"
                                >&times;</button>
                            </div>
                        ))}
                        <label className="min-w-[90px] h-[90px] bg-surface border border-dashed border-border rounded-[10px] cursor-pointer flex items-center justify-center text-text-muted text-xl shrink-0 hover:border-accent">
                            +
                            <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                                const files = Array.from(e.target.files || [])
                                set({
                                    imageFiles: [...draft.imageFiles, ...files],
                                    imagePreviews: [...draft.imagePreviews, ...files.map(f => URL.createObjectURL(f))],
                                })
                            }} />
                        </label>
                    </div>
                ) : (
                    <label className="block w-full min-h-11 border border-dashed border-border rounded-[10px] bg-surface text-text-secondary text-sm text-center py-5 cursor-pointer hover:border-accent">
                        + add a photo
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                            const files = Array.from(e.target.files || [])
                            set({
                                imageFiles: [...draft.imageFiles, ...files],
                                imagePreviews: [...draft.imagePreviews, ...files.map(f => URL.createObjectURL(f))],
                            })
                        }} />
                    </label>
                )}
            </div>

            <div>
                <label className={labelClass}>Name it? <span className="font-normal opacity-85">&middot; most aren't named</span></label>
                <input
                    value={draft.name}
                    onChange={e => set({ name: e.target.value })}
                    placeholder={draft.type === 'wall' ? 'the wall by the road' : 'the one with the crack'}
                    className={inputClass}
                />
                <p className="text-xs text-text-muted mt-1.5">
                    Either a photo or a name is enough. Without either, nobody can tell which {draft.type === 'wall' ? 'wall' : 'rock'} this is.
                </p>
            </div>

            {/* Optional, and the only place a rock's own coordinate is ever
                captured (handoff.md open item 13's close-zoom rock layer is
                what it feeds). A spot 100 m across can hold a dozen rocks;
                without this they all collapse onto the spot's single pin. */}
            <div>
                <label className={labelClass}>
                    Where exactly? <span className="font-normal opacity-85">&middot; optional, helps people find it</span>
                </label>
                {cragCenter ? (
                    <RockPointMap
                        lat={draft.lat}
                        lng={draft.lng}
                        accuracyM={draft.accuracyM}
                        onPick={(lat, lng, accuracyM) => set({ lat, lng, accuracyM })}
                        onClear={() => set({ lat: null, lng: null, accuracyM: null })}
                        cragCenter={cragCenter}
                        cragName={cragName}
                        nearby={nearbyRocks}
                        kind={draft.type}
                    />
                ) : (
                    <p className="text-xs text-text-muted">
                        Pick the spot above first, then you can pin exactly where this {draft.type === 'wall' ? 'wall' : 'rock'} stands within it.
                    </p>
                )}
            </div>

            <div>
                <label className={labelClass}>What kind of stone? <span className="font-normal opacity-85">&middot; optional</span></label>
                <input value={draft.rock_type} onChange={e => set({ rock_type: e.target.value })} placeholder="batu kapur" className={inputClass} />
            </div>
        </div>
    )
}
