import { useState } from 'react'
import type { CragListItem } from '../../types/crag.js'
import type { NewSpotDraft } from './types.js'
import SpotMiniMap from './SpotMiniMap.js'

const inputClass = "w-full min-h-11 bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none focus:border-accent"
const labelClass = "block text-[12.5px] font-medium text-text-muted mb-1.5"

type SpotFieldsProps = {
    draft: NewSpotDraft
    onChange: (v: NewSpotDraft) => void
    allCrags: CragListItem[]
    /** Collapses the patokan/access-notes fields behind "More details" --
     * used for the inline new-spot branch inside the picker overlay, where
     * the sheet is already tall. The standalone "Add a spot" tab shows them
     * open (they're the point of that tab). */
    collapsedDetails?: boolean
}

// The one spot editor, used in two places (name + pin + photo + optional
// patokan/access): the "Add a spot" tab, and inline when someone picks
// "it's a new spot" from the location overlay. Same fields both times.
export default function SpotFields({ draft, onChange, allCrags, collapsedDetails }: SpotFieldsProps) {
    const [detailsOpen, setDetailsOpen] = useState(!collapsedDetails)

    const set = (patch: Partial<NewSpotDraft>) => onChange({ ...draft, ...patch })

    return (
        <div className="flex flex-col gap-4">
            <div>
                <label className={labelClass}>What's it called?</label>
                <input value={draft.name} onChange={e => set({ name: e.target.value })} placeholder="Batu Kalong" className={inputClass} />
            </div>

            <div>
                <label className={labelClass}>Where is it?</label>
                <SpotMiniMap
                    lat={draft.lat}
                    lng={draft.lng}
                    accuracyM={draft.accuracyM}
                    onPick={(lat, lng, accuracyM) => set({ lat, lng, accuracyM })}
                    allCrags={allCrags}
                />
            </div>

            <div>
                <label className={labelClass}>Photo <span className="font-normal opacity-85">&middot; how it looks when you arrive</span></label>
                {draft.photoPreview ? (
                    <div className="relative w-full aspect-video rounded-[10px] overflow-hidden border border-border">
                        <img src={draft.photoPreview} alt="Spot" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => set({ photoFile: null, photoPreview: null })} className="absolute top-2 right-2 bg-black/60 text-white border-0 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer">&times;</button>
                    </div>
                ) : (
                    <label className="block w-full min-h-11 border border-dashed border-border rounded-[10px] bg-surface text-text-secondary text-sm text-center py-5 cursor-pointer hover:border-accent">
                        + add a photo
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            set({ photoFile: file, photoPreview: URL.createObjectURL(file) })
                        }} />
                    </label>
                )}
                <p className="text-xs text-text-muted mt-1.5">The approach shot, so the next person recognises the place.</p>
            </div>

            <div className="border-t border-border pt-1">
                <button type="button" onClick={() => setDetailsOpen(v => !v)} className="w-full min-h-11 flex items-center justify-between text-[13.5px] font-medium text-text-muted cursor-pointer bg-transparent border-0">
                    More details (optional)
                    <span className="text-text-muted">{detailsOpen ? '−' : '+'}</span>
                </button>
                {detailsOpen && (
                    <div className="flex flex-col gap-3 pt-1">
                        <div>
                            <label className={labelClass}>Patokan</label>
                            <input value={draft.directions} onChange={e => set({ directions: e.target.value })} placeholder="turn at the warung, 300 m up the track" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Access</label>
                            <input value={draft.access_notes} onChange={e => set({ access_notes: e.target.value })} placeholder="ask the owner first, park by the gate" className={inputClass} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
