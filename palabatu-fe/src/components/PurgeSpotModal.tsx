import { useEffect, useState } from 'react'
import { X, AlertTriangle, Download } from 'lucide-react'
import { api } from '../lib/api.js'
import type { CragPurgePreview, CragPurgeRequest, CragPurgeResult, PurgeCounts } from '../types/crag.js'
import type { ErrorResponse } from '../types/apitypes.js'

type Props = {
    cragId: string
    cragName: string
    onClose: () => void
    onPurged: (result: CragPurgeResult) => void
}

// The counts, in the order a person actually cares about them: the rock and
// the climbing first, then other people's contributions, then the
// housekeeping rows they will not have thought about.
const COUNT_ROWS: { key: keyof PurgeCounts; label: string; theirs?: boolean }[] = [
    { key: 'boulders', label: 'rocks' },
    { key: 'problems', label: 'problems' },
    { key: 'pitches', label: 'pitch by pitch details' },
    { key: 'approaches', label: 'ways in mapped' },
    { key: 'lines', label: 'drawn lines', theirs: true },
    { key: 'sends', label: 'logged sends', theirs: true },
    { key: 'high_points', label: 'turned-back records', theirs: true },
    { key: 'comments', label: 'comments', theirs: true },
    { key: 'reports', label: 'pending reports' },
    { key: 'photos', label: 'photos (deleted from storage)' },
]

const saveSnapshot = (name: string, snapshot: unknown) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const slug = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    a.download = 'palabatu-purge-' + slug + '-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
}

// Purging a spot destroys other people's work, so this screen's whole job
// is to make that impossible to do by accident: it shows exactly what dies
// (fetched fresh, never guessed from the page behind it), it offers the
// record as a file before anything happens rather than only after, and it
// asks for the spot's name typed out. The typing is not ceremony, it is the
// difference between an action you chose and a button you hit.
export default function PurgeSpotModal({ cragId, cragName, onClose, onPurged }: Props) {
    const [preview, setPreview] = useState<CragPurgePreview | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [typed, setTyped] = useState('')
    const [savedRecord, setSavedRecord] = useState(false)
    const [isPurging, setIsPurging] = useState(false)
    const [purgeError, setPurgeError] = useState<string | null>(null)

    useEffect(() => {
        api.get<CragPurgePreview | ErrorResponse>('/api/crags/' + cragId + '/purge-preview').then(res => {
            if ('error' in res) { setLoadError(res.error); return }
            setPreview(res)
        })
    }, [cragId])

    const confirmed = typed.trim().toLowerCase() === cragName.trim().toLowerCase()

    const handlePurge = async () => {
        if (!preview || !confirmed) return
        setIsPurging(true)
        setPurgeError(null)
        const body: CragPurgeRequest = { expected: preview.counts }
        const res = await api.post<CragPurgeResult | ErrorResponse>('/api/crags/' + cragId + '/purge', body)
        setIsPurging(false)
        if ('error' in res) { setPurgeError(res.error); return }
        saveSnapshot(cragName, res.snapshot)
        onPurged(res)
    }

    return (
        <div className="fixed inset-0 z-[3000] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label={'Purge ' + cragName}
                onClick={e => e.stopPropagation()}
                className="w-full sm:max-w-[520px] max-h-[92vh] overflow-y-auto bg-panel border border-border rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="shrink-0 text-danger" />
                        <h2 className="font-serif text-xl font-black text-text">Purge {cragName}</h2>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="bg-transparent border-none text-text-muted cursor-pointer p-1">
                        <X size={18} className="shrink-0" />
                    </button>
                </div>

                {loadError && <div className="text-danger text-sm">{loadError}</div>}
                {!preview && !loadError && <div className="text-text-muted text-sm">Checking what is here...</div>}

                {preview && (
                    <>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            This removes the spot and everything on it, for everyone. It cannot be undone.
                        </p>

                        <div className="border border-border rounded-xl overflow-hidden">
                            {COUNT_ROWS.filter(r => preview.counts[r.key] > 0).map(r => (
                                <div key={r.key} className="flex items-center justify-between px-3.5 py-2 border-b border-border last:border-b-0">
                                    <span className={r.theirs ? 'text-xs text-danger' : 'text-xs text-text-muted'}>
                                        {r.label}{r.theirs ? ', not yours' : ''}
                                    </span>
                                    <span className="text-sm text-text font-semibold">{preview.counts[r.key]}</span>
                                </div>
                            ))}
                            {COUNT_ROWS.every(r => preview.counts[r.key] === 0) && (
                                <div className="px-3.5 py-2 text-xs text-text-muted">Nothing on it. A plain delete would do.</div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <button
                                onClick={() => { saveSnapshot(cragName, preview.snapshot); setSavedRecord(true) }}
                                className="w-full p-2.5 bg-white/5 border border-border text-text-secondary rounded-lg text-xs cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                            >
                                <Download size={13} className="shrink-0" />
                                {savedRecord ? 'Record saved. Save it again' : 'Save the record first'}
                            </button>
                            <div className="text-[11px] text-text-muted">
                                A JSON file of every row about to be deleted. It is the only copy that will exist.
                            </div>
                        </div>

                        <div>
                            <div className="text-[11px] text-text-muted tracking-[0.1em] uppercase mb-1.5">
                                Type the name to confirm
                            </div>
                            <input
                                value={typed}
                                onChange={e => setTyped(e.target.value)}
                                placeholder={cragName}
                                aria-label="Type the spot name to confirm"
                                className="w-full bg-surface border border-border rounded-[10px] px-3.5 py-2.5 text-text-secondary font-sans text-sm outline-none"
                            />
                        </div>

                        {purgeError && <div className="text-danger text-xs">{purgeError}</div>}

                        <div className="flex flex-col gap-1.5">
                            <button
                                onClick={handlePurge}
                                disabled={!confirmed || isPurging}
                                className="w-full p-2.5 bg-danger/15 border border-danger/50 text-danger rounded-lg text-sm cursor-pointer hover:bg-danger/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isPurging ? 'Purging...' : 'Purge this spot and everything on it'}
                            </button>
                            <div className="text-[11px] text-text-muted text-center">
                                {confirmed ? 'Everyone who added a problem here will be told.' : 'Type the name above to enable this.'}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
