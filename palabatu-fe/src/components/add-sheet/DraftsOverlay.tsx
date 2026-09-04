import { useEffect, useState } from 'react'
import { X, Trash2, Layers, MapPin, Mountain } from 'lucide-react'
import { type AddSheetDraft, formatDraftAge } from './drafts.js'
import type { AddIntent } from './types.js'

const INTENT_LABEL: Record<AddIntent, string> = { problem: 'Problem', spot: 'Spot', rock: 'Rock' }
const INTENT_ICON: Record<AddIntent, typeof Mountain> = { problem: Mountain, spot: MapPin, rock: Layers }

function thumbnailFile(draft: AddSheetDraft): File | null {
    if (draft.intent === 'spot') return draft.newSpotDraft.photoFile
    if (draft.intent === 'rock') return draft.newRockDraft.imageFiles[0] ?? null
    return draft.problemDraft.photoFile
}

function DraftRow({ draft, onLoad, onRemove }: { draft: AddSheetDraft; onLoad: () => void; onRemove: () => void }) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null)
    const Icon = INTENT_ICON[draft.intent]

    useEffect(() => {
        const file = thumbnailFile(draft)
        if (!file) { setThumbUrl(null); return }
        const url = URL.createObjectURL(file)
        setThumbUrl(url)
        return () => URL.revokeObjectURL(url)
        // draft.id is enough to key the effect -- the file a given draft
        // points at doesn't change without a new autosave, which re-renders
        // the whole list from a fresh getAllDrafts() anyway.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draft.id])

    return (
        <div className="flex items-center gap-3 w-full min-h-14 px-3 py-2.5 rounded-[10px] border border-border bg-surface mt-2">
            <button type="button" onClick={onLoad} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer bg-transparent border-0 p-0">
                {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="shrink-0 w-11 h-11 rounded-[8px] object-cover bg-panel" />
                ) : (
                    <div className="shrink-0 w-11 h-11 rounded-[8px] bg-panel flex items-center justify-center">
                        <Icon size={16} className="shrink-0 text-text-faint" />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text truncate">{draft.label}</div>
                    <div className="text-xs text-text-muted mt-0.5">{INTENT_LABEL[draft.intent]} &middot; {formatDraftAge(draft.updatedAt)}</div>
                </div>
            </button>
            <button
                type="button"
                onClick={onRemove}
                aria-label="Remove draft"
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-danger/10 hover:text-danger cursor-pointer bg-transparent border-0"
            >
                <Trash2 size={16} className="shrink-0" />
            </button>
        </div>
    )
}

type DraftsOverlayProps = {
    drafts: AddSheetDraft[]
    onLoad: (draft: AddSheetDraft) => void
    onRemove: (id: string) => void
    onClose: () => void
}

// Full-sheet overlay, same layered pattern as LocationOverlay (handoff-
// drafts.md decision 8) -- keeps drafts scoped to the flow that creates
// them rather than a standalone page nobody thinks to visit.
export default function DraftsOverlay({ drafts, onLoad, onRemove, onClose }: DraftsOverlayProps) {
    return (
        <div className="absolute inset-0 z-10 bg-black/55 backdrop-blur-[3px] flex flex-col justify-end">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="drafts-overlay-title"
                className="bg-panel border border-border border-b-0 rounded-t-[20px] max-h-[88%] flex flex-col overflow-hidden shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
            >
                <div className="shrink-0 px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-3 border-b border-border">
                    <h3 id="drafts-overlay-title" className="font-serif font-bold text-[17px] text-text">Your drafts</h3>
                    <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -m-2 rounded-full flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-secondary cursor-pointer bg-transparent border-0">
                        <X size={20} className="shrink-0" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1">
                    {drafts.length === 0 ? (
                        <p className="text-xs text-text-muted py-4">Nothing saved yet.</p>
                    ) : (
                        drafts.map(d => (
                            <DraftRow key={d.id} draft={d} onLoad={() => onLoad(d)} onRemove={() => onRemove(d.id)} />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
