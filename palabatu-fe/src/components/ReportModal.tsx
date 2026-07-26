import { useState } from 'react';

export type ReportTarget =
    | { type: 'comment'; id: string; content: string }
    | { type: 'image'; url: string };

type ReportModalProps = {
    target: ReportTarget;
    onClose: () => void;
    onSubmit: (reason: string) => void;
    isSubmitting?: boolean;
};

export default function ReportModal({ target, onClose, onSubmit, isSubmitting = false }: ReportModalProps) {
    const [reason, setReason] = useState('');

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-ink/75 backdrop-blur-sm flex items-center justify-center z-[10001] p-4"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-panel border border-border rounded-[20px] w-full max-w-[420px] max-h-[90vh] overflow-y-auto font-sans text-text flex flex-col"
            >
                <div className="px-5 py-4 flex justify-between items-center border-b border-border">
                    <h3 className="font-serif text-lg m-0">
                        Report {target.type === 'comment' ? 'Comment' : 'Image'}
                    </h3>
                    <button onClick={onClose} className="bg-transparent border-0 text-text-muted text-[22px] cursor-pointer leading-none">&times;</button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3.5">
                    {target.type === 'comment' ? (
                        <div className="text-[13px] text-text-secondary bg-panel/50 p-3 rounded-xl border border-border leading-[1.4]">
                            {target.content}
                        </div>
                    ) : (
                        <img
                            src={target.url}
                            alt="Reported content"
                            className="w-full max-h-[200px] object-cover rounded-xl border border-border"
                        />
                    )}

                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why are you reporting this? (optional)"
                        rows={3}
                        className="w-full resize-y bg-surface border border-border rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border"
                    />

                    <div className="flex gap-2.5 flex-wrap">
                        <button
                            onClick={onClose}
                            className="flex-[1_1_120px] p-2.5 bg-transparent border border-border rounded-[10px] text-text-muted text-[13px] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit(reason.trim())}
                            disabled={isSubmitting}
                            className={`flex-[1_1_120px] p-2.5 bg-danger/15 border border-danger/40 rounded-[10px] text-danger text-[13px] font-bold cursor-pointer ${isSubmitting ? 'opacity-60' : 'opacity-100'}`}
                        >
                            {isSubmitting ? 'Reporting...' : 'Submit Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
