import { useState } from 'react';
import { FEEDBACK_TYPES, type FeedbackType } from '../types/feedback.js';

type FeedbackModalProps = {
    onClose: () => void;
    onSubmit: (data: { type: FeedbackType; message: string; email: string }) => void;
    isSubmitting?: boolean;
    showEmailField: boolean;
};

export default function FeedbackModal({ onClose, onSubmit, isSubmitting = false, showEmailField }: FeedbackModalProps) {
    const [type, setType] = useState<FeedbackType>('feedback');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');

    const activeType = FEEDBACK_TYPES.find(t => t.value === type) ?? FEEDBACK_TYPES[0]!;

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 bg-ink/75 backdrop-blur-sm flex items-center justify-center z-[10001] p-4"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-panel border border-border rounded-[20px] w-full max-w-[420px] max-h-[90dvh] overflow-y-auto font-sans text-text flex flex-col"
            >
                <div className="px-5 py-4 flex justify-between items-center border-b border-border">
                    <h3 className="font-serif text-lg m-0">Send Feedback</h3>
                    <button onClick={onClose} className="bg-transparent border-0 text-text-muted text-[22px] cursor-pointer leading-none">&times;</button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] text-text-muted font-bold">Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as FeedbackType)}
                            className="w-full bg-surface border border-border focus:border-accent rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border cursor-pointer transition-colors"
                        >
                            {FEEDBACK_TYPES.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="text-[12px] text-text-muted bg-surface/60 border border-border rounded-xl p-3 leading-relaxed">
                        {activeType.description}
                    </div>

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Tell us more..."
                        rows={5}
                        className="w-full resize-y bg-surface border border-border rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border"
                    />

                    {showEmailField && (
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email (optional, if you want a reply)"
                            className="w-full bg-surface border border-border rounded-xl p-3 text-text outline-none font-sans text-[13px] box-border"
                        />
                    )}

                    <div className="flex gap-2.5 flex-wrap">
                        <button
                            onClick={onClose}
                            className="flex-[1_1_120px] p-2.5 bg-transparent border border-border rounded-[10px] text-text-muted text-[13px] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSubmit({ type, message: message.trim(), email: email.trim() })}
                            disabled={isSubmitting || !message.trim()}
                            className={`flex-[1_1_120px] p-2.5 bg-accent/15 border border-accent/40 rounded-[10px] text-accent text-[13px] font-bold cursor-pointer ${isSubmitting || !message.trim() ? 'opacity-60' : 'opacity-100'}`}
                        >
                            {isSubmitting ? 'Sending...' : 'Send Feedback'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
