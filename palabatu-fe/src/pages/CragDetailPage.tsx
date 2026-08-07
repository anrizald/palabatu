import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Compass, Layers, MapPin, Pencil, Plus } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'
import { useIsAdmin } from '../lib/useIsAdmin.js'
import { invalidateCragCache } from '../lib/cragCache.js'
import type { CragListItem, CragRequest } from '../types/crag.js'
import type { BoulderListItem } from '../types/boulder.js'
import type { ErrorResponse } from '../types/apitypes.js'
import Toast, { type ToastProps } from '../components/Toast.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"

// A crag's page (handoff.md decision 3: tapping a crag pin opens this).
// Shows the spot's own info and a photo grid of its rocks -- picked by
// photo, per handoff.md's UX principles, never a name list. An empty spot
// (no rocks yet) gets a primary-action empty state, not a line of grey
// text (handoff.md open item 1).
export default function CragDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const isAdmin = useIsAdmin()
    const navigate = useNavigate()

    const [crag, setCrag] = useState<CragListItem | null>(null)
    const [boulders, setBoulders] = useState<BoulderListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editDirections, setEditDirections] = useState('')
    const [editAccessNotes, setEditAccessNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    const load = () => {
        if (!id) return
        Promise.all([
            api.get<CragListItem | ErrorResponse>(`/api/crags/${id}`),
            api.get<BoulderListItem[] | ErrorResponse>(`/api/crags/${id}/boulders`),
        ]).then(([cragRes, boulderRes]) => {
            if ('error' in cragRes) { setNotFound(true); setIsLoading(false); return }
            setCrag(cragRes)
            setEditName(cragRes.name)
            setEditDirections(cragRes.directions ?? '')
            setEditAccessNotes(cragRes.access_notes ?? '')
            setBoulders('error' in boulderRes ? [] : boulderRes)
            setIsLoading(false)
        })
    }

    useEffect(load, [id])

    const canEdit = !!crag && !!user && (user.id === crag.created_by || isAdmin)

    const handleSave = async () => {
        if (!crag || !editName.trim()) { showError('Please give the spot a name'); return }
        setIsSaving(true)
        const body: CragRequest = {
            name: editName, lat: crag.lat, lng: crag.lng,
            directions: editDirections, access_notes: editAccessNotes,
        }
        const res = await api.put<CragListItem | ErrorResponse>(`/api/crags/${crag.id}`, body)
        setIsSaving(false)
        if ('error' in res) { showError(res.error); return }
        invalidateCragCache()
        setIsEditing(false)
        load()
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading...</div>
            </div>
        )
    }

    if (notFound || !crag) {
        return (
            <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Spot not found</div>
                <Link to="/map" className="text-accent text-sm no-underline hover:underline">Back to the map</Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
            {toast && <Toast {...toast} />}

            <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-3">
                    {isEditing ? (
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className={labelClass}>Name</div>
                                <input value={editName} onChange={e => setEditName(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <div className={labelClass}>Patokan (directions)</div>
                                <textarea value={editDirections} onChange={e => setEditDirections(e.target.value)} rows={2} className={inputClass} />
                            </div>
                            <div>
                                <div className={labelClass}>Access notes</div>
                                <textarea value={editAccessNotes} onChange={e => setEditAccessNotes(e.target.value)} rows={2} className={inputClass} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSave} disabled={isSaving} className="flex-1 p-2 bg-accent/10 border border-accent/25 text-accent rounded-lg cursor-pointer text-xs">
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                                <button onClick={() => setIsEditing(false)} className="flex-1 p-2 bg-white/5 border border-border text-text-muted rounded-lg cursor-pointer text-xs">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Compass size={20} className="shrink-0 text-accent" />
                                    <h1 className="font-serif text-2xl font-black text-text">{crag.name}</h1>
                                </div>
                                {canEdit && (
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">
                                        <Pencil size={13} className="shrink-0" /> Edit
                                    </button>
                                )}
                            </div>

                            <div className="text-xs text-text-dim flex items-center gap-1.5">
                                <MapPin size={12} className="shrink-0" /> {crag.lat.toFixed(4)}, {crag.lng.toFixed(4)}
                            </div>

                            {crag.directions && (
                                <div className="text-sm text-text-secondary">
                                    <span className="text-text-dim">Patokan: </span>{crag.directions}
                                </div>
                            )}
                            {crag.access_notes && (
                                <div className="text-sm text-text-secondary">
                                    <span className="text-text-dim">Access: </span>{crag.access_notes}
                                </div>
                            )}
                            {crag.creator_name && (
                                <div className="text-xs text-text-dim">Added by {crag.creator_name}</div>
                            )}
                        </>
                    )}
                </div>

                {boulders.length === 0 ? (
                    <div className="bg-panel border border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
                        <Layers size={28} className="shrink-0 text-text-faint" />
                        <div className="font-serif text-lg font-black text-text">No problems yet</div>
                        <p className="text-sm text-text-dim max-w-[360px]">Someone marked this spot, but nobody's documented a rock here yet.</p>
                        <button
                            onClick={() => navigate(`/map?addToCrag=${crag.id}`)}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] border-0 text-on-accent font-sans text-sm font-medium cursor-pointer bg-[linear-gradient(145deg,var(--color-accent),var(--color-accent-dark))]"
                        >
                            <Plus size={15} className="shrink-0" /> Add the first one
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-serif text-lg font-black text-text">Rocks</h2>
                            <button
                                onClick={() => navigate(`/map?addToCrag=${crag.id}`)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-dashed border-text-faint rounded-lg text-text-dim text-xs cursor-pointer"
                            >
                                <Plus size={13} className="shrink-0" /> Add a rock
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {boulders.map((b, idx) => {
                                const isEmpty = b.problem_count === 0
                                return (
                                    <Link
                                        key={b.id}
                                        to={`/boulders/${b.id}`}
                                        className={`relative aspect-square rounded-2xl overflow-hidden border border-border block no-underline ${isEmpty ? 'opacity-60' : ''}`}
                                    >
                                        {b.image_urls[0] ? (
                                            <img src={b.image_urls[0]} className="w-full h-full object-cover" alt={b.name ?? `Rock ${idx + 1}`} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-surface">
                                                <Layers size={26} className="shrink-0 text-text-faint" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,12,10,0.9),rgba(15,12,10,0.1)_60%,transparent)]" />
                                        <div className="absolute left-2.5 right-2.5 bottom-2.5">
                                            <div className="font-serif text-sm font-bold text-white truncate">{b.name ?? `Rock ${idx + 1}`}</div>
                                            <div className="text-[10.5px] text-white/75">
                                                {isEmpty ? 'No problems yet' : `${b.problem_count} problem${b.problem_count === 1 ? '' : 's'}`}
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
