import { useEffect, useState } from 'react'
import { X, Layers } from 'lucide-react'
import { api } from '../lib/api.js'
import { fetchBouldersForCrag } from '../lib/cragCache.js'
import type { BoulderListItem, SuggestMergeRequest } from '../types/boulder.js'
import type { ErrorResponse } from '../types/apitypes.js'
import Toast, { type ToastProps } from './Toast.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-muted tracking-[0.1em] uppercase mb-1.5"

type Props = {
    boulderId: string
    cragId: string
    onClose: () => void
    onSuggested: () => void
}

// "These are the same rock" -- open to any signed-in user (handoff.md
// decision 6). Picks by photo, same as the add wizard's rock step, from
// the other boulders at this spot -- duplicate rocks are almost always
// within the same crag (the backfill created one boulder per pre-existing
// problem, and contributors standing at the same rock keep creating new
// ones there), so the picker doesn't need a cross-crag search.
export default function MergeSuggestModal({ boulderId, cragId, onClose, onSuggested }: Props) {
    const [candidates, setCandidates] = useState<BoulderListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [targetId, setTargetId] = useState<string | null>(null)
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [toast, setToast] = useState<ToastProps | null>(null)

    useEffect(() => {
        fetchBouldersForCrag(cragId).then(list => {
            setCandidates(list.filter(b => b.id !== boulderId && !b.merged_into))
            setIsLoading(false)
        })
    }, [cragId, boulderId])

    const handleSubmit = async () => {
        if (!targetId) {
            setToast({ message: 'Pick the other rock', type: 'error', onClose: () => setToast(null) })
            return
        }
        setIsSubmitting(true)
        const body: SuggestMergeRequest = { target_boulder_id: targetId, reason }
        const res = await api.post<unknown | ErrorResponse>(`/api/boulders/${boulderId}/merge-suggestions`, body)
        setIsSubmitting(false)
        if (res && typeof res === 'object' && 'error' in res) {
            setToast({ message: (res as ErrorResponse).error, type: 'error', onClose: () => setToast(null) })
            return
        }
        onSuggested()
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-6">
            {toast && <Toast {...toast} />}
            <div className="bg-panel border border-border rounded-[20px] w-full max-w-[440px] max-h-[calc(100dvh-48px)] flex flex-col shadow-[0_40px_80px_rgba(0,0,0,0.6)] font-sans">
                <div className="flex items-center justify-between pt-4 px-8 pb-2.5 shrink-0">
                    <h2 className="font-serif text-[20px] font-black text-text">These are the same rock</h2>
                    <button onClick={onClose} className="text-text-dim cursor-pointer bg-transparent border-0 p-0 flex items-center" aria-label="Close">
                        <X size={18} className="shrink-0" />
                    </button>
                </div>

                <div className="overflow-y-auto min-h-0 flex-1 px-8 pb-4 flex flex-col gap-4">
                    <p className="text-[13px] text-text-muted">Which other rock at this spot is this the same as?</p>

                    {isLoading ? (
                        <p className="text-xs text-text-muted">Loading rocks...</p>
                    ) : candidates.length === 0 ? (
                        <p className="text-sm text-text-muted">There's no other rock at this spot to compare against.</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-2.5">
                            {candidates.map((b, idx) => (
                                <button
                                    key={b.id}
                                    onClick={() => setTargetId(b.id)}
                                    className={`relative aspect-square rounded-[10px] overflow-hidden border cursor-pointer bg-surface ${targetId === b.id ? 'border-accent' : 'border-border'}`}
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

                    <div>
                        <div className={labelClass}>Why? (optional)</div>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. same shape, same problems, standing right next to it"
                            rows={2}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="flex gap-2.5 px-8 py-4 shrink-0 border-t border-border">
                    <button onClick={onClose} className="flex-1 py-[11px] bg-transparent border border-border rounded-[10px] text-text-muted font-sans text-sm cursor-pointer">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !targetId}
                        className={`flex-[2] py-[11px] rounded-[10px] border-0 text-on-accent font-sans text-sm font-medium cursor-pointer bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))] ${isSubmitting || !targetId ? 'opacity-50' : 'opacity-100'}`}
                    >
                        {isSubmitting ? 'Sending...' : 'Flag as the same rock'}
                    </button>
                </div>
            </div>
        </div>
    )
}
