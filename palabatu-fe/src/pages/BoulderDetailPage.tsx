import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layers, Pencil, Plus, X, AlertTriangle, GitCompare } from 'lucide-react'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/useAuth.js'
import { useIsAdmin } from '../lib/useIsAdmin.js'
import { invalidateCragCache } from '../lib/cragCache.js'
import type { CragListItem } from '../types/crag.js'
import type { BoulderListItem, BoulderAnnotation, UpdateBoulderRequest, MergeRequestListItem } from '../types/boulder.js'
import type { ProblemListItem, TopoUploadResponse } from '../types/problem.js'
import type { Shape } from '../types/annotation.js'
import type { ErrorResponse } from '../types/apitypes.js'
import { useContainRect } from '../components/topo-annotations/useContainRect.js'
import TopoAnnotationOverlay from '../components/topo-annotations/TopoAnnotationOverlay.js'
import MergeSuggestModal from '../components/MergeSuggestModal.js'
import Toast, { type ToastProps } from '../components/Toast.js'

const inputClass = "w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
const labelClass = "text-[11px] text-text-dim tracking-[0.1em] uppercase mb-1.5"

// Read-only view of a photo with every problem's line on it drawn together
// -- the concrete payoff of the boulder owning the photo (handoff.md
// decision 2: "one photo, N lines"), which no single problem's own page can
// show on its own.
function BoulderPhoto({ url, shapes }: { url: string; shapes: Shape[] }) {
    const { containerRef, imgRef, rect } = useContainRect()
    return (
        <div ref={containerRef} className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-surface" style={{ minHeight: '220px' }}>
            <img ref={imgRef} src={url} alt="Rock" style={{ maxWidth: '100%', maxHeight: '420px', width: 'auto', height: 'auto', display: 'block' }} />
            <TopoAnnotationOverlay shapes={shapes} rect={rect} />
        </div>
    )
}

// A boulder's page (handoff.md's middle level) -- the rock's own photo(s),
// every problem drawn on those photos together, and the list of ways up it.
export default function BoulderDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const isAdmin = useIsAdmin()
    const navigate = useNavigate()

    const [boulder, setBoulder] = useState<BoulderListItem | null>(null)
    const [crag, setCrag] = useState<CragListItem | null>(null)
    const [annotations, setAnnotations] = useState<BoulderAnnotation[]>([])
    const [problems, setProblems] = useState<ProblemListItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)

    const [isEditing, setIsEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editRockType, setEditRockType] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
    const [removingUrl, setRemovingUrl] = useState<string | null>(null)

    const [showMergeModal, setShowMergeModal] = useState(false)
    const [pendingMergeRequests, setPendingMergeRequests] = useState<MergeRequestListItem[]>([])
    const [objectionDrafts, setObjectionDrafts] = useState<Record<string, string>>({})
    const [objectingId, setObjectingId] = useState<string | null>(null)

    const [toast, setToast] = useState<ToastProps | null>(null)
    const showError = (message: string) => setToast({ message, type: 'error', onClose: () => setToast(null) })

    const load = () => {
        if (!id) return
        api.get<BoulderListItem | ErrorResponse>(`/api/boulders/${id}`).then(async boulderRes => {
            if ('error' in boulderRes) { setNotFound(true); setIsLoading(false); return }
            setBoulder(boulderRes)
            setEditName(boulderRes.name ?? '')
            setEditRockType(boulderRes.rock_type ?? '')

            const [cragRes, annotationsRes, problemsRes] = await Promise.all([
                api.get<CragListItem | ErrorResponse>(`/api/crags/${boulderRes.crag_id}`),
                api.get<BoulderAnnotation[] | ErrorResponse>(`/api/boulders/${id}/annotations`),
                api.get<ProblemListItem[] | ErrorResponse>(`/api/problems?boulder_id=${id}`),
            ])
            if (!('error' in cragRes)) setCrag(cragRes)
            setAnnotations('error' in annotationsRes ? [] : annotationsRes)
            setProblems('error' in problemsRes ? [] : problemsRes)
            setIsLoading(false)
        })
    }

    useEffect(load, [id])

    const canEdit = !!boulder && !!user && (user.id === boulder.created_by || isAdmin)

    // Visibility for the "someone flagged this as maybe the same rock"
    // banner -- the new creator-or-admin-gated endpoint (as opposed to the
    // admin-wide queue) so this boulder's own creator can actually see and
    // object to a request filed against their rock (handoff.md merge
    // design note 3).
    useEffect(() => {
        if (!id || !canEdit) { setPendingMergeRequests([]); return }
        api.get<MergeRequestListItem[] | ErrorResponse>(`/api/boulders/${id}/merge-requests`).then(res => {
            setPendingMergeRequests(Array.isArray(res) ? res : [])
        })
    }, [id, canEdit])

    const handleObject = async (requestId: string) => {
        const body = objectionDrafts[requestId]?.trim()
        if (!body) { showError('Say why this is not the same rock'); return }
        setObjectingId(requestId)
        const res = await api.post<Partial<ErrorResponse>>(`/api/boulders/merge-requests/${requestId}/object`, { body })
        setObjectingId(null)
        if (res.error) { showError(res.error); return }
        setPendingMergeRequests(prev => prev.map(r => r.id === requestId
            ? { ...r, objections: [...r.objections, { id: 'local', merge_request_id: requestId, user_id: user?.id ?? null, username: user?.username ?? null, body, created_at: new Date().toISOString() }] }
            : r))
        setObjectionDrafts(prev => ({ ...prev, [requestId]: '' }))
    }

    const handleSave = async () => {
        if (!boulder) return
        setIsSaving(true)
        const body: UpdateBoulderRequest = { name: editName, rock_type: editRockType, lat: boulder.lat, lng: boulder.lng }
        const res = await api.put<BoulderListItem | ErrorResponse>(`/api/boulders/${boulder.id}`, body)
        setIsSaving(false)
        if ('error' in res) { showError(res.error); return }
        invalidateCragCache()
        setIsEditing(false)
        load()
    }

    const handleAddPhotos = async (files: File[]) => {
        if (!boulder || files.length === 0) return
        setIsUploadingPhoto(true)
        try {
            const uploads = await Promise.all(files.map(file => {
                const formData = new FormData()
                formData.append('image', file)
                return api.upload<Partial<TopoUploadResponse & ErrorResponse>>('/api/upload/topo', formData)
            }))
            const uploadedUrls = uploads.filter((r): r is TopoUploadResponse => !!r.url).map(r => r.url)
            if (uploadedUrls.length === 0) return
            const res = await api.post<BoulderListItem | ErrorResponse>(`/api/boulders/${boulder.id}/images`, { image_urls: uploadedUrls })
            if ('error' in res) { showError(res.error); return }
            invalidateCragCache()
            load()
        } finally {
            setIsUploadingPhoto(false)
        }
    }

    const handleRemovePhoto = async (url: string) => {
        if (!boulder || !window.confirm('Remove this photo? Every line drawn on it goes too.')) return
        setRemovingUrl(url)
        const res = await api.delete<Partial<ErrorResponse>>(`/api/boulders/${boulder.id}/images`, { url })
        setRemovingUrl(null)
        if (res.error) { showError(res.error); return }
        invalidateCragCache()
        load()
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-ink flex items-center justify-center">
                <div className="text-text-muted font-serif tracking-wider">Loading...</div>
            </div>
        )
    }

    if (notFound || !boulder) {
        return (
            <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="font-serif text-2xl font-black text-text">Rock not found</div>
                <Link to="/map" className="text-accent text-sm no-underline hover:underline">Back to the map</Link>
            </div>
        )
    }

    const annotationsByUrl: Record<string, Shape[]> = {}
    for (const a of annotations) {
        annotationsByUrl[a.image_url] = [...(annotationsByUrl[a.image_url] ?? []), ...a.data]
    }

    return (
        <div className="min-h-screen bg-ink font-sans px-6 pt-20 pb-12">
            {toast && <Toast {...toast} />}

            <div className="max-w-[820px] mx-auto flex flex-col gap-5">
                {crag && (
                    <Link to={`/crags/${crag.id}`} className="text-xs text-text-dim no-underline hover:underline self-start">
                        &larr; {crag.name}
                    </Link>
                )}

                {pendingMergeRequests.map(req => {
                    const otherName = (req.source_boulder_id === boulder.id ? req.target_boulder_name : req.source_boulder_name) ?? 'another rock';
                    return (
                        <div key={req.id} className="bg-accent/10 border border-accent/30 rounded-2xl p-5 flex flex-col gap-3">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle size={16} className="shrink-0 text-accent mt-0.5" />
                                <p className="text-sm text-text-secondary">
                                    <b>{req.suggester_name ?? 'Someone'}</b> flagged this as maybe the same rock as <b>{otherName}</b>.
                                    {req.reason && <span className="block text-xs text-text-dim mt-1">"{req.reason}"</span>}
                                </p>
                            </div>
                            {req.objections.length > 0 && (
                                <div className="flex flex-col gap-1.5 pl-[26px]">
                                    {req.objections.map(o => (
                                        <div key={o.id} className="text-xs text-text-dim">
                                            <b className="text-text-secondary">{o.username ?? 'Someone'}</b> said this is not the same rock: "{o.body}"
                                        </div>
                                    ))}
                                </div>
                            )}
                            {canEdit && !req.objections.some(o => o.user_id === user?.id) && (
                                <div className="flex gap-2 pl-[26px]">
                                    <input
                                        value={objectionDrafts[req.id] ?? ''}
                                        onChange={e => setObjectionDrafts(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        placeholder="Say why this is not the same rock"
                                        className={inputClass}
                                    />
                                    <button
                                        onClick={() => handleObject(req.id)}
                                        disabled={objectingId === req.id}
                                        className="shrink-0 px-3.5 py-2 bg-transparent border border-accent/40 text-accent rounded-[10px] text-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                                    >
                                        This is not the same rock
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="bg-panel border border-border rounded-2xl p-5 flex flex-col gap-3">
                    {isEditing ? (
                        <div className="flex flex-col gap-3">
                            <div>
                                <div className={labelClass}>Name</div>
                                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Most rocks don't have one" className={inputClass} />
                            </div>
                            <div>
                                <div className={labelClass}>Rock type</div>
                                <input value={editRockType} onChange={e => setEditRockType(e.target.value)} placeholder="e.g. andesite, batu kapur" className={inputClass} />
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
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                                <h1 className="font-serif text-2xl font-black text-text">{boulder.name ?? 'Unnamed rock'}</h1>
                                {boulder.rock_type && <div className="text-xs text-text-dim mt-1">{boulder.rock_type}</div>}
                                {boulder.creator_name && <div className="text-xs text-text-dim mt-1">Added by {boulder.creator_name}</div>}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {user && (
                                    <button onClick={() => setShowMergeModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">
                                        <GitCompare size={13} className="shrink-0" /> Same rock as...
                                    </button>
                                )}
                                {canEdit && (
                                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-border rounded-lg text-text-dim text-xs cursor-pointer">
                                        <Pencil size={13} className="shrink-0" /> Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    {boulder.image_urls.length === 0 ? (
                        <div className="rounded-2xl bg-surface border border-dashed border-text-faint flex flex-col items-center justify-center gap-2 py-10">
                            <Layers size={24} className="shrink-0 text-text-faint" />
                            <div className="text-sm text-text-dim">No photo yet</div>
                        </div>
                    ) : (
                        boulder.image_urls.map(url => (
                            <div key={url} className="relative">
                                <BoulderPhoto url={url} shapes={annotationsByUrl[url] ?? []} />
                                {canEdit && (
                                    <button
                                        onClick={() => handleRemovePhoto(url)}
                                        disabled={removingUrl === url}
                                        className="absolute top-2 right-2 bg-black/60 text-white border-0 rounded-full w-7 h-7 cursor-pointer flex items-center justify-center disabled:opacity-50"
                                        aria-label="Remove photo"
                                    ><X size={14} className="shrink-0" /></button>
                                )}
                            </div>
                        ))
                    )}
                    {canEdit && (
                        <label className={`self-start flex items-center gap-1.5 px-3 py-2 bg-transparent border border-dashed border-text-faint rounded-lg text-text-dim text-xs ${isUploadingPhoto ? 'opacity-50' : 'cursor-pointer'}`}>
                            <Plus size={13} className="shrink-0" /> {isUploadingPhoto ? 'Uploading...' : 'Add a photo'}
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={isUploadingPhoto}
                                className="hidden"
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || [])
                                    e.target.value = ''
                                    handleAddPhotos(files)
                                }}
                            />
                        </label>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-serif text-lg font-black text-text">Problems on this rock</h2>
                        <button
                            onClick={() => navigate(`/map?addToBoulder=${boulder.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-dashed border-text-faint rounded-lg text-text-dim text-xs cursor-pointer"
                        >
                            <Plus size={13} className="shrink-0" /> Add a problem
                        </button>
                    </div>

                    {problems.length === 0 ? (
                        <div className="bg-panel border border-border rounded-2xl p-6 text-center text-sm text-text-dim">
                            No problems yet -- be the first to add one.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {problems.map(p => (
                                <Link key={p.id} to={`/problems/${p.id}`} className="flex items-center justify-between gap-3 bg-panel border border-border rounded-xl px-4 py-3 no-underline">
                                    <span className="font-serif text-sm font-bold text-text">{p.name}</span>
                                    {p.grade && <span className="bg-accent/15 text-accent px-2.5 py-1 rounded-full text-[11px] font-bold">{p.grade}</span>}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showMergeModal && (
                <MergeSuggestModal
                    boulderId={boulder.id}
                    cragId={boulder.crag_id}
                    onClose={() => setShowMergeModal(false)}
                    onSuggested={() => setToast({ message: 'Flagged for review. Thanks for the heads up.', type: 'success', onClose: () => setToast(null) })}
                />
            )}
        </div>
    )
}
